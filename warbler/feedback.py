"""Wordle feedback: 0 = gray, 1 = yellow, 2 = green, packed base-3 into an int."""

ALL_GREEN = 242  # ggggg


def feedback(guess: str, answer: str) -> int:
    """Score `guess` against `answer`, handling duplicate letters like Wordle does."""
    result = [0] * 5
    remaining: dict[str, int] = {}
    for i in range(5):
        if guess[i] == answer[i]:
            result[i] = 2
        else:
            remaining[answer[i]] = remaining.get(answer[i], 0) + 1
    for i in range(5):
        if result[i] == 0 and remaining.get(guess[i], 0) > 0:
            result[i] = 1
            remaining[guess[i]] -= 1
    code = 0
    for r in result:
        code = code * 3 + r
    return code


def parse_pattern(text: str) -> int:
    """Parse 'gybbg' / 'GYBBG' / '20012' / 'g y - - g' (g=green, y=yellow, b/-/x/.=gray)."""
    symbols = [c for c in text.lower() if not c.isspace()]
    table = {"g": 2, "2": 2, "y": 1, "1": 1, "b": 0, "x": 0, "-": 0, ".": 0, "0": 0, "_": 0}
    if len(symbols) != 5 or any(c not in table for c in symbols):
        raise ValueError(f"bad pattern {text!r}: expected 5 of g/y/b (green/yellow/gray)")
    code = 0
    for c in symbols:
        code = code * 3 + table[c]
    return code


def pattern_str(code: int) -> str:
    out = []
    for _ in range(5):
        out.append("byg"[code % 3])
        code //= 3
    return "".join(reversed(out))
