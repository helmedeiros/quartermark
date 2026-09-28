import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTeamBlob } from "../../api/useTeamBlob";
import {
  padByWholeMonths,
  type DateWindow,
  type Granularity,
} from "../../lib/dateWindow";
import { objectiveGanttGroups, sprintGanttBars } from "../okrTree";
import { OkrGanttChart } from "./OkrGanttChart";
import type { TeamOkrsData } from "./types";
import { useOkrTreeMutations } from "./useOkrTreeMutations";
import { queryStateMessage } from "../../components/queryStateMessage";

type GanttGranularity = Extract<Granularity, "day" | "week">;

function TeamCapacityInput({
  value,
  onCommit,
}: {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const commit = () => {
    const n = draft.trim() === "" ? undefined : Number(draft);
    if (n === undefined || !Number.isNaN(n)) onCommit(n);
  };
  return (
    <label
      className="small muted"
      style={{ display: "flex", alignItems: "center", gap: 4 }}
    >
      Team capacity
      <input
        type="number"
        min={0}
        step={0.5}
        placeholder="—"
        value={draft}
        style={{ width: 50 }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      engineers
    </label>
  );
}

export function QuarterGanttPage({ teamSlug }: { teamSlug: string }) {
  const { quarterId } = useParams<{ quarterId: string }>();
  const { data, isLoading, error } = useTeamBlob<TeamOkrsData>(
    teamSlug,
    "okrs",
  );
  const [granularity, setGranularity] = useState<GanttGranularity>("day");
  const tree = useOkrTreeMutations(teamSlug, data!, quarterId!);

  const queryState = queryStateMessage(isLoading, error, "OKRs");
  if (queryState) return queryState;

  const quarter = data?.quarters.find((q) => q.quarterId === quarterId);
  if (!quarter) return <p className="muted">Quarter not found.</p>;

  const dateWindow: DateWindow = padByWholeMonths(
    {
      start: new Date(quarter.startDate ?? quarter.label),
      end: new Date(quarter.endDate ?? quarter.label),
    },
    1,
    1,
  );

  const groups = objectiveGanttGroups(quarter, teamSlug);
  const sprints = sprintGanttBars(quarter, dateWindow);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ marginTop: 0 }}>{quarter.label} — Gantt view</h2>
        <div
          className="small muted"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Link
            className="timeline-nav-btn"
            to={`/t/${teamSlug}/okrs/${quarter.quarterId}`}
          >
            Back to quarter
          </Link>
          <TeamCapacityInput
            value={quarter.teamCapacity}
            onCommit={(teamCapacity) => tree.editQuarterField({ teamCapacity })}
          />
          <div className="okr-create-metric-toggle">
            {(["day", "week"] as const).map((g) => (
              <button
                key={g}
                type="button"
                className={`okr-create-metric-toggle-option${granularity === g ? " active" : ""}`}
                onClick={() => setGranularity(g)}
              >
                {g === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {groups.length ? (
        <div style={{ marginTop: 24 }}>
          <OkrGanttChart
            quarter={quarter}
            groups={groups}
            sprints={sprints}
            dateWindow={dateWindow}
            granularity={granularity}
            onMoveMilestone={(milestoneId, startDate, dueDate) =>
              tree.editField(milestoneId, { startDate, dueDate })
            }
            onResizeMilestone={(milestoneId, startDate, dueDate, effortWeeks) =>
              tree.editField(milestoneId, { startDate, dueDate, effortWeeks })
            }
          />
        </div>
      ) : (
        <p className="muted">Nothing to show yet.</p>
      )}
    </div>
  );
}
