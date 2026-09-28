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
