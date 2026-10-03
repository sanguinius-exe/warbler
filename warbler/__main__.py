import argparse
import statistics
import sys
import time
from collections import Counter

from .feedback import ALL_GREEN, feedback, parse_pattern, pattern_str
from .solver import Solver
from .words import load_words


def load(args):
    answers, guesses, source = load_words()
    if getattr(args, "expanded", False):
        answers = guesses  # any legal word may be the answer
    return answers, guesses, source


def cmd_play(args):
    answers, guesses, source = load(args)
    solver = Solver(answers, guesses, hard=args.hard)
    print(f"warbler | {len(answers)} answers | words: {source}")
    print("Enter what you played and Wordle's colors, e.g. `crane bygbb` (g=green y=yellow b=gray).")
    print("Press enter alone to accept the suggestion and then type just the colors.\n")
    history: list[tuple[str, int]] = []
    while True:
        pool = solver.candidates(history)
        print(f"{len(pool)} possible" + (f": {', '.join(pool[:15])}" if len(pool) <= 15 else ""))
        suggestion = solver.suggest(history)
        print(f"suggest: {suggestion.upper()}")
        try:
            line = input("> ").split()
        except EOFError:
            return
        try:
            if len(line) == 1:
                guess, code = suggestion, parse_pattern(line[0])
            elif len(line) >= 2:
                guess, code = line[0].lower(), parse_pattern("".join(line[1:]))
            else:
                continue
            if len(guess) != 5:
                raise ValueError("guess must be 5 letters")
        except ValueError as e:
            print(e)
            continue
        history.append((guess, code))
        if code == ALL_GREEN:
            print(f"solved in {len(history)}!")
            return
        if not solver.candidates(history):
            print("no words match; check the colors you entered (undoing that turn)")
            history.pop()


def cmd_solve(args):
    answers, guesses, _ = load(args)
    solver = Solver(answers, guesses, hard=args.hard)
    history = []
    for item in args.turns:
        guess, pat = item.split(":")
        history.append((guess.lower(), parse_pattern(pat)))
    pool = solver.candidates(history)
    print(f"{len(pool)} possible: {', '.join(pool[:30])}")
    print("suggest:", solver.suggest(history).upper())


def cmd_simulate(args):
    answers, guesses, source = load(args)
    solver = Solver(answers, guesses, hard=args.hard)
    targets = answers[:: max(1, len(answers) // args.limit)] if args.limit else answers
    print(f"simulating {len(targets)} answers | words: {source}")
    start, tally, worst = time.time(), Counter(), []
    for i, target in enumerate(targets, 1):
        path = solver.play(target)
        n = len(path) if path[-1] == target else 99
        tally[n] += 1
        if n >= 6:
            worst.append((target, path))
        if i % 200 == 0:
            print(f"  {i}/{len(targets)} ({time.time() - start:.0f}s)", file=sys.stderr)
    scores = [k for k, v in tally.items() for _ in range(v)]
    solved = [s for s in scores if s != 99]
    print(f"average guesses: {statistics.mean(solved):.3f} | "
          f"fail (>6): {sum(v for k, v in tally.items() if k > 6)} | time {time.time() - start:.0f}s")
    for k in sorted(tally):
        print(f"  {'fail' if k == 99 else k}: {tally[k]}")
    for target, path in worst[:10]:
        print("  hard:", target, "->", " ".join(path))


def main():
    p = argparse.ArgumentParser(prog="warbler", description="Wordle solver")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn, help_ in [("play", cmd_play, "interactive helper"),
                            ("solve", cmd_solve, "suggest from turns like crane:bygbb"),
                            ("simulate", cmd_simulate, "benchmark against the answer list")]:
        sp = sub.add_parser(name, help=help_)
        sp.add_argument("--hard", action="store_true", help="hard mode: reuse all revealed hints")
        sp.add_argument("--expanded", action="store_true", help="any legal word may be the answer")
        if name == "solve":
            sp.add_argument("turns", nargs="*")
        if name == "simulate":
            sp.add_argument("--limit", type=int, default=0, help="evenly sample N answers")
        sp.set_defaults(fn=fn)
    args = p.parse_args()
    args.fn(args)


main()
