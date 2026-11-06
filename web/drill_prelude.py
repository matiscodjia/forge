"""Helpers available to every drill test (numpy as np, rng, close, numgrad, ...)."""
import time
import numpy as np


def rng(seed=0):
    return np.random.default_rng(seed)


def _arr(x, what):
    if x is None:
        raise AssertionError(f"{what}: your function returned None")
    try:
        return np.asarray(x, dtype=np.float64)
    except Exception:
        raise AssertionError(f"{what}: expected numbers, got {type(x).__name__}")


def close(got, exp, atol=1e-6, what="result"):
    g, e = _arr(got, what), np.asarray(exp, dtype=np.float64)
    if g.shape != e.shape:
        raise AssertionError(f"{what}: shape {g.shape}, expected {e.shape}")
    if not np.all(np.isfinite(g)):
        raise AssertionError(f"{what}: contains nan or inf")
    if not np.allclose(g, e, atol=atol, rtol=1e-5):
        i = np.unravel_index(np.argmax(np.abs(g - e)), g.shape) if g.ndim else ()
        where = f"[{', '.join(map(str, i))}]" if i else ""
        raise AssertionError(f"{what}{where}: got {g[i]:.6g}, expected {e[i]:.6g}")


def finite(x, what="output"):
    a = _arr(x, what)
    if not np.all(np.isfinite(a)):
        raise AssertionError(f"{what}: contains nan or inf")


def shape(x, want, what="output"):
    a = _arr(x, what)
    if a.shape != tuple(want):
        raise AssertionError(f"{what}: shape {a.shape}, expected {tuple(want)}")


def pair(out, fn, n=2):
    if not isinstance(out, (tuple, list)) or len(out) != n:
        raise AssertionError(f"{fn} must return a tuple of {n} values")
    return out


def numgrad(f, x, eps=1e-6):
    x = np.array(x, dtype=np.float64)
    g = np.zeros_like(x)
    it = np.nditer(x, flags=["multi_index"])
    for _ in it:
        i = it.multi_index
        old = x[i]
        x[i] = old + eps; hi = float(f(x))
        x[i] = old - eps; lo = float(f(x))
        x[i] = old
        g[i] = (hi - lo) / (2 * eps)
    return g


def timed(fn, *a):
    best = float("inf")
    for _ in range(3):
        t = time.perf_counter(); fn(*a); best = min(best, time.perf_counter() - t)
    return best


def calls(fn, *a):
    """Number of function calls (Python and C) made while running fn(*a): a loop over T makes at least T."""
    import sys
    n = [0]
    def prof(frame, event, arg):
        if event in ("call", "c_call"):
            n[0] += 1
    sys.setprofile(prof)
    try:
        fn(*a)
    finally:
        sys.setprofile(None)
    return n[0]
