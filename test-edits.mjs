// Run: node test-edits.mjs
import {
  tokenize, unmarkedBase, acceptedPlain, diffToHtml, escapeHtml,
  editCopyName, originalName, acceptedMarkdown, cleanCopyName,
  visiblePlain, decideMarks,
} from "./edits.js";
import { assemble } from "./blocks.js";

let pass = 0, fail = 0;
function ok(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`); }
}

console.log("tokenize");
ok("words and spaces", tokenize("a b"), ["a", " ", "b"]);

console.log("unmarkedBase");
ok("strips red insert", unmarkedBase('Hello <span class="md-ins">there</span>.'), "Hello .");
ok("restores deleted", unmarkedBase("Hello <del>old</del>."), "Hello old.");

console.log("acceptedPlain");
ok("keeps insert, drops del",
  acceptedPlain('Hello <del>old</del> <span class="md-ins">new</span>.'),
  "Hello  new.");

console.log("escapeHtml");
ok("amp", escapeHtml("a & b"), "a &amp; b");

console.log("diffToHtml");
ok("one word added",
  diffToHtml("The cat sat", "The cat sat here"),
  'The cat sat<span class="md-ins"> </span><span class="md-ins">here</span>');
ok("replace word",
  diffToHtml("The cat sat", "The dog sat"),
  'The <del class="md-del">cat</del><span class="md-ins">dog</span> sat');
ok("delete word",
  diffToHtml("The cat sat", "The sat"),
  'The <del class="md-del">cat</del><del class="md-del"> </del>sat');
ok("no change", diffToHtml("Same.", "Same."), "Same.");
ok("second pass against accepted text is stable",
  diffToHtml("The cat sat", acceptedPlain(diffToHtml("The cat sat", "The dog sat"))),
  'The <del class="md-del">cat</del><span class="md-ins">dog</span> sat');

console.log("editCopyName");
ok("md", editCopyName("getting-started.md"), "getting-started.edit.md");
ok("already a copy", editCopyName("getting-started.edit.md"), "getting-started.edit.md");
ok("txt", editCopyName("notes.txt"), "notes.edit.txt");
ok("original from copy", originalName("getting-started.edit.md"), "getting-started.md");
ok("original stays", originalName("getting-started.md"), "getting-started.md");

console.log("cleanCopyName");
ok("md", cleanCopyName("chapter.md"), "chapter.clean.md");
ok("from an edit copy", cleanCopyName("chapter.edit.md"), "chapter.clean.md");
ok("already clean", cleanCopyName("chapter.clean.md"), "chapter.clean.md");
ok("txt", cleanCopyName("notes.txt"), "notes.clean.txt");

console.log("acceptedMarkdown");
ok("keeps the insertion",
  acceptedMarkdown('The <span class="md-ins">dog</span> sat.'), "The dog sat.");
ok("drops the struck words",
  acceptedMarkdown('The <del class="md-del">cat</del>dog sat.'), "The dog sat.");
ok("a replacement resolves to the new wording",
  acceptedMarkdown(diffToHtml("The cat sat", "The dog sat")), "The dog sat");
// The reason this function exists rather than acceptedPlain: a document may
// carry HTML of its own, and a clean copy that quietly ate it would lose work.
ok("leaves other html alone",
  acceptedMarkdown('A <br> and an <img src="x.png"> stay.'),
  'A <br> and an <img src="x.png"> stay.');
ok("acceptedPlain would have eaten them",
  acceptedPlain('A <br> and an <img src="x.png"> stay.'), "A  and an  stay.");
ok("no marks, nothing changes",
  acceptedMarkdown("# A heading\n\nPlain text."), "# A heading\n\nPlain text.");
ok("drops an editor remark",
  acceptedMarkdown('Hello <span class="md-ins md-remark"> [Editor: cut this] </span>there.'),
  "Hello there.");

console.log("visiblePlain");
ok("strips bold markers", visiblePlain("A **bold** word."), "A bold word.");
ok("strips italic markers", visiblePlain("An *italic* word."), "An italic word.");
ok("strips a heading hash", visiblePlain("## A heading"), "A heading");
ok("matches rendered text", visiblePlain("A **bold** word."), "A bold word.");

console.log("decideMarks — formatting must not eat a save");
{
  const source = "A **bold** word.";
  const formatOnly = decideMarks({
    sourceMd: source,
    currentPlain: "A bold word.",
    currentHtml: "<p>A <strong>bold</strong> word.</p>",
  });
  ok("Ctrl+B does not rebuild", formatOnly.rebuild, false);
  ok("and keeps the tags", formatOnly.html, "<p>A <strong>bold</strong> word.</p>");

  const reworded = decideMarks({
    sourceMd: source,
    currentPlain: "A bold phrase.",
    currentHtml: "<p>A <strong>bold</strong> phrase.</p>",
  });
  ok("a wording change does rebuild", reworded.rebuild, true);
  const hasNew = reworded.html.includes("phrase");
  const hasMark = /md-ins|md-del/.test(reworded.html);
  ok("the new word is in the marks", hasNew, true);
  ok("the marks are actually marks", hasMark, true);

  // The 2026-08-16 failure: after the mark pass, assemble wrote a file
  // byte-identical to the original. This is that case, as a test.
  const original = [
    "# Colophon Works",
    "Open a markdown file in Chrome and read it.",
  ];
  const decision = decideMarks({
    sourceMd: original[1],
    currentPlain: "Open a markdown file in Chrome so you can read it.",
    currentHtml: "<p>Open a markdown file in Chrome so you can read it.</p>",
  });
  ok("a reworded line is rebuilt", decision.rebuild, true);
  const { text } = assemble(original, { 1: decision.html });
  ok("the saved file is not the original", text === original.join("\n\n") + "\n", false);
  ok("the saved file has the new wording",
    acceptedMarkdown(text).includes("so you can"), true);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
