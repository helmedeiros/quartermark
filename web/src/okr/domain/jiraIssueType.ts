export type JiraIssueTypeKind = "epic" | "story" | "task" | "bug" | "unknown";

export function classifyJiraIssueType(
  issueType: string | undefined,
): JiraIssueTypeKind {
  const t = issueType?.toLowerCase() ?? "";
  if (t.includes("epic")) return "epic";
  if (t.includes("story")) return "story";
  if (t.includes("bug")) return "bug";
  if (t.includes("task")) return "task";
  return "unknown";
}
