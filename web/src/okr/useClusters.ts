import { useTeamBlob } from "../api/useTeamBlob";
import type { TeamOkrsData } from "./components/types";
import { DEFAULT_CLUSTERS } from "./okrTree/metadata";

export function useClusters(teamSlug: string): string[] {
  const { data } = useTeamBlob<TeamOkrsData>(teamSlug, "okrs");
  const clusters = data?.clusters;
  return clusters && clusters.length > 0 ? clusters : DEFAULT_CLUSTERS;
}
