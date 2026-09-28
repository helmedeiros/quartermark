import type { Team } from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed: unknown = JSON.parse(body);
      if (
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        typeof parsed.error === "string"
      ) {
        message = parsed.error;
      }
    } catch {}
    throw new ApiError(
      res.status,
      `${init?.method ?? "GET"} ${path} failed: ${res.status} ${message}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listTeams: () => request<Team[]>("/teams"),

  createTeam: (team: { slug: string; name: string }) =>
    request<Team>("/teams", { method: "POST", body: JSON.stringify(team) }),

  getTeamBlob: <T>(teamSlug: string, section: string) =>
    request<T>(`/teams/${teamSlug}/blobs/${section}`),

  putTeamBlob: <T>(teamSlug: string, section: string, data: T) =>
    request<void>(`/teams/${teamSlug}/blobs/${section}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getOkrSettings: (teamSlug: string) =>
    request<{ jiraBaseUrl: string }>(`/teams/${teamSlug}/okr-settings`),

  refreshOkrJira: (
    teamSlug: string,
    opts?: { quarterId?: string; force?: boolean },
  ) =>
    request<{ refreshedQuarters: string[]; skippedFresh: string[] }>(
      `/teams/${teamSlug}/okrs/jira-refresh`,
      { method: "POST", body: JSON.stringify(opts ?? {}) },
    ),

  refreshOkrJiraNode: (
    teamSlug: string,
    opts: { quarterId: string; nodeId: string },
  ) =>
    request<{ refreshed: boolean }>(
      `/teams/${teamSlug}/okrs/jira-refresh-node`,
      { method: "POST", body: JSON.stringify(opts) },
    ),

  searchJiraIssues: (teamSlug: string, query: string) =>
    request<{ key: string; summary: string; issueType: string }[]>(
      `/teams/${teamSlug}/okrs/jira-search?q=${encodeURIComponent(query)}`,
    ),
};
