// Warbler solver (JS port of warbler/solver.py). Works in a Worker or Node.
(function (root) {
  const ALL_GREEN = 242;
  const SHORTLIST = 250;
  const WIN_WEIGHT = 1.0;
  // Rough guesses still needed to finish from a cell of m equally likely words.
  const LOGB = Math.log(6);
  const need = (m) => (m <= 1 ? 1 : m === 2 ? 1.5 : 1 + Math.log(m) / LOGB);
  const scratch = new Int8Array(26);
  const res = [0, 0, 0, 0, 0];

  // 0 gray, 1 yellow, 2 green, packed base-3 (same encoding as the Python version).
  function feedback(g, a) {
    scratch.fill(0);
    for (let i = 0; i < 5; i++) {
      if (g.charCodeAt(i) === a.charCodeAt(i)) res[i] = 2;
      else { res[i] = 0; scratch[a.charCodeAt(i) - 97]++; }
    }
    for (let i = 0; i < 5; i++) {
      if (res[i] === 0) {
        const c = g.charCodeAt(i) - 97;
        if (scratch[c] > 0) { res[i] = 1; scratch[c]--; }
      }
    }
    return res[0] * 81 + res[1] * 27 + res[2] * 9 + res[3] * 3 + res[4];
  }

  class Solver {
    constructor(answers, guesses, hard = false, scoring = "cost") {
      this.scoring = scoring;
      this.answers = answers;
      this.guesses = guesses || answers;
      this.hard = hard;
      this.memo = new Map();
    }

    candidates(history) {
      let pool = this.answers;
      for (const [g, code] of history) pool = pool.filter((w) => feedback(g, w) === code);
      return pool;
    }

    frequencyTables(pool) {
      const n = pool.length;
      const letter = new Float64Array(26);
      const pos = Array.from({ length: 5 }, () => new Float64Array(26));
      for (const w of pool) {
        let seen = 0;
        for (let i = 0; i < 5; i++) {
          const c = w.charCodeAt(i) - 97;
          pos[i][c]++;
          if (!(seen & (1 << c))) { letter[c]++; seen |= 1 << c; }
        }
      }
      const info = new Float64Array(26);
      for (let c = 0; c < 26; c++) info[c] = 4 * (letter[c] / n) * (1 - letter[c] / n);
      return { info, pos };
    }

    frequencyScore(word, t, n, early) {
      let seen = 0, uniq = 0, score = 0;
      for (let i = 0; i < 5; i++) {
        const c = word.charCodeAt(i) - 97;
        if (!(seen & (1 << c))) { score += t.info[c]; seen |= 1 << c; uniq++; }
        score += 0.35 * t.pos[i][c] / n;
      }
      if (early) score -= 0.4 * (5 - uniq);
      return score;
    }

    // Returns {bits, cost}: entropy of the feedback split, and expected total guesses
    // (this guess + guesses needed to finish from whichever cell the feedback lands in).
    evaluate(guess, pool) {
      const counts = new Int32Array(243);
      for (const w of pool) counts[feedback(guess, w)]++;
      const n = pool.length;
      let bits = 0, cost = 1;
      for (let k = 0; k < 243; k++) {
        const c = counts[k];
        if (!c) continue;
        const p = c / n;
        bits -= p * Math.log2(p);
        if (k !== ALL_GREEN) cost += p * need(c);
      }
      return { bits, cost };
    }

    // Returns { pool, ranked: [{word, bits, candidate}] } best-first.
    suggest(history, top = 5) {
      const key = JSON.stringify(history) + "|" + top;
      if (this.memo.has(key)) return this.memo.get(key);
      const pool = this.candidates(history);
      let out;
      if (pool.length === 0) out = { pool, ranked: [] };
      else out = { pool, ranked: this.choose(pool, top) };
      this.memo.set(key, out);
      return out;
    }

    choose(pool, top) {
      const n = pool.length;
      if (n <= 2) return pool.map((w) => ({ word: w, bits: n === 1 ? 0 : 1, cost: n === 1 ? 1 : 1.5, candidate: true }));
      const inPool = new Set(pool);
      const space = this.hard ? pool : this.guesses;
      const t = this.frequencyTables(pool);
      const early = n > 60;
      const scored = space.map((w) => [this.frequencyScore(w, t, n, early), w]);
      scored.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1));
      const short = new Set(scored.slice(0, SHORTLIST).map((s) => s[1]));
      if (n <= SHORTLIST) for (const w of pool) short.add(w);
      if (n <= 12 && !this.hard) for (const w of space) short.add(w);
      const rows = [];
      for (const w of [...short].sort()) {
        const { bits, cost } = this.evaluate(w, pool);
        const candidate = inPool.has(w);
        const value = this.scoring === "cost" ? -cost : bits + (candidate ? WIN_WEIGHT / n : 0);
        rows.push({ word: w, bits, cost, candidate, value });
      }
      rows.sort((a, b) => b.value - a.value || (a.word < b.word ? -1 : 1));
      const out = rows.slice(0, top);
      if (top > 1 && !out.some((r) => r.candidate)) {
        const best = rows.find((r) => r.candidate);
        if (best) out[out.length - 1] = best; // always offer a guess that could win outright
      }
      return out;
    }

    play(answer, maxTurns = 10) {
      const history = [], guesses = [];
      for (let i = 0; i < maxTurns; i++) {
        const g = this.suggest(history, 1).ranked[0].word;
        guesses.push(g);
        const code = feedback(g, answer);
        history.push([g, code]);
        if (code === ALL_GREEN) break;
      }
      return guesses;
    }
  }

  const api = { Solver, feedback, ALL_GREEN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Warbler = api;
})(typeof self !== "undefined" ? self : globalThis);
