"""Warbler: frequency analysis + entropy + classic Wordle strategy.

Each turn:
 1. Filter the answer pool by every (guess, feedback) seen so far.
 2. Tiny pools are handled directly (1 word -> play it; 2 -> coin flip).
 3. Shortlist guesses with *frequency analysis*: letters are weighted by how evenly they
    split the pool (a letter in 50% of words is worth more than one in 95%), plus
    positional frequency for green hits, plus a penalty for repeated letters early on.
 4. Re-rank the shortlist by *expected information* (entropy of the feedback
    distribution across the pool), with a bonus for guesses that could themselves win.
    This catches "trap" pools like _IGHT / _ATCH where frequency alone fails.
 5. Hard mode restricts guesses to words still consistent with all hints.
"""
from __future__ import annotations

import math
from collections import Counter

from .feedback import ALL_GREEN, feedback

SHORTLIST = 250
WIN_WEIGHT = 1.0  # bits credited to a guess that might be the answer, scaled by 1/|pool|


class Solver:
    def __init__(self, answers: list[str], guesses: list[str] | None = None, hard: bool = False):
        self.answers = answers
        self.guesses = guesses or answers
        self.hard = hard
        self._memo: dict[tuple, str] = {}

    # -- pool -------------------------------------------------------------------------
    def candidates(self, history: list[tuple[str, int]]) -> list[str]:
        pool = self.answers
        for guess, code in history:
            pool = [w for w in pool if feedback(guess, w) == code]
        return pool

    # -- step 3: frequency analysis -----------------------------------------------------
    @staticmethod
    def _frequency_tables(pool: list[str]):
        n = len(pool)
        letter = Counter(c for w in pool for c in set(w))
        pos = [Counter(w[i] for w in pool) for i in range(5)]
        # 4f(1-f) peaks at f=0.5: rewards letters that split the pool, not just common ones
        info = {c: 4 * (k / n) * (1 - k / n) for c, k in letter.items()}
        return info, pos

    def _frequency_score(self, word: str, info, pos, n: int, early: bool) -> float:
        seen = set()
        score = 0.0
        for i, c in enumerate(word):
            if c not in seen:
                score += info.get(c, 0.0)
                seen.add(c)
            score += 0.35 * pos[i].get(c, 0) / n  # green-hit potential
        if early:
            score -= 0.4 * (5 - len(seen))  # strategy: don't burn early guesses on repeats
        return score

    # -- step 4: entropy ------------------------------------------------------------------
    @staticmethod
    def _entropy(guess: str, pool: list[str]) -> float:
        counts = Counter(feedback(guess, w) for w in pool)
        n = len(pool)
        return -sum(k / n * math.log2(k / n) for k in counts.values())

    # -- choose ---------------------------------------------------------------------------
    def suggest(self, history: list[tuple[str, int]]) -> str:
        key = tuple(history)
        if key in self._memo:
            return self._memo[key]
        pool = self.candidates(history)
        if not pool:
            raise ValueError("no words match those hints; check the feedback you entered")
        move = self._choose(pool, history)
        self._memo[key] = move
        return move

    def _choose(self, pool: list[str], history) -> str:
        n = len(pool)
        if n <= 2:
            return pool[0]
        in_pool = set(pool)
        space = pool if self.hard else self.guesses
        info, pos = self._frequency_tables(pool)
        early = n > 60
        ranked = sorted(space, key=lambda w: -self._frequency_score(w, info, pos, n, early))
        shortlist = set(ranked[:SHORTLIST])
        shortlist.update(pool if n <= SHORTLIST else ())  # candidates always get a shot
        if n <= 12 and not self.hard:  # endgame: consider every splitter word
            shortlist.update(space)

        def value(w: str) -> float:
            return self._entropy(w, pool) + (WIN_WEIGHT / n if w in in_pool else 0.0)

        return max(sorted(shortlist), key=value)  # sorted -> deterministic ties

    def play(self, answer: str, max_turns: int = 10) -> list[str]:
        history: list[tuple[str, int]] = []
        guesses: list[str] = []
        for _ in range(max_turns):
            g = self.suggest(history)
            guesses.append(g)
            code = feedback(g, answer)
            history.append((g, code))
            if code == ALL_GREEN:
                break
        return guesses
