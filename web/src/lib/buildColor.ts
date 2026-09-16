export function colorForCommit(commit: string): string {
  let hash = 0;
  for (let i = 0; i < commit.length; i++) {
    hash = (hash * 31 + commit.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 75%, 45%)`;
}
