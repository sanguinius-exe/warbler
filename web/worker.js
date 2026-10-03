importScripts("words.js", "solver.js", "search.js");
const { Solver, Search, feedback } = Warbler;
const { answers, allowed } = WARBLER_WORDS;
const guesses = [...answers, ...allowed].sort();
// "classic" = the 2,315 original answers; "all" = every legal word could be the answer.
const pools = { classic: answers, all: guesses };
const solvers = {};
const getSolver = (mode, hard) =>
  (solvers[mode + hard] ||= new Solver(pools[mode], guesses, hard));
const EXACT_MAX = 90; // live exact search when off the precomputed tree and this few words remain

const trees = {};
const loadTree = (mode, hard) => {
  const file = `tree${mode === "all" ? "-all" : ""}${hard ? "-hard" : ""}.json`;
  return (trees[file] ||= fetch(file).then((r) => (r.ok ? r.json() : null)).catch(() => null));
};

// Follow the player's history down the tree. Returns the subtree to play next, or null if off-tree.
function walk(tree, history) {
  let node = tree;
  for (const [g, code] of history) {
    if (!node || (typeof node === "string" ? node : node[0]) !== g) return null;
    if (typeof node === "string" || code === 242) return null;
    node = node[1][code];
  }
  return node || null;
}

// {total, depth} of a subtree for the words still in `pool`: total guesses summed over those
// words (counting the guess at this node) and the longest line.
function stats(node, pool) {
  if (typeof node === "string") return { total: 1, depth: 1 };
  const cells = new Map();
  for (const w of pool) {
    const c = feedback(node[0], w);
    if (c !== 242) (cells.get(c) || cells.set(c, []).get(c)).push(w);
  }
  let total = pool.length, depth = 0;
  for (const [c, cell] of cells) {
    const s = stats(node[1][c], cell);
    total += s.total;
    depth = Math.max(depth, s.depth);
  }
  return { total, depth: depth + 1 };
}

const exactCache = new Map();
function exact(pool, hard) {
  const key = hard + "|" + pool.join(",");
  if (!exactCache.has(key)) {
    const S = new Search(pool, hard ? pool : guesses, { hard });
    const all = S.allPool();
    exactCache.set(key, { S, all, node: S.tree(all, S.solve(all).g) });
  }
  return exactCache.get(key);
}

onmessage = async (e) => {
  try {
    await handle(e.data);
  } catch (err) {
    postMessage({ id: e.data.id, error: String(err && err.stack || err) });
  }
};

async function handle({ id, history, hard, mode = "classic" }) {
  hard = !!hard;
  const solver = getSolver(mode, hard);
  const { pool, ranked } = solver.suggest(history, 5);
  let source = null, optimal = null;

  if (pool.length > 2) {
    const tree = await loadTree(mode, hard);
    let node = tree ? walk(tree.tree, history) : null;
    const small = pool.length <= EXACT_MAX;
    const ex = small ? exact(pool, hard) : null;
    if (node) source = "tree";
    else if (ex) { node = ex.node; source = "search"; }
    if (node) {
      const word = typeof node === "string" ? node : node[0];
      const s = stats(node, pool);
      optimal = { word, expected: s.total / pool.length, worst: s.depth };
      const row = { word, bits: solver.evaluate(word, pool).bits, cost: optimal.expected, candidate: pool.includes(word), optimal: true };
      const rest = ranked.filter((r) => r.word !== word).slice(0, 4);
      for (const r of rest) {
        // exact where cheap; otherwise clamp: nothing can beat the optimal value
        const g = ex ? ex.S.gIndex.get(r.word) : undefined;
        r.cost = g !== undefined ? ex.S.tryGuess(ex.all, g) / pool.length : Math.max(r.cost, optimal.expected);
        r.exact = g !== undefined;
      }
      rest.sort((a, b) => a.cost - b.cost);
      ranked.length = 0;
      ranked.push(row, ...rest);
    }
  }
  postMessage({ id, poolSize: pool.length, pool: pool.length <= 40 ? pool : null, ranked, source, optimal });
}
