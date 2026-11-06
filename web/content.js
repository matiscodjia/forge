/* Forge content: daily blocks, coding problems, theory diagnostics, skill tracks. */
window.FORGE = {
  start: "2027-03-01",

  /* Observed, never ticked by hand: Forge sees each of these happen. */
  blocks: [
    { k: "code",   t: "Pass a drill",   min: 45, d: "Every test of one Arena exercise passes today." },
    { k: "fund",   t: "Path module",    min: 25, d: "25 active minutes on your module (its page and notes), or one of its exit checks proven." },
    { k: "ship",   t: "Ship a commit",  min: 0,  d: "A commit pushed today to a synced GitHub repository." },
    { k: "recall", t: "Clear recall",   min: 0,  d: "Proof questions and review cards answered until nothing is due." }
  ],

  /* One problem per pattern. Tests live in tests.json (verified reference outputs). */
  problems: [
    { id: "two-sum", pattern: "Hash map", level: "Easy", fn: "two_sum", sig: "def two_sum(nums: List[int], target: int) -> List[int]:",
      text: "Return the indices of the two numbers in <code>nums</code> that add up to <code>target</code>. Exactly one answer exists and you may not use the same element twice. Any order is accepted." },
    { id: "max-area", pattern: "Two pointers", level: "Medium", fn: "max_area", sig: "def max_area(height: List[int]) -> int:",
      text: "<code>height[i]</code> is the height of a vertical line at position <code>i</code>. Choose two lines that, with the x-axis, hold the most water. Return that amount of water (width × the shorter height)." },
    { id: "longest-unique", pattern: "Sliding window", level: "Medium", fn: "longest_unique", sig: "def longest_unique(s: str) -> int:",
      text: "Return the length of the longest substring of <code>s</code> that contains no repeated character." },
    { id: "valid-parens", pattern: "Stack", level: "Easy", fn: "valid_parens", sig: "def valid_parens(s: str) -> bool:",
      text: "<code>s</code> contains only <code>()[]{}</code>. Return <code>True</code> if every bracket is closed by the same type, in the correct order." },
    { id: "search-rotated", pattern: "Binary search", level: "Medium", fn: "search_rotated", sig: "def search_rotated(nums: List[int], target: int) -> int:",
      text: "A sorted array of distinct integers was rotated at an unknown pivot (e.g. <code>[4,5,6,7,0,1,2]</code>). Return the index of <code>target</code>, or <code>-1</code>. Aim for $O(\\log n)$." },
    { id: "reverse-list", pattern: "Linked list", level: "Easy", fn: "reverse_list", sig: "def reverse_list(head: Optional[ListNode]) -> Optional[ListNode]:",
      text: "Reverse a singly linked list and return the new head. <code>ListNode</code> has <code>val</code> and <code>next</code>; it is already defined for you." },
    { id: "valid-bst", pattern: "Trees (DFS)", level: "Medium", fn: "is_valid_bst", sig: "def is_valid_bst(root: Optional[TreeNode]) -> bool:",
      text: "Return <code>True</code> if the binary tree is a valid binary search tree: every left subtree holds strictly smaller values, every right subtree strictly larger. <code>TreeNode</code> has <code>val</code>, <code>left</code>, <code>right</code>." },
    { id: "islands", pattern: "BFS / grids", level: "Medium", fn: "num_islands", sig: "def num_islands(grid: List[str]) -> int:",
      text: "<code>grid</code> is a list of strings of <code>'1'</code> (land) and <code>'0'</code> (water). Count the islands: groups of land connected horizontally or vertically." },
    { id: "top-k", pattern: "Heap / top-k", level: "Medium", fn: "top_k_frequent", sig: "def top_k_frequent(nums: List[int], k: int) -> List[int]:",
      text: "Return the <code>k</code> most frequent elements of <code>nums</code>, in any order. The answer is unique. Better than $O(n \\log n)$ is possible." },
    { id: "merge-intervals", pattern: "Intervals", level: "Medium", fn: "merge", sig: "def merge(intervals: List[List[int]]) -> List[List[int]]:",
      text: "Merge all overlapping intervals <code>[start, end]</code> (touching intervals like <code>[1,4]</code> and <code>[4,5]</code> overlap). Return the result sorted by start. The input may be unsorted." },
    { id: "subsets", pattern: "Backtracking", level: "Medium", fn: "subsets", sig: "def subsets(nums: List[int]) -> List[List[int]]:",
      text: "<code>nums</code> has distinct integers. Return all possible subsets (the power set), in any order." },
    { id: "course-schedule", pattern: "Graphs (topo sort)", level: "Medium", fn: "can_finish", sig: "def can_finish(n: int, prerequisites: List[List[int]]) -> bool:",
      text: "There are <code>n</code> courses. <code>[a, b]</code> means you must take <code>b</code> before <code>a</code>. Return <code>True</code> if all courses can be finished (no cycle)." },
    { id: "rob", pattern: "1-D dynamic programming", level: "Medium", fn: "rob", sig: "def rob(nums: List[int]) -> int:",
      text: "Houses on a street hold <code>nums[i]</code> money. You cannot rob two adjacent houses. Return the maximum amount you can rob." },
    { id: "lcs", pattern: "2-D dynamic programming", level: "Medium", fn: "lcs", sig: "def lcs(a: str, b: str) -> int:",
      text: "Return the length of the longest common subsequence of <code>a</code> and <code>b</code> (characters in order, not necessarily contiguous)." },
    { id: "can-jump", pattern: "Greedy", level: "Medium", fn: "can_jump", sig: "def can_jump(nums: List[int]) -> bool:",
      text: "You start at index 0. <code>nums[i]</code> is your maximum jump length from <code>i</code>. Return <code>True</code> if you can reach the last index." }
  ],

  /* Theory diagnostics. Each key point is one rubric line you tick after reading the model answer. */
  theory: [
    { id: "ml", n: "Part 2", h: "ML & deep learning", min: 35, qs: [
      { q: "Explain the bias–variance trade-off. From training and validation learning curves, how do you recognise high variance, and what are three ways to reduce it?",
        keys: ["High bias: both errors high and close (underfitting)", "High variance: low training error, large gap to validation", "Names 3 fixes: more data/augmentation, regularisation (weight decay, dropout), simpler model or early stopping / ensembling"] },
      { q: "For logits $z$, softmax $p_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}$ and cross-entropy $L = -\\sum_i y_i \\log p_i$ with one-hot $y$, derive $\\frac{\\partial L}{\\partial z} = p - y$.",
        keys: ["$\\frac{\\partial p_i}{\\partial z_j} = p_i(\\delta_{ij} - p_j)$", "Chain rule: $\\frac{\\partial L}{\\partial z_j} = -\\sum_i \\frac{y_i}{p_i} p_i(\\delta_{ij}-p_j)$", "Uses $\\sum_i y_i = 1$ to get $p_j - y_j$"] },
      { q: "Your 3D U-Net reaches Dice 0.85 on validation but 0.60 on scans from a new hospital. Give three likely causes and, for each, one experiment that would confirm it.",
        keys: ["Scanner / protocol shift (intensity, contrast): compare histograms, test with intensity normalisation", "Resolution / voxel spacing mismatch: check spacing, resample and re-evaluate", "Annotation protocol difference: have one expert relabel a subset and measure agreement", "Population / pathology shift: stratify errors by case type"] },
      { q: "BatchNorm vs LayerNorm: over which axes does each normalise, and why do transformers use LayerNorm?",
        keys: ["BN: per channel, statistics over the batch (and spatial) axes; running stats at inference", "LN: per sample, over the feature axis", "LN suits variable sequence lengths, small batches, identical train/inference behaviour"] },
      { q: "Explain scaled dot-product attention $\\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$. Why divide by $\\sqrt{d_k}$?",
        keys: ["Scores = similarity of each query with each key; softmax gives weights; output = weighted sum of values", "Dot-product variance grows like $d_k$ for unit-variance entries", "Large logits saturate softmax → near one-hot, vanishing gradients; scaling keeps variance ≈ 1"] },
      { q: "Show that the Dice coefficient equals the F1 score for binary segmentation, and write IoU as a function of Dice.",
        keys: ["$\\text{Dice} = \\frac{2TP}{2TP+FP+FN}$", "F1 = harmonic mean of precision and recall simplifies to the same expression", "$\\text{IoU} = \\frac{D}{2-D}$"] }
    ]},
    { id: "math", n: "Part 3", h: "Math foundations", min: 40, qs: [
      { q: "Let $f(x) = \\tfrac12\\lVert Ax - b\\rVert_2^2$. Compute $\\nabla f(x)$ and the minimiser when $A^\\top A$ is invertible.",
        keys: ["$\\nabla f(x) = A^\\top(Ax-b)$", "$x^* = (A^\\top A)^{-1}A^\\top b$", "Notes $f$ is convex so the stationary point is the global minimum"] },
      { q: "For $x_1,\\dots,x_n \\sim \\mathcal{N}(\\mu,\\sigma^2)$ i.i.d., derive the MLE of $\\mu$ and $\\sigma^2$. Is $\\hat\\sigma^2_{\\text{MLE}}$ biased? By how much?",
        keys: ["$\\hat\\mu = \\bar x$", "$\\hat\\sigma^2 = \\frac1n\\sum_i (x_i-\\bar x)^2$", "$\\mathbb{E}[\\hat\\sigma^2] = \\frac{n-1}{n}\\sigma^2$: biased by $-\\sigma^2/n$"] },
      { q: "A test has sensitivity 0.99 and specificity 0.95. Prevalence is 1%. Compute $P(\\text{disease} \\mid +)$ and explain the result in one sentence.",
        keys: ["Bayes: $\\frac{0.99 \\cdot 0.01}{0.99\\cdot 0.01 + 0.05 \\cdot 0.99}$", "$= 1/6 \\approx 16.7\\%$", "Low prevalence: most positives are false positives"] },
      { q: "State the spectral theorem for a real symmetric matrix. Why are the principal components the eigenvectors of the covariance matrix with the largest eigenvalues?",
        keys: ["$A = Q\\Lambda Q^\\top$, real eigenvalues, orthonormal eigenvectors", "Variance along unit $u$ is $u^\\top \\Sigma u$", "Rayleigh quotient is maximised by the top eigenvector; next components by orthogonality"] },
      { q: "Show that the logistic loss $\\ell(w) = \\log\\left(1 + e^{-y\\,w^\\top x}\\right)$, $y \\in \\{-1,1\\}$, is convex in $w$ (compute the Hessian).",
        keys: ["$\\nabla \\ell = -\\sigma(-y w^\\top x)\\, y\\, x$", "$\\nabla^2 \\ell = \\sigma(m)(1-\\sigma(m))\\, x x^\\top$ with $m = y w^\\top x$", "Non-negative scalar × PSD matrix ⇒ PSD ⇒ convex"] },
      { q: "For $x_k = F x_{k-1} + w_k$, $z_k = H x_k + v_k$ with $w_k \\sim \\mathcal{N}(0,Q)$, $v_k \\sim \\mathcal{N}(0,R)$, write the Kalman predict and update equations.",
        keys: ["Predict: $\\hat x^- = F\\hat x$, $P^- = FPF^\\top + Q$", "Gain: $K = P^-H^\\top(HP^-H^\\top + R)^{-1}$", "Update: $\\hat x = \\hat x^- + K(z - H\\hat x^-)$, $P = (I-KH)P^-$"] }
    ]},
    { id: "sys", n: "Part 4", h: "PyTorch & systems", min: 45, qs: [
      { q: "Without <code>nn.Linear</code> or <code>torch.optim</code>, write a 2-layer MLP and a training loop with manual SGD on random <code>X</code> (256, 10) and <code>y</code> (256,).",
        keys: ["Parameters as tensors with requires_grad=True", "Forward with a non-linearity, then a loss and loss.backward()", "Update inside torch.no_grad(), then zero or reset the gradients"] },
      { q: "Implement scaled dot-product attention with an optional causal mask for tensors of shape (B, H, T, d). State the output shape.",
        keys: ["scores = q @ k.transpose(-2, -1) / sqrt(d)", "Causal mask via torch.triu(…, diagonal=1) filled with -inf before softmax(dim=-1)", "Output = weights @ v, shape (B, H, T, d)"] },
      { q: "What is the difference between <code>model.eval()</code> and <code>torch.no_grad()</code>? When do you need both?",
        keys: ["eval() changes layer behaviour: dropout off, BatchNorm uses running stats", "no_grad() stops graph building: less memory, faster", "Inference / validation needs both"] },
      { q: "A training step is much slower than expected. How do you profile it, and what are three common bottlenecks?",
        keys: ["torch.profiler (or timers with torch.cuda.synchronize())", "Data loading (num_workers, pin_memory)", "Hidden CPU–GPU syncs (.item(), printing) or host↔device copies", "No mixed precision / many small kernels (torch.compile)"] },
      { q: "How much memory do the weights of a 7B-parameter model take in fp16? Roughly how much for full training with Adam in mixed precision? Show the arithmetic.",
        keys: ["$7\\times10^9 \\times 2$ B ≈ 14 GB", "Adam mixed precision ≈ 16 B/param (fp16 weights + grads, fp32 master, m, v)", "≈ 112 GB plus activations"] },
      { q: "In Rust, explain ownership and borrowing. Why does ROUILLE avoid heap allocation on a 128 KB microcontroller, and what does that cost you in design?",
        keys: ["One owner, moves; many & or one &mut; checked at compile time, no GC", "No allocator in no_std; avoids fragmentation, memory known at compile time, deterministic", "Cost: fixed sizes (const generics), less flexibility, code size from monomorphisation"] }
    ]}
  ],

  tracks: [
    { k: "coding", t: "Coding interviews", target: 4, metric: "Mock score, patterns solved under time", proof: "Three mocks in a row ≥ 80, explained aloud" },
    { k: "ml",     t: "ML & DL",           target: 4, metric: "Part 2 score", proof: "Every Part 2 answer derived without notes" },
    { k: "math",   t: "Math",              target: 4, metric: "Part 3 score", proof: "Clean derivations, checked numerically" },
    { k: "sys",    t: "PyTorch & systems", target: 4, metric: "Part 4 score, from-scratch builds", proof: "Attention, training loop, profiler report, one kernel" },
    { k: "ship",   t: "Shipped proof",     target: 4, metric: "Public artifacts others can check", proof: "ROUILLE release + benchmarks, SENTINEL demo, 1 merged OSS PR" },
  ],
  levels: ["None", "Aware", "With help", "Alone, slow", "Alone, timed", "Can teach"],
  statuses: [
    { k: "todo", t: "To apply" }, { k: "applied", t: "Applied" }, { k: "interview", t: "Interview" },
    { k: "technical", t: "Technical" }, { k: "offer", t: "Offer" }, { k: "closed", t: "Closed" }
  ],
  rules: [
    ["Measure before you judge yourself", "“I'm useless” is a feeling. “Mock 42/100, gap: sliding window under time” is a fact you can fix. Only facts go in Forge."],
    ["Rebuild from scratch, then compare", "Real knowledge means rebuilding on a blank page: attention, a training loop, a Kalman filter, autodiff. Read the reference only after your attempt."],
    ["Patterns beat problem counts", "Fifteen patterns cover most interviews. Solve each three times, then once under the clock while talking aloud in English."],
    ["Ship proof in public", "Experience is work others can check: a release with benchmarks, a demo video, a merged pull request, a preprint. Never claim what you can't show."],
    ["When you freeze, run the script", "Restate the problem. Work a tiny example by hand. Say the brute force and its complexity. Improve one step. Silence is the only wrong answer."],
    ["People open doors, filters close them", "Your interviews came from a forum, a referral and a platform. Two thoughtful messages a day beat fifty blind applications."],
    ["Sleep is training", "A tired brain panics. Stop by 23:00. Eight steady weeks beat heroic nights."]
  ]
};
