// Reference solutions of the Arena drills (web/drills.js). Server-only: used by the tutor guard and by the test suite.
export const SOLUTIONS = {
  softmax: `import numpy as np

def softmax(x, axis=-1):
    z = x - np.max(x, axis=axis, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=axis, keepdims=True)
`,
  "cross-entropy": `import numpy as np

def cross_entropy(logits, y):
    N = logits.shape[0]
    z = logits - logits.max(axis=1, keepdims=True)
    logp = z - np.log(np.exp(z).sum(axis=1, keepdims=True))
    loss = -logp[np.arange(N), y].mean()
    d = np.exp(logp)
    d[np.arange(N), y] -= 1
    return loss, d / N
`,
  "linear-backward": `import numpy as np

def linear_backward(x, W, b, dout):
    return dout @ W.T, x.T @ dout, dout.sum(axis=0)
`,
  layernorm: `import numpy as np

def layernorm_forward(x, g, b, eps=1e-5):
    mu = x.mean(-1, keepdims=True)
    var = x.var(-1, keepdims=True)
    rstd = 1 / np.sqrt(var + eps)
    xh = (x - mu) * rstd
    return xh * g + b, (xh, rstd, g)

def layernorm_backward(dy, cache):
    xh, rstd, g = cache
    dg = (dy * xh).sum(0)
    db = dy.sum(0)
    dxh = dy * g
    dx = rstd * (dxh - dxh.mean(-1, keepdims=True) - xh * (dxh * xh).mean(-1, keepdims=True))
    return dx, dg, db
`,
  attention: `import numpy as np

def attention(q, k, v):
    B, T, d = q.shape
    att = q @ k.transpose(0, 2, 1) / np.sqrt(d)
    mask = np.triu(np.ones((T, T), dtype=bool), k=1)
    att = np.where(mask, -np.inf, att)
    att = att - att.max(axis=-1, keepdims=True)
    w = np.exp(att)
    w /= w.sum(axis=-1, keepdims=True)
    return w @ v
`,
  mha: `import numpy as np

def mha(x, Wqkv, Wo, n_head):
    B, T, C = x.shape
    hs = C // n_head
    q, k, v = np.split(x @ Wqkv, 3, axis=-1)
    split = lambda t: t.reshape(B, T, n_head, hs).transpose(0, 2, 1, 3)
    q, k, v = split(q), split(k), split(v)
    att = q @ k.transpose(0, 1, 3, 2) / np.sqrt(hs)
    att = np.where(np.triu(np.ones((T, T), dtype=bool), 1), -np.inf, att)
    att = np.exp(att - att.max(-1, keepdims=True))
    att /= att.sum(-1, keepdims=True)
    y = (att @ v).transpose(0, 2, 1, 3).reshape(B, T, C)
    return y @ Wo
`,
  adam: `import numpy as np

def adam_step(p, g, m, v, t, lr=1e-3, b1=0.9, b2=0.999, eps=1e-8):
    m = b1 * m + (1 - b1) * g
    v = b2 * v + (1 - b2) * g * g
    mh = m / (1 - b1 ** t)
    vh = v / (1 - b2 ** t)
    return p - lr * mh / (np.sqrt(vh) + eps), m, v
`,
  bpe: `def _merge(ids, pair, new):
    out, i = [], 0
    while i < len(ids):
        if i + 1 < len(ids) and (ids[i], ids[i + 1]) == pair:
            out.append(new); i += 2
        else:
            out.append(ids[i]); i += 1
    return out

def bpe_train(text, n_merges):
    ids = list(text.encode("utf-8"))
    merges = []
    for i in range(n_merges):
        counts = {}
        for p in zip(ids, ids[1:]):
            counts[p] = counts.get(p, 0) + 1
        if not counts:
            break
        best = max(counts, key=counts.get)
        ids = _merge(ids, best, 256 + i)
        merges.append(best)
    return merges

def bpe_encode(text, merges):
    ids = list(text.encode("utf-8"))
    rank = {tuple(p): i for i, p in enumerate(merges)}
    while len(ids) >= 2:
        pairs = set(zip(ids, ids[1:]))
        best = min(pairs, key=lambda p: rank.get(p, float("inf")))
        if best not in rank:
            break
        ids = _merge(ids, best, 256 + rank[best])
    return ids
`,
  conv2d: `import numpy as np

def conv2d(x, w, stride=1, pad=0):
    N, C, H, W = x.shape
    F, _, kh, kw = w.shape
    xp = np.pad(x, ((0, 0), (0, 0), (pad, pad), (pad, pad)))
    Ho = (H + 2 * pad - kh) // stride + 1
    Wo = (W + 2 * pad - kw) // stride + 1
    out = np.zeros((N, F, Ho, Wo))
    for i in range(kh):
        for j in range(kw):
            patch = xp[:, :, i : i + stride * Ho : stride, j : j + stride * Wo : stride]
            out += np.einsum("nchw,fc->nfhw", patch, w[:, :, i, j])
    return out
`,
  "kv-cache": `import numpy as np

def decode_step(x, Wq, Wk, Wv, cache=None):
    q, k, v = x @ Wq, x @ Wk, x @ Wv
    K = k[None] if cache is None else np.vstack([cache["k"], k])
    V = v[None] if cache is None else np.vstack([cache["v"], v])
    s = K @ q / np.sqrt(q.shape[-1])
    w = np.exp(s - s.max())
    w /= w.sum()
    return w @ V, {"k": K, "v": V}
`,
  "top-p": `import numpy as np

def top_p(logits, p):
    e = np.exp(logits - logits.max())
    probs = e / e.sum()
    order = np.argsort(-probs)
    cum = np.cumsum(probs[order])
    keep = order[: np.searchsorted(cum, p) + 1]
    out = np.zeros_like(probs)
    out[keep] = probs[keep]
    return out / out.sum()
`,
  micrograd: `import math

class Value:
    def __init__(self, data, children=()):
        self.data = data
        self.grad = 0.0
        self._prev = set(children)
        self._backward = lambda: None

    def __add__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data + other.data, (self, other))
        def _b():
            self.grad += out.grad
            other.grad += out.grad
        out._backward = _b
        return out

    def __mul__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data * other.data, (self, other))
        def _b():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = _b
        return out

    def __pow__(self, k):
        out = Value(self.data ** k, (self,))
        def _b():
            self.grad += k * self.data ** (k - 1) * out.grad
        out._backward = _b
        return out

    def tanh(self):
        t = math.tanh(self.data)
        out = Value(t, (self,))
        def _b():
            self.grad += (1 - t * t) * out.grad
        out._backward = _b
        return out

    __radd__ = __add__
    __rmul__ = __mul__
    def __neg__(self): return self * -1
    def __sub__(self, other): return self + (-other)
    def __rsub__(self, other): return other + (-self)

    def backward(self):
        order, seen, stack = [], set(), [(self, False)]
        while stack:
            node, done = stack.pop()
            if done:
                order.append(node); continue
            if node in seen:
                continue
            seen.add(node)
            stack.append((node, True))
            for c in node._prev:
                stack.append((c, False))
        self.grad = 1.0
        for node in reversed(order):
            node._backward()
`
};
