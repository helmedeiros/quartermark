import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useTeamBlob } from "../../api/useTeamBlob";
import { formatRelativeTime } from "../../lib/format";
import { useOkrConfig } from "../config";
import { downloadWorkbook } from "../okrExportWorkbook";
import { collectLabels, collectOwners } from "../domain/tree";
import { OkrCreatePanel } from "./OkrCreatePanel";
import { OkrQuarterSummary } from "./OkrQuarterSummary";
import { OkrTreeTable } from "./OkrTreeTable";
import type { OkrNodeType, Quarter, TeamOkrsData } from "../domain/model";
import { useOkrTreeMutations } from "./useOkrTreeMutations";
import { useClusters } from "../useClusters";
import { useJiraBaseUrl } from "../../api/useOkrSettings";
import { queryStateMessage } from "../../components/queryStateMessage";

function jiraSyncStatusLabel(quarter: Quarter): string | null {
  if (!quarter.jiraRefreshedAt) return null;
  const asOfDate = quarter.jiraAsOf?.slice(0, 10);
  const refreshedDate = quarter.jiraRefreshedAt.slice(0, 10);
  if (asOfDate && asOfDate !== refreshedDate) {
    return `Jira data frozen as of quarter close (${asOfDate})`;
  }
  return `Jira synced ${formatRelativeTime(quarter.jiraRefreshedAt)}`;
}

export function QuarterDetailPage({ teamSlug }: { teamSlug: string }) {
  const clusters = useClusters(teamSlug);
  const { exportColumns } = useOkrConfig();
  const { quarterId } = useParams<{ quarterId: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTeamBlob<TeamOkrsData>(
    teamSlug,
    "okrs",
  );
  const tree = useOkrTreeMutations(teamSlug, data!, quarterId!);
  const [createRequest, setCreateRequest] = useState<{
    type: OkrNodeType;
    parentId: string | null;
    parentLabel?: string;
  } | null>(null);

  const refreshJira = useMutation({
    mutationFn: (force: boolean) =>
      api.refreshOkrJira(teamSlug, { quarterId, force }),
    onSuccess: (result) => {
      if (result.refreshedQuarters.length) {
        void queryClient.invalidateQueries({
          queryKey: ["teamBlob", teamSlug, "okrs"],
        });
      }
    },
  });

  const trackerConfigured = useJiraBaseUrl(teamSlug) !== "";

  const exportXlsx = useMutation({
    mutationFn: (quarter: Quarter) =>
      downloadWorkbook(data!.team, quarter, exportColumns, clusters),
  });

  useEffect(() => {
    if (!quarterId || !trackerConfigured) return;
    refreshJira.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSlug, quarterId, trackerConfigured]);

  const queryState = queryStateMessage(isLoading, error, "OKRs");
  if (queryState) return queryState;

  const quarter = data?.quarters.find((q) => q.quarterId === quarterId);
  if (!quarter) return <p className="muted">Quarter not found.</p>;

  const jiraSyncLabel = jiraSyncStatusLabel(quarter);

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
        <h2 style={{ marginTop: 0 }}>
          {quarter.label}
          {quarter.locked && (
            <span
              className="chip"
              style={{ marginLeft: 8, verticalAlign: "middle" }}
              title="Existing goals, key results, and milestones in this quarter are protected from being overwritten by a data re-import."
            >
              Locked
            </span>
          )}
        </h2>
        <div
          className="small muted"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          {jiraSyncLabel && <span>{jiraSyncLabel}</span>}
          <Link
            className="timeline-nav-btn"
            to={`/t/${teamSlug}/okrs/${quarter.quarterId}/gantt`}
          >
            Gantt view
          </Link>
          {trackerConfigured && (
            <button
              type="button"
              className="timeline-nav-btn"
              disabled={refreshJira.isPending}
              onClick={() => refreshJira.mutate(true)}
            >
              {refreshJira.isPending
                ? "Refreshing…"
                : "Force refresh from Jira"}
            </button>
          )}
          <button
            type="button"
            className="timeline-nav-btn"
            disabled={tree.isPending}
            onClick={() => tree.setQuarterLocked(!quarter.locked)}
          >
            {quarter.locked ? "Unlock quarter" : "Lock quarter"}
          </button>
          <button
            type="button"
            className="timeline-nav-btn"
            disabled={exportXlsx.isPending}
            onClick={() => exportXlsx.mutate(quarter)}
          >
            {exportXlsx.isPending ? "Exporting…" : "Export to xlsx"}
          </button>
        </div>
      </div>
      {refreshJira.isError && (
        <p className="small muted" style={{ marginTop: -6 }}>
          Could not refresh from Jira. Check the team's connector settings.
        </p>
      )}
      {exportXlsx.isError && (
        <p className="small muted" style={{ marginTop: -6 }}>
          Export failed: {String(exportXlsx.error)}
        </p>
      )}

      <OkrQuarterSummary quarter={quarter} />

      {!quarter.objectives.length ? (
        <p className="muted">No objectives logged for this quarter yet.</p>
      ) : (
        <OkrTreeTable
          objectives={quarter.objectives}
          quarterId={quarter.quarterId}
          teamSlug={teamSlug}
          data={data!}
          editable
          hiddenColumns={["update"]}
          onRequestCreate={(type, parentId, parentLabel) =>
            setCreateRequest({ type, parentId, parentLabel })
          }
        />
      )}
      <button
        type="button"
        className="okr-add-row-trigger"
        onClick={() => setCreateRequest({ type: "objective", parentId: null })}
      >
        + Add Objective
      </button>
      {tree.isError && (
        <p className="small" style={{ color: "var(--status-critical)" }}>
          Failed to save: {String(tree.error)}
        </p>
      )}
      {createRequest && (
        <OkrCreatePanel
          teamName={data!.team}
          clusters={clusters}
          allowedTypes={[createRequest.type]}
          parentLabel={createRequest.parentLabel}
          quarterLabel={quarter.label}
          pending={tree.isPending}
          ownerOptions={collectOwners(data!.quarters)}
          labelOptions={collectLabels(data!.quarters)}
          onCreate={(type, fields) =>
            tree.create(createRequest.parentId, type, fields.title, fields)
          }
          onClose={() => setCreateRequest(null)}
        />
      )}
    </div>
  );
}
