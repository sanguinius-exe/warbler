# warbler

A Wordle solver that blends frequency analysis with classic Wordle strategy.

Each turn it filters the answer pool by all feedback so far, shortlists guesses using
split-weighted letter and positional frequencies (penalizing repeated letters early), then
re-ranks the shortlist by expected information (entropy), favoring guesses that could win.
Endgames consider every splitter word, which handles traps like `_IGHT`.

```
python3 -m warbler play                 # interactive: type `crane bygbb` (g/y/b) each turn
python3 -m warbler solve crane:bygbb    # one-shot suggestion
python3 -m warbler simulate --limit 200 # benchmark; add --hard for hard mode
```

Word lists: put `answers.txt` and `allowed.txt` (one lowercase word per line) in `data/`.
Without them it falls back to the noisy system dictionary.

## Web app

`web/` is a static, offline-capable PWA (no backend): the solver is ported to JavaScript and runs in a Web Worker.

```
python3 -m http.server --directory web   # then open http://localhost:8000
node tests/test_web.js 200               # benchmark the JS solver
python3 scripts/build_words.py           # regenerate web/words.js from data/
```

`.github/workflows/pages.yml` deploys `web/` to GitHub Pages on every push to `main`
(enable it under Settings -> Pages -> Source: GitHub Actions).

## Results (all 2,315 answers)

| Solver | Average guesses | Worst |
|---|---|---|
| Heuristic (frequency shortlist + expected-guesses ranking) | 3.465 | 6 |
| **Precomputed tree (`web/tree.json`), opener SALET** | **3.4212** | **5** |
| Hard mode tree (`web/tree-hard.json`) | 3.5175 | 7 |

### Expanded list: any legal word may be the answer (12,972 words)

| Solver | Average guesses | Worst |
|---|---|---|
| Tree (`web/tree-all.json`), opener TARES | 4.0603 | 7 |
| Hard mode tree (`web/tree-all-hard.json`), opener SALET | 4.4135 | 15 |

Every word is treated as equally likely, so these averages are higher than the classic list's. Hard mode
has a long tail because a pool like `_ILLS` can only be walked one word at a time. Pick the list in the
app's dropdown, or use `--expanded` on the CLI.

The published optimum for the classic list is about 3.420, so the tree is within roughly 0.001 of optimal.

## How the optimal play works

`web/search.js` minimizes the *total* number of guesses over a pool of answers. For each pool it ranks
every legal guess by how evenly it splits the pool (frequency-style shortlist), then recursively solves
each resulting feedback cell, pruning with a lower bound (`2m-1` guesses for a cell of m words) and
memoizing pools. A precomputed feedback table makes scoring a lookup.

- `scripts/build_tree.js` runs it offline from the full answer list, tries several openers, verifies the
  tree by replaying every answer, and writes `web/tree.json` / `web/tree-hard.json` (about 34 KB each).
  Regenerate with `WARBLER_WIDTH=3 node scripts/build_tree.js [--hard]` (about 90 s). Add `--expanded`
  for the 12,972-word trees; that needs a 168 MB feedback table and takes about 6 minutes per
  opener normally, or 10+ minutes per opener in hard mode (`node --max-old-space-size=8000`).
- The web app follows the tree while you play its suggestions. If you deviate and 90 or fewer answers
  remain, it solves that position exactly in the browser; otherwise it uses the heuristic solver.
- `node tests/test_tree.js` replays every answer through both trees.

The Python package is the heuristic reference implementation; the exact search lives in JavaScript.

## Word lists

`data/answers.txt` and `data/allowed.txt` come from
https://gist.github.com/cfreshman (wordle-answers-alphabetical / wordle-allowed-guesses).
