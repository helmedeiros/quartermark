import { formatMetricValue } from "../../domain/tree";
import { linearScale } from "../../../lib/scale";
import type { OkrMetricPoint, OkrMetricType } from "../../domain/model";

const METRIC_COLOR = "#f97316";

export function OkrMetricChart({
  points,
  target,
  unit,
  metricType,
  height = 180,
}: {
  points: OkrMetricPoint[];
  target?: number;
  unit?: string;
  metricType?: OkrMetricType;
  height?: number;
}) {
  if (points.length < 2) {
    return <p className="small muted">Not enough history to chart yet.</p>;
  }

  const width = 720;
  const padding = { top: 12, right: 14, bottom: 22, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const times = points.map((p) => new Date(p.date).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);

  const values = points.map((p) => p.current);
  const allValues = target != null ? [...values, target] : values;
  const rawMin = Math.min(0, ...allValues);
  const rawMax = Math.max(0, ...allValues);
  const span = rawMax - rawMin || 1;
  const minV = rawMin - span * 0.1;
  const maxV = rawMax + span * 0.1;

  const xFor = linearScale([minT, maxT], [padding.left, padding.left + plotW]);
  const yFor = linearScale([minV, maxV], [padding.top + plotH, padding.top]);

  const plotted = points.map((p) => ({
    x: xFor(new Date(p.date).getTime()),
    y: yFor(p.current),
    p,
  }));

  const baselineY = yFor(Math.max(minV, Math.min(maxV, 0)));
  const linePath = plotted.map((pt) => `${pt.x},${pt.y}`).join(" L");
  const areaPath = `M${plotted[0].x},${baselineY} L${linePath} L${
    plotted[plotted.length - 1].x
  },${baselineY} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const gridValues =
    metricType === "boolean" ? [0, 1] : [minV, (minV + maxV) / 2, maxV];
  const showZeroLine = metricType !== "boolean" && minV < 0 && maxV > 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {gridValues.map((v, i) => (
        <g key={i}>
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
            {metricType === "boolean"
              ? formatMetricValue(metricType, v)
              : Math.round(v)}
          </text>
        </g>
      ))}
      {showZeroLine && (
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={yFor(0)}
          y2={yFor(0)}
          stroke="var(--text-muted)"
          strokeWidth={1}
        />
      )}
      {target != null && metricType !== "boolean" && (
        <g>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yFor(target)}
            y2={yFor(target)}
            stroke={METRIC_COLOR}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
          <text
            x={width - padding.right}
            y={yFor(target) - 4}
            textAnchor="end"
            fontSize={10}
            fill={METRIC_COLOR}
          >
            Target: {formatMetricValue(metricType, target, unit)}
          </text>
        </g>
      )}
      <path d={areaPath} fill={METRIC_COLOR} opacity={0.08} />
      <path
        d={`M${linePath}`}
        fill="none"
        stroke={METRIC_COLOR}
        strokeWidth={2}
      />
      {plotted.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={METRIC_COLOR}>
          <title>
            {pt.p.date.slice(0, 10)} —{" "}
            {formatMetricValue(metricType, pt.p.current, unit)}
          </title>
        </circle>
      ))}
      <text
        x={padding.left}
        y={height - 6}
        fontSize={10}
        fill="var(--text-muted)"
      >
        {first.date.slice(0, 10)}
      </text>
      <text
        x={width - padding.right}
        y={height - 6}
        textAnchor="end"
        fontSize={10}
        fill="var(--text-muted)"
      >
        {last.date.slice(0, 10)}
      </text>
    </svg>
  );
}
