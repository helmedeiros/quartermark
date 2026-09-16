import { Link } from "react-router-dom";
import { CLUSTER_COLORS, type Cluster } from "../okrTree";

export function ClusterChip({
  cluster,
  teamSlug,
  linkable = true,
}: {
  cluster: Cluster;
  teamSlug: string;
  linkable?: boolean;
}) {
  const color = (CLUSTER_COLORS as Record<string, string | undefined>)[cluster];
  const chip = (
    <span className={`chip cluster-chip${color ? "" : " neutral"}`}>
      {color && <span className="cluster-dot" style={{ background: color }} />}
      {cluster}
    </span>
  );
  if (!linkable) return chip;
  return (
    <Link
      to={`/t/${teamSlug}/okrs/clusters/${encodeURIComponent(cluster)}`}
      className="cluster-chip-link"
    >
      {chip}
    </Link>
  );
}
