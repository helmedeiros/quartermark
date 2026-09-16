import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { JiraTypeBadge } from "./JiraTypeBadge";

export function OkrLinkJiraPanel({
  teamSlug,
  existingKeys,
  parentLabel,
  pending,
  onLink,
  onClose,
}: {
  teamSlug: string;
  existingKeys: string[];
  parentLabel?: string;
  pending: boolean;
  onLink: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["jira-search", teamSlug, debouncedQuery],
    queryFn: () => api.searchJiraIssues(teamSlug, debouncedQuery),
    enabled: debouncedQuery.length > 1,
  });

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const linkedKeys = existingKeys.filter((k) => !removed.has(k));
  const submit = () => {
    if (pending) return;
    onLink([...new Set([...linkedKeys, ...selected])]);
  };

  return (
    <>
      <div className="okr-create-backdrop" onClick={onClose} />
      <div className="okr-create-panel" role="dialog" aria-modal="true">
        <div className="okr-create-header">
          <span className="okr-create-header-label">
            <span className="okr-badge okr-badge-jira">J</span>
            Link Jira Issue
          </span>
          <button
            type="button"
            className="okr-create-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {parentLabel && (
          <p className="small muted" style={{ margin: "0 0 12px" }}>
            Under {parentLabel}
          </p>
        )}

        {!!linkedKeys.length && (
          <div className="okr-jira-linked-chips">
            {linkedKeys.map((k) => (
              <span key={k} className="chip neutral">
                {k}
                <button
                  type="button"
                  aria-label={`Unlink ${k}`}
                  onClick={() => setRemoved((prev) => new Set(prev).add(k))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          autoFocus
          className="okr-create-title-input"
          style={{ fontSize: 16 }}
          placeholder="Search for a Jira issue by key or text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="okr-jira-search-results">
          {isFetching && <p className="small muted">Searching…</p>}
          {!isFetching && debouncedQuery.length > 1 && !results?.length && (
            <p className="small muted">No matching issues.</p>
          )}
          {results?.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`okr-jira-search-result${
                selected.has(r.key) ? " selected" : ""
              }`}
              onClick={() => toggleSelected(r.key)}
            >
              <JiraTypeBadge issueType={r.issueType} />
              <span className="okr-jira-search-result-text">
                <strong>{r.key}</strong> {r.summary}
              </span>
              {selected.has(r.key) && (
                <span className="okr-jira-search-check">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="okr-create-footer">
          <span className="small muted">
            {selected.size
              ? `${selected.size} selected`
              : "Select one or more issues"}
          </span>
          <div className="okr-create-actions">
            <button
              type="button"
              className="timeline-nav-btn"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="okr-create-submit"
              onClick={submit}
              disabled={pending}
            >
              {pending ? "Linking…" : "Link"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
