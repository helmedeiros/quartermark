import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../api/client";
import {
  currentNumberFor,
  deriveMetricProgress,
  formatMetricValue,
  hasContributingChildren,
  targetNumberFor,
  updateNode,
} from "../../domain/tree";
import { MetricFieldsBlock } from "./MetricFieldsBlock";
import { OkrMetricChart } from "./OkrMetricChart";
import type { OkrMetricType, OkrNode, TeamOkrsData } from "../../domain/model";

function defaultMetricType(node: OkrNode): OkrMetricType {
  if (node.metricType) return node.metricType;
  if (node.unit === "%") return "percent";
  if (node.unit === "$" || node.unit === "€" || node.unit === "£")
    return "currency";
  return "number";
}

function buildMetricNodePatch(
  node: OkrNode,
  metricType: OkrMetricType,
  currentNum: number | undefined,
  targetNum: number | undefined,
  displayUnit: string,
  today: string,
): Partial<OkrNode> {
  const progress =
    currentNum != null && targetNum != null
      ? deriveMetricProgress(metricType, currentNum, targetNum)
      : node.progress;

  const metricHistory =
    currentNum == null
      ? node.metricHistory
      : [...(node.metricHistory ?? []), { date: today, current: currentNum }];

  const updates =
    currentNum != null && targetNum != null
      ? [
          ...(node.updates ?? []),
          {
            date: today,
            status: node.status,
            progress,
            note: `Metric updated: ${formatMetricValue(metricType, currentNum, displayUnit)}${
              metricType === "boolean"
                ? ""
                : ` / ${formatMetricValue(metricType, targetNum, displayUnit)}`
            }`,
          },
        ]
      : node.updates;

  return {
    metricType,
    unit: displayUnit.trim() || undefined,
    target: targetNum,
    current: currentNum,
    progress,
    metricHistory,
    updates,
  };
}

export function OkrMetricCard({
  teamSlug,
  data,
  quarterId,
  node,
}: {
  teamSlug: string;
  data: TeamOkrsData;
  quarterId: string;
  node: OkrNode;
}) {
  const queryClient = useQueryClient();
  const [metricType, setMetricType] = useState<OkrMetricType>(() =>
    defaultMetricType(node),
  );
  const [unit, setUnit] = useState(node.unit ?? "");
  const [target, setTarget] = useState(node.target?.toString() ?? "");
  const [current, setCurrent] = useState(
    metricType === "boolean"
      ? (node.current ?? 0) >= 1
        ? "1"
        : "0"
      : (node.current?.toString() ?? ""),
  );

  const metricHistory = [...(node.metricHistory ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const displayUnit = metricType === "percent" ? "%" : unit;
  const isLocked = hasContributingChildren(node);

  const save = useMutation({
    mutationFn: async () => {
      const targetNum = targetNumberFor(metricType, target);
      const currentNum = currentNumberFor(metricType, current);
      const today = new Date().toISOString().slice(0, 10);
      const patch = buildMetricNodePatch(
        node,
        metricType,
        currentNum,
        targetNum,
        displayUnit,
        today,
      );

      const quarters = data.quarters.map((q) =>
        q.quarterId === quarterId
          ? {
              ...q,
              objectives: updateNode(q.objectives, node.id, (n) => ({
                ...n,
                ...patch,
              })),
            }
          : q,
      );
      await api.putTeamBlob(teamSlug, "okrs", { ...data, quarters });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["teamBlob", teamSlug, "okrs"],
      });
    },
  });

  return (
    <div className="card">
      <h3>Metric</h3>
      {isLocked && (
        <p className="okr-metric-locked-notice">
          🔒 Progress for this Key Result is calculated from its nested items
          and can't be edited directly here.
        </p>
      )}
      <MetricFieldsBlock
        metricType={metricType}
        unit={unit}
        current={current}
        target={target}
        disabled={isLocked}
        onMetricTypeChange={(next) => {
          setMetricType(next);
          if (next === "boolean") setCurrent(Number(current) >= 1 ? "1" : "0");
        }}
        onUnitChange={setUnit}
        onCurrentChange={setCurrent}
        onTargetChange={setTarget}
      />

      <button
        type="button"
        className="timeline-nav-btn"
        disabled={save.isPending || isLocked}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Saving…" : "Save & log data point"}
      </button>
      {save.isError && (
        <p className="small" style={{ color: "var(--status-critical)" }}>
          Failed to save: {String(save.error)}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <OkrMetricChart
          points={metricHistory}
          target={node.target}
          unit={node.unit}
          metricType={node.metricType}
        />
      </div>
    </div>
  );
}
