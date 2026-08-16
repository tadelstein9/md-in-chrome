// Run: node test-saving.mjs
//
// Every route the save can take, with fake handles. Written 2026-08-16 after
// the tool sent a person to a Save dialog when they had a folder open, and no
// test in the repo could reach the code that decided that.
import { resolveTarget, ROUTE, REASON } from "./saving.js";

let pass = 0, fail = 0;
function ok(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`); }
}

/** A folder handle whose permission answers however the test says. */
function folder({ query = "granted", request = "granted", create = null } = {}) {
  const calls = { created: [] };
  return {
    calls,
    async queryPermission() { return query; },
    async requestPermission() { return request; },
    async getFileHandle(name, opts) {
      calls.created.push([name, opts]);
      if (create instanceof Error) throw create;
      return { name };
    },
  };
}

function picker() {
  const calls = [];
  const fn = async (name) => { calls.push(name); return { name, picked: true }; };
  fn.calls = calls;
  return fn;
}

const OPEN = { name: "chapter.md" };

console.log("writing to the file already open");
{
  const pick = picker();
  const r = await resolveTarget({
    copyName: "chapter.edit.md", handle: { name: "chapter.edit.md" },
    sourceDir: folder(), pick,
  });
  ok("reopened edit copy updates itself", r.route, ROUTE.SAME_FILE);
  ok("and never asks", pick.calls.length, 0);
}

console.log("a folder we may write in");
{
  const dir = folder();
  const pick = picker();
  const r = await resolveTarget({
    copyName: "chapter.edit.md", handle: OPEN, sourceDir: dir, pick,
  });
  ok("writes a sibling", r.route, ROUTE.SIBLING);
  ok("creates the right name", dir.calls.created, [["chapter.edit.md", { create: true }]]);
  ok("does not ask the person", pick.calls.length, 0);
}

console.log("a folder that was opened read-only");
{
  // The 0.2.5 defect: showDirectoryPicker() with no mode hands back a
  // read-only handle, so the copy could never be created beside the original.
  const dir = folder({ query: "prompt", request: "denied" });
  const pick = picker();
  const said = [];
  const r = await resolveTarget({
    copyName: "chapter.edit.md", handle: OPEN, sourceDir: dir, pick,
    note: (m) => said.push(m),
  });
  ok("falls back to asking", r.route, ROUTE.ASK);
  ok("says why", said, [REASON.READ_ONLY]);
  ok("never tries to create", dir.calls.created, []);
}

console.log("a folder that grants on request");
{
  const dir = folder({ query: "prompt", request: "granted" });
  const pick = picker();
  const r = await resolveTarget({
    copyName: "chapter.edit.md", handle: OPEN, sourceDir: dir, pick,
  });
  ok("prompting once is enough", r.route, ROUTE.SIBLING);
  ok("still does not ask", pick.calls.length, 0);
}

console.log("no folder at all");
{
  const pick = picker();
  const said = [];
  const r = await resolveTarget({
    copyName: "chapter.edit.md", handle: OPEN, sourceDir: null, pick,
    note: (m) => said.push(m),
  });
  ok("asks the person", r.route, ROUTE.ASK);
  ok("names the reason", said, [REASON.NO_FOLDER]);
  ok("suggests the copy name", pick.calls, ["chapter.edit.md"]);
}

console.log("the folder throws");
{
  const err = new Error("nope"); err.name = "NotAllowedError";
  const dir = folder({ create: err });
  const pick = picker();
  const said = [];
  const r = await resolveTarget({
    copyName: "chapter.edit.md", handle: OPEN, sourceDir: dir, pick,
    note: (m) => said.push(m),
  });
  ok("falls back rather than failing", r.route, ROUTE.ASK);
  ok("names the error", said, [`${REASON.FAILED} (NotAllowedError)`]);
}

console.log("the person cancels the picker");
{
  const abort = new Error("cancelled"); abort.name = "AbortError";
  const dir = { async queryPermission() { throw abort; } };
  let threw = null;
  try {
    await resolveTarget({
      copyName: "chapter.edit.md", handle: OPEN, sourceDir: dir,
      pick: picker(),
    });
  } catch (e) { threw = e.name; }
  ok("a cancel is not swallowed", threw, "AbortError");
}

console.log("the clean copy takes the same routes");
{
  const dir = folder();
  const r = await resolveTarget({
    copyName: "chapter.clean.md", handle: OPEN, sourceDir: dir, pick: picker(),
  });
  ok("sibling", r.route, ROUTE.SIBLING);
  ok("named clean", dir.calls.created, [["chapter.clean.md", { create: true }]]);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
