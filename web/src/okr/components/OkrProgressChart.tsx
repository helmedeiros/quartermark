import { linearScale } from "../../lib/scale";
import type { OkrUpdate } from "./types";

export function OkrProgressChart({
  updates,
  height = 180,
  domain,
}: {
  updates: OkrUpdate[];
  height?: number;
  domain?: [string, string];
}) {
  if (updates.length < 2) {
    return <p className="small muted">Not enough history to chart yet.</p>;
  }

  const width = 720;
  const padding = { top: 12, right: 14, bottom: 22, left: 32 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const times = updates.map((u) => new Date(u.date).getTime());
  const minT = domain ? new Date(domain[0]).getTime() : Math.min(...times);
  const maxT = domain ? new Date(domain[1]).getTime() : Math.max(...times);

  const xFor = linearScale([minT, maxT], [padding.left, padding.left + plotW]);
  const yForRaw = linearScale([0, 100], [padding.top + plotH, padding.top]);
  const yFor = (p: number) => yForRaw(Math.max(0, Math.min(100, p)));

  const points = updates.map((u) => ({
    x: xFor(new Date(u.date).getTime()),
    y: yFor(u.progress),
    u,
  }));

  const linePath = points.map((p) => `${p.x},${p.y}`).join(" L");
  const areaPath = `M${points[0].x},${padding.top + plotH} L${linePath} L${
    points[points.length - 1].x
  },${padding.top + plotH} Z`;

  const firstLabel = domain ? domain[0] : updates[0].date;
  const lastLabel = domain ? domain[1] : updates[updates.length - 1].date;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yFor(v)}
            y2={yFor(v)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={yFor(v) + 4}
            textAnchor="end"
            fontSize={10}
            fill="var(--text-muted)"
          >
            {v}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="var(--series-1)" opacity={0.08} />
      <path
        d={`M${linePath}`}
        fill="none"
        stroke="var(--series-1)"
        strokeWidth={2}
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--series-1)">
          <title>
            {p.u.date.slice(0, 10)} — {p.u.progress}% ({p.u.status})
            {p.u.note ? `: ${p.u.note}` : ""}
          </title>
        </circle>
      ))}
      <text
        x={padding.left}
        y={height - 6}
        fontSize={10}
        fill="var(--text-muted)"
      >
        {firstLabel.slice(0, 10)}
      </text>
      <text
        x={width - padding.right}
        y={height - 6}
        textAnchor="end"
        fontSize={10}
        fill="var(--text-muted)"
      >
        {lastLabel.slice(0, 10)}
      </text>
    </svg>
  );
}
