export const CATEGORY_COLOR_PALETTE = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#7c3aed",
  "#dc2626",
];

const KNOWN_CATEGORY_COLORS: Record<string, string> = {
  Probation: CATEGORY_COLOR_PALETTE[0],
  "Quarter Planning": CATEGORY_COLOR_PALETTE[1],
  "Performance Review": CATEGORY_COLOR_PALETTE[2],
  "Team Absences": CATEGORY_COLOR_PALETTE[3],
  PTO: CATEGORY_COLOR_PALETTE[0],
  Sick: CATEGORY_COLOR_PALETTE[1],
  Holiday: CATEGORY_COLOR_PALETTE[2],
  Other: CATEGORY_COLOR_PALETTE[3],
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function colorForCategory(category: string): string {
  const known = KNOWN_CATEGORY_COLORS[category];
  if (known) return known;
  return CATEGORY_COLOR_PALETTE[
    hashString(category) % CATEGORY_COLOR_PALETTE.length
  ];
}
