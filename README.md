# Markdown in Chrome

**Beta.** Version 0.1.0, first released 5 August 2026. It has been run on Linux
Mint with Chrome and it does what this page says. Nobody has yet run it on a Mac
or on Windows, and it has not been through the Chrome Web Store.

**Keep a copy of anything you care about before you edit it here.** The program
writes to your file. The rule it works by — rewrite only the paragraphs you
touched, leave everything else alone — is covered by tests, and tests are not the
same as a year of other people using it.

Open a markdown file, read it the way it is meant to look, fix what you find
while you are looking at it, and save it back to the same file.

No terminal. No Python. Nothing to install but the extension.

## Why

A model hands you a chapter, a report, a set of notes, and it arrives as `.md`.
You open it and get pound signs where the headings should be, asterisks standing
in for bold, and a table drawn as a fence of pipes.

So you paste it somewhere that renders it, read it properly, find the sentence
that goes wrong — and discover the thing showing it to you has no way to write a
correction back. You go to your editor, change the word, and lose the ability to
see what you changed.

Two tools, and neither does both halves of the job.

## What it does to your file

Converting a whole edited page back to markdown re-wraps every line and
normalises every emphasis mark, so changing one word produces a diff across the
whole file, and the history stops being worth reading.

Instead the file is cut into blocks on blank lines. Each block is rendered on its
own. When you save, only the blocks whose text you changed are converted back.
**Every block you did not touch is written out character for character, exactly as
it arrived.**

Change one word, get a one-word diff.

A fenced code block is read-only. Editing code in a browser and converting it
back is how indentation dies.

## Install

Not on the Chrome Web Store yet. To run it now:

1. Clone or download this directory.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**, top right.
4. Click **Load unpacked** and choose this directory.
5. Click the toolbar button. The editor opens in its own tab.

## Using it

Click **Open a markdown file** and pick your file. The browser asks once for
permission to write to it.

The block you are editing takes a highlight. A block you have changed keeps a
gold bar down its left edge, and the bar at the top counts them. **Ctrl+S** saves
and reports how many blocks it wrote.

Empty a block and it disappears from the file when you save.

Files you have opened appear on the front page, so you point at a file once
rather than hunting for it again.

Copying is safe from anywhere on the page. The page cleans the clipboard on the
way out — no editing attributes, no block ids, no padding — so a paste into
Substack, Word or LibreOffice arrives as your document and not as the editor's
markup.

## Requires

Chrome or Edge. The file write-back uses the browser's file access, which Firefox
does not have.

Your file never leaves your computer. The page makes no network requests and
stores nothing but a pointer to files you opened, in the browser's own storage.

## Tests

```
node test-blocks.mjs
```

Covers the guarantee: split, edit one block, and confirm every other block comes
back identical.

## Bundled

- [marked](https://github.com/markedjs/marked) — markdown to HTML. MIT.
- [turndown](https://github.com/mixmark-io/turndown) and its GFM plugin — HTML
  back to markdown. MIT.

Both ship inside the extension. Nothing is fetched at runtime.

## License

MIT. See LICENSE.
