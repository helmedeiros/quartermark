import { Link } from "react-router-dom";
import { clusterColor, type Cluster } from "../okrTree";
import { useClusters } from "../useClusters";

export function ClusterChip({
  cluster,
  teamSlug,
  linkable = true,
}: {
  cluster: Cluster;
  teamSlug: string;
  linkable?: boolean;
}) {
  const color = clusterColor(cluster, useClusters(teamSlug));
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
