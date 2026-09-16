function inlineMd(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function isBlockBoundary(line: string): boolean {
  return (
    /^\s*$/.test(line) ||
    /^#{1,3}\s/.test(line) ||
    /^\s*-\s/.test(line) ||
    /^\s*\|/.test(line)
  );
}

export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      out.push(
        `<h${level}>${inlineMd(line.replace(/^#+\s*/, ""))}</h${level}>`,
      );
      i++;
      continue;
    }
    if (
      /^\s*\|/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?\s*-{2,}/.test(lines[i + 1].replace(/\|/g, "|"))
    ) {
      const headerCells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(
          lines[i]
            .split("|")
            .map((c) => c.trim())
            .filter(
              (c, idx, arr) =>
                !(idx === 0 && c === "") &&
                !(idx === arr.length - 1 && c === ""),
            ),
        );
        i++;
      }
      let tbl =
        "<table><thead><tr>" +
        headerCells.map((c) => `<th>${inlineMd(c)}</th>`).join("") +
        "</tr></thead><tbody>";
      for (const r of rows)
        tbl +=
          "<tr>" + r.map((c) => `<td>${inlineMd(c)}</td>`).join("") + "</tr>";
      tbl += "</tbody></table>";
      out.push(tbl);
      continue;
    }
    if (/^\s*-\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\s*-\s/, ""))}</li>`);
        i++;
      }
      out.push("<ul>" + items.join("") + "</ul>");
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      out.push("<hr/>");
      i++;
      continue;
    }
    const paragraphLines: string[] = [line];
    i++;
    while (i < lines.length && !isBlockBoundary(lines[i])) {
      paragraphLines.push(lines[i]);
      i++;
    }
    out.push(`<p>${inlineMd(paragraphLines.join(" "))}</p>`);
  }
  return out.join("\n");
}
