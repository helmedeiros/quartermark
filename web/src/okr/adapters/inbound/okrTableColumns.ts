export type OkrColumnKey =
  | "title"
  | "cluster"
  | "owner"
  | "status"
  | "progress"
  | "weight"
  | "allocation"
  | "dates"
  | "labels"
  | "update";

export const OKR_COLUMNS: OkrColumnKey[] = [
  "title",
  "cluster",
  "owner",
  "status",
  "progress",
  "weight",
  "allocation",
  "dates",
  "labels",
  "update",
];

const COLUMN_FRACTIONS: Record<OkrColumnKey, number> = {
  title: 0.24,
  cluster: 0.08,
  owner: 0.11,
  status: 0.07,
  progress: 0.07,
  weight: 0.07,
  allocation: 0.07,
  dates: 0.13,
  labels: 0.07,
  update: 0.09,
};

export const MIN_COLUMN_WIDTH = 70;

export function initialColumnWidths(
  availableWidth: number,
): Record<OkrColumnKey, number> {
  const widths = {} as Record<OkrColumnKey, number>;
  for (const key of OKR_COLUMNS) {
    widths[key] = Math.max(
      MIN_COLUMN_WIDTH,
      Math.round(availableWidth * COLUMN_FRACTIONS[key]),
    );
  }
  return widths;
}

export function resizeColumn(
  widths: Record<OkrColumnKey, number>,
  key: OkrColumnKey,
  deltaX: number,
): Record<OkrColumnKey, number> {
  return {
    ...widths,
    [key]: Math.max(MIN_COLUMN_WIDTH, widths[key] + deltaX),
  };
}
