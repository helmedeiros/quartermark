import { useTeamBlob } from "../../api/useTeamBlob";
import type { TeamOkrsData } from "../domain/model";
import { DEFAULT_CLUSTERS } from "../domain/tree/metadata";

export function useClusters(teamSlug: string): string[] {
  const { data } = useTeamBlob<TeamOkrsData>(teamSlug, "okrs");
  const clusters = data?.clusters;
  return clusters && clusters.length > 0 ? clusters : DEFAULT_CLUSTERS;
}
