// Jira URL construction. The host is a per-team setting rather than a
// constant: it is whatever instance that team's connector points at, and
// a build-time default would bake one organisation's host into every
// install. Callers get it from useOkrSettings.

export function jiraTicketUrl(baseUrl: string, key: string): string {
  if (!baseUrl) return "";
  return `${trimSlash(baseUrl)}/browse/${key}`;
}

export function jiraLabelSearchUrl(baseUrl: string, label: string): string {
  if (!baseUrl) return "";
  return `${trimSlash(baseUrl)}/issues/?jql=labels%3D%22${encodeURIComponent(label)}%22`;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
