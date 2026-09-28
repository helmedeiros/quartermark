import { useMemo, useState } from "react";
import {
  averageProgress,
  buildAggregateTrend,
  buildStatusBreakdown,
  collectNodesByScope,
  progressDeltaSinceLastWeek,
  statusMeta,
  type SummaryScope,
} from "../../domain/tree";
import type { Quarter } from "../../domain/model";
import { OkrProgressChart } from "./OkrProgressChart";

const SCOPE_LABELS: Record<SummaryScope, string> = {
  overall: "Overall",
  kr: "Key Results",
  milestone: "Milestones",
};

export function OkrQuarterSummary({ quarter }: { quarter: Quarter }) {
  const [scope, setScope] = useState<SummaryScope>("overall");

  const nodes = useMemo(
    () => collectNodesByScope(quarter, scope),
    [quarter, scope],
  );
  const progress = averageProgress(nodes);
  const trend = useMemo(() => buildAggregateTrend(nodes), [nodes]);
  const delta = useMemo(
    () => progressDeltaSinceLastWeek(trend, new Date()),
    [trend],
  );
  const breakdown = useMemo(() => buildStatusBreakdown(nodes), [nodes]);
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <details className="card okr-summary-card" style={{ marginBottom: 16 }}>
      <summary className="small" style={{ cursor: "pointer" }}>
        Progress summary
      </summary>
      <div className="okr-summary-body">
        <div className="okr-summary-tabs">
          {(Object.keys(SCOPE_LABELS) as SummaryScope[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`timeline-nav-btn${scope === s ? " okr-summary-tab-active" : ""}`}
              onClick={() => setScope(s)}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>

        {!nodes.length ? (
          <p className="small muted" style={{ marginTop: 12 }}>
            Nothing to summarize in this scope yet.
          </p>
        ) : (
          <div className="okr-summary-panels">
            <div className="okr-summary-progress-panel">
              <p className="small muted" style={{ margin: 0 }}>
                Progress
              </p>
              <p className="okr-summary-big-number">{progress}%</p>
              {delta !== null && (
                <p className="small muted" style={{ margin: 0 }}>
                  <span
                    style={{
                      color:
                        delta >= 0
                          ? "var(--status-good)"
                          : "var(--status-critical)",
                      fontWeight: 600,
                    }}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta}%
                  </span>{" "}
                  since last week
                </p>
              )}
            </div>

            <div className="okr-summary-chart-panel">
              {trend.length >= 2 ? (
                <OkrProgressChart
                  updates={trend}
                  height={140}
                  domain={
                    quarter.startDate && quarter.endDate
                      ? [quarter.startDate, quarter.endDate]
                      : undefined
                  }
                />
              ) : (
                <p className="small muted">Not enough history to chart yet.</p>
              )}
            </div>

            <div className="okr-summary-breakdown-panel">
              <div className="okr-summary-bars">
                {breakdown
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <div
                      key={b.status}
                      className={`okr-summary-bar chip-bg-${statusMeta(b.status).cls}`}
                      style={{ height: `${(b.count / maxCount) * 100}%` }}
                    />
                  ))}
              </div>
              <div className="okr-summary-legend">
                {breakdown
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <div key={b.status} className="okr-summary-legend-row">
                      <span className={`chip ${statusMeta(b.status).cls}`}>
                        {statusMeta(b.status).label}
                      </span>
                      <strong>{b.count}</strong>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
