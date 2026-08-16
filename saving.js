// Where a copy gets written, decided separately from the browser.
//
// This is the path that sent people to a Save dialog when they had already
// opened a folder, and nothing could test it: the logic sat inside editor.js
// wrapped around live FileSystemHandles, so it only ran when a person clicked.
// Everything the browser supplies is passed in, which lets the tests drive all
// four routes with plain objects.
//
// The order is fixed:
//   1. writing to the file already open  -> that handle
//   2. a folder we may write in          -> a sibling in that folder
//   3. anything else                     -> ask the person

export const ROUTE = {
  SAME_FILE: "same-file",
  SIBLING: "sibling",
  ASK: "ask",
};

/** Why we could not write beside the original. Shown in the status bar. */
export const REASON = {
  NO_FOLDER: "no folder open — use Open a folder, then pick the file from the list",
  READ_ONLY: "that folder is read-only here — choose where to save",
  FAILED: "cannot write in that folder — choose where to save",
};

/**
 * @param {object} o
 * @param {string} o.copyName      name we want to write, e.g. "chapter.edit.md"
 * @param {object} o.handle        the open file's handle ({name})
 * @param {object|null} o.sourceDir  directory handle, when we have one
 * @param {function} o.pick        called when the person must choose
 * @param {function} [o.note]      called with a REASON before pick()
 * @returns {Promise<{route: string, target: object}>}
 */
export async function resolveTarget({ copyName, handle, sourceDir, pick, note }) {
  if (handle && copyName === handle.name) {
    return { route: ROUTE.SAME_FILE, target: handle };
  }

  if (!sourceDir) {
    if (note) note(REASON.NO_FOLDER);
    return { route: ROUTE.ASK, target: await pick(copyName) };
  }

  const opts = { mode: "readwrite" };
  try {
    let state = await sourceDir.queryPermission(opts);
    if (state !== "granted") state = await sourceDir.requestPermission(opts);
    if (state === "granted") {
      const target = await sourceDir.getFileHandle(copyName, { create: true });
      return { route: ROUTE.SIBLING, target };
    }
    if (note) note(REASON.READ_ONLY);
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    if (note) note(`${REASON.FAILED} (${(err && err.name) || "error"})`);
  }

  return { route: ROUTE.ASK, target: await pick(copyName) };
}
