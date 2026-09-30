"""Word list loading.

Put the official lists in data/answers.txt (possible solutions) and data/allowed.txt
(extra valid guesses), one lowercase word per line. Without them we fall back to the
system dictionary, which contains many obscure words Wordle would never pick.
"""
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SYSTEM_DICT = Path("/usr/share/dict/words")
FIVE = re.compile(r"^[a-z]{5}$")


def _read(path: Path) -> list[str]:
    return sorted({w.strip() for w in path.read_text().split() if FIVE.match(w.strip())})


def load_words() -> tuple[list[str], list[str], str]:
    """Return (answers, guesses, source). `guesses` is a superset of `answers`."""
    answers_file, allowed_file = DATA_DIR / "answers.txt", DATA_DIR / "allowed.txt"
    if answers_file.exists():
        answers = _read(answers_file)
        extra = _read(allowed_file) if allowed_file.exists() else []
        return answers, sorted(set(answers) | set(extra)), "data/"
    if SYSTEM_DICT.exists():
        words = _read(SYSTEM_DICT)
        return words, words, "system dictionary (noisy; add data/answers.txt for real Wordle lists)"
    raise FileNotFoundError("no word list found: add data/answers.txt")
