import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface OkrSettings {
  jiraBaseUrl: string;
}

export function useOkrSettings(teamSlug: string) {
  return useQuery({
    queryKey: ["okrSettings", teamSlug],
    queryFn: () => api.getOkrSettings(teamSlug),
    enabled: Boolean(teamSlug),
  });
}

export function useJiraBaseUrl(teamSlug: string): string {
  return useOkrSettings(teamSlug).data?.jiraBaseUrl ?? "";
}
