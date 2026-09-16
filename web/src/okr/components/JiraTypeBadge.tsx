import type { ReactNode } from "react";
import { classifyJiraIssueType } from "../jiraIssueType";

const JIRA_TYPE_META: Record<
  ReturnType<typeof classifyJiraIssueType>,
  { cls: string; label: string; path: ReactNode }
> = {
  epic: {
    cls: "okr-badge-jira-epic",
    label: "Epic",
    path: <path d="M9 1L3 9H7L6 15L13 6H9L9 1Z" fill="white" />,
  },
  story: {
    cls: "okr-badge-jira-story",
    label: "Story",
    path: <path d="M4 2H12V14L8 11L4 14V2Z" fill="white" />,
  },
  task: {
    cls: "okr-badge-jira-task",
    label: "Task",
    path: (
      <path
        d="M3 8L6.5 11.5L13 4"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  bug: {
    cls: "okr-badge-jira-bug",
    label: "Bug",
    path: (
      <>
        <circle cx="8" cy="9" r="4" fill="white" />
        <line x1="8" y1="3" x2="8" y2="5" stroke="white" strokeWidth="1.5" />
        <line x1="4" y1="7" x2="2" y2="5" stroke="white" strokeWidth="1.5" />
        <line x1="12" y1="7" x2="14" y2="5" stroke="white" strokeWidth="1.5" />
      </>
    ),
  },
  unknown: {
    cls: "okr-badge-jira",
    label: "Jira issue",
    path: undefined,
  },
};

export function JiraTypeBadge({
  issueType,
}: {
  issueType: string | undefined;
}) {
  const kind = classifyJiraIssueType(issueType);
  const meta = JIRA_TYPE_META[kind];
  return (
    <span className={`okr-badge ${meta.cls}`} title={issueType || meta.label}>
      {meta.path ? (
        <svg viewBox="0 0 16 16" width="12" height="12">
          {meta.path}
        </svg>
      ) : (
        "J"
      )}
    </span>
  );
}
