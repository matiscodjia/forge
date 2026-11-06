"""Forge test harness: runs a user's solution against test cases (Pyodide or CPython)."""
import copy
import io
import json
import sys
import time
import traceback
from typing import List, Optional, Dict, Tuple, Set


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

    def __repr__(self):
        return f"ListNode({self.val})"


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self):
        return f"TreeNode({self.val})"


def _mk_list(xs):
    head = None
    for v in reversed(xs):
        head = ListNode(v, head)
    return head


def _from_list(head):
    out, n = [], 0
    while head is not None and n < 200000:
        out.append(head.val)
        head = head.next
        n += 1
    return out


def _mk_tree(vals):
    if not vals:
        return None
    nodes = [None if v is None else TreeNode(v) for v in vals]
    kids = nodes[::-1]
    root = kids.pop()
    for nd in nodes:
        if nd is not None:
            if kids:
                nd.left = kids.pop()
            if kids:
                nd.right = kids.pop()
    return root


def _check(cmp, got, exp):
    if cmp == "sorted":
        return isinstance(got, (list, tuple)) and sorted(got) == sorted(exp)
    if cmp == "set":
        return isinstance(got, (list, tuple)) and len(got) == len(exp) and sorted(got) == sorted(exp)
    if cmp == "subsets":
        if not isinstance(got, (list, tuple)) or len(got) != len(exp):
            return False
        return sorted(sorted(s) for s in got) == sorted(sorted(s) for s in exp)
    return got == exp


def _short(x, n=160):
    s = repr(x)
    return s if len(s) <= n else s[: n - 1] + "…"


def run(code, fn_name, cases_json, cmp):
    ns = {"ListNode": ListNode, "TreeNode": TreeNode, "List": List, "Optional": Optional,
          "Dict": Dict, "Tuple": Tuple, "Set": Set, "__name__": "solution"}
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        try:
            exec(compile(code, "solution.py", "exec"), ns)
        except Exception as e:
            tb = traceback.format_exception_only(type(e), e)
            return json.dumps({"error": "".join(tb).strip(), "stdout": buf.getvalue()[:2000]})
        fn = ns.get(fn_name)
        if not callable(fn):
            return json.dumps({"error": f"Define a function named {fn_name}(…).", "stdout": buf.getvalue()[:2000]})
        results = []
        for i, c in enumerate(json.loads(cases_json)):
            args = copy.deepcopy(c["args"])
            shown_args = _short(c["args"], 120)
            if cmp == "linked":
                args = [_mk_list(args[0])]
            elif cmp == "tree":
                args = [_mk_tree(args[0])]
            t0 = time.perf_counter()
            try:
                got = fn(*args)
                ms = (time.perf_counter() - t0) * 1000
                if cmp == "linked":
                    got = _from_list(got)
                ok = bool(_check(cmp, got, c["expected"]))
                results.append({"ok": ok, "ms": round(ms, 2), "input": shown_args,
                                "got": _short(got), "expected": _short(c["expected"])})
            except Exception as e:
                ms = (time.perf_counter() - t0) * 1000
                tb = traceback.extract_tb(e.__traceback__)
                line = next((f.lineno for f in reversed(tb) if f.filename == "solution.py"), None)
                msg = f"{type(e).__name__}: {e}" + (f" (line {line})" if line else "")
                results.append({"ok": False, "ms": round(ms, 2), "input": shown_args, "error": msg,
                                "expected": _short(c["expected"])})
        return json.dumps({"results": results, "stdout": buf.getvalue()[:2000]})
    finally:
        sys.stdout = old
