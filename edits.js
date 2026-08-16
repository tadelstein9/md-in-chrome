// Word-level edit marks.
//   New words:     <span class="md-ins">word</span>     (red)
//   Replaced/cut:  <del class="md-del">word</del>       (red, struck)
// Both stay in the edit copy. The unmarked base of a block is the source
// with insertions stripped and deletions restored, so a later edit of the
// same paragraph still paints every change against the original wording.

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function tokenize(s) {
  return String(s).split(/(\s+)/).filter((t) => t.length);
}

/** Text as it stood before any red insertion in this file. */
export function unmarkedBase(md) {
  return String(md)
    .replace(/<span\b[^>]*class="md-ins"[^>]*>([\s\S]*?)<\/span>/gi, "")
    .replace(/<del\b[^>]*>([\s\S]*?)<\/del>/gi, "$1")
    .replace(/<[^>]+>/g, "");
}

/** Visible words. Markdown emphasis and HTML are stripped so a paragraph
 *  that carries **bold** can be compared to the text on the page. The mark
 *  pass used to compare source against rendered text, so no emphasized
 *  block could match itself, and a save wrote the original back. */
export function visiblePlain(md) {
  let s = unmarkedBase(md);
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/<\/?u>/gi, "");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^>\s?/gm, "");
  s = s.replace(/^[-*]\s+/gm, "");
  s = s.replace(/^\d+\.\s+/gm, "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Decide whether to rebuild a block as red marks.
 *
 * Wording unchanged (Ctrl+B / I / U, or a click-out): keep the HTML the
 * browser already has, including its tags. Wording changed: word-diff the
 * visible text, not the markdown source. Diffing source against rendered
 * text is what turned a real edit file back into the original.
 */
export function decideMarks({ sourceMd, currentPlain, currentHtml }) {
  const prev = visiblePlain(sourceMd);
  const now = visiblePlain(currentPlain);
  if (now === prev) {
    return { rebuild: false, html: currentHtml };
  }
  return { rebuild: true, html: diffToHtml(prev, now) };
}

/** Text as it stands now: insertions kept, struck words dropped. */
export function acceptedPlain(md) {
  return String(md)
    .replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, "")
    .replace(/<span\b[^>]*class="md-ins"[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<[^>]+>/g, "");
}

/** Markdown with every change taken: insertions kept, struck words dropped,
 *  and only the mark tags removed. Unlike acceptedPlain this leaves any other
 *  HTML in the document alone, so a clean copy of a file carrying real inline
 *  HTML comes out with that HTML still in it. */
export function acceptedMarkdown(md) {
  return String(md)
    .replace(/<span\b[^>]*class="[^"]*\bmd-remark\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<del\b[^>]*class="md-del"[^>]*>[\s\S]*?<\/del>/gi, "")
    .replace(/<span\b[^>]*class="md-ins"[^>]*>([\s\S]*?)<\/span>/gi, "$1");
}

/** Sibling that receives the clean copy. foo.md → foo.clean.md, and an edit
 *  copy resolves to the same place: foo.edit.md → foo.clean.md. */
export function cleanCopyName(name) {
  const n = String(name || "");
  if (/\.clean\.(md|markdown|mdown|txt)$/i.test(n)) return n;
  if (/\.edit\.(md|markdown|mdown|txt)$/i.test(n)) {
    return n.replace(/\.edit\.(md|markdown|mdown|txt)$/i, ".clean.$1");
  }
  if (/\.(md|markdown|mdown|txt)$/i.test(n)) {
    return n.replace(/(\.(md|markdown|mdown|txt))$/i, ".clean$1");
  }
  return n + ".clean.md";
}

/** Kept tokens as-is; new tokens red; dropped tokens red and struck. */
export function diffToHtml(prev, next) {
  const a = tokenize(prev);
  const b = tokenize(next);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  let html = "";
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      html += escapeHtml(a[i]);
      i++;
      j++;
    } else if (j < m && (i === n || dp[i][j + 1] > dp[i + 1][j])) {
      html += `<span class="md-ins">${escapeHtml(b[j])}</span>`;
      j++;
    } else {
      html += `<del class="md-del">${escapeHtml(a[i])}</del>`;
      i++;
    }
  }
  return html;
}

/** Sibling name that receives edits. foo.md → foo.edit.md. Already a copy stays itself. */
export function editCopyName(name) {
  const n = String(name || "");
  if (/\.edit\.(md|markdown|mdown|txt)$/i.test(n)) return n;
  if (/\.(md|markdown|mdown|txt)$/i.test(n)) {
    return n.replace(/(\.(md|markdown|mdown|txt))$/i, ".edit$1");
  }
  return n + ".edit.md";
}

/** Inverse of editCopyName. foo.edit.md → foo.md. A non-copy stays itself. */
export function originalName(name) {
  const n = String(name || "");
  if (/\.edit\.(md|markdown|mdown|txt)$/i.test(n)) {
    return n.replace(/\.edit\.(md|markdown|mdown|txt)$/i, ".$1");
  }
  return n;
}
