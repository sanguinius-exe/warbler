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

## Results

All 2,315 answers, easy mode: **3.465 average guesses**, 0 failures (max 6).

## Word lists

`data/answers.txt` and `data/allowed.txt` come from
https://gist.github.com/cfreshman (wordle-answers-alphabetical / wordle-allowed-guesses).
