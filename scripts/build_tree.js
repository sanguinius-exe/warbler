// node scripts/build_tree.js [--hard] [--expanded] [--openers salet,crate,...]
// --expanded treats every legal guess (not just the classic 2,315 answers) as a possible answer.
// Searches for the opener + reply strategy that minimizes average guesses and writes
// web/tree.json (or web/tree-hard.json): a complete decision tree over every possible answer.
const fs = require("fs");
const path = require("path");
const { Search } = require("../web/search.js");
const { feedback } = require("../web/solver.js");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, "data", f), "utf8").split(/\s+/).filter((w) => w.length === 5);
const classic = [...new Set(read("answers.txt"))].sort();
const guesses = [...new Set([...classic, ...read("allowed.txt")])].sort();
const expanded = process.argv.includes("--expanded");
const answers = expanded ? guesses : classic;
const hard = process.argv.includes("--hard");
const oi = process.argv.indexOf("--openers");
const defaults = expanded
  ? ["tares", "lares", "rales", "rates", "salet", "reast", "soare", "arose", "raise", "tales", "serai", "aesir", "crane", "slate", "trace"]
  : ["salet", "reast", "crate", "trace", "slate", "crane", "soare", "roate", "raise", "arise", "stare", "least", "slane", "trape"];
const openers = (oi > 0 ? process.argv[oi + 1].split(",") : defaults).filter((w) => guesses.includes(w));

const t0 = Date.now();
const log = (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
log(`building ${expanded ? "expanded " : ""}${hard ? "hard" : "normal"}-mode feedback table (${guesses.length} x ${answers.length})`);
const S = new Search(answers, guesses, { hard });
const pool = S.allPool();

let best = null;
for (const o of openers) {
  const g = S.gIndex.get(o);
  const total = S.tryGuess(pool, g, best ? best.total + 1 : Infinity);
  log(`opener ${o}: ${total === Infinity ? "(worse)" : (total / answers.length).toFixed(4)} avg | memo ${S.memo.size}`);
  if (total < (best ? best.total : Infinity) || (total !== Infinity && !best)) best = { o, g, total };
}
log(`best opener ${best.o}: ${(best.total / answers.length).toFixed(4)} average guesses`);

const tree = S.tree(pool, best.g);

// Verify by actually walking the tree for every answer.
const dist = {};
let sum = 0;
for (const a of answers) {
  let node = tree, n = 0;
  for (;;) {
    const g = typeof node === "string" ? node : node[0];
    n++;
    const code = feedback(g, a);
    if (code === 242) break;
    node = node[1][code];
    if (node === undefined) throw new Error("tree dead end for " + a);
  }
  dist[n] = (dist[n] || 0) + 1;
  sum += n;
}
const out = path.join(root, "web", `tree${expanded ? "-all" : ""}${hard ? "-hard" : ""}.json`);
fs.writeFileSync(out, JSON.stringify({ opener: best.o, avg: +(sum / answers.length).toFixed(4), dist, tree }));
log(`verified avg ${(sum / answers.length).toFixed(4)}`, JSON.stringify(dist), `-> ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
