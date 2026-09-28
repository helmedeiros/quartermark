import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTeamBlob } from "../../../api/useTeamBlob";
import { resolveCluster, type Cluster } from "../../domain/tree";
import { ClusterChip } from "./ClusterChip";
import { OkrTreeTable } from "./OkrTreeTable";
import type { TeamOkrsData } from "../../domain/model";
import { queryStateMessage } from "../../../components/queryStateMessage";

export function ClusterDetailPage({ teamSlug }: { teamSlug: string }) {
  const { cluster: clusterParam } = useParams<{ cluster: string }>();
  const cluster = decodeURIComponent(clusterParam ?? "") as Cluster;
  const { data, isLoading, error } = useTeamBlob<TeamOkrsData>(
    teamSlug,
    "okrs",
  );

  const quartersWithMatches = useMemo(() => {
    if (!data) return [];
    return data.quarters
      .map((quarter) => ({
        quarter,
        objectives: quarter.objectives.filter(
          (o) => resolveCluster(o.groups) === cluster,
        ),
      }))
      .filter((q) => q.objectives.length > 0);
  }, [data, cluster]);

  const queryState = queryStateMessage(isLoading, error, "OKRs");
  if (queryState) return queryState;

  const totalObjectives = quartersWithMatches.reduce(
    (sum, q) => sum + q.objectives.length,
    0,
  );

  return (
    <div>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 0,
        }}
      >
        <ClusterChip cluster={cluster} teamSlug={teamSlug} linkable={false} />
        <span className="small muted">
          {totalObjectives} objective{totalObjectives === 1 ? "" : "s"} across{" "}
          {quartersWithMatches.length} quarter
          {quartersWithMatches.length === 1 ? "" : "s"}
        </span>
      </h2>

      {!quartersWithMatches.length ? (
        <p className="muted">No OKRs tagged to this cluster yet.</p>
      ) : (
        quartersWithMatches.map(({ quarter, objectives }) => (
          <details key={quarter.quarterId} className="card" open>
            <summary
              className="small"
              style={{ cursor: "pointer", fontWeight: 700 }}
            >
              {quarter.label} · {objectives.length} objective
              {objectives.length === 1 ? "" : "s"}
            </summary>
            <div style={{ marginTop: 12 }}>
              <OkrTreeTable
                objectives={objectives}
                quarterId={quarter.quarterId}
                teamSlug={teamSlug}
                data={data!}
                editable={false}
              />
            </div>
          </details>
        ))
      )}
    </div>
  );
}
