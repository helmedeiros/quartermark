import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface OkrSettings {
  jiraBaseUrl: string;
}

// The non-secret slice of a team's connector config. Separate from the
// connectors blob on purpose — that one carries the Jira API token, and
// nothing in the browser needs it.
export function useOkrSettings(teamSlug: string) {
  return useQuery({
    queryKey: ["okrSettings", teamSlug],
    queryFn: () => api.getOkrSettings(teamSlug),
    // No team in view yet (fresh install, or the registry still
    // loading): there is nothing to ask for.
    enabled: Boolean(teamSlug),
  });
}

// Convenience for render paths that only need the host and should degrade
// to plain text (no link) when Jira isn't configured for the team.
export function useJiraBaseUrl(teamSlug: string): string {
  return useOkrSettings(teamSlug).data?.jiraBaseUrl ?? "";
}
