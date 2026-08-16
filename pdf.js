// Build a real PDF file in the page. No print dialog, no printer.
//
// Chrome's window.print() opens the print sheet and cannot choose
// "Save as PDF" — that destination is whatever the person used last.
// This module writes a PDF 1.4 byte array. Save PDF puts it on disk
// next to the three markdown files as name.pdf.
//
// US Letter. Helvetica. Selectable text. The clean page: insertions
// kept, struck words gone, remarks dropped.

import { splitBlocks } from "./blocks.js";
import { visiblePlain } from "./edits.js";

const LETTER_W = 612;
const LETTER_H = 792;
const MARGIN = 72;

const SIZE = {
  h1: 22,
  h2: 15,
  h3: 13,
  h4: 12,
  p: 11,
  li: 11,
  quote: 11,
  pre: 9,
};

/** Sibling that receives the PDF. chapter.md, chapter.edit.md, and
 *  chapter.clean.md all resolve to chapter.pdf. */
export function pdfFileName(name) {
  const n = String(name || "");
  if (/\.(edit|clean)\.(md|markdown|mdown|txt)$/i.test(n)) {
    return n.replace(/\.(edit|clean)\.(md|markdown|mdown|txt)$/i, ".pdf");
  }
  if (/\.(md|markdown|mdown|txt)$/i.test(n)) {
    return n.replace(/\.(md|markdown|mdown|txt)$/i, ".pdf");
  }
  return n + ".pdf";
}

export function looksLikePdf(bytes) {
  if (!bytes || bytes.length < 8) return false;
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
  return head === "%PDF-";
}

/** The strings a PDF reader will find. Used by the tests so a green
 *  suite means the title is actually in the file. */
export function pdfContains(bytes, needle) {
  const text = new TextDecoder("latin1").decode(bytes);
  return text.includes(needle);
}

export function markdownToItems(md) {
  const items = [];
  for (const block of splitBlocks(md)) {
    const t = block.trim();
    if (!t) continue;
    if (t.startsWith("```")) {
      const body = t.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
      items.push({ tag: "pre", text: body });
      continue;
    }
    const hm = t.match(/^(#{1,6})\s+([\s\S]*)$/);
    if (hm) {
      items.push({ tag: "h" + hm[1].length, text: visiblePlain(hm[2]) });
      continue;
    }
    if (/^[-*]\s/m.test(t) && !t.includes("|")) {
      for (const line of t.split("\n")) {
        const m = line.match(/^[-*]\s+(.*)$/);
        if (m) items.push({ tag: "li", text: visiblePlain(m[1]) });
      }
      continue;
    }
    if (t.startsWith(">")) {
      items.push({ tag: "quote", text: visiblePlain(t.replace(/^>\s?/gm, "")) });
      continue;
    }
    items.push({ tag: "p", text: visiblePlain(t) });
  }
  return items;
}

export function buildPdfFromMarkdown(md) {
  return buildPdf(markdownToItems(md));
}

function toWinAnsi(s) {
  return String(s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");
}

function escapePdf(s) {
  return toWinAnsi(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text, fontSize, maxWidth) {
  const widthOf = (t) => t.length * fontSize * 0.5;
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (cur && widthOf(next) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function layout(items) {
  const maxW = LETTER_W - 2 * MARGIN;
  const list = items.length ? items : [{ tag: "p", text: " " }];
  let y = LETTER_H - MARGIN;
  let page = [];
  const pages = [page];

  for (const item of list) {
    const tag = SIZE[item.tag] ? item.tag : "p";
    const size = SIZE[tag];
    const leading = size + 5;
    const indent = tag === "li" || tag === "quote" ? 18 : 0;
    const prefix = tag === "li" ? "- " : "";
    const lines = wrapLine(prefix + (item.text || ""), size, maxW - indent);
    const gap = tag.startsWith("h") ? 12 : 8;
    const needed = lines.length * leading + gap;
    if (y - needed < MARGIN) {
      page = [];
      pages.push(page);
      y = LETTER_H - MARGIN;
    }
    const font = tag.startsWith("h") ? "F2" : tag === "quote" ? "F3" : "F1";
    for (const line of lines) {
      page.push({ text: line, size, y, x: MARGIN + indent, font });
      y -= leading;
    }
    y -= gap;
  }
  return pages;
}

function pageStream(lines) {
  const out = ["BT"];
  for (const line of lines) {
    out.push(`/${line.font} ${line.size} Tf`);
    out.push(`1 0 0 1 ${line.x.toFixed(1)} ${line.y.toFixed(1)} Tm`);
    out.push(`(${escapePdf(line.text)}) Tj`);
  }
  out.push("ET");
  return out.join("\n");
}

export function buildPdf(items) {
  const pages = layout(items);
  const enc = new TextEncoder();
  const parts = [];
  let pos = 0;

  function write(str) {
    const bytes = enc.encode(str);
    parts.push(bytes);
    pos += bytes.length;
  }

  write("%PDF-1.4\n%\x80\x80\x80\x80\n");

  const objects = {};
  function setObj(num, body) {
    objects[num] = `${num} 0 obj\n${body}\nendobj\n`;
  }

  const nPages = pages.length;
  const kids = pages.map((_, i) => `${7 + i * 2} 0 R`).join(" ");
  setObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  setObj(2, `<< /Type /Pages /Kids [ ${kids} ] /Count ${nPages} >>`);
  setObj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  setObj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  setObj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");

  pages.forEach((page, i) => {
    const contentNum = 6 + i * 2;
    const pageNum = 7 + i * 2;
    const stream = pageStream(page);
    const len = enc.encode(stream).length;
    setObj(contentNum, `<< /Length ${len} >>\nstream\n${stream}\nendstream`);
    setObj(
      pageNum,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LETTER_W} ${LETTER_H}] ` +
        `/Contents ${contentNum} 0 R /Resources << /Font << ` +
        `/F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>`
    );
  });

  const last = 5 + nPages * 2;
  const offsets = { 0: 0 };
  for (let i = 1; i <= last; i++) {
    offsets[i] = pos;
    write(objects[i]);
  }

  const xrefPos = pos;
  write(`xref\n0 ${last + 1}\n`);
  write("0000000000 65535 f \n");
  for (let i = 1; i <= last; i++) {
    write(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${last + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const total = parts.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of parts) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
