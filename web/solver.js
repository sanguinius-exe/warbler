// Warbler solver (JS port of warbler/solver.py). Works in a Worker or Node.
(function (root) {
  const ALL_GREEN = 242;
  const SHORTLIST = 250;
  const WIN_WEIGHT = 1.0;
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
    constructor(answers, guesses, hard = false) {
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

    entropy(guess, pool) {
      const counts = new Int32Array(243);
      for (const w of pool) counts[feedback(guess, w)]++;
      const n = pool.length;
      let h = 0;
      for (let k = 0; k < 243; k++) if (counts[k]) { const p = counts[k] / n; h -= p * Math.log2(p); }
      return h;
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
      if (n <= 2) return pool.map((w) => ({ word: w, bits: n === 1 ? 0 : 1, candidate: true }));
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
        const bits = this.entropy(w, pool);
        const candidate = inPool.has(w);
        rows.push({ word: w, bits, candidate, value: bits + (candidate ? WIN_WEIGHT / n : 0) });
      }
      rows.sort((a, b) => b.value - a.value || (a.word < b.word ? -1 : 1));
      return rows.slice(0, top);
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
