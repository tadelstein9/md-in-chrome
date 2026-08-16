// The markdown conversion, on its own so a test can drive it.
//
// This module holds every rule that decides what a saved file looks like. It
// lived inside editor.js until 2026-08-16, where nothing could reach it: the
// node tests only cover pure string functions, and turndown needs a real DOM.
// A rule that never fired therefore shipped in 0.2.0 and again in 0.2.5 — the
// redDelete filter read "DEL", turndown compares a string filter against
// node.nodeName.toLowerCase(), and so every struck word was written by the GFM
// plugin as ~word~ instead. Run test-roundtrip.html in a browser to hold it.

import { marked } from "./lib/marked.esm.js";
import TurndownService from "./lib/turndown.es.js";
import { gfm } from "./lib/turndown-gfm.es.js";

export function configureMarked() {
  marked.setOptions({ gfm: true, breaks: false });
  return marked;
}

export function makeTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Without this, turndown has no idea what a table is and returns its cells
  // as a column of loose paragraphs. Editing one word in a table would destroy
  // it.
  turndown.use(gfm);

  // The two edit marks have to survive the trip back to disk as the same HTML
  // they went out as. Anything else and the accept and revert passes cannot
  // find them on the next open.
  turndown.addRule("redInsert", {
    filter(node) {
      return node.nodeName === "SPAN" && node.classList &&
             node.classList.contains("md-ins");
    },
    replacement(content, node) {
      const cls = (node.className || "md-ins").trim() || "md-ins";
      return `<span class="${cls}">${content}</span>`;
    },
  });

  // Lower case, and it matters. Turndown tests a string filter with
  // `filter === node.nodeName.toLowerCase()`. "DEL" never matches, the GFM
  // strikethrough rule takes the node instead, and a line that begins with the
  // tildes it writes opens a fenced code block on the next render.
  turndown.addRule("redDelete", {
    filter: "del",
    replacement(content) {
      return `<del class="md-del">${content}</del>`;
    },
  });

  // Markdown has no underline, so Ctrl+U has nowhere to go unless the tag
  // itself is written into the file. Markdown carries inline HTML, marked
  // renders it back, and the writer gets to keep the underline they applied.
  turndown.addRule("underline", {
    filter: "u",
    replacement(content) {
      return `<u>${content}</u>`;
    },
  });

  // Turndown pads a list marker out to three spaces — "-   one" where the file
  // said "- one". Every list in the document would rewrite itself on the first
  // save. Match the source instead.
  turndown.addRule("tightListItem", {
    filter: "li",
    replacement(content, node, options) {
      content = content.replace(/^\n+/, "").replace(/\n+$/, "\n")
                       .replace(/\n/gm, "\n  ");
      let prefix = options.bulletListMarker + " ";
      const parent = node.parentNode;
      if (parent.nodeName === "OL") {
        const start = parent.getAttribute("start");
        const i = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + i : i + 1) + ". ";
      }
      return prefix + content +
             (node.nextSibling && !/\n$/.test(content) ? "\n" : "");
    },
  });

  return turndown;
}
