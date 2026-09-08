# AI course notes

My notes from online AI / machine-learning courses (Stanford Online, etc.), written as plain
static HTML. No build step, no dependencies to install — open `index.html` in a browser and it works.

```
index.html                     ← generated: grid of all courses
assets/notes.css               ← the whole design system (one file)
assets/notes.js                ← theme, TOC, scroll-spy, copy buttons, search, math/code init
templates/lecture.html         ← the note template new lectures are stamped from
templates/components.html      ← living reference: every block rendered next to its markup
tools/notes.py                 ← scaffolding + index generation
courses/<slug>/course.json     ← course metadata you edit by hand
courses/<slug>/index.html      ← generated: lecture list for that course
courses/<slug>/NN-title.html   ← one note per lecture — this is what you actually write
```

## Daily workflow

```bash
# start a new course
python3 tools/notes.py new-course cs231n \
  --title "Deep Learning for Computer Vision" --code CS231n --org "Stanford Online" \
  --desc "CNNs, training deep nets, detection and segmentation." \
  --source "http://cs231n.stanford.edu/" --tags "deep learning, vision" --order 2

# start a lecture note (number is auto-assigned; file gets a slugified name)
python3 tools/notes.py new-lecture cs231n "Image Classification and kNN" \
  --summary "Nearest-neighbour baselines, the data-driven approach, train/val/test discipline."

# ...write the note in courses/cs231n/02-image-classification-and-knn.html...

# rebuild the indexes, prev/next links and per-lecture sidebar nav
python3 tools/notes.py reindex

python3 tools/notes.py list     # see everything at a glance
```

`reindex` is safe to run any time: it regenerates `index.html` and each `courses/*/index.html`,
and inside lecture files it only rewrites the three marked regions
(`<!-- PAGER -->`, `<!-- SIBLINGS -->`, `<!-- CRUMB -->`). Your prose is never touched.

## Writing a note

Open `templates/components.html` in a browser — it renders every available block next to the
HTML that produces it. The vocabulary:

| Block | Use it for |
| --- | --- |
| `.panel` "In one minute" | the 3–4 line summary at the top of every lecture |
| `.callout--definition` / `--theorem` | formal statements worth boxing |
| `.callout--tip` | intuition, the "why this actually works" paragraph |
| `.callout--warning` / `--danger` | traps, and mistakes you personally made |
| `.callout--question` | anything still unclear — a to-do list for later |
| `.callout--example` | worked instances |
| `ol.steps` | algorithms, procedures |
| `dl.terms` | the key-terms glossary at the end |
| `pre > code.language-python` | code, with an automatic copy button |

- **Math**: KaTeX renders `\( … \)` inline and `$$ … $$` display, in any block.
- **Headings**: `<h2>` and `<h3>` inside `#content` are auto-numbered into the sidebar table of
  contents, get `id`s and hover anchors, and drive the scroll-spy. Add `class="no-toc"` to a
  wrapper to keep its headings out.
- **Images**: drop them in the course folder (e.g. `courses/cme296/images/`) and use `<figure>`.

## Keyboard

`t` theme · `/` focus filter · `←`/`→` (or `p`/`n`) previous / next lecture.

## Notes on the design

- Light and dark themes follow the OS by default; the toggle stores an override in `localStorage`.
- Serif prose (`--font-prose`) for reading, sans for UI and headings. Change the token at the top
  of `assets/notes.css` to `var(--font-sans)` if you prefer sans-serif notes.
- KaTeX and highlight.js load from a CDN, so math and syntax colours need a connection the first
  time. Everything else — layout, typography, navigation — works fully offline.
- `@media print` is styled: any note prints (or "Save as PDF") cleanly without chrome.
