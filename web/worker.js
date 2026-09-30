importScripts("words.js", "solver.js");
const { Solver } = Warbler;
const { answers, allowed } = WARBLER_WORDS;
const guesses = [...answers, ...allowed].sort();
const solvers = { easy: new Solver(answers, guesses, false), hard: new Solver(answers, guesses, true) };

onmessage = (e) => {
  const { id, history, hard } = e.data;
  const { pool, ranked } = solvers[hard ? "hard" : "easy"].suggest(history, 5);
  postMessage({ id, poolSize: pool.length, pool: pool.length <= 40 ? pool : null, ranked });
};
