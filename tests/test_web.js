// node tests/test_web.js [limit]  -- sanity check + benchmark of the JS solver
const fs = require("fs");
const { Solver, feedback } = require("../web/solver.js");
const read = (f) => fs.readFileSync(__dirname + "/../data/" + f, "utf8").split(/\s+/).filter((w) => w.length === 5);
const answers = [...new Set(read("answers.txt"))].sort();
const guesses = [...new Set([...answers, ...read("allowed.txt")])].sort();
const fmt = (c) => { let s = ""; for (let i = 0; i < 5; i++) { s = "byg"[c % 3] + s; c = Math.floor(c / 3); } return s; };
const eq = (a, b) => { if (a !== b) throw new Error(a + " != " + b); };
eq(fmt(feedback("speed", "erase")), "ybyyb");
eq(fmt(feedback("geese", "eerie")), "bgybg");
eq(fmt(feedback("allay", "label")), "yyybb");
const limit = +process.argv[2] || 100;
const step = Math.max(1, Math.floor(answers.length / limit));
const solver = new Solver(answers, guesses);
const tally = {}; let total = 0, n = 0; const t0 = Date.now();
for (let i = 0; i < answers.length; i += step) {
  const p = solver.play(answers[i]); const k = p[p.length - 1] === answers[i] ? p.length : 99;
  tally[k] = (tally[k] || 0) + 1; total += k; n++;
}
console.log({ games: n, avg: (total / n).toFixed(3), tally, secs: (Date.now() - t0) / 1000 });
