import { marked } from "./lib/marked.esm.js";
import TurndownService from "./lib/turndown.es.js";
import { gfm } from "./lib/turndown-gfm.es.js";
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

const bar = {
  open: document.getElementById("open"),
  save: document.getElementById("save"),
  name: document.getElementById("name"),
  status: document.getElementById("status"),
};
const docEl = document.getElementById("doc");
const welcome = document.getElementById("welcome");

marked.setOptions({ gfm: true, breaks: false });

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// Without this, turndown has no idea what a table is and returns its cells as
// a column of loose paragraphs. Editing one word in a table would destroy it.
turndown.use(gfm);

// Turndown pads a list marker out to three spaces — "-   one" where the file
// said "- one". Every list in the document would rewrite itself on the first
// save. Match the source instead.
turndown.addRule("tightListItem", {
  filter: "li",
  replacement(content, node, options) {
    content = content.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n/gm, "\n  ");
    let prefix = options.bulletListMarker + " ";
    const parent = node.parentNode;
    if (parent.nodeName === "OL") {
      const start = parent.getAttribute("start");
      const i = Array.prototype.indexOf.call(parent.children, node);
      prefix = (start ? Number(start) + i : i + 1) + ". ";
    }
    return prefix + content + (node.nextSibling && !/\n$/.test(content) ? "\n" : "");
  },
});

let handle = null;      // FileSystemFileHandle for the open file
let blocks = [];        // every block as it came off disk
let initial = [];       // each block's HTML as first rendered

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
  let text;
  try {
    text = await (await h.getFile()).text();
  } catch (err) {
    bar.status.textContent = `could not read file: ${err.message}`;
    return;
  }
  text = normalizeNewlines(text);
  render(text);
  await remember(h);
  bar.name.textContent = h.name;
  bar.save.hidden = false;
  document.getElementById("copyall").hidden = false;
  welcome.hidden = true;
  docEl.hidden = false;
  bar.status.textContent = `${blocks.length} blocks · no changes`;
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

// ------------------------------------------------------------------ rendering

function render(text) {
  blocks = splitBlocks(normalizeNewlines(text));
  initial = [];
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
    docEl.appendChild(el);
  });
}

docEl.addEventListener("input", (e) => {
  const el = e.target.closest("[data-block]");
  if (!el || el.dataset.locked === "1") return;
  const i = Number(el.dataset.block);
  el.classList.toggle("changed", el.innerHTML !== initial[i]);
  const n = docEl.querySelectorAll("[data-block].changed").length;
  bar.status.textContent = n ? `${n} block${n > 1 ? "s" : ""} changed` : "no changes";
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

async function save() {
  if (!handle) return;
  const changed = {};
  for (const el of docEl.querySelectorAll("[data-block].changed")) {
    const i = Number(el.dataset.block);
    changed[i] = toMarkdown(el, blocks[i] || "");
  }
  const count = Object.keys(changed).length;
  if (!count) { bar.status.textContent = "nothing to save"; return; }

  bar.status.textContent = "saving…";
  try {
    const { text, deleted } = assemble(blocks, changed);
    const stream = await handle.createWritable();
    await stream.write(text);
    await stream.close();

    render(text);   // re-read our own output so indices and originals stay true
    bar.status.textContent =
      `saved ${count} block${count > 1 ? "s" : ""}` +
      (deleted ? `, removed ${deleted}` : "");
  } catch (err) {
    bar.status.textContent = `FAILED: ${err.message}`;
  }
}

bar.save.addEventListener("click", save);

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
  }
});

// ----------------------------------------------------------------- clipboard
//
// Copying out of an editable page carries contenteditable, the block ids and
// the page's own padding into whatever you paste into, and a receiving editor
// reads that markup as formatting the author never applied. Clean it here so
// there is no second page to remember.

const KEEP = { A: ["href"], IMG: ["src", "alt"], TD: ["colspan", "rowspan"], TH: ["colspan", "rowspan"] };

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
