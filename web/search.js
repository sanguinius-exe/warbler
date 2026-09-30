// Exact(ish) Wordle search: minimizes the TOTAL number of guesses over a pool of answers.
// Works in Node and in a Web Worker. Used offline to build the decision tree and live as an
// exact endgame solver when the player strays from the tree.
(function (root) {
  const W = typeof require !== "undefined" && typeof module !== "undefined" ? require("./solver.js") : root.Warbler;
  const { feedback, ALL_GREEN } = W;

  // Cheapest conceivable cost of a cell of m words: one guess each, plus one extra guess for all but one.
  const lbCell = (m) => 2 * m - 1;

  class Search {
    // answers: the words that may be the solution (the pool to solve); guesses: every legal guess.
    constructor(answers, guesses, opts = {}) {
      this.A = answers;
      this.G = guesses;
      this.hard = !!opts.hard;
      this.widthFor = opts.widthFor || defaultWidth;
      this.m = answers.length;
      this.F = new Uint8Array(guesses.length * this.m); // F[g*m + a] = feedback of guess g vs answer a
      for (let g = 0; g < guesses.length; g++) {
        const gw = guesses[g], base = g * this.m;
        for (let a = 0; a < this.m; a++) this.F[base + a] = feedback(gw, answers[a]);
      }
      const index = new Map(guesses.map((w, i) => [w, i]));
      this.gOfA = answers.map((w) => index.get(w));
      this.gIndex = index;
      this.memo = new Map();   // pool key -> {total, g}
      this.floor = new Map();  // pool key -> proven lower bound on total (after a failed bounded search)
      this.cnt = new Int32Array(243);
      this.nodes = 0;
    }

    allPool() { return Int32Array.from({ length: this.m }, (_, i) => i); }

    partition(pool, g) {
      const cells = new Map(), base = g * this.m;
      for (let i = 0; i < pool.length; i++) {
        const code = this.F[base + pool[i]];
        let c = cells.get(code);
        if (!c) cells.set(code, (c = []));
        c.push(pool[i]);
      }
      return cells;
    }

    // Total guesses for playing g now against this pool, then playing optimally. Infinity if >= limit.
    tryGuess(pool, g, limit = Infinity) {
      const n = pool.length;
      const cells = this.partition(pool, g);
      let lbRest = 0;
      const list = [];
      for (const [code, cell] of cells) {
        if (code === ALL_GREEN) continue;
        lbRest += lbCell(cell.length);
        list.push(cell);
      }
      if (n + lbRest >= limit) return Infinity;
      list.sort((x, y) => x.length - y.length); // cheap cells first: tightens the bound early
      let total = n;
      for (const cell of list) {
        lbRest -= lbCell(cell.length);
        const r = this.solve(Int32Array.from(cell), limit - total - lbRest);
        if (r.total === Infinity) return Infinity;
        total += r.total;
        if (total + lbRest >= limit) return Infinity;
      }
      return total;
    }

    // Best {total, g} for the pool, or {total: Infinity} if nothing beats `limit`.
    solve(pool, limit = Infinity) {
      const n = pool.length;
      if (n === 1) return { total: 1, g: this.gOfA[pool[0]] };
      if (n === 2) return { total: 3, g: this.gOfA[pool[0]] };
      const key = pool.join(",");
      const hit = this.memo.get(key);
      if (hit) return hit.total < limit ? hit : { total: Infinity };
      if ((this.floor.get(key) || 0) >= limit) return { total: Infinity };
      this.nodes++;

      const cands = this.candidates(pool);
      let best = { total: limit, g: -1 };
      for (const g of cands) {
        const t = this.tryGuess(pool, g, best.total);
        if (t < best.total) best = { total: t, g };
      }
      if (best.g === -1) {
        this.floor.set(key, Math.max(this.floor.get(key) || 0, limit));
        return { total: Infinity };
      }
      this.memo.set(key, best);
      return best;
    }

    // Ordered guesses worth trying: all pool members + the best splitters among the rest.
    candidates(pool) {
      const n = pool.length, m = this.m, F = this.F, cnt = this.cnt;
      const inPool = new Set();
      for (let i = 0; i < n; i++) inPool.add(this.gOfA[pool[i]]);
      if (this.hard) return [...inPool].sort((a, b) => this.ssq(pool, a) - this.ssq(pool, b));
      const width = this.widthFor(n);
      const scored = [];
      const full = this.G.length;
      for (let g = 0; g < full; g++) {
        const base = g * m;
        let ssq = 0;
        for (let i = 0; i < n; i++) { const f = F[base + pool[i]]; ssq += 2 * cnt[f]++ + 1; }
        for (let i = 0; i < n; i++) cnt[F[base + pool[i]]] = 0;
        // members get a small edge: they can end the game immediately
        scored.push([ssq - (inPool.has(g) ? 1 : 0), g]);
      }
      scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const out = [], seen = new Set();
      for (const [, g] of scored) {
        if (out.length >= width) break;
        out.push(g); seen.add(g);
      }
      if (n <= 40) for (const g of inPool) if (!seen.has(g)) out.push(g); // always consider every real answer
      return out;
    }

    ssq(pool, g) {
      const cnt = this.cnt, base = g * this.m;
      let s = 0;
      for (let i = 0; i < pool.length; i++) s += 2 * cnt[this.F[base + pool[i]]]++ + 1;
      for (let i = 0; i < pool.length; i++) cnt[this.F[base + pool[i]]] = 0;
      return s;
    }

    // Nested decision tree for a pool: [guessWord, {code: child}], with a bare string meaning
    // "this is the only word left: play it".
    tree(pool, g) {
      if (pool.length === 1) return this.A[pool[0]];
      if (g === undefined) g = this.solve(pool).g;
      const kids = {};
      for (const [code, cell] of this.partition(pool, g)) {
        if (code === ALL_GREEN) continue;
        const p = Int32Array.from(cell);
        kids[code] = cell.length === 1 ? this.A[cell[0]] : this.tree(p, this.solve(p).g);
      }
      return [this.G[g], kids];
    }
  }

  // How many non-answer splitters to consider, by pool size. Wider = closer to optimal, slower.
  const SCALE = (typeof process !== "undefined" && +process.env.WARBLER_WIDTH) || 1;
  function defaultWidth(n) {
    const base = n > 600 ? 10 : n > 150 ? 14 : n > 40 ? 24 : 60;
    return Math.round(base * SCALE);
  }

  const api = { Search };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root.Warbler, api);
})(typeof self !== "undefined" ? self : globalThis);
