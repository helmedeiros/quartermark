import { useTeamBlob } from "../api/useTeamBlob";
import type { TeamOkrsData } from "./components/types";
import { DEFAULT_CLUSTERS } from "./okrTree/metadata";

// The team's cluster vocabulary, falling back to the module's default
// list. Reads the OKR blob that every page on this route already loaded,
// so it costs a cache hit rather than a request — which is what makes it
// usable from a leaf like ClusterChip without prop-drilling the list
// through everything in between.
export function useClusters(teamSlug: string): string[] {
  const { data } = useTeamBlob<TeamOkrsData>(teamSlug, "okrs");
  const clusters = data?.clusters;
  return clusters && clusters.length > 0 ? clusters : DEFAULT_CLUSTERS;
}
