# CS336 coding assignments

One folder per assignment, each the official starter repo **vendored** — cloned, then its `.git`
deleted so the files are tracked by this notes repo. Notes and solutions share one history and one
push; the trade-off is that upstream fixes have to be read off the starter repo's CHANGELOG by hand.

| # | Folder | Vendored from | What it builds |
| --- | --- | --- | --- |
| 1 | `assignment1-basics/` | `a158843` (2026-04-07) | BPE tokenizer, Transformer LM, AdamW, training loop |
| 2 | `assignment2-systems/` | — | profiling, a FlashAttention-2 Triton kernel, distributed data-parallel |
| 3 | `assignment3-scaling/` | — | a sweep under a compute budget, fitting a scaling law |
| 4 | `assignment4-data/` | — | Common Crawl → training text: extraction, filtering, dedup |
| 5 | `assignment5-alignment/` | — | SFT, then RL (GRPO) on math reasoning |

## Starting one

```bash
cd courses/cs336/assignments
git clone https://github.com/stanford-cs336/assignment2-systems
git -C assignment2-systems rev-parse --short HEAD   # note the SHA in the table above
rm -rf assignment2-systems/.git assignment2-systems/.gitignore
cd assignment2-systems
uv run pytest            # everything fails until the code is written — that's the assignment
```

## Conventions

- **Code here, prose in the notes.** Explanations, derivations and anything worth re-reading go in
  `courses/cs336/NN-*.html`; the code folder keeps only what a reader of the code needs.
- **One `.gitignore`, at the repo root.** The starter repos' Python ignores were merged into it, so a
  vendored folder keeps no ignore file of its own.
- **No data in git.** `data/`, `checkpoints/` and `wandb/` inside an assignment folder are ignored —
  the starter repos do *not* ignore them themselves, and assignment 1 alone downloads a few GB of
  TinyStories and OpenWebText.
- **Markdown drafts are ignored** everywhere under `courses/`, except this file and the `.md` docs
  that come with a vendored repo.
