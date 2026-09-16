export type MarkdownAction =
  | { kind: "wrap"; before: string; after: string; placeholder: string }
  | { kind: "linePrefix"; prefix: string; placeholder: string }
  | { kind: "insert"; text: string };

export const MARKDOWN_TOOLBAR: {
  label: string;
  title: string;
  action: MarkdownAction;
}[] = [
  {
    label: "H",
    title: "Heading",
    action: { kind: "linePrefix", prefix: "## ", placeholder: "Heading" },
  },
  {
    label: "B",
    title: "Bold",
    action: {
      kind: "wrap",
      before: "**",
      after: "**",
      placeholder: "bold text",
    },
  },
  {
    label: "</>",
    title: "Code",
    action: { kind: "wrap", before: "`", after: "`", placeholder: "code" },
  },
  {
    label: "Link",
    title: "Link",
    action: {
      kind: "wrap",
      before: "[",
      after: "](https://)",
      placeholder: "link text",
    },
  },
  {
    label: "•",
    title: "Bullet list",
    action: { kind: "linePrefix", prefix: "- ", placeholder: "List item" },
  },
  {
    label: "▦",
    title: "Table",
    action: {
      kind: "insert",
      text: "\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n",
    },
  },
  {
    label: "―",
    title: "Divider",
    action: { kind: "insert", text: "\n---\n" },
  },
];

export interface TextSelection {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function applyMarkdownAction(
  selection: TextSelection,
  action: MarkdownAction,
): TextSelection {
  const { selectionStart, selectionEnd, value } = selection;
  if (action.kind === "wrap") {
    const selected =
      value.slice(selectionStart, selectionEnd) || action.placeholder;
    const start = selectionStart + action.before.length;
    return {
      value:
        value.slice(0, selectionStart) +
        action.before +
        selected +
        action.after +
        value.slice(selectionEnd),
      selectionStart: start,
      selectionEnd: start + selected.length,
    };
  }
  if (action.kind === "linePrefix") {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineEndRaw = value.indexOf("\n", selectionEnd);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const block = value.slice(lineStart, lineEnd) || action.placeholder;
    const prefixed = block
      .split("\n")
      .map((l) => `${action.prefix}${l}`)
      .join("\n");
    return {
      value: value.slice(0, lineStart) + prefixed + value.slice(lineEnd),
      selectionStart: lineStart,
      selectionEnd: lineStart + prefixed.length,
    };
  }
  const pos = selectionStart + action.text.length;
  return {
    value:
      value.slice(0, selectionStart) + action.text + value.slice(selectionEnd),
    selectionStart: pos,
    selectionEnd: pos,
  };
}
