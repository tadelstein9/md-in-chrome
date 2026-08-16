# Joining this repository

The product is a Chrome extension. A model writes a `.md` file. A person
has to read it, fix it, show the team what changed, and hand the office
a file it will open.

GitHub is the tree. Push a finished piece. Do not hold a working change
for a store upload.

## Three files, then two views

| File or view | Job |
|---|---|
| `name.md` | the original. Never written to. |
| `name.edit.md` | marks. The team traces and decides. |
| `name.clean.md` | the accepted page. What gets published. |
| Preview clean | the accepted page on screen. No write. |
| `name.pdf` | the office file. Built in the page. Not the print dialog. |

## Tests

```bash
node test-blocks.mjs
node test-edits.mjs
node test-saving.mjs
node test-pdf.mjs
./run-browser-tests.sh
```

`applyEditMark` in `editor.js` calls `decideMarks` in `edits.js`. That
function rebuilds a writer's paragraph. A change there needs a test that
writes a file (or assembles one) and reads it back. A green suite that
never calls it has already shipped a dead rule twice and, on
2026-08-16, wrote an edit copy that was byte-identical to the original.

`window.print()` is not a PDF. Do not put it back.

## Load unpacked

`chrome://extensions` → Developer mode → Load unpacked → this folder.
After a pull, click Reload on the card, then refresh the editor tab.

`./pack.sh` builds the zip the Chrome Web Store and a friend both load.

## What stays out of a commit

Do not add a `Co-Authored-By` trailer. Author is the person who writes
the commit.

The Chrome Web Store listing, and any line that points this work at a
larger house, are written by Tom. Leave them off a code commit.
