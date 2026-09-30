"""Regenerate web/words.js from data/answers.txt and data/allowed.txt."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
read = lambda n: sorted({w for w in (root / "data" / n).read_text().split() if len(w) == 5})
answers = read("answers.txt")
allowed = sorted(set(read("allowed.txt")) - set(answers))
(root / "web" / "words.js").write_text(
    "self.WARBLER_WORDS=" + json.dumps({"answers": answers, "allowed": allowed}, separators=(",", ":")) + ";\n"
)
print(len(answers), len(allowed))
