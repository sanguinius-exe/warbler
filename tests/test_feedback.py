from warbler import Solver, feedback, parse_pattern, pattern_str


def fb(g, a):
    return pattern_str(feedback(g, a))


def test_basic():
    assert fb("crane", "crane") == "ggggg"
    assert fb("crane", "pilot") == "bbbbb"


def test_duplicate_letters():
    assert fb("speed", "erase") == "ybyyb"  # answer has two e's: both guess e's are yellow
    assert fb("geese", "eerie") == "bgybg"  # greens claim e's first; one e left for yellow
    assert fb("allay", "label") == "yyybb"  # second a gets nothing: answer has one a


def test_pattern_roundtrip():
    assert pattern_str(parse_pattern("gybbg")) == "gybbg"
    assert parse_pattern("20012") == parse_pattern("gbbyg")


def test_solver_solves_every_word():
    words = ["crane", "slate", "trace", "crate", "grace", "brace", "stale", "share", "shale", "whale"]
    solver = Solver(words)
    for w in words:
        assert solver.play(w)[-1] == w
