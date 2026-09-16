import { linearScale } from "../lib/scale";

export function Sparkline({
  values,
  width = 90,
  height = 22,
  color = "var(--series-1)",
}: {
  values: (number | null | undefined)[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const points = values
    .map((v, i) => (v == null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p != null);

  if (points.length < 2) return null;

  const minV = Math.min(...points.map((p) => p.v));
  const maxV = Math.max(...points.map((p) => p.v));
  const pad = 2;

  const xFor = linearScale([0, values.length - 1], [pad, width - pad]);
  const yFor = linearScale([minV, maxV], [height - pad, pad]);
  const toXY = (p: { i: number; v: number }): [number, number] => [
    xFor(p.i),
    yFor(p.v),
  ];

  const path = points.map((p) => toXY(p).join(",")).join(" L");
  const [lastX, lastY] = toXY(points[points.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ display: "block", marginTop: 6 }}
    >
      <path d={`M${path}`} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}
