// The part that has to be right.
//
// Converting a whole edited document back to markdown re-wraps every line and
// normalises every emphasis mark, so changing one word produces a diff across
// the file. Instead the file is cut into blocks on blank lines, each block is
// rendered on its own, and on save only the blocks whose text changed are
// converted back. Everything untouched is written out exactly as it arrived.
//
// Nothing here touches the DOM, so it runs under Node as well as in the page —
// which is how it gets tested without a browser.

export const WRAP_COLUMNS = 95;

/** Cut markdown into blocks on blank lines, keeping a fenced block whole. */
export function splitBlocks(text) {
  const blocks = [];
  let cur = [];
  let inFence = false;

  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      cur.push(line);
      continue;
    }
    if (!line.trim() && !inFence) {
      if (cur.length) {
        blocks.push(cur.join("\n"));
        cur = [];
      }
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur.join("\n"));
  return blocks;
}

/** A fenced code block is served read-only; editing one in a browser and
 *  converting it back is how indentation dies. */
export function isLocked(block) {
  return block.trimStart().startsWith("```");
}

/** The marker that lives in the source rather than in the fragment the browser
 *  hands back — a heading's hashes, a quote's angle, a list item's bullet. */
export function blockPrefix(block) {
  const m = block.match(/^(#{1,6} |> |[-*] |\d+\. )/);
  return m ? m[1] : null;
}

/** A contenteditable region inserts non-breaking spaces as a person types,
 *  especially either side of inline code. They survive the round trip as
 *  U+00A0 — invisible on the page, and a search for your own sentence never
 *  finds it. */
export function stripNbsp(s) {
  return s.replace(/ /g, " ").replace(/&nbsp;/g, " ");
}

/** Wrap to a fixed width so an edited block matches the rest of the file
 *  instead of arriving as one long line. Leaves a fenced block and a table
 *  alone — wrapping either one breaks it. */
export function wrap(text, columns = WRAP_COLUMNS) {
  return text
    .split("\n")
    .map((line) => {
      if (line.length <= columns) return line;
      if (line.trimStart().startsWith("```")) return line;
      if (line.includes("|")) return line;

      const indent = line.match(/^\s*/)[0];
      const words = line.trim().split(/\s+/);
      const out = [];
      let row = indent;
      for (const word of words) {
        if (row.trim() && (row + " " + word).length > columns) {
          out.push(row);
          row = indent + word;
        } else {
          row = row.trim() ? row + " " + word : indent + word;
        }
      }
      if (row.trim()) out.push(row);
      return out.join("\n");
    })
    .join("\n");
}

/** Put the source marker back on a converted block if the conversion lost it. */
export function restorePrefix(markdown, prefix) {
  if (!prefix) return markdown;
  return markdown.startsWith(prefix) ? markdown : prefix + markdown;
}

/**
 * Rebuild the file.
 *
 * `blocks`  — every block as it came off disk.
 * `changed` — {index: markdown} for the blocks the author edited. An entry
 *             whose markdown is empty removes that block.
 *
 * Blocks not named in `changed` are copied across untouched, character for
 * character. That is the whole guarantee.
 */
export function assemble(blocks, changed) {
  const out = [];
  let deleted = 0;

  blocks.forEach((block, i) => {
    if (!(i in changed)) {
      out.push(block);
      return;
    }
    const replacement = changed[i];
    if (!replacement || !replacement.trim()) {
      deleted += 1;
      return;
    }
    out.push(replacement);
  });

  return { text: out.join("\n\n") + "\n", deleted };
}
