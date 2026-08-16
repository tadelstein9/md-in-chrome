// Run: node test-pdf.mjs
//
// A green suite here means a file on disk starts with %PDF- and holds
// the title as selectable text. window.print() never enters this file.
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  pdfFileName,
  looksLikePdf,
  pdfContains,
  markdownToItems,
  buildPdfFromMarkdown,
} from "./pdf.js";

let pass = 0, fail = 0;
function ok(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`); }
}

console.log("pdfFileName");
ok("md", pdfFileName("chapter.md"), "chapter.pdf");
ok("from an edit copy", pdfFileName("chapter.edit.md"), "chapter.pdf");
ok("from a clean copy", pdfFileName("chapter.clean.md"), "chapter.pdf");
ok("txt", pdfFileName("notes.txt"), "notes.pdf");

console.log("markdownToItems");
const items = markdownToItems(
  "# Colophon Works\n\nA colophon is the printer's note.\n\n- one tool\n- another"
);
ok("heading first", items[0] && items[0].tag, "h1");
ok("heading text", items[0] && items[0].text, "Colophon Works");
ok("paragraph next", items[1] && items[1].tag, "p");
ok("list items", items.filter((i) => i.tag === "li").length, 2);

console.log("the file on disk");
const md = "# Colophon Works\n\nTools for writers using AI.\n";
const bytes = buildPdfFromMarkdown(md);
ok("starts with %PDF-", looksLikePdf(bytes), true);
ok("holds the title", pdfContains(bytes, "Colophon Works"), true);
ok("holds the body", pdfContains(bytes, "Tools for writers using AI"), true);
ok("is not empty", bytes.length > 200, true);

const path = join(tmpdir(), "md-in-chrome-test.pdf");
writeFileSync(path, bytes);
const back = readFileSync(path);
ok("round-trip still a PDF", looksLikePdf(back), true);
ok("round-trip still has the title", pdfContains(back, "Colophon Works"), true);
unlinkSync(path);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
