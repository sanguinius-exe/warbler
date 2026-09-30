// node tests/test_tree.js  -- every answer must be solvable by walking each precomputed tree
const fs = require("fs");
const { feedback } = require("../web/solver.js");
const { Search } = require("../web/search.js");
const read = (f) => fs.readFileSync(__dirname + "/../data/" + f, "utf8").split(/\s+/).filter((w) => w.length === 5);
const answers = [...new Set(read("answers.txt"))].sort();
const guesses = [...new Set([...answers, ...read("allowed.txt")])].sort();
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };

for (const [file, maxAvg, maxGuesses, hard] of [["tree.json", 3.43, 5, false], ["tree-hard.json", 3.53, 7, true]]) {
  const { tree } = JSON.parse(fs.readFileSync(__dirname + "/../web/" + file));
  let sum = 0, worst = 0;
  for (const a of answers) {
    let node = tree, n = 0, pool = answers;
    for (;;) {
      const g = typeof node === "string" ? node : node[0];
      ok(guesses.includes(g), `${file}: ${g} is not a legal guess`);
      if (hard && n > 0) ok(pool.includes(g), `${file}: hard-mode violation ${g} for ${a}`);
      n++;
      const code = feedback(g, a);
      if (code === 242) break;
      pool = pool.filter((w) => feedback(g, w) === code);
      node = node[1][code];
      ok(node !== undefined && n < 10, `${file}: dead end for ${a}`);
    }
    sum += n; worst = Math.max(worst, n);
  }
  const avg = sum / answers.length;
  console.log(file, "avg", avg.toFixed(4), "worst", worst);
  ok(avg <= maxAvg && worst <= maxGuesses, `${file}: avg ${avg} / worst ${worst} out of bounds`);
}

// Exact search sanity: 3 words where one guess separates the rest -> total 1+2+2 = 5
const S = new Search(["crane", "crate", "grace"], guesses);
ok(S.solve(S.allPool()).total <= 6, "search on tiny pool");
console.log("all tree tests passed");
