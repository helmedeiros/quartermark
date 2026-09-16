export type OkrStatus =
  "not_started" | "on_track" | "at_risk" | "off_track" | "done";

export type OkrNodeType = "objective" | "key_result" | "milestone";

export type OkrCommitment =
  "proposed" | "committed" | "if_possible" | "rejected" | "extra";

export interface OkrUpdate {
  date: string;
  status: OkrStatus;
  progress: number;
  note?: string;
  author?: string;
}

export interface OkrNote {
  date: string;
  author?: string;
  comment?: string;
  learnings?: string;
  nextSteps?: string;
}

export interface OkrMetricPoint {
  date: string;
  current: number;
}

export type OkrMetricType = "percent" | "number" | "currency" | "boolean";

export interface JiraSprintSnapshot {
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface JiraIssueSnapshot {
  summary?: string;
  issueType?: string;
  status?: OkrStatus;
  progress?: number;
  assignee?: string;
  labels?: string[];
  dueDate?: string;
  sprints?: JiraSprintSnapshot[];
  syncedAt?: string;
}

export interface OkrNode {
  id: string;
  type: OkrNodeType;
  title: string;
  description?: string;
  owner?: string;
  groups?: string[];
  status: OkrStatus;
  progress: number;
  progressMode?: "auto" | "manual";
  statusMode?: "auto" | "manual";
  weight?: number;
  allocation?: number;
  actualAllocation?: number;
  labels?: string[];
  metricType?: OkrMetricType;
  target?: number;
  current?: number;
  unit?: string;
  startDate?: string;
  dueDate?: string;
  effortWeeks?: number;
  link?: string;
  updates?: OkrUpdate[];
  notes?: OkrNote[];
  metricHistory?: OkrMetricPoint[];
  jiraKeys?: string[];
  jiraIssues?: Record<string, JiraIssueSnapshot>;
  contributesToParentGrade?: boolean;
  commitment?: OkrCommitment;
  children?: OkrNode[];
}

export interface Quarter {
  quarterId: string;
  label: string;
  startDate?: string;
  endDate?: string;
  jiraRefreshedAt?: string;
  jiraAsOf?: string;
  locked?: boolean;
  teamCapacity?: number;
  objectives: OkrNode[];
}

export interface TeamOkrsData {
  team: string;
  quarters: Quarter[];
  // Stamped by the server (see okr.UpgradeBlob). Optional because a blob
  // written before versioning existed has none; present here so edits
  // round-trip it instead of silently dropping it on save.
  schemaVersion?: number;
}
