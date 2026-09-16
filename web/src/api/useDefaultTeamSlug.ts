import { useTeams } from "./useTeams";

// The team to fall back to when a URL does not name one: whichever the
// registry lists first.
//
// Returns "" while the registry is loading and when it is genuinely
// empty — a fresh install has no teams, and the honest answer there is
// "none yet", which callers turn into a trip to onboarding rather than a
// link to a team that does not exist.
export function useDefaultTeamSlug(): string {
  const { data: teams } = useTeams();
  return teams?.[0]?.slug ?? "";
}
