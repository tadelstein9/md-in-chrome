# Markdown in Chrome

**Version 0.3.0.** Open a markdown file in Chrome or Edge. Read it the way it is meant to look. Fix a sentence while you are looking at it. Save writes an **edit copy** beside the original. The original file does not change. A clean copy and a PDF sit next to it.

The edit copy holds every red change, every struck original word, and every editor remark. A file that is already `name.edit.md` stays that file. The program never writes `name.edit.edit.md`.

Only the paragraphs you touch are rewritten. Everything else is written out **character for character** as it arrived. Change one word, get a one-word diff.

**Keep a copy of anything you care about before you edit it here.** This program writes to disk.

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

To update later: pull or re-download, then on `chrome://extensions` click **Reload** on the card. Refresh the editor tab after that.

### Optional: zip for friends

From this directory:

```bash
./pack.sh
```

That writes `dist/md-in-chrome-<version>.zip`. Send the zip; they unzip and **Load unpacked** on the folder inside.

## How to use it

Click the toolbar icon. The editor opens in its own tab.

### 1. Open a folder (usual way)

Use **Open a folder** when you want the edit copy to sit next to the original.

1. Click **Open a folder**.
2. In Chrome’s folder window, go to the folder that holds the `.md` file. Then click **Select**.
3. Click the file in the list.

Chrome will not select Home. It says the folder contains system files. In that window, type the folder you want, then Select:

| System | How to type the path |
|---|---|
| Linux | **Ctrl+L**, type the path (example: `/home/you/Books/draft`), Enter, **Select** |
| Windows | Click the path bar at the top of the window, type the path, Enter, **Select** |
| Mac | **Cmd+Shift+G**, type the path, Go, **Select** |

A folder whose name starts with a period (`.grok`, `.claude`) works the same way. Type the full path to that folder, then Select. Or open a parent folder Chrome will accept, type the child name (`.grok`) in **Folder name inside the one you already opened**, and click **Go**. The list includes names that start with a period.

**Back to folder** returns to the list.

### 2. Open one file

Click **Open a markdown file** and pick a `.md` file. Chrome asks once for permission to write — allow it.

Save still writes an edit copy. Without a folder, Chrome will ask where to put that copy.

### 3. Edit on the page

Headings look like headings. Tables look like tables. Click in a paragraph and type.

A gold bar on the left marks a block you changed.

**Mark edits** is on by default. Change a sentence and click out of it:

- New words turn **red**.
- Words you replaced stay on the page in **red with a line through them**.

Click **Mark edits** again if you want the marks off.

Fenced code blocks stay **read-only**, so a browser edit cannot destroy the indentation.

### 4. Save the edit copy

**Save edit copy** or **Ctrl+S** (Mac: **Cmd+S**) writes `name.edit.md` in the same folder. `chapter.md` becomes `chapter.edit.md`. The original `chapter.md` stays as it was.

Open `chapter.edit.md` again and save. The program updates that same file. It does not create `chapter.edit.edit.md`.

If you opened the edit copy from a folder that still holds the original, the editor reads the original and puts the replaced words back on the page, struck through. Save writes those struck words into the edit copy so they are there the next time.

The status bar names the file it wrote and how many blocks it touched.

### 5. Leave a remark

Click in a paragraph, then **Remark**. Type the note. It lands at the cursor as a red italic `[Editor: …]`.

That note lives only in the edit copy. It is for the professional reader. A later pass treats those notes as instruction.

### 6. Copy the whole document

**Copy whole document** or **Ctrl+A** puts clean HTML and plain text on the clipboard. Paste into Substack, Word, or LibreOffice. The editor’s own markup does not ride along.

### 7. Save the clean copy

**Save clean copy** writes `name.clean.md` — the same text with every change taken. Insertions kept, struck words gone, no marks left to read around.

That gives you three files and each one has a job:

| File | Who reads it |
|---|---|
| `chapter.md` | the original. What the writer handed in. Never written to. |
| `chapter.edit.md` | the marked copy. What the reviewer reads and approves. |
| `chapter.clean.md` | the clean copy. What gets published. |

Saving the clean copy never touches the other two.

### 8. Preview the clean page

**Preview clean** shows the accepted page — insertions kept, struck words gone — without writing a file and without taking the marks off the edit copy. Click it again to see the marks.

That is how you tell what a reader will get before anyone accepts the changes.

### 9. Save a PDF

**Save PDF** writes `name.pdf` in the same folder. It is a file. It is not the print dialog. The words come from the clean page, so the office gets what will be published.

`chapter.md`, `chapter.edit.md`, and `chapter.clean.md` all resolve to `chapter.pdf`.

### 10. Bold, italic, underline

**Ctrl+B**, **Ctrl+I**, and **Ctrl+U** (Cmd on a Mac) apply while you type. A paragraph whose wording did not change keeps those tags on save. A paragraph whose wording did change is marked in red; the emphasis on that paragraph is rebuilt as words.

## What 0.3.0 adds

| You do this | What happens |
|---|---|
| Open a folder | Hidden names (`.grok`) appear in the list. Type a child name to enter it. |
| Change a sentence and click out | New words in red. Replaced words stay, red, with a line through them. |
| Save | Writes `name.edit.md`. The original file does not change. |
| Open an edit copy next to its original | Struck originals come back onto the page. Save keeps them. |
| Remark | Inserts `[Editor: …]` in the edit copy. |
| Save clean copy | Writes `name.clean.md` with every change taken. |
| Preview clean | Shows the accepted page. Marks stay in the edit copy. |
| Save PDF | Writes `name.pdf`. A file, not a print sheet. |
| Ctrl+B / I / U | Bold, italic, underline. They survive a save when the wording did not change. |

## Requires

- **Chrome** or **Edge** (File System Access API — write back to disk).
- **Not Firefox** for save-to-disk (no equivalent API).

Your file never leaves your computer. The page makes no network requests. It only stores handles to files you opened (IndexedDB in the browser).

## Tests

```bash
node test-blocks.mjs
node test-edits.mjs
node test-saving.mjs
node test-pdf.mjs
./run-browser-tests.sh
```

`test-blocks.mjs` covers the guarantee: split, edit one block, every other block returns identical. Also CRLF normalization.

`test-edits.mjs` covers the red marks, the three file names, and the mark pass: formatting-only does not rebuild a paragraph; a wording change does, and the saved text is not the original. That last case is the save that wrote a file identical to the source on 2026-08-16.

`test-saving.mjs` covers where a copy gets written: the file already open, a sibling in a folder you may write in, a folder that is read-only, a folder that throws, and no folder at all.

`test-pdf.mjs` writes a PDF to a temp file, reads it back, and checks that it starts with `%PDF-` and holds the title as text. `window.print()` is not part of this path.

`run-browser-tests.sh` covers the trip a file actually makes — markdown to HTML and back. Those rules need a real DOM, so it serves `test-roundtrip.html` and runs it in headless Chrome.

The mark pass rebuilds a writer's paragraph. Do not change it without a test that would have failed on 2026-08-16. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Bundled (offline)

- [marked](https://github.com/markedjs/marked) — markdown → HTML. MIT.
- [turndown](https://github.com/mixmark-js/turndown) + GFM plugin — HTML → markdown. MIT.

Nothing is fetched at runtime.

## Related

- Linux terminal version (Python + pandoc): [edit-in-chrome](https://github.com/tadelstein9/edit-in-chrome)
- Essay: [Editing an AI model’s markdown…](https://tomadelstein.substack.com/p/editing-an-ai-models-markdown-md)

## Privacy

Your file never leaves the machine. [PRIVACY.md](PRIVACY.md) is the
page the Chrome Web Store needs.

## License

MIT. See LICENSE.
