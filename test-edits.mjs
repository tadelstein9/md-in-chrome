// Run: node test-edits.mjs
import {
  tokenize, unmarkedBase, acceptedPlain, diffToHtml, escapeHtml,
  editCopyName, originalName, acceptedMarkdown, cleanCopyName,
} from "./edits.js";

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

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
