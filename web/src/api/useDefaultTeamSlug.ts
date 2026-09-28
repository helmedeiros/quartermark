import { useTeams } from "./useTeams";

export function useDefaultTeamSlug(): string {
  const { data: teams } = useTeams();
  return teams?.[0]?.slug ?? "";
}
