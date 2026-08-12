// Tests for the part that has to be right. Run: node test-blocks.mjs
//
// These check the guarantee the whole program rests on — that a block the
// author did not touch comes back character for character.

import {
  splitBlocks, isLocked, blockPrefix, stripNbsp, wrap, restorePrefix, assemble,
  normalizeNewlines,
} from "./blocks.js";

let pass = 0, fail = 0;

function ok(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`); }
}

const SAMPLE = `# A heading

A paragraph with **bold** in it.

\`\`\`
code block

with a blank line inside it
\`\`\`

- a list item
- another

> a quotation
`;

console.log("normalizeNewlines");
ok("crlf to lf", normalizeNewlines("a\r\nb\r\n"), "a\nb\n");
ok("lone cr", normalizeNewlines("a\rb"), "a\nb");

console.log("splitBlocks");
const blocks = splitBlocks(SAMPLE);
ok("counts the blocks", blocks.length, 5);
ok("keeps a fence whole", blocks[2].split("\n").length, 5);
ok("heading survives", blocks[0], "# A heading");
ok("crlf file has clean blocks", splitBlocks("A\r\n\r\nB\r\n"), ["A", "B"]);

console.log("isLocked");
ok("fence is locked", isLocked(blocks[2]), true);
ok("paragraph is not", isLocked(blocks[1]), false);

console.log("blockPrefix");
ok("heading", blockPrefix("## Two"), "## ");
ok("quote", blockPrefix("> said"), "> ");
ok("bullet", blockPrefix("- one"), "- ");
ok("ordered", blockPrefix("3. three"), "3. ");
ok("plain paragraph has none", blockPrefix("just words"), null);

console.log("stripNbsp");
ok("removes U+00A0", stripNbsp("a b"), "a b");
ok("removes the entity", stripNbsp("a&nbsp;b"), "a b");

console.log("wrap");
const long = "word ".repeat(40).trim();
ok("wraps past the column", wrap(long, 40).split("\n").every((l) => l.length <= 40), true);
ok("leaves a short line alone", wrap("short", 40), "short");
ok("leaves a table row alone", wrap("| a | " + "x".repeat(200) + " |", 40).includes("\n"), false);

console.log("restorePrefix");
ok("adds a lost marker", restorePrefix("Two", "## "), "## Two");
ok("does not double it", restorePrefix("## Two", "## "), "## Two");

console.log("assemble — the guarantee");
const original = splitBlocks(SAMPLE);
const one = assemble(original, { 1: "A paragraph with **bold** in it, edited." });
ok("only the edited block differs",
   splitBlocks(one.text).filter((b, i) => b !== original[i]).length, 1);
ok("the fence came through untouched", splitBlocks(one.text)[2], original[2]);
ok("nothing was deleted", one.deleted, 0);

const none = assemble(original, {});
ok("no edits means the file is unchanged", none.text.trimEnd(), SAMPLE.trimEnd());

const gone = assemble(original, { 1: "" });
ok("an emptied block is removed", splitBlocks(gone.text).length, original.length - 1);
ok("and is counted", gone.deleted, 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
