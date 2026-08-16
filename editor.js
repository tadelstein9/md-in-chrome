import { configureMarked, makeTurndown } from "./md.js";
import { resolveTarget } from "./saving.js";
import {
  splitBlocks,
  isLocked,
  stripNbsp,
  wrap,
  assemble,
  blockPrefix,
  restorePrefix,
  normalizeNewlines,
} from "./blocks.js";
import {
  unmarkedBase,
  editCopyName,
  originalName,
  acceptedMarkdown,
  cleanCopyName,
  decideMarks,
} from "./edits.js";
import { pdfFileName, buildPdfFromMarkdown } from "./pdf.js";

const bar = {
  open: document.getElementById("open"),
  openFolder: document.getElementById("openfolder"),
  backFolder: document.getElementById("backfolder"),
  save: document.getElementById("save"),
  saveClean: document.getElementById("saveclean"),
  savePdf: document.getElementById("savepdf"),
  preview: document.getElementById("preview"),
  markEdits: document.getElementById("markedits"),
  remark: document.getElementById("remark"),
  name: document.getElementById("name"),
  status: document.getElementById("status"),
};
const docEl = document.getElementById("doc");
const welcome = document.getElementById("welcome");
const folderBrowser = document.getElementById("folder-browser");
const folderList = document.getElementById("folder-list");
const folderCrumb = document.getElementById("folder-crumb");
const folderGo = document.getElementById("folder-go");
const folderGoForm = document.getElementById("folder-go-form");

const MD_EXT = /\.(md|markdown|mdown|txt)$/i;

// Folder stack: each entry is a FileSystemDirectoryHandle. The last one is
// the directory on screen. Hidden names (".grok") are listed and can be
// entered — Chrome's own Open dialog hides them.
let folderStack = [];
let browsingFolder = false;

const marked = configureMarked();
const turndown = makeTurndown();

let handle = null;      // FileSystemFileHandle we write to (the edit copy)
let sourceDir = null;   // folder that holds the original, when we have it
let openedName = "";    // name of the file the person opened
let blocks = [];        // every block as it came off disk
let initial = [];       // each block's HTML as first rendered
let basePlain = [];     // unmarked original text of each block
let markEditsOn = true;
let previewClean = false;

// ---------------------------------------------------------------- recent files
//
// A handle cannot be stored in localStorage — it is a live object, and only
// IndexedDB keeps one across sessions. Reopening still asks the browser for
// permission; the handle saves the person hunting for the file again.

const DB = "md-in-chrome", STORE = "handles";

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function remember(h) {
  const conn = await db();
  const tx = conn.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(h, h.name);
  return new Promise((r) => (tx.oncomplete = r));
}

async function recentHandles() {
  const conn = await db();
  const store = conn.transaction(STORE, "readonly").objectStore(STORE);
  const keys = await new Promise((r) => {
    const req = store.getAllKeys();
    req.onsuccess = () => r(req.result);
    req.onerror = () => r([]);
  });
  const out = [];
  for (const key of keys) {
    const h = await new Promise((r) => {
      const req = conn.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(null);
    });
    if (h) out.push(h);
  }
  return out;
}

async function showRecent() {
  const list = document.getElementById("recent");
  const wrapEl = document.getElementById("recent-wrap");
  const items = await recentHandles();
  list.textContent = "";
  wrapEl.hidden = items.length === 0;
  for (const h of items) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = h.name;
    button.addEventListener("click", () => openHandle(h));
    li.appendChild(button);
    list.appendChild(li);
  }
}

// ------------------------------------------------------------------- opening

async function openHandle(h) {
  if (typeof window.showOpenFilePicker !== "function") {
    bar.status.textContent =
      "this browser cannot open disk files here — use Chrome or Edge";
    return;
  }
  const opts = { mode: "readwrite" };
  try {
    if ((await h.queryPermission(opts)) !== "granted" &&
        (await h.requestPermission(opts)) !== "granted") {
      bar.status.textContent = "permission refused — allow edit access to that file";
      return;
    }
  } catch (err) {
    bar.status.textContent = `permission error: ${err.message}`;
    return;
  }
  handle = h;
  openedName = h.name;
  if (folderStack.length) sourceDir = folderStack[folderStack.length - 1];
  else sourceDir = null;
  let text;
  try {
    text = await (await h.getFile()).text();
  } catch (err) {
    bar.status.textContent = `could not read file: ${err.message}`;
    return;
  }
  text = normalizeNewlines(text);
  render(text);
  const restored = await restoreStruckFromOriginal();
  await remember(h);
  bar.name.textContent = crumb() ? `${crumb()} / ${h.name}` : h.name;
  bar.save.hidden = false;
  bar.saveClean.hidden = false;
  bar.savePdf.hidden = false;
  bar.preview.hidden = false;
  document.getElementById("copyall").hidden = false;
  bar.markEdits.hidden = false;
  bar.markEdits.setAttribute("aria-pressed", markEditsOn ? "true" : "false");
  bar.remark.hidden = false;
  welcome.hidden = true;
  folderBrowser.hidden = true;
  docEl.hidden = false;
  bar.backFolder.hidden = folderStack.length === 0;
  bar.status.textContent = restored
    ? `${blocks.length} blocks · ${restored} replacement${restored > 1 ? "s" : ""} now show the old words struck · Save edit copy to keep them`
    : `${blocks.length} blocks · no changes`;
}

bar.open.addEventListener("click", async () => {
  if (typeof window.showOpenFilePicker !== "function") {
    bar.status.textContent =
      "this browser cannot open disk files here — use Chrome or Edge";
    return;
  }
  try {
    const [h] = await window.showOpenFilePicker({
      types: [{
        description: "Markdown",
        accept: {
          "text/markdown": [".md", ".markdown", ".mdown"],
          "text/plain": [".txt", ".md"],
        },
      }],
      multiple: false,
    });
    await openHandle(h);
  } catch (err) {
    if (err.name !== "AbortError") bar.status.textContent = err.message;
  }
});

function crumb() {
  return folderStack.map((h) => h.name).join(" / ");
}

function showFolderPane() {
  welcome.hidden = true;
  docEl.hidden = true;
  folderBrowser.hidden = false;
  bar.save.hidden = true;
  bar.saveClean.hidden = true;
  bar.savePdf.hidden = true;
  bar.preview.hidden = true;
  document.getElementById("copyall").hidden = true;
  bar.markEdits.hidden = true;
  bar.remark.hidden = true;
  setPreview(false);
  bar.backFolder.hidden = true;
  browsingFolder = true;
}

async function listFolder() {
  const dir = folderStack[folderStack.length - 1];
  if (!dir) return;
  const dirs = [];
  const files = [];
  try {
    for await (const [name, h] of dir.entries()) {
      const row = { name, handle: h };
      if (h.kind === "directory") dirs.push(row);
      else if (MD_EXT.test(name)) files.push(row);
    }
  } catch (err) {
    bar.status.textContent = `could not read folder: ${err.message}`;
    return;
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  dirs.sort(byName);
  files.sort(byName);

  folderCrumb.textContent = crumb() || dir.name;
  bar.name.textContent = crumb() || dir.name;
  folderList.textContent = "";

  if (folderStack.length > 1) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.className = "up";
    button.textContent = ".. (up)";
    button.addEventListener("click", () => {
      folderStack.pop();
      listFolder();
    });
    li.appendChild(button);
    folderList.appendChild(li);
  }

  for (const row of dirs) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.className = "dir" + (row.name.startsWith(".") ? " dot" : "");
    button.textContent = row.name + "/";
    button.addEventListener("click", () => enterDir(row.handle));
    li.appendChild(button);
    folderList.appendChild(li);
  }
  for (const row of files) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    if (row.name.startsWith(".")) button.className = "dot";
    button.textContent = row.name;
    button.addEventListener("click", () => openHandle(row.handle));
    li.appendChild(button);
    folderList.appendChild(li);
  }

  const hiddenDirs = dirs.filter((r) => r.name.startsWith(".")).length;
  bar.status.textContent =
    `${dirs.length} folders · ${files.length} markdown files` +
    (hiddenDirs ? ` · ${hiddenDirs} start with .` : "");
  folderGo.value = "";
  folderGo.focus();
}

async function enterDir(handle) {
  folderStack.push(handle);
  await listFolder();
}

async function enterNamed(name) {
  const dir = folderStack[folderStack.length - 1];
  if (!dir) return;
  const trimmed = name.trim().replace(/\/+$/, "");
  if (!trimmed) return;
  if (trimmed === "..") {
    if (folderStack.length > 1) folderStack.pop();
    await listFolder();
    return;
  }
  try {
    const next = await dir.getDirectoryHandle(trimmed);
    await enterDir(next);
  } catch (err) {
    bar.status.textContent =
      `no folder named ${trimmed} here — ${err.message}`;
  }
}

bar.openFolder.addEventListener("click", async () => {
  if (typeof window.showDirectoryPicker !== "function") {
    bar.status.textContent =
      "this browser cannot open folders here — use Chrome or Edge";
    return;
  }
  try {
    // readwrite, or the handle comes back read-only and the edit copy cannot
    // be created beside the original — the save then has to ask where to go,
    // which is the whole reason for opening a folder in the first place.
    const dir = await window.showDirectoryPicker({ mode: "readwrite" });
    folderStack = [dir];
    showFolderPane();
    await listFolder();
  } catch (err) {
    if (err.name !== "AbortError") bar.status.textContent = err.message;
  }
});

bar.backFolder.addEventListener("click", async () => {
  if (!folderStack.length) return;
  showFolderPane();
  await listFolder();
});

folderGoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await enterNamed(folderGo.value);
});

// ------------------------------------------------------------------ rendering

/** Visible words on the page, struck text ignored. */
function currentPlain(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll("del").forEach((n) => n.remove());
  return clone.innerText.replace(/\u00a0/g, " ");
}

function applyEditMark(el) {
  const i = Number(el.dataset.block);
  if (el.dataset.locked === "1") return;
  const host = el.firstElementChild;
  if (host && ["UL", "OL", "TABLE", "PRE"].includes(host.tagName)) return;
  const now = currentPlain(el);
  const prev = basePlain[i] || "";
  const currentHtml = host ? host.innerHTML : el.innerHTML;
  const { rebuild, html } = decideMarks({
    sourceMd: prev,
    currentPlain: now,
    currentHtml,
  });
  if (!rebuild) return;
  if (host) host.innerHTML = html;
  else el.innerHTML = `<p>${html}</p>`;
  el.classList.add("changed");
}

function setPreview(on) {
  previewClean = on;
  docEl.classList.toggle("preview-clean", on);
  if (bar.preview) {
    bar.preview.setAttribute("aria-pressed", on ? "true" : "false");
  }
  for (const el of docEl.querySelectorAll("[data-block]")) {
    if (el.dataset.locked === "1") continue;
    el.contentEditable = on ? "false" : "true";
  }
  if (on) {
    bar.status.textContent = "clean preview — marks still on disk, not on this view";
  }
}

/** When the open file is an edit copy, paint struck originals from the sibling. */
async function restoreStruckFromOriginal() {
  if (!sourceDir || !openedName) return 0;
  const orig = originalName(openedName);
  if (orig === openedName) return 0;
  let origHandle;
  try {
    origHandle = await sourceDir.getFileHandle(orig);
  } catch {
    return 0;
  }
  let origText;
  try {
    origText = normalizeNewlines(await (await origHandle.getFile()).text());
  } catch {
    return 0;
  }
  const origBlocks = splitBlocks(origText);
  const n = Math.min(origBlocks.length, blocks.length);
  let painted = 0;
  for (let i = 0; i < n; i++) {
    basePlain[i] = unmarkedBase(origBlocks[i]);
    const src = blocks[i] || "";
    if (!/class="md-ins"|<del\b/i.test(src)) continue;
    const el = docEl.querySelector(`[data-block="${i}"]`);
    if (!el || el.dataset.locked === "1") continue;
    const before = el.innerHTML;
    applyEditMark(el);
    if (el.innerHTML !== before) painted++;
  }
  return painted;
}

function render(text) {
  blocks = splitBlocks(normalizeNewlines(text));
  initial = [];
  basePlain = [];
  docEl.textContent = "";

  blocks.forEach((block, i) => {
    // Always edit a wrapper div. Putting contenteditable on <table>, <ul>, or
    // <ol> is unreliable in Chrome (focus, selection, and copy break).
    const el = document.createElement("div");
    el.className = "block";
    el.dataset.block = String(i);
    el.innerHTML = marked.parse(block);

    if (isLocked(block)) {
      el.dataset.locked = "1";
    } else {
      el.contentEditable = "true";
      el.spellcheck = true;
    }
    initial[i] = el.innerHTML;
    basePlain[i] = unmarkedBase(block);
    docEl.appendChild(el);
  });
  setPreview(false);
}

docEl.addEventListener("input", (e) => {
  const el = e.target.closest("[data-block]");
  if (!el || el.dataset.locked === "1") return;
  const i = Number(el.dataset.block);
  el.classList.toggle("changed", el.innerHTML !== initial[i]);
  const n = docEl.querySelectorAll("[data-block].changed").length;
  bar.status.textContent = n ? `${n} block${n > 1 ? "s" : ""} changed` : "no changes";
});

docEl.addEventListener("focusout", (e) => {
  if (!markEditsOn) return;
  const el = e.target.closest("[data-block]");
  if (!el || el.dataset.locked === "1") return;
  if (!el.classList.contains("changed")) return;
  applyEditMark(el);
});

bar.markEdits.addEventListener("click", () => {
  markEditsOn = !markEditsOn;
  bar.markEdits.setAttribute("aria-pressed", markEditsOn ? "true" : "false");
  bar.status.textContent = markEditsOn
    ? "new words in red; replaced words stay struck in red"
    : "edit marks off";
});

bar.preview.addEventListener("click", () => {
  setPreview(!previewClean);
});

bar.remark.addEventListener("click", () => {
  const el = document.activeElement && document.activeElement.closest
    ? document.activeElement.closest("[data-block]")
    : null;
  const host = el || docEl.querySelector("[data-block]:not([data-locked])");
  if (!host) {
    bar.status.textContent = "click in a paragraph, then Remark";
    return;
  }
  const note = window.prompt("Editor remark (goes in the edit copy, in red)");
  if (note == null || !String(note).trim()) return;
  const span = document.createElement("span");
  span.className = "md-ins md-remark";
  span.textContent = ` [Editor: ${String(note).trim()}] `;
  const sel = window.getSelection();
  if (sel && sel.rangeCount && host.contains(sel.anchorNode)) {
    sel.getRangeAt(0).deleteContents();
    sel.getRangeAt(0).insertNode(span);
  } else {
    host.appendChild(span);
  }
  host.classList.add("changed");
  bar.status.textContent = "remark added · save writes the edit copy";
});

// -------------------------------------------------------------------- saving

function toMarkdown(el, sourceBlock) {
  const clone = el.cloneNode(true);
  clone.removeAttribute("data-block");
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("spellcheck");
  clone.removeAttribute("class");
  clone.removeAttribute("data-locked");
  // Wrapper div: convert its children, not the empty shell.
  const html = stripNbsp(clone.innerHTML);
  let md = wrap(turndown.turndown(html).trim());
  // If conversion dropped a source marker (heading hashes, quote, list bullet),
  // put it back from the original block.
  md = restorePrefix(md, blockPrefix(sourceBlock));
  return md;
}

async function targetForSave() {
  return targetForName(editCopyName(openedName || handle.name));
}

// Resolve a sibling to write, by name. The edit copy and the clean copy take
// the same route: beside the original when we have the folder, otherwise ask.
async function targetForName(copyName, types) {
  const { route, target } = await resolveTarget({
    copyName,
    handle,
    sourceDir,
    note: (msg) => { bar.status.textContent = msg; },
    pick: (name) => {
      if (typeof window.showSaveFilePicker !== "function") {
        throw new Error("open the file from a folder so the copy can sit beside it");
      }
      return window.showSaveFilePicker({
        suggestedName: name,
        types: types || [{
          description: "Markdown",
          accept: {
            "text/markdown": [".md", ".markdown", ".mdown"],
            "text/plain": [".txt", ".md"],
          },
        }],
      });
    },
  });
  console.log("[md] save route:", route, "->", target && target.name);
  return target;
}

async function save() {
  if (!handle) return;
  if (markEditsOn) {
    for (const el of docEl.querySelectorAll("[data-block].changed")) {
      applyEditMark(el);
    }
  }
  const changed = {};
  for (const el of docEl.querySelectorAll("[data-block].changed")) {
    const i = Number(el.dataset.block);
    changed[i] = toMarkdown(el, blocks[i] || "");
  }
  const count = Object.keys(changed).length;
  if (!count) { bar.status.textContent = "nothing to save"; return; }

  bar.status.textContent = "saving edit copy…";
  try {
    const { text, deleted } = assemble(blocks, changed);
    const dest = await targetForSave();
    const stream = await dest.createWritable();
    await stream.write(text);
    await stream.close();

    const wroteCopy = dest.name !== openedName;
    handle = dest;
    bar.name.textContent = dest.name;
    await remember(dest);

    render(text);
    bar.status.textContent =
      (wroteCopy
        ? `saved ${dest.name} · ${openedName} unchanged`
        : `saved ${dest.name}`) +
      ` · ${count} block${count > 1 ? "s" : ""}` +
      (deleted ? `, removed ${deleted}` : "");
  } catch (err) {
    if (err.name === "AbortError") {
      bar.status.textContent = "save cancelled";
      return;
    }
    bar.status.textContent = `FAILED: ${err.message}`;
  }
}

bar.save.addEventListener("click", save);

// The third file. The original is what the writer submitted, the edit copy is
// what the reviewer marked, and this one is the text with every change taken:
// insertions kept, struck words gone, no marks left to read around. It is the
// copy that gets published, so it never overwrites either of the other two.
async function saveClean() {
  if (!handle) return;
  if (markEditsOn) {
    for (const el of docEl.querySelectorAll("[data-block].changed")) {
      applyEditMark(el);
    }
  }
  const changed = {};
  for (const el of docEl.querySelectorAll("[data-block].changed")) {
    const i = Number(el.dataset.block);
    changed[i] = toMarkdown(el, blocks[i] || "");
  }

  bar.status.textContent = "saving clean copy…";
  try {
    const { text } = assemble(blocks, changed);
    const clean = acceptedMarkdown(text);
    const name = cleanCopyName(openedName || handle.name);
    const dest = await targetForName(name);
    const stream = await dest.createWritable();
    await stream.write(clean);
    await stream.close();
    bar.status.textContent =
      `saved ${dest.name} · every change taken · ${openedName} unchanged`;
  } catch (err) {
    if (err.name === "AbortError") {
      bar.status.textContent = "clean copy cancelled";
      return;
    }
    bar.status.textContent = `FAILED: ${err.message}`;
  }
}

bar.saveClean.addEventListener("click", saveClean);

const PDF_TYPES = [{
  description: "PDF",
  accept: { "application/pdf": [".pdf"] },
}];

async function savePdf() {
  if (!handle) return;
  if (markEditsOn) {
    for (const el of docEl.querySelectorAll("[data-block].changed")) {
      applyEditMark(el);
    }
  }
  const changed = {};
  for (const el of docEl.querySelectorAll("[data-block].changed")) {
    const i = Number(el.dataset.block);
    changed[i] = toMarkdown(el, blocks[i] || "");
  }

  bar.status.textContent = "saving PDF…";
  try {
    const { text } = assemble(blocks, changed);
    const clean = acceptedMarkdown(text);
    const bytes = buildPdfFromMarkdown(clean);
    const name = pdfFileName(openedName || handle.name);
    const dest = await targetForName(name, PDF_TYPES);
    const stream = await dest.createWritable();
    await stream.write(bytes);
    await stream.close();
    bar.status.textContent =
      `saved ${dest.name} · ${bytes.length} bytes · ${openedName} unchanged`;
  } catch (err) {
    if (err.name === "AbortError") {
      bar.status.textContent = "PDF cancelled";
      return;
    }
    bar.status.textContent = `FAILED: ${err.message}`;
  }
}

bar.savePdf.addEventListener("click", savePdf);

// Put the whole document on the clipboard.
//
// Selecting it does not work and cannot be made to: every paragraph is its own
// editable region, and a browser will not carry one selection across separate
// editable regions. Select-all gave one paragraph, then nothing. So skip the
// selection — build the clean HTML and hand it to the clipboard directly.
async function copyWholeDocument() {
  const holder = docEl.cloneNode(true);
  scrubAttributes(holder);
  const html = holder.innerHTML;
  const text = docEl.innerText;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    const words = text.trim().split(/\s+/).length;
    bar.status.textContent = `copied — ${words.toLocaleString()} words, paste anywhere`;
    // Show what went. Without this the button gives no sign it did anything.
    docEl.classList.add("copied");
    clearTimeout(copyWholeDocument.fade);
    copyWholeDocument.fade = setTimeout(() => docEl.classList.remove("copied"), 900);
  } catch (err) {
    bar.status.textContent = `copy failed: ${err.message}`;
  }
}

document.getElementById("copyall").addEventListener("click", copyWholeDocument);

document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const key = e.key.toLowerCase();

  if (key === "s") { e.preventDefault(); save(); return; }

  // Ctrl+A cannot select across separate editable regions, so it copies the
  // whole document instead — which is what a person pressing it here wants.
  if (key === "a") {
    e.preventDefault();
    copyWholeDocument();
    return;
  }

  if (key === "b" || key === "i" || key === "u") {
    if (previewClean) return;
    const el = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest("[data-block]")
      : null;
    if (!el || el.dataset.locked === "1") return;
    e.preventDefault();
    const cmd = { b: "bold", i: "italic", u: "underline" }[key];
    document.execCommand(cmd);
    el.classList.add("changed");
    const n = docEl.querySelectorAll("[data-block].changed").length;
    bar.status.textContent = n ? `${n} block${n > 1 ? "s" : ""} changed` : "no changes";
  }
});

// ----------------------------------------------------------------- clipboard
//
// Copying out of an editable page carries contenteditable, the block ids and
// the page's own padding into whatever you paste into, and a receiving editor
// reads that markup as formatting the author never applied. Clean it here so
// there is no second page to remember.

const KEEP = {
  A: ["href"],
  IMG: ["src", "alt"],
  TD: ["colspan", "rowspan"],
  TH: ["colspan", "rowspan"],
  SPAN: ["class"],
  DEL: ["class"],
};

// Strip everything the editor added, keep what is the document.
function scrubAttributes(node) {
  for (const el of node.querySelectorAll("#bar")) el.remove();
  for (const el of node.querySelectorAll("*")) {
    const keep = KEEP[el.tagName] || [];
    for (const attr of [...el.attributes]) if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
  }
  return node;
}

document.addEventListener("copy", (e) => {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const holder = document.createElement("div");
  for (let i = 0; i < sel.rangeCount; i++) holder.appendChild(sel.getRangeAt(i).cloneContents());
  scrubAttributes(holder);
  e.clipboardData.setData("text/html", holder.innerHTML);
  e.clipboardData.setData("text/plain", sel.toString());
  e.preventDefault();
});

window.addEventListener("beforeunload", (e) => {
  if (docEl.querySelector("[data-block].changed")) e.preventDefault();
});

showRecent();
