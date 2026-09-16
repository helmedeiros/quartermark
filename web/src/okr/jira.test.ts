import { describe, expect, it } from "vitest";
import { jiraLabelSearchUrl, jiraTicketUrl } from "./jira";

const BASE = "https://example.atlassian.net";

describe("jiraTicketUrl", () => {
  it("builds a browse URL for a given key", () => {
    expect(jiraTicketUrl(BASE, "PROJ-123")).toBe(
      "https://example.atlassian.net/browse/PROJ-123",
    );
  });

  it("tolerates a trailing slash on the configured host", () => {
    expect(jiraTicketUrl(`${BASE}/`, "PROJ-123")).toBe(
      "https://example.atlassian.net/browse/PROJ-123",
    );
  });

  // A team can run OKRs without Jira configured. Returning "" lets the
  // caller render plain text rather than a link to nowhere.
  it("returns an empty string when no host is configured", () => {
    expect(jiraTicketUrl("", "PROJ-123")).toBe("");
  });
});

describe("jiraLabelSearchUrl", () => {
  it("builds a JQL label search and escapes the label", () => {
    expect(jiraLabelSearchUrl(BASE, "net rate")).toBe(
      "https://example.atlassian.net/issues/?jql=labels%3D%22net%20rate%22",
    );
  });

  it("returns an empty string when no host is configured", () => {
    expect(jiraLabelSearchUrl("", "anything")).toBe("");
  });
});
