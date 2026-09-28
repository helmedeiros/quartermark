import { Link } from "react-router-dom";
import { useTeamBlob } from "../../api/useTeamBlob";
import { countNodes, NON_CLUSTER, objectiveAvgProgress } from "../domain/tree";
import { useClusters } from "../useClusters";
import { QueryState } from "../../components/QueryState";
import { ClusterChip } from "./ClusterChip";
import type { TeamOkrsData } from "../domain/model";

export function OkrsLanding({ teamSlug }: { teamSlug: string }) {
  const clusters = useClusters(teamSlug);
  const { data, isLoading, error } = useTeamBlob<TeamOkrsData>(
    teamSlug,
    "okrs",
  );

  return (
    <QueryState isLoading={isLoading} error={error} label="OKRs">
      {!data || !data.quarters.length ? (
        <p className="muted">No quarters tracked yet.</p>
      ) : (
        <div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Objectives</th>
                <th>OKRs</th>
                <th>Avg objective progress</th>
              </tr>
            </thead>
            <tbody>
              {data.quarters.map((q) => {
                const progress = objectiveAvgProgress(q);
                return (
                  <tr key={q.quarterId}>
                    <td>
                      <Link to={`/t/${teamSlug}/okrs/${q.quarterId}`}>
                        <strong>{q.label}</strong>
                      </Link>
                    </td>
                    <td>{q.objectives.length}</td>
                    <td>{countNodes(q.objectives)}</td>
                    <td>{progress == null ? "—" : `${progress}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 style={{ marginTop: 28 }}>Clusters</h3>
          <p className="small muted" style={{ marginTop: -8 }}>
            Cross-quarter view of every OKR tagged to a delivery cluster.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...clusters, NON_CLUSTER].map((cluster) => (
              <ClusterChip
                key={cluster}
                cluster={cluster}
                teamSlug={teamSlug}
              />
            ))}
          </div>
        </div>
      )}
    </QueryState>
  );
}
