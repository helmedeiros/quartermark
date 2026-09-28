import { describe, expect, it } from "vitest";
import { classifyJiraIssueType } from "./jiraIssueType";

describe("classifyJiraIssueType", () => {
  it("recognizes the standard Jira issue types, case-insensitively", () => {
    expect(classifyJiraIssueType("Epic")).toBe("epic");
    expect(classifyJiraIssueType("Story")).toBe("story");
    expect(classifyJiraIssueType("Bug")).toBe("bug");
    expect(classifyJiraIssueType("Task")).toBe("task");
    expect(classifyJiraIssueType("SUB-TASK")).toBe("task");
  });

  it("falls back to unknown for unrecognized or missing types", () => {
    expect(classifyJiraIssueType("Improvement")).toBe("unknown");
    expect(classifyJiraIssueType(undefined)).toBe("unknown");
    expect(classifyJiraIssueType("")).toBe("unknown");
  });
});
