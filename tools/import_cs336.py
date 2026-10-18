#!/usr/bin/env python3
"""Turn the upstream CS336 executable lectures into note pages.

The upstream lectures (github.com/stanford-cs336/lectures) are Python scripts
built on `edtrace`: narration is text()/image()/link() calls, and the code
between them is the lecture. This walks a lecture with `ast` — following the
zero-argument calls out of main() the way the trace viewer does — and writes
one HTML page per lecture using templates/lecture.html.

    python3 tools/import_cs336.py ~/src/stanford-cs336-lectures
    python3 tools/import_cs336.py ~/src/... --only 06,07 --course cs336

PDF lectures are copied as-is; list them in course.json ("pdfs") instead.
"""

import argparse
import ast
import datetime
import html
import json
import os
import re
import shutil
import textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COURSES = os.path.join(ROOT, "courses")
TEMPLATES = os.path.join(ROOT, "templates")
UPSTREAM = "https://github.com/stanford-cs336/lectures/blob/main/"

LINK_FNS = {"link": None, "article_link": "article", "post_link": "post", "video_link": "video"}

# Words that should not be title-cased when a function name becomes a heading.
ACRONYMS = {
    "gpu": "GPU", "gpus": "GPUs", "cpu": "CPU", "kv": "KV", "mfu": "MFU", "flops": "FLOPs",
    "moe": "MoE", "rl": "RL", "rlhf": "RLHF", "sft": "SFT", "dpo": "DPO", "ppo": "PPO",
    "llm": "LLM", "llms": "LLMs", "lm": "LM", "lms": "LMs", "api": "API", "mla": "MLA",
    "gqa": "GQA", "mqa": "MQA", "swa": "SWA", "cuda": "CUDA", "ptx": "PTX", "sm": "SM",
    "sms": "SMs", "hbm": "HBM", "dram": "DRAM", "fsdp": "FSDP", "ddp": "DDP", "zero": "ZeRO",
    "tp": "TP", "pp": "PP", "dp": "DP", "ep": "EP", "gelu": "GeLU", "relu": "ReLU",
    "swiglu": "SwiGLU", "rope": "RoPE", "mlp": "MLP", "ffn": "FFN", "triton": "Triton",
    "pytorch": "PyTorch", "gpt": "GPT", "bpe": "BPE", "ocr": "OCR", "vlm": "VLM",
    "vae": "VAE", "clip": "CLIP", "asr": "ASR", "tts": "TTS", "io": "I/O", "ai": "AI",
    "mmlu": "MMLU", "hellaswag": "HellaSwag", "arc": "ARC", "gsm8k": "GSM8K",
}


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def e(s):
    return html.escape(s or "", quote=True)


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s or "lecture"


def prettify(name):
    words = name.replace("__", "_").split("_")
    out = []
    for i, w in enumerate(words):
        if w.lower() in ACRONYMS:
            out.append(ACRONYMS[w.lower()])
        elif i == 0:
            out.append(w[:1].upper() + w[1:])
        else:
            out.append(w)
    return " ".join(out).replace(" vs ", " vs. ")


# ---------------------------------------------------------------- upstream metadata
def load_references(repo):
    """references.py holds Reference(title=..., url=...) objects the lectures link to."""
    path = os.path.join(repo, "references.py")
    refs = {}
    if not os.path.exists(path):
        return refs
    for node in ast.parse(read(path)).body:
        if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Call):
            continue
        fn = node.value.func
        if not (isinstance(fn, ast.Name) and fn.id in ("Reference", "url_reference")):
            continue
        kw = {k.arg: k.value for k in node.value.keywords if isinstance(k.value, ast.Constant)}
        for t in node.targets:
            if isinstance(t, ast.Name):
                refs[t.id] = (kw.get("title").value if "title" in kw else t.id,
                              kw.get("url").value if "url" in kw else "")
    return refs


def load_link_titles(repo):
    """edtrace caches fetched pages under var/files as <kind>-<hash>-<mangled url>."""
    d = os.path.join(repo, "var", "files")
    titles = {}
    if not os.path.isdir(d):
        return titles
    for fn in os.listdir(d):
        parts = fn.split("-", 2)
        if len(parts) != 3:
            continue
        try:
            with open(os.path.join(d, fn), encoding="utf-8", errors="ignore") as f:
                head = f.read(4000)
        except OSError:
            continue
        m = re.search(r"<title>(.*?)</title>", head, re.S | re.I)
        if m:
            t = html.unescape(re.sub(r"\s+", " ", m.group(1))).strip()
            t = re.sub(r"^\[\d{4}\.\d{4,5}v?\d*\]\s*", "", t)  # arXiv id prefix
            titles[parts[2]] = t
    return titles


def mangle(url):
    return re.sub(r"[^A-Za-z0-9]", "_", url)


# ---------------------------------------------------------------- inline markdown
def inline(s):
    """The narration is light markdown with the odd <font color=...> tag."""
    out = []
    for i, part in enumerate(s.split("`")):
        if i % 2:  # inside backticks
            out.append("<code>" + e(part) + "</code>")
            continue
        t = e(part)
        t = re.sub(r"&lt;font color=&quot;(\w+)&quot;&gt;", r'<span style="color:\1">', t)
        t = t.replace("&lt;/font&gt;", "</span>")
        t = t.replace("&lt;br&gt;", "<br>")
        # Keep stray dollar amounts ($65, $1.5B) from pairing up as KaTeX math.
        t = t.replace("$", "<span>$</span>")
        t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
                   r'<a href="\2" target="_blank" rel="noopener">\1</a>', t)
        t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
        t = re.sub(r"(?<![\*\w])\*([^*\n]+)\*(?![\*\w])", r"<em>\1</em>", t)
        out.append(t)
    return "".join(out)


class Body:
    """Accumulates HTML blocks, merging runs of list items."""

    def __init__(self):
        self.parts = []
        self._list = None  # ("ul"|"ol", [items])
        self._pre = []     # consecutive verbatim text() calls: one ASCII table

    def _close(self):
        if self._list:
            tag, items = self._list
            self.parts.append(f"    <{tag}>\n" + "\n".join(f"      <li>{i}</li>" for i in items)
                              + f"\n    </{tag}>")
            self._list = None
        if self._pre:
            self.parts.append("    <pre><code>" + "\n".join(self._pre) + "</code></pre>")
            self._pre = []

    def item(self, tag, text):
        if self._list and self._list[0] != tag:
            self._close()
        if self._pre:
            self._close()
        if not self._list:
            self._list = (tag, [])
        self._list[1].append(text)

    def pre(self, text):
        if self._list:
            self._close()
        self._pre.append(text)

    def add(self, html_chunk):
        self._close()
        self.parts.append(html_chunk)

    def append_inline(self, frag):
        """Links trail the line they annotate, so keep them in that block."""
        if self._list and self._list[1]:
            self._list[1][-1] += " " + frag
        elif self.parts and self.parts[-1].startswith("    <p>") and self.parts[-1].endswith("</p>"):
            self.parts[-1] = self.parts[-1][:-len("</p>")] + " " + frag + "</p>"
        else:
            self.add('    <p class="src-link">' + frag + "</p>")

    def html(self):
        self._close()
        return "\n\n".join(self.parts)


# ---------------------------------------------------------------- lecture walker
class Lecture:
    def __init__(self, repo, path, number, course_dir, refs, link_titles):
        self.repo = repo
        self.path = path
        self.number = number
        self.course_dir = course_dir
        self.refs = refs
        self.link_titles = link_titles
        self.src = read(path)
        self.lines = self.src.splitlines()
        self.tree = ast.parse(self.src)
        self.funcs = {n.name: n for n in self.tree.body if isinstance(n, ast.FunctionDef)}
        self.body = Body()
        self.title = None
        self.lead = []
        self.images = []
        self.stack = []
        self.expanded = set()

    # -- helpers -------------------------------------------------------
    def const_str(self, node):
        try:
            v = ast.literal_eval(node)
        except (ValueError, SyntaxError, TypeError):
            return None
        return v if isinstance(v, str) else None

    NARRATIVE = ("text", "image") + tuple(LINK_FNS)

    def narrative_calls(self, stmt):
        """The narrative calls in a statement, which may be a tuple of them."""
        if not isinstance(stmt, ast.Expr):
            return []
        nodes = (stmt.value.elts if isinstance(stmt.value, ast.Tuple) else [stmt.value])
        calls = [n for n in nodes if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                 and n.func.id in self.NARRATIVE]
        return calls if len(calls) == len(nodes) else []

    def section_name(self, stmt):
        """A narrative section: a zero-arg call to a function defined in this lecture."""
        if not (isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call)):
            return None
        call = stmt.value
        if not isinstance(call.func, ast.Name) or call.args or call.keywords:
            return None
        return call.func.id if call.func.id in self.funcs else None

    # -- emitters ------------------------------------------------------
    def heading(self, text, depth):
        level = 2 if depth == 0 else (3 if depth == 1 else 4)
        anchor = slugify(text)
        self.body.add(f'    <h{level} id="{anchor}">{inline(text)}</h{level}>')

    def emit_text(self, call, depth):
        raw = self.const_str(call.args[0]) if call.args else None
        if raw is None:
            # text(profile_output, verbatim=True): produced when the lecture runs.
            if call.args and isinstance(call.args[0], ast.Name):
                self.body.add('    <p class="src-link"><em>Runtime output: <code>'
                              + e(call.args[0].id) + "</code> (only in the executed trace)</em></p>")
                return
            return self.emit_code_src(call)
        verbatim = any(k.arg == "verbatim" and getattr(k.value, "value", False) for k in call.keywords)
        if verbatim:
            self.body.pre(e(raw))
            return
        for line in raw.split("\n"):
            s = line.strip()
            if not s:
                continue
            m = re.match(r"(#{1,4})\s+(.*)", s)
            if m:
                text = m.group(2).strip()
                if self.title is None and re.match(r"lecture\s*\d+\s*[:.]", text, re.I):
                    self.title = re.sub(r"^lecture\s*\d+\s*[:.]\s*", "", text, flags=re.I).strip()
                    continue
                self.heading(text, depth)
                continue
            m = re.match(r"[-*]\s+(.*)", s)
            if m:
                self.body.item("ul", inline(m.group(1)))
                continue
            m = re.match(r"\d+[.)]\s+(.*)", s)
            if m:
                self.body.item("ol", inline(m.group(1)))
                continue
            if s.startswith("&gt;") or s.startswith(">"):
                self.body.add("    <blockquote>" + inline(s.lstrip("> ")) + "</blockquote>")
                continue
            self.body.add("    <p>" + inline(s) + "</p>")
            if len(self.lead) < 2 and depth == 0 and len(s) > 40:
                self.lead.append(s)

    def emit_image(self, call):
        src = self.const_str(call.args[0]) if call.args else None
        if src is None:
            return self.emit_code_src(call)
        width = next((k.value.value for k in call.keywords
                      if k.arg == "width" and isinstance(k.value, ast.Constant)), None)
        alt = prettify(re.sub(r"\.\w+$", "", os.path.basename(src)).replace("-", "_"))
        if not src.startswith("http"):
            local = os.path.join(self.repo, src)
            rel = f"images/l{self.number}/{os.path.basename(src)}"
            if os.path.exists(local):
                dst = os.path.join(self.course_dir, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(local, dst)
                self.images.append(rel)
                src = rel
            else:
                src = UPSTREAM + src
        w = f' width="{int(width)}"' if isinstance(width, (int, float)) else ""
        self.body.add(f'    <figure>\n      <img src="{e(src)}"{w} alt="{e(alt)}">\n    </figure>')

    def emit_link(self, call, fname):
        title = next((self.const_str(k.value) for k in call.keywords if k.arg == "title"), None)
        url = next((self.const_str(k.value) for k in call.keywords if k.arg == "url"), None)
        if url is None and call.args:
            arg = call.args[0]
            if isinstance(arg, ast.Name) and arg.id in self.refs:
                rtitle, url = self.refs[arg.id]
                title = title or rtitle
            else:
                url = self.const_str(arg)
        if not url:
            return self.emit_code_src(call)
        if not url.startswith("http"):        # e.g. link("var/traces/lecture_07_stdout.txt")
            url = UPSTREAM + url.lstrip("/")
        title = title or LINK_FNS.get(fname) or self.link_titles.get(mangle(url)) or url
        self.body.append_inline(f'<a class="src-link" href="{e(url)}" target="_blank" '
                                f'rel="noopener">{inline(title)} ↗</a>')

    def emit_code_src(self, node):
        seg = ast.get_source_segment(self.src, node) or ""
        if seg.strip():
            self.body.add("    <pre><code class=\"language-python\">" + e(seg) + "</code></pre>")

    def emit_code(self, stmts):
        if not stmts:
            return
        start = min(s.lineno for s in stmts)
        i = start - 2
        while i >= 0 and self.lines[i].strip().startswith("#"):
            start = i + 1
            i -= 1
        end = max(s.end_lineno for s in stmts)
        chunk = textwrap.dedent("\n".join(self.lines[start - 1:end])).strip("\n")
        if chunk.strip():
            self.body.add("    <pre><code class=\"language-python\">" + e(chunk) + "</code></pre>")

    def is_narrative(self, fn):
        return any(isinstance(c, ast.Call) and isinstance(c.func, ast.Name)
                   and c.func.id in ("text", "image") for c in ast.walk(fn))

    def flush(self, pending, depth):
        """Emit a run of code, then whatever lecture functions it referenced.

        The kernels and worker processes live at module level, so following the
        names out of the code is the only way they make it into the page."""
        if not pending:
            return
        self.emit_code(pending)
        queue = self.referenced(pending)
        while queue:
            name = queue.pop(0)
            fn = self.funcs[name]
            self.expanded.add(name)
            if self.is_narrative(fn):
                self.heading(prettify(name), depth + 1)
                self.stack.append(name)
                self.walk(fn.body, depth + 2)
                self.stack.pop()
            else:
                src = ast.get_source_segment(self.src, fn) or ""
                self.body.add(
                    '    <details class="toggle">\n'
                    f'      <summary>Source <span class="name">{e(name)}()</span></summary>\n'
                    '      <pre><code class="language-python">' + e(src) + "</code></pre>\n"
                    "    </details>")
                # Kernels hang off helpers (triton_gelu → triton_gelu_kernel), so keep going.
                queue += [n for n in self.referenced(fn.body) if n not in queue]

    def referenced(self, stmts):
        """Lecture functions named anywhere in these statements, in source order."""
        names = []
        for stmt in stmts:
            for node in ast.walk(stmt):
                if (isinstance(node, ast.Name) and node.id in self.funcs
                        and node.id not in self.expanded and node.id not in self.stack
                        and node.id != "main" and node.id not in names):
                    names.append(node.id)
        return names

    # -- walk ----------------------------------------------------------
    def walk(self, stmts, depth):
        pending = []
        for stmt in stmts:
            calls = self.narrative_calls(stmt)
            if calls:
                self.flush(pending, depth)
                pending = []
                for call in calls:
                    name = call.func.id
                    if name == "text":
                        self.emit_text(call, depth)
                    elif name == "image":
                        self.emit_image(call)
                    else:
                        self.emit_link(call, name)
                continue
            name = self.section_name(stmt)
            if name and name not in self.stack:
                self.flush(pending, depth)
                pending = []
                self.expanded.add(name)
                self.heading(prettify(name), depth)
                self.stack.append(name)
                self.walk(self.funcs[name].body, depth + 1)
                self.stack.pop()
                continue
            if isinstance(stmt, ast.Return):
                continue
            pending.append(stmt)
        self.flush(pending, depth)

    def convert(self):
        main = self.funcs.get("main")
        if main is None:
            raise SystemExit(f"{self.path}: no main()")
        self.stack.append("main")
        self.walk(main.body, 0)
        return self.body.html()


# ---------------------------------------------------------------- page assembly
def build_page(course, number, title, summary, tags, date, source, body):
    tpl = read(os.path.join(TEMPLATES, "lecture.html"))
    for k, v in {
        "{{ROOT}}": "../../",
        "{{TITLE}}": e(title),
        "{{COURSE_TITLE}}": e(course.get("title", "")),
        "{{NUMBER}}": number,
        "{{DATE}}": e(date),
        "{{SUMMARY}}": e(summary),
        "{{TAGS}}": e(tags),
        "{{SOURCE_URL}}": e(source),
    }.items():
        tpl = tpl.replace(k, v)
    tpl = tpl.replace("        <li class=\"chip\"></li>\n", "")
    head, rest = tpl.split('    <div class="panel">', 1)
    _demo, tail = rest.split("    <!-- PAGER:START -->", 1)
    return head + body + "\n\n    <!-- PAGER:START -->" + tail


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo", help="checkout of github.com/stanford-cs336/lectures")
    ap.add_argument("--course", default="cs336")
    ap.add_argument("--only", help="comma-separated lecture numbers, e.g. 06,07")
    ap.add_argument("--skip", default="", help="lecture numbers to leave alone")
    ap.add_argument("--meta", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "cs336-lectures.json"),
                    help="titles/tags per lecture number")
    a = ap.parse_args()

    course_dir = os.path.join(COURSES, a.course)
    course = json.loads(read(os.path.join(course_dir, "course.json")))
    meta = json.loads(read(a.meta)) if os.path.exists(a.meta) else {}
    refs = load_references(a.repo)
    link_titles = load_link_titles(a.repo)
    only = {x.strip() for x in a.only.split(",")} if a.only else None
    skip = {x.strip() for x in a.skip.split(",") if x.strip()}

    pdfs = []
    for fn in sorted(os.listdir(a.repo)):
        m = re.match(r"lecture_(\d+)\.(py|pdf)$", fn)
        if not m:
            continue
        num, kind = m.group(1), m.group(2)
        if (only and num not in only) or num in skip:
            continue
        info = meta.get(num, {})
        if kind == "pdf":
            dst = os.path.join(course_dir, fn)
            if not os.path.exists(dst):
                shutil.copy2(os.path.join(a.repo, fn), dst)
            entry = {"file": fn, "number": num, "title": info.get("title", f"Lecture {num}")}
            for key in ("summary", "date", "tags"):
                if info.get(key):
                    entry[key] = info[key]
            pdfs.append(entry)
            print(f"pdf   {fn}")
            continue

        lec = Lecture(a.repo, os.path.join(a.repo, fn), num, course_dir, refs, link_titles)
        body = lec.convert()
        title = info.get("title") or lec.title or f"Lecture {num}"
        summary = info.get("summary") or " ".join(lec.lead)[:300]
        page = build_page(course, num, title, summary, info.get("tags", ""),
                          info.get("date", ""), UPSTREAM + fn, body)
        out = os.path.join(course_dir, f"{num}-{slugify(title)}.html")
        write(out, page)
        print(f"html  {os.path.relpath(out, ROOT)}  ({len(lec.images)} images)")

    if pdfs:
        keep = {p["file"] for p in pdfs}
        merged = [p for p in (course.get("pdfs") or []) if p["file"] not in keep] + pdfs
        course["pdfs"] = sorted(merged, key=lambda p: p.get("number", ""))
        write(os.path.join(course_dir, "course.json"),
              json.dumps(course, indent=2, ensure_ascii=False) + "\n")
        print(f"course.json: {len(course['pdfs'])} pdf lecture(s)")
    print("now run: python3 tools/notes.py reindex")


if __name__ == "__main__":
    main()
