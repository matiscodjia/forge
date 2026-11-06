/* Forge — Arena drills: rebuild the core pieces of modern ML from a blank file, tested in real Python (numpy).
   Each test is a Python function `test_*(u)` where `u` holds your definitions; its docstring is the label.
   Reference solutions live on the server only (tutor guard + test suite), never in the browser. */
(function () {
const D = [];
const add = (o) => D.push(o);

add({ id: "softmax", lvl: 1, track: "ml", title: "Stable softmax", fns: ["softmax"],
  desc: `Write <code>softmax(x, axis=-1)</code> for an array of any shape. It must not overflow for large inputs.`,
  starter: String.raw`import numpy as np

def softmax(x, axis=-1):
    # x: float array of any shape. Return probabilities along axis.
    pass
`,
  tests: String.raw`
def test_sum(u):
    """rows sum to 1"""
    x = rng(0).normal(size=(4, 7))
    close(np.sum(u.softmax(x), axis=-1), np.ones(4), what="row sums")

def test_ref(u):
    """matches the definition"""
    x = rng(1).normal(size=(3, 5))
    e = np.exp(x)
    close(u.softmax(x), e / e.sum(-1, keepdims=True))

def test_axis(u):
    """respects axis=0"""
    x = rng(2).normal(size=(6, 2))
    e = np.exp(x)
    close(u.softmax(x, axis=0), e / e.sum(0, keepdims=True))

def test_large(u):
    """stable for logits around 1000"""
    p = u.softmax(np.array([[1000.0, 1001.0, 1002.0]]))
    finite(p)
    e = np.exp(np.array([0.0, 1.0, 2.0]))
    close(p, (e / e.sum())[None], what="softmax([1000, 1001, 1002])")
` });

add({ id: "cross-entropy", lvl: 2, track: "ml", title: "Cross-entropy and its gradient", fns: ["cross_entropy"],
  desc: `Write <code>cross_entropy(logits, y)</code>: <code>logits</code> is <code>(N, C)</code>, <code>y</code> holds <code>N</code> class indices. Return <code>(loss, dlogits)</code> where <code>loss</code> is the mean negative log-likelihood and <code>dlogits</code> its gradient. Derive the gradient by hand, then check it.`,
  starter: String.raw`import numpy as np

def cross_entropy(logits, y):
    # logits: (N, C), y: (N,) ints. Return (mean loss, dloss/dlogits).
    pass
`,
  tests: String.raw`
def _data(seed=0, N=5, C=4):
    r = rng(seed)
    return r.normal(size=(N, C)), r.integers(0, C, size=N)

def test_loss(u):
    """loss matches -mean(log softmax[y])"""
    x, y = _data()
    loss, _ = pair(u.cross_entropy(x, y), "cross_entropy")
    p = np.exp(x) / np.exp(x).sum(1, keepdims=True)
    close(loss, -np.log(p[np.arange(len(y)), y]).mean(), what="loss")

def test_grad(u):
    """gradient matches finite differences"""
    x, y = _data(1)
    _, d = pair(u.cross_entropy(x, y), "cross_entropy")
    close(d, numgrad(lambda z: u.cross_entropy(z, y)[0], x), atol=1e-5, what="dlogits")

def test_grad_rows(u):
    """each gradient row sums to 0"""
    x, y = _data(2, N=8, C=6)
    _, d = pair(u.cross_entropy(x, y), "cross_entropy")
    close(np.sum(d, axis=1), np.zeros(8), what="row sums of dlogits")

def test_large(u):
    """stable for logits around 1e4"""
    x, y = _data(3)
    loss, d = pair(u.cross_entropy(x * 1e4, y), "cross_entropy")
    finite(loss); finite(d)
` });

add({ id: "linear-backward", lvl: 2, track: "ml", title: "Backprop through a linear layer", fns: ["linear_backward"],
  desc: `The forward pass is <code>out = x @ W + b</code> with <code>x</code> <code>(N, D)</code>, <code>W</code> <code>(D, M)</code>, <code>b</code> <code>(M,)</code>. Given the upstream gradient <code>dout</code> <code>(N, M)</code>, write <code>linear_backward(x, W, b, dout)</code> returning <code>(dx, dW, db)</code>. Check the shapes on paper first.`,
  starter: String.raw`import numpy as np

def linear_backward(x, W, b, dout):
    # out = x @ W + b. Return (dx, dW, db).
    pass
`,
  tests: String.raw`
def _data(seed=0):
    r = rng(seed)
    return r.normal(size=(4, 3)), r.normal(size=(3, 5)), r.normal(size=5), r.normal(size=(4, 5))

def _grads(u, *a):
    g = u.linear_backward(*a)
    if not isinstance(g, (tuple, list)) or len(g) != 3:
        raise AssertionError("return a tuple (dx, dW, db)")
    return g

def test_shapes(u):
    """shapes match x, W and b"""
    x, W, b, do = _data()
    dx, dW, db = _grads(u, x, W, b, do)
    for name, g, ref in (("dx", dx, x), ("dW", dW, W), ("db", db, b)):
        if np.shape(g) != ref.shape:
            raise AssertionError(f"{name}: shape {np.shape(g)}, expected {ref.shape}")

def test_dW(u):
    """dW matches finite differences"""
    x, W, b, do = _data(1)
    close(_grads(u, x, W, b, do)[1], numgrad(lambda w: np.sum((x @ w + b) * do), W), atol=1e-5, what="dW")

def test_dx(u):
    """dx matches finite differences"""
    x, W, b, do = _data(2)
    close(_grads(u, x, W, b, do)[0], numgrad(lambda z: np.sum((z @ W + b) * do), x), atol=1e-5, what="dx")

def test_db(u):
    """db sums over the batch"""
    x, W, b, do = _data(3)
    close(_grads(u, x, W, b, do)[2], do.sum(0), what="db")
` });

add({ id: "layernorm", lvl: 3, track: "ml", title: "LayerNorm, forward and backward", fns: ["layernorm_forward", "layernorm_backward"],
  desc: `Normalize each row of <code>x</code> <code>(N, D)</code> to zero mean and unit variance, then scale by <code>g</code> and shift by <code>b</code>. <code>layernorm_forward(x, g, b, eps=1e-5)</code> returns <code>(y, cache)</code>; <code>layernorm_backward(dy, cache)</code> returns <code>(dx, dg, db)</code>. The backward pass is the hard part: derive <code>dx</code> without autograd.`,
  starter: String.raw`import numpy as np

def layernorm_forward(x, g, b, eps=1e-5):
    # x: (N, D), g and b: (D,). Return (y, cache).
    pass

def layernorm_backward(dy, cache):
    # Return (dx, dg, db).
    pass
`,
  tests: String.raw`
def _data(seed=0, N=4, D=6):
    r = rng(seed)
    return r.normal(size=(N, D)) * 3 + 1, r.normal(size=D), r.normal(size=D), r.normal(size=(N, D))

def _ref(x, g, b, eps=1e-5):
    return (x - x.mean(-1, keepdims=True)) / np.sqrt(x.var(-1, keepdims=True) + eps) * g + b

def _fwd(u, *a):
    out = u.layernorm_forward(*a)
    if not isinstance(out, (tuple, list)) or len(out) != 2:
        raise AssertionError("layernorm_forward must return (y, cache)")
    return out

def test_forward(u):
    """forward matches the definition"""
    x, g, b, _ = _data()
    close(_fwd(u, x, g, b)[0], _ref(x, g, b), atol=1e-6, what="y")

def test_stats(u):
    """with g=1, b=0 rows have mean 0 and std 1"""
    x, _, _, _ = _data(1)
    y = _fwd(u, x, np.ones(6), np.zeros(6))[0]
    close(y.mean(-1), np.zeros(4), atol=1e-6, what="row means")
    close(y.std(-1), np.ones(4), atol=1e-3, what="row std")

def test_dx(u):
    """dx matches finite differences"""
    x, g, b, dy = _data(2)
    dx = pair(u.layernorm_backward(dy, _fwd(u, x, g, b)[1]), "layernorm_backward", 3)[0]
    close(dx, numgrad(lambda z: np.sum(_ref(z, g, b) * dy), x), atol=1e-5, what="dx")

def test_dg_db(u):
    """dg and db match finite differences"""
    x, g, b, dy = _data(3)
    _, dg, db = pair(u.layernorm_backward(dy, _fwd(u, x, g, b)[1]), "layernorm_backward", 3)
    close(dg, numgrad(lambda w: np.sum(_ref(x, w, b) * dy), g), atol=1e-5, what="dg")
    close(db, numgrad(lambda w: np.sum(_ref(x, g, w) * dy), b), atol=1e-5, what="db")
` });

add({ id: "attention", lvl: 3, track: "ml", title: "Causal self-attention", fns: ["attention"],
  desc: `Implement <code>attention(q, k, v)</code> for a batch of sequences, all <code>(B, T, d)</code>. Position <code>t</code> may only attend to positions <code>≤ t</code>. Scale scores by <code>1/√d</code> and keep the softmax stable.`,
  starter: String.raw`import numpy as np

def attention(q, k, v):
    # q, k, v: (B, T, d). Return (B, T, d).
    pass
`,
  tests: String.raw`
def _qkv(seed=0, B=2, T=5, d=4):
    r = rng(seed)
    return r.normal(size=(B, T, d)), r.normal(size=(B, T, d)), r.normal(size=(B, T, d))

def _ref(q, k, v):
    B, T, d = q.shape
    out = np.zeros_like(q)
    for b in range(B):
        for t in range(T):
            s = q[b, t] @ k[b, : t + 1].T / np.sqrt(d)
            w = np.exp(s - s.max()); w /= w.sum()
            out[b, t] = w @ v[b, : t + 1]
    return out

def test_shape(u):
    """shape (B, T, d)"""
    q, k, v = _qkv()
    shape(u.attention(q, k, v), (2, 5, 4))

def test_ref(u):
    """matches the reference, atol 1e-6"""
    q, k, v = _qkv(1)
    close(u.attention(q, k, v), _ref(q, k, v))

def test_causal(u):
    """the future never changes the past"""
    q, k, v = _qkv(2, T=6)
    a = np.asarray(u.attention(q, k, v))
    k2, v2 = k.copy(), v.copy(); k2[:, 3:] += 5; v2[:, 3:] += 5
    close(np.asarray(u.attention(q, k2, v2))[:, :3], a[:, :3], what="outputs 0..2 after changing tokens 3..5")

def test_large(u):
    """stable for large scores"""
    q, k, v = _qkv(3)
    finite(u.attention(q * 1e3, k, v))

def test_vectorized(u):
    """no Python loop over T"""
    q, k, v = _qkv(4, B=1, T=200, d=8)
    close(u.attention(q[:, :20], k[:, :20], v[:, :20]), _ref(q[:, :20], k[:, :20], v[:, :20]), what="output on T = 20")
    n = calls(u.attention, q, k, v)
    if n >= 200:
        raise AssertionError(f"{n} function calls for T = 200: replace the loop with matrix products")
` });

add({ id: "mha", lvl: 3, track: "ml", title: "Multi-head attention", fns: ["mha"],
  desc: `Write <code>mha(x, Wqkv, Wo, n_head)</code>: <code>x</code> is <code>(B, T, C)</code>, <code>Wqkv</code> <code>(C, 3C)</code> projects to queries, keys and values (in that order), heads split <code>C</code> into <code>n_head</code> blocks of <code>C / n_head</code>, attention is causal, and <code>Wo</code> <code>(C, C)</code> projects the concatenated heads back. No loop over heads.`,
  starter: String.raw`import numpy as np

def mha(x, Wqkv, Wo, n_head):
    # x: (B, T, C). Return (B, T, C).
    pass
`,
  tests: String.raw`
def _data(seed=0, B=2, T=5, C=8):
    r = rng(seed)
    return r.normal(size=(B, T, C)), r.normal(size=(C, 3 * C)) / np.sqrt(C), r.normal(size=(C, C)) / np.sqrt(C)

def _ref(x, Wqkv, Wo, H):
    B, T, C = x.shape; hs = C // H
    q, k, v = np.split(x @ Wqkv, 3, axis=-1)
    heads = []
    for h in range(H):
        sl = slice(h * hs, (h + 1) * hs)
        s = q[..., sl] @ k[..., sl].transpose(0, 2, 1) / np.sqrt(hs)
        s = s + np.triu(np.full((T, T), -1e30), 1)
        w = np.exp(s - s.max(-1, keepdims=True)); w /= w.sum(-1, keepdims=True)
        heads.append(w @ v[..., sl])
    return np.concatenate(heads, -1) @ Wo

def test_shape(u):
    """shape (B, T, C)"""
    x, A, O = _data()
    shape(u.mha(x, A, O, 2), (2, 5, 8))

def test_one_head(u):
    """n_head=1 is plain causal attention"""
    x, A, O = _data(1)
    close(u.mha(x, A, O, 1), _ref(x, A, O, 1))

def test_heads(u):
    """matches the reference with 4 heads"""
    x, A, O = _data(2)
    close(u.mha(x, A, O, 4), _ref(x, A, O, 4))

def test_causal(u):
    """the future never changes the past"""
    x, A, O = _data(3, T=6)
    a = np.asarray(u.mha(x, A, O, 2)); x2 = x.copy(); x2[:, 4:] += 3
    close(np.asarray(u.mha(x2, A, O, 2))[:, :4], a[:, :4], what="outputs 0..3")
` });

add({ id: "adam", lvl: 2, track: "ml", title: "Adam, one step", fns: ["adam_step"],
  desc: `Write <code>adam_step(p, g, m, v, t, lr=1e-3, b1=0.9, b2=0.999, eps=1e-8)</code> returning the new <code>(p, m, v)</code>. <code>t</code> is the step number, starting at 1. Don't forget the bias correction.`,
  starter: String.raw`import numpy as np

def adam_step(p, g, m, v, t, lr=1e-3, b1=0.9, b2=0.999, eps=1e-8):
    # Return (p, m, v) after one Adam update.
    pass
`,
  tests: String.raw`
def _ref(p, g, m, v, t, lr=1e-3, b1=0.9, b2=0.999, eps=1e-8):
    m = b1 * m + (1 - b1) * g; v = b2 * v + (1 - b2) * g * g
    return p - lr * (m / (1 - b1 ** t)) / (np.sqrt(v / (1 - b2 ** t)) + eps), m, v

def test_first(u):
    """first step moves each weight by about lr"""
    p = rng(0).normal(size=5); g = rng(1).normal(size=5)
    p1 = pair(u.adam_step(p, g, np.zeros(5), np.zeros(5), 1, lr=0.01), "adam_step", 3)[0]
    close(np.abs(p1 - p), np.full(5, 0.01), atol=1e-6, what="|step|")

def test_three(u):
    """matches the reference over 3 steps"""
    r = rng(2); p = r.normal(size=(3, 2)); m = np.zeros_like(p); v = np.zeros_like(p); P, M, V = p.copy(), m.copy(), v.copy()
    for t in range(1, 4):
        g = r.normal(size=p.shape)
        p, m, v = pair(u.adam_step(p, g, m, v, t), "adam_step", 3)
        P, M, V = _ref(P, g, M, V, t)
    close(p, P, atol=1e-9, what="p"); close(m, M, atol=1e-12, what="m"); close(v, V, atol=1e-12, what="v")

def test_sign(u):
    """steps against the gradient"""
    p = np.zeros(4); g = np.array([1.0, -2.0, 0.5, -0.1])
    p1 = pair(u.adam_step(p, g, np.zeros(4), np.zeros(4), 1), "adam_step", 3)[0]
    close(np.sign(p1), -np.sign(g), what="sign of the step")
` });

add({ id: "bpe", lvl: 3, track: "ml", title: "Byte-pair encoding", fns: ["bpe_train", "bpe_encode"],
  desc: `Train a BPE tokenizer on bytes. <code>bpe_train(text, n_merges)</code> starts from the UTF-8 bytes of <code>text</code>, repeatedly merges the most frequent adjacent pair into a new id (256, 257, …) and returns the list of merged pairs. Ties go to the pair seen first. <code>bpe_encode(text, merges)</code> turns new text into ids with those merges.`,
  starter: String.raw`def bpe_train(text, n_merges):
    # Return [(a, b), ...]: the i-th pair becomes id 256 + i.
    pass

def bpe_encode(text, merges):
    # Return a list of token ids.
    pass
`,
  tests: String.raw`
def _decode(ids, merges):
    vocab = {i: bytes([i]) for i in range(256)}
    for i, (a, b) in enumerate(merges):
        vocab[256 + i] = vocab[a] + vocab[b]
    return b"".join(vocab[i] for i in ids).decode("utf-8")

def test_merges(u):
    """learns the classic example: aaabdaaabac"""
    got = [tuple(m) for m in (u.bpe_train("aaabdaaabac", 3) or [])]
    if got != [(97, 97), (256, 97), (257, 98)]:
        raise AssertionError(f"merges {got}, expected [(97, 97), (256, 97), (257, 98)]")

def test_encode(u):
    """encodes with the learned merges"""
    m = u.bpe_train("aaabdaaabac", 3)
    got = list(u.bpe_encode("aaabdaaabac", m) or [])
    if got != [258, 100, 258, 97, 99]:
        raise AssertionError(f"got {got}, expected [258, 100, 258, 97, 99]")

def test_roundtrip(u):
    """decoding gives the text back, UTF-8 included"""
    text = "le chat mange, l'été arrive : ça chauffe. " * 3
    m = u.bpe_train(text, 20)
    ids = list(u.bpe_encode("l'été, le chat chauffe", m))
    back = _decode(ids, [tuple(x) for x in m])
    if back != "l'été, le chat chauffe":
        raise AssertionError(f"decoded {back!r}")

def test_compresses(u):
    """20 merges shorten the sequence"""
    text = "the cat sat on the mat. the cat ate the rat. " * 4
    n = len(u.bpe_encode(text, u.bpe_train(text, 20)))
    if n >= len(text.encode()) * 0.6:
        raise AssertionError(f"{n} tokens for {len(text.encode())} bytes")
` });

add({ id: "conv2d", lvl: 2, track: "ml", title: "Conv2d, from the definition", fns: ["conv2d"],
  desc: `Write <code>conv2d(x, w, stride=1, pad=0)</code>: <code>x</code> is <code>(N, C, H, W)</code>, <code>w</code> is <code>(F, C, kh, kw)</code>, output <code>(N, F, H_out, W_out)</code>. Cross-correlation as in deep-learning libraries, zero padding, no bias.`,
  starter: String.raw`import numpy as np

def conv2d(x, w, stride=1, pad=0):
    # x: (N, C, H, W), w: (F, C, kh, kw). Return (N, F, H_out, W_out).
    pass
`,
  tests: String.raw`
def _ref(x, w, s=1, p=0):
    N, C, H, W = x.shape; F, _, kh, kw = w.shape
    xp = np.pad(x, ((0, 0), (0, 0), (p, p), (p, p)))
    Ho = (H + 2 * p - kh) // s + 1; Wo = (W + 2 * p - kw) // s + 1
    out = np.zeros((N, F, Ho, Wo))
    for i in range(Ho):
        for j in range(Wo):
            patch = xp[:, :, i * s : i * s + kh, j * s : j * s + kw]
            out[:, :, i, j] = np.tensordot(patch, w, axes=([1, 2, 3], [1, 2, 3]))
    return out

def test_ref(u):
    """matches the reference, stride 1"""
    r = rng(0); x = r.normal(size=(2, 3, 6, 6)); w = r.normal(size=(4, 3, 3, 3))
    close(u.conv2d(x, w), _ref(x, w))

def test_pad_stride(u):
    """padding 1 and stride 2"""
    r = rng(1); x = r.normal(size=(1, 2, 7, 5)); w = r.normal(size=(3, 2, 3, 3))
    close(u.conv2d(x, w, stride=2, pad=1), _ref(x, w, 2, 1))

def test_identity(u):
    """a centered 1 kernel with pad 1 copies the input"""
    x = rng(2).normal(size=(1, 1, 4, 4)); w = np.zeros((1, 1, 3, 3)); w[0, 0, 1, 1] = 1
    close(u.conv2d(x, w, pad=1), x)

def test_not_flipped(u):
    """cross-correlation, not a flipped convolution"""
    x = np.arange(9.0).reshape(1, 1, 3, 3); w = np.zeros((1, 1, 2, 2)); w[0, 0, 0, 0] = 1
    close(u.conv2d(x, w), x[:, :, :2, :2])
` });

add({ id: "kv-cache", lvl: 4, track: "ml", title: "Decoding with a KV cache", fns: ["decode_step"],
  desc: `Write <code>decode_step(x, Wq, Wk, Wv, cache)</code> for one new token <code>x</code> <code>(C,)</code> of a single attention head. <code>cache</code> is <code>None</code> at the first step, then whatever you returned. Return <code>(y, cache)</code>. Decoding a sequence token by token must give exactly causal attention over the whole sequence, without recomputing past keys and values.`,
  starter: String.raw`import numpy as np

def decode_step(x, Wq, Wk, Wv, cache=None):
    # x: (C,). Return (y, cache) with y: (d,).
    pass
`,
  tests: String.raw`
def _data(seed=0, T=7, C=6, d=4):
    r = rng(seed)
    return r.normal(size=(T, C)), r.normal(size=(C, d)), r.normal(size=(C, d)), r.normal(size=(C, d))

def _full(X, Wq, Wk, Wv):
    q, k, v = X @ Wq, X @ Wk, X @ Wv; T, d = q.shape
    s = q @ k.T / np.sqrt(d) + np.triu(np.full((T, T), -1e30), 1)
    w = np.exp(s - s.max(-1, keepdims=True)); w /= w.sum(-1, keepdims=True)
    return w @ v

def _run(u, X, *W):
    cache, ys = None, []
    for x in X:
        y, cache = pair(u.decode_step(x, *W, cache), "decode_step")
        ys.append(np.asarray(y))
    return np.stack(ys)

def test_first(u):
    """first token returns its own value"""
    X, Wq, Wk, Wv = _data()
    y, _ = pair(u.decode_step(X[0], Wq, Wk, Wv, None), "decode_step")
    close(y, X[0] @ Wv)

def test_equivalent(u):
    """token by token == full causal attention"""
    X, Wq, Wk, Wv = _data(1)
    close(_run(u, X, Wq, Wk, Wv), _full(X, Wq, Wk, Wv))

def test_no_recompute(u):
    """past keys are not recomputed"""
    X, Wq, Wk, Wv = _data(2, T=4)
    calls = [0]
    class Spy(np.ndarray):
        def __rmatmul__(self, other):
            calls[0] += 1
            return np.asarray(other) @ np.asarray(self)
    Wk2 = Wk.view(Spy)
    _run(u, X, Wq, Wk2, Wv)
    if calls[0] > len(X):
        raise AssertionError(f"Wk used {calls[0]} times for {len(X)} tokens: cache the keys")
` });

add({ id: "top-p", lvl: 2, track: "ml", title: "Nucleus (top-p) sampling", fns: ["top_p"],
  desc: `Write <code>top_p(logits, p)</code>: turn <code>logits</code> <code>(V,)</code> into probabilities, keep the smallest set of most likely tokens whose total probability reaches <code>p</code>, zero the rest and renormalize. Return the filtered distribution.`,
  starter: String.raw`import numpy as np

def top_p(logits, p):
    # Return a (V,) probability vector.
    pass
`,
  tests: String.raw`
def _sm(x):
    e = np.exp(x - x.max()); return e / e.sum()

def test_sum(u):
    """returns a distribution"""
    q = np.asarray(u.top_p(rng(0).normal(size=10), 0.8))
    close(q.sum(), 1.0, what="sum");
    if (q < 0).any(): raise AssertionError("negative probability")

def test_full(u):
    """p = 1 keeps everything"""
    x = rng(1).normal(size=8)
    close(u.top_p(x, 1.0), _sm(x))

def test_argmax(u):
    """tiny p keeps only the argmax"""
    x = rng(2).normal(size=8); q = np.asarray(u.top_p(x, 1e-9))
    e = np.zeros(8); e[np.argmax(x)] = 1
    close(q, e)

def test_nucleus(u):
    """keeps the smallest set reaching p"""
    x = np.log(np.array([0.5, 0.05, 0.3, 0.15]))
    close(u.top_p(x, 0.75), np.array([0.5, 0.0, 0.3, 0.0]) / 0.8, what="top_p([.5, .05, .3, .15], .75)")
` });

add({ id: "micrograd", lvl: 4, track: "ml", title: "A tiny autograd engine", fns: ["Value"],
  desc: `Build a scalar <code>Value</code> class: <code>.data</code>, <code>.grad</code>, <code>+</code>, <code>*</code>, <code>-</code>, <code>**</code> (number exponent), <code>.tanh()</code>, and <code>.backward()</code> that fills every <code>.grad</code> in topological order. Plain numbers must work on either side (<code>2 * a</code>, <code>a + 1</code>).`,
  starter: String.raw`import math

class Value:
    def __init__(self, data, children=()):
        self.data = data
        self.grad = 0.0
        self._prev = set(children)
        self._backward = lambda: None

    def backward(self):
        pass
`,
  tests: String.raw`
def test_forward(u):
    """forward values"""
    V = u.Value; a, b = V(2.0), V(-3.0)
    c = a * b + 10
    close(c.data, 4.0, what="2 * -3 + 10")
    close((a - b).data, 5.0, what="2 - (-3)")
    close((a ** 2).data, 4.0, what="2 ** 2")

def test_grads(u):
    """gradients match finite differences"""
    V = u.Value
    def f(x, y):
        a, b = V(x), V(y)
        out = ((a * b + b ** 3) * 2 - a).tanh()
        return a, b, out
    a, b, out = f(0.3, -0.7); out.backward()
    eps = 1e-6
    ga = (f(0.3 + eps, -0.7)[2].data - f(0.3 - eps, -0.7)[2].data) / (2 * eps)
    gb = (f(0.3, -0.7 + eps)[2].data - f(0.3, -0.7 - eps)[2].data) / (2 * eps)
    close(a.grad, ga, atol=1e-6, what="d out / d a"); close(b.grad, gb, atol=1e-6, what="d out / d b")

def test_reuse(u):
    """a node used twice accumulates its gradient"""
    a = u.Value(3.0); out = a * a + a; out.backward()
    close(a.grad, 7.0, what="d(a*a + a)/da at 3")

def test_numbers(u):
    """plain numbers on the left"""
    a = u.Value(1.5); out = 2 * a + 1 - a; out.backward()
    close(out.data, 2.5, what="2a + 1 - a"); close(a.grad, 1.0, what="gradient")

def test_deep(u):
    """a chain of 500 operations"""
    x = u.Value(0.5); y = x
    for _ in range(500): y = y * 1.001
    y.backward()
    close(x.grad, 1.001 ** 500, atol=1e-6, what="gradient through 500 steps")
` });

window.DRILLS = D;
})();
