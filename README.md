# Markdown in Chrome

**Version 0.2.0.** Open a markdown file in Chrome or Edge, read it the way it is meant to look, fix what you find on the page, and save it back to the **same file**.

Only the paragraphs you touch are rewritten. Everything else is written out **character for character** as it arrived. Change one word, get a one-word diff.

**Keep a copy of anything you care about before you edit it here.** This program writes to your file.

## Why this exists

AI systems hand you `.md` files all day. You cannot comfortably *read* them raw (pound signs, asterisks, pipe tables). Paste them into a renderer and you can read — but you cannot fix a bad sentence. Open them in a text editor and you can fix the sentence — but you lose the layout.

That gap is what this extension closes. The full argument is in:

**[Editing an AI model’s markdown (md) file in your web browser](https://tomadelstein.substack.com/p/editing-an-ai-models-markdown-md)** — Tom Adelstein, *Advance* on Substack (6 August 2026).

## Install (about two minutes)

Not on the Chrome Web Store yet. Load it unpacked:

1. Go to **[github.com/tadelstein9/md-in-chrome](https://github.com/tadelstein9/md-in-chrome)**.
2. Click green **Code → Download ZIP** (or `git clone` this repo). Unzip if needed.
3. In Chrome (or Edge), open `chrome://extensions` (or `edge://extensions`).
4. Turn **Developer mode** on (top right).
5. Click **Load unpacked** and choose the folder that contains `manifest.json`.
6. Pin **Markdown in Chrome** on the toolbar if you like. Click the icon — the editor opens in its own tab.

To update later: pull or re-download, then on `chrome://extensions` click **Reload** on the card.

### Optional: zip for friends

From this directory:

```bash
./pack.sh
```

That writes `dist/md-in-chrome-0.2.0.zip`. Send the zip; they unzip and **Load unpacked** on the folder inside.

## Using it

1. Click **Open a markdown file** and pick a `.md` file.
2. Chrome asks once for permission to write to that file — allow it.
3. Edit on the page. A gold bar marks blocks you changed.
4. **Ctrl+S** (Mac: **Cmd+S**) saves. The status bar says how many blocks it wrote.
5. **Copy whole document** (or Ctrl+A) puts clean HTML + plain text on the clipboard for Substack, Word, or LibreOffice — without the editor’s own markup.

Fenced code blocks stay **read-only** so browser editing does not destroy indentation.

## What 0.2.0 fixed

| Problem | Fix |
|---------|-----|
| Toolbar icon did nothing (tabs query failed without permission) | `tabs` permission; open-tab always falls back; errors logged |
| Missing toolbar icon | `action.default_icon` set |
| Windows `.md` files with CRLF rendered/saved wrong | Newlines normalized on open |
| Tables and lists hard to edit | Every block is a wrapper `div` with `contenteditable` |
| Conversion could drop heading/list markers | `restorePrefix` applied on save |
| Silent failures on open/permission | Status bar messages |

## Requires

- **Chrome** or **Edge** (File System Access API — write back to disk).
- **Not Firefox** for save-to-disk (no equivalent API).

Your file never leaves your computer. The page makes no network requests. It only stores handles to files you opened (IndexedDB in the browser).

## Tests

```bash
node test-blocks.mjs
```

Covers the guarantee: split, edit one block, every other block returns identical. Also CRLF normalization.

## Bundled (offline)

- [marked](https://github.com/markedjs/marked) — markdown → HTML. MIT.
- [turndown](https://github.com/mixmark-js/turndown) + GFM plugin — HTML → markdown. MIT.

Nothing is fetched at runtime.

## Related

- Linux terminal version (Python + pandoc): [edit-in-chrome](https://github.com/tadelstein9/edit-in-chrome)
- Essay: [Editing an AI model’s markdown…](https://tomadelstein.substack.com/p/editing-an-ai-models-markdown-md)

## License

MIT. See LICENSE.
