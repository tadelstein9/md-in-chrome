// Bold, italic, underline from the keyboard.
//
// Chrome's own Ctrl+B in a contenteditable only arms bold for the next
// keystroke when the caret sits in a word. The word on the page does not
// change, which reads as "it isn't taking." Linux Chrome also binds
// Ctrl+B to Bookmarks. This module expands a caret to the word it is
// in, wraps that word, and the editor listener takes the key in the
// capture phase so Bookmarks never sees it.

export function wordOffsets(text, offset) {
  const s = String(text);
  let start = Math.max(0, Math.min(Number(offset) || 0, s.length));
  let end = start;
  const at = start < s.length ? s[start] : "";
  const before = start > 0 ? s[start - 1] : "";
  if (!/\S/.test(at) && !/\S/.test(before)) return { start, end };
  while (start > 0 && /\S/.test(s[start - 1])) start--;
  while (end < s.length && /\S/.test(s[end])) end++;
  return { start, end };
}

function tagFor(kind) {
  if (kind === "b" || kind === "bold" || kind === "strong") return "STRONG";
  if (kind === "i" || kind === "italic" || kind === "em") return "EM";
  if (kind === "u" || kind === "underline") return "U";
  return null;
}

function enclosing(node, tagName, root) {
  let el = node && node.nodeType === 3 ? node.parentElement : node;
  while (el && el !== root && el.nodeType === 1) {
    if (el.tagName === tagName) return el;
    el = el.parentElement;
  }
  return null;
}

function unwrap(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function rangeForWord(sel) {
  const range = sel.getRangeAt(0).cloneRange();
  if (!range.collapsed) return range;
  const node = range.startContainer;
  if (node.nodeType !== 3) return range;
  const { start, end } = wordOffsets(node.textContent, range.startOffset);
  if (start === end) return range;
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

/** Wrap or unwrap the selection (or the word at the caret) in strong/em/u.
 *  Returns the block element that changed, or null. */
export function toggleInline(kind, root) {
  const tag = tagFor(kind);
  const sel = window.getSelection();
  if (!tag || !sel || !sel.rangeCount) return null;

  let node = sel.anchorNode;
  if (node && node.nodeType === 3) node = node.parentElement;
  const block = node && node.closest && node.closest("[data-block]");
  if (!block || (root && !root.contains(block))) return null;
  if (block.dataset.locked === "1") return null;

  const range = rangeForWord(sel);
  if (range.collapsed) return null;

  const already = enclosing(range.commonAncestorContainer, tag, block);
  if (already) {
    unwrap(already);
  } else {
    const wrap = document.createElement(tag.toLowerCase());
    try {
      range.surroundContents(wrap);
    } catch {
      wrap.appendChild(range.extractContents());
      range.insertNode(wrap);
    }
  }

  sel.removeAllRanges();
  return block;
}
