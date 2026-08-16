// Run: node test-format.mjs
import { wordOffsets } from "./format.js";

let pass = 0, fail = 0;
function ok(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`); }
}

console.log("wordOffsets");
ok("middle of a word", wordOffsets("One em dash", 5), { start: 4, end: 6 });
ok("start of a word", wordOffsets("One em dash", 4), { start: 4, end: 6 });
ok("end of a word", wordOffsets("One em dash", 6), { start: 4, end: 6 });
ok("between two spaces", wordOffsets("One  em", 4), { start: 4, end: 4 });
ok("empty", wordOffsets("", 0), { start: 0, end: 0 });

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
