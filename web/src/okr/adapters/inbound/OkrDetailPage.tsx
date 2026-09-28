import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useTeamBlob } from "../../../api/useTeamBlob";
import { initials } from "../../../lib/format";
import { yearWeekRangeLabel } from "../../../lib/ganttLayout";
import { jiraTicketUrl } from "../outbound/jira";
import { markdownToHtml } from "../../../lib/markdown";
import {
  applyMarkdownAction,
  MARKDOWN_TOOLBAR,
  type MarkdownAction,
} from "../../../lib/markdownEditor";
import {
  collectLabels,
  collectOwners,
  contributesToParentGrade,
  effectiveDateRange,
  effectiveGroups,
  effectiveProgress,
  effortWeeksPatch,
  findNode,
  findPath,
  hasContributingChildren,
  objectiveTotalEffortEngineerWeeks,
  PREDICTED_SCORE_AT_RISK,
  PREDICTED_SCORE_ON_TRACK,
  predictedScore,
  predictStatus,
  resolveCluster,
  sortedUpdates,
  STATUS_META,
  statusMeta,
  TYPE_META,
} from "../../domain/tree";
import { Sparkline } from "../../../components/Sparkline";
import { ClusterChip } from "./ClusterChip";
import { useClusters } from "../../useClusters";
import { JiraTypeBadge } from "./JiraTypeBadge";
import { OkrCreatePanel } from "./OkrCreatePanel";
import { OkrLinkJiraPanel } from "./OkrLinkJiraPanel";
import { OkrMetricCard } from "./OkrMetricCard";
import { OkrNotesCard } from "./OkrNotesCard";
import { OkrProgressChart } from "./OkrProgressChart";
import { OkrRowMenu } from "./OkrRowMenu";
import { OkrTreeTable } from "./OkrTreeTable";
import type {
  OkrNode,
  OkrNodeType,
  OkrStatus,
  Quarter,
  TeamOkrsData,
} from "../../domain/model";
import { useOkrTreeMutations } from "../../components/useOkrTreeMutations";
import { useJiraBaseUrl } from "../../../api/useOkrSettings";
import { useCurrentTeamSlug } from "../../../useCurrentTeamSlug";
import { queryStateMessage } from "../../../components/queryStateMessage";

function MarkdownTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const runAction = (action: MarkdownAction) => {
    const el = textareaRef.current;
    if (!el) return;
    const result = applyMarkdownAction(el, action);
    onChange(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  return (
    <div>
      <div className="markdown-toolbar">
        {MARKDOWN_TOOLBAR.map((item) => (
          <button
            key={item.title}
            type="button"
            className="timeline-nav-btn"
            title={item.title}
            onClick={() => runAction(item.action)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        autoFocus
        rows={8}
        className="okr-editable-input"
        style={{ width: "100%", fontFamily: "monospace", resize: "vertical" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function OkrDescriptionCard({
  description,
  onSave,
}: {
  description: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);

  const startEditing = () => {
    setDraft(description);
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Context
        </p>
        <MarkdownTextarea value={draft} onChange={setDraft} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="timeline-nav-btn"
            onClick={() => {
              setEditing(false);
              if (draft !== description) onSave(draft);
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="timeline-nav-btn"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!description) {
    return (
      <button
        type="button"
        className="okr-editable-trigger small muted"
        style={{ marginBottom: 16 }}
        onClick={startEditing}
      >
        + Add description
      </button>
    );
  }

  return (
    <details className="card" style={{ marginBottom: 16 }}>
      <summary className="small" style={{ cursor: "pointer" }}>
        Context
      </summary>
      <div
        className="markdown small"
        style={{ marginTop: 10 }}
        dangerouslySetInnerHTML={{ __html: markdownToHtml(description) }}
      />
      <button
        type="button"
        className="okr-editable-trigger small muted"
        style={{ marginTop: 8 }}
        onClick={startEditing}
      >
        Edit
      </button>
    </details>
  );
}

function JiraNestedItemRow({
  node,
  jiraKey,
  onUnlink,
}: {
  node: OkrNode;
  jiraKey: string;
  onUnlink: () => void;
}) {
  const snapshot = node.jiraIssues?.[jiraKey];
  const snapshotStatus = snapshot?.status ? statusMeta(snapshot.status) : null;
  const jiraBaseUrl = useJiraBaseUrl(useCurrentTeamSlug());
  return (
    <div className="okr-nested-item-row">
      <JiraTypeBadge issueType={snapshot?.issueType} />
      <a
        href={jiraTicketUrl(jiraBaseUrl, jiraKey)}
        target="_blank"
        rel="noopener noreferrer"
        className="okr-nested-item-title"
      >
        <strong>{jiraKey}</strong>
        {snapshot?.summary ? ` ${snapshot.summary}` : ""}
      </a>
      {snapshotStatus ? (
        <span className={`chip ${snapshotStatus.cls}`}>
          {snapshotStatus.label}
        </span>
      ) : (
        <span className="chip neutral">Not synced</span>
      )}
      <span className="okr-nested-item-progress">
        {snapshot?.progress != null ? `${snapshot.progress}%` : "—"}
      </span>
      {snapshot?.assignee && (
        <span
          className="avatar"
          style={{ width: 22, height: 22, fontSize: 10 }}
          title={snapshot.assignee}
        >
          {initials(snapshot.assignee)}
        </span>
      )}
      <button
        type="button"
        className="okr-row-delete"
        aria-label={`Unlink ${jiraKey}`}
        onClick={onUnlink}
      >
        🗑
      </button>
    </div>
  );
}

function OkrComposedOfCard({
  node,
  teamSlug,
  quarterId,
  data,
  tree,
  onRequestCreate,
  onLinkJira,
}: {
  node: OkrNode;
  teamSlug: string;
  quarterId: string;
  data: TeamOkrsData;
  tree: ReturnType<typeof useOkrTreeMutations>;
  onRequestCreate: (
    type: OkrNodeType,
    parentId: string,
    parentLabel: string,
  ) => void;
  onLinkJira: () => void;
}) {
  const parentLabel = `${node.id} ${node.title}`;
  const hasItems = !!node.children?.length || !!node.jiraKeys?.length;
  return (
    <div className="card">
      <div className="okr-nested-items-header">
        <h3>Nested items</h3>
        <OkrRowMenu
          node={node}
          disabled={tree.isPending}
          onAddChild={(type) => onRequestCreate(type, node.id, parentLabel)}
          onLinkJira={onLinkJira}
          triggerGlyph="+"
          triggerClassName="okr-row-menu-trigger"
        />
      </div>
      {hasItems ? (
        <div className="okr-nested-item-list">
          {!!node.children?.length && (
            <OkrTreeTable
              objectives={node.children}
              quarterId={quarterId}
              teamSlug={teamSlug}
              data={data}
              editable
              showNewButton={false}
              hiddenColumns={["cluster", "allocation"]}
              onRequestCreate={(type, childParentId, childParentLabel) =>
                onRequestCreate(
                  type,
                  childParentId ?? node.id,
                  childParentLabel ?? parentLabel,
                )
              }
            />
          )}
          {node.jiraKeys?.map((k) => (
            <JiraNestedItemRow
              key={k}
              node={node}
              jiraKey={k}
              onUnlink={() =>
                void tree.linkJira(
                  node.id,
                  (node.jiraKeys ?? []).filter((existing) => existing !== k),
                )
              }
            />
          ))}
        </div>
      ) : (
        <p className="small muted">No sub-items yet.</p>
      )}
      {tree.isError && (
        <p className="small" style={{ color: "var(--status-critical)" }}>
          Failed to save: {String(tree.error)}
        </p>
      )}
    </div>
  );
}

function AutoManualToggle({
  label,
  mode,
  onChange,
}: {
  label: string;
  mode: "auto" | "manual";
  onChange: (mode: "auto" | "manual") => void;
}) {
  return (
    <div className="okr-auto-toggle-row">
      <span className="small muted">{label}</span>
      <div className="okr-create-metric-toggle">
        {(["auto", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`okr-create-metric-toggle-option${mode === m ? " active" : ""}`}
            onClick={() => onChange(m)}
          >
            {m === "auto" ? "Auto" : "Manual"}
          </button>
        ))}
      </div>
    </div>
  );
}

function PredictedScoreBar({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        Set start/due dates (on this item or the quarter) to predict a status.
      </p>
    );
  }
  const zone =
    score >= PREDICTED_SCORE_ON_TRACK
      ? "on_track"
      : score >= PREDICTED_SCORE_AT_RISK
        ? "at_risk"
        : "off_track";
  return (
    <div className="okr-predicted-score">
      <p className="small muted" style={{ margin: "0 0 4px" }}>
        Predicted score: {score}%
      </p>
      <div className="okr-predicted-score-track">
        <span
          className={`okr-predicted-score-segment critical${zone === "off_track" ? " active" : ""}`}
        >
          Off Track
        </span>
        <span
          className={`okr-predicted-score-segment warning${zone === "at_risk" ? " active" : ""}`}
        >
          At Risk
        </span>
        <span
          className={`okr-predicted-score-segment good${zone === "on_track" ? " active" : ""}`}
        >
          On Track
        </span>
      </div>
    </div>
  );
}

function GradeCard({
  node,
  quarter,
  onStatusChange,
  onModeChange,
}: {
  node: OkrNode;
  quarter: Quarter;
  onStatusChange: (status: OkrStatus) => void;
  onModeChange: (
    patch: Partial<Pick<OkrNode, "progressMode" | "statusMode">>,
  ) => void;
}) {
  const progress = effectiveProgress(node);
  const statusIsAuto = node.statusMode === "auto";
  const predicted = statusIsAuto ? predictStatus(node, quarter) : node.status;
  const meta = statusMeta(predicted);
  const trend = sortedUpdates(node).map((u) => u.progress);
  const score = statusIsAuto ? predictedScore(node, quarter) : null;

  useEffect(() => {
    if (statusIsAuto && predicted !== node.status) onStatusChange(predicted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusIsAuto, predicted]);

  const progressMode: "auto" | "manual" =
    node.progressMode ?? (hasContributingChildren(node) ? "auto" : "manual");
  const statusMode: "auto" | "manual" = node.statusMode ?? "manual";

  return (
    <div className="card okr-detail-grade-card">
      <div className="okr-detail-grade-value">{progress}%</div>
      <div className="okr-detail-grade-bar-track">
        <div
          className={`okr-detail-grade-bar-fill ${meta.cls}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {statusIsAuto ? (
        <span className={`chip ${meta.cls}`}>{meta.label}</span>
      ) : (
        <select
          className={`chip ${meta.cls} okr-detail-status-select`}
          value={node.status}
          onChange={(e) => onStatusChange(e.target.value as OkrStatus)}
        >
          {Object.entries(STATUS_META).map(([value, m]) => (
            <option key={value} value={value}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      <AutoManualToggle
        label="Status"
        mode={statusMode}
        onChange={(mode) => onModeChange({ statusMode: mode })}
      />
      <AutoManualToggle
        label="Progress"
        mode={progressMode}
        onChange={(mode) => onModeChange({ progressMode: mode })}
      />
      {statusIsAuto && <PredictedScoreBar score={score} />}
      {trend.length >= 2 && (
        <div className="okr-detail-grade-sparkline">
          <Sparkline values={trend} width={200} height={36} />
        </div>
      )}
    </div>
  );
}

function AllocationInput({
  value,
  onCommit,
}: {
  value?: number;
  onCommit: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const commit = () => {
    if (draft.trim() === "") {
      onCommit(undefined);
      return;
    }
    const n = Number(draft);
    if (Number.isNaN(n)) return;
    onCommit(Math.min(100, Math.max(0, n)));
  };
  return (
    <span className="okr-create-metric-input-group" style={{ width: 90 }}>
      <input
        type="number"
        min={0}
        max={100}
        placeholder="—"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <span>%</span>
    </span>
  );
}

function DateInput({
  value,
  onCommit,
}: {
  value?: string;
  onCommit: (value: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const commit = () => onCommit(draft.trim() === "" ? undefined : draft);
  return (
    <input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

function DatesEditor({
  node,
  quarter,
  path,
  onCommit,
}: {
  node: OkrNode;
  quarter: Quarter;
  path: OkrNode[];
  onCommit: (patch: { startDate?: string; dueDate?: string }) => void;
}) {
  const ancestorObjective = path[0];
  const objectiveRange = effectiveDateRange(ancestorObjective, quarter);
  const warnings: string[] = [];
  if (node.startDate && node.dueDate && node.dueDate < node.startDate) {
    warnings.push("Due date is before the start date.");
  }
  if (node.type !== "objective" && ancestorObjective) {
    if (
      node.startDate &&
      objectiveRange.start &&
      node.startDate < objectiveRange.start
    ) {
      warnings.push("Starts before its objective does.");
    }
    if (
      node.dueDate &&
      objectiveRange.due &&
      node.dueDate > objectiveRange.due
    ) {
      warnings.push("Due after its objective's due date.");
    }
  }
  const isInheriting =
    node.type !== "objective" && !node.startDate && !node.dueDate;

  const displayStart = node.startDate ?? objectiveRange.start;
  const displayDue = node.dueDate ?? objectiveRange.due;
  const weeksLabel =
    displayStart && displayDue
      ? yearWeekRangeLabel(new Date(displayStart), new Date(displayDue))
      : undefined;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 4, width: 190 }}
    >
      <span className="okr-create-metric-input-group" style={{ gap: 6 }}>
        <DateInput
          value={node.startDate}
          onCommit={(startDate) => onCommit({ startDate })}
        />
        <span className="muted">–</span>
        <DateInput
          value={node.dueDate}
          onCommit={(dueDate) => onCommit({ dueDate })}
        />
      </span>
      {weeksLabel && <span className="small muted">{weeksLabel}</span>}
      {isInheriting && (
        <span className="small muted">
          Using the objective's dates — set its own to override.
        </span>
      )}
      {warnings.map((w) => (
        <span
          key={w}
          className="small"
          style={{ color: "var(--status-warning)" }}
        >
          ⚠ {w}
        </span>
      ))}
    </div>
  );
}

function EffortNumberInput({
  value,
  onCommit,
}: {
  value?: number;
  onCommit: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const commit = () => {
    if (draft.trim() === "") {
      onCommit(undefined);
      return;
    }
    const n = Number(draft);
    if (Number.isNaN(n)) return;
    onCommit(Math.max(0, n));
  };
  return (
    <input
      type="number"
      min={0}
      placeholder="—"
      value={draft}
      style={{ width: 50 }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

function MilestoneProgressCard({
  node,
  onChangeProgress,
}: {
  node: OkrNode;
  onChangeProgress: (progress: number) => void;
}) {
  const [draft, setDraft] = useState(node.progress.toString());
  const isLinkedToJira = !!node.jiraKeys?.length;
  const commit = () => {
    const n = Number(draft);
    if (Number.isNaN(n)) return;
    onChangeProgress(Math.min(100, Math.max(0, n)));
  };
  return (
    <div className="card">
      <h3>Progress</h3>
      {isLinkedToJira && (
        <p className="okr-metric-locked-notice">
          🔒 Progress for this milestone is calculated from its linked Jira
          issues and can't be edited directly here.
        </p>
      )}
      <label
        className="small muted"
        style={{ display: "flex", flexDirection: "column", gap: 4, width: 140 }}
      >
        Progress
        <div className="okr-create-metric-input-group">
          <input
            type="number"
            min={0}
            max={100}
            value={draft}
            disabled={isLinkedToJira}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
          />
          <span>%</span>
        </div>
      </label>
    </div>
  );
}

export function OkrDetailPage({ teamSlug }: { teamSlug: string }) {
  const clusters = useClusters(teamSlug);
  const { quarterId, okrId } = useParams<{
    quarterId: string;
    okrId: string;
  }>();
  const { data, isLoading, error } = useTeamBlob<TeamOkrsData>(
    teamSlug,
    "okrs",
  );
  const tree = useOkrTreeMutations(teamSlug, data!, quarterId!);
  const [creating, setCreating] = useState<{
    type: OkrNodeType;
    parentId: string;
    parentLabel: string;
  } | null>(null);
  const [linkingJira, setLinkingJira] = useState(false);

  const queryState = queryStateMessage(isLoading, error, "OKRs");
  if (queryState) return queryState;

  const quarter = data?.quarters.find((q) => q.quarterId === quarterId);
  if (!quarter) return <p className="muted">Quarter not found.</p>;

  const node = okrId && findNode(quarter.objectives, okrId);
  if (!node) return <p className="muted">OKR not found.</p>;

  const path = findPath(quarter.objectives, okrId!) ?? [node];
  const updates = sortedUpdates(node);
  const typeMeta = TYPE_META[node.type];

  return (
    <div>
      <p className="small">
        <Link to={`/t/${teamSlug}/okrs/${quarterId}`}>
          &larr; Back to OKR tree
        </Link>
      </p>

      {path.length > 1 && (
        <p className="small muted">
          {path.slice(0, -1).map((p, i) => (
            <span key={p.id}>
              <Link to={`/t/${teamSlug}/okrs/${quarterId}/${p.id}`}>
                {p.title}
              </Link>
              {i < path.length - 2 ? " › " : " › "}
            </span>
          ))}
          <strong>{node.title}</strong>
        </p>
      )}

      {path.length > 1 && (
        <label className="okr-contribute-toggle">
          <input
            type="checkbox"
            checked={contributesToParentGrade(node)}
            onChange={(e) =>
              tree.editField(node.id, {
                contributesToParentGrade: e.target.checked,
              })
            }
          />
          Contribute to parent&rsquo;s grade
        </label>
      )}

      <div className="okr-detail-layout">
        <div className="okr-detail-main">
          <h2 style={{ marginTop: 0 }}>
            <span
              className={`chip okr-type-chip okr-badge-${node.type.replace("_", "-")}`}
            >
              {typeMeta.short}
            </span>{" "}
            {node.id} {node.title}
          </h2>
          <OkrDescriptionCard
            description={node.description ?? ""}
            onSave={(value) =>
              tree.editField(node.id, { description: value || undefined })
            }
          />

          {node.type === "key_result" && (
            <OkrMetricCard
              teamSlug={teamSlug}
              data={data!}
              quarterId={quarterId!}
              node={node}
            />
          )}
          {node.type === "milestone" && (
            <MilestoneProgressCard
              node={node}
              onChangeProgress={(progress) =>
                tree.editField(node.id, { progress })
              }
            />
          )}

          <OkrComposedOfCard
            node={node}
            teamSlug={teamSlug}
            quarterId={quarterId!}
            data={data!}
            tree={tree}
            onRequestCreate={(type, parentId, parentLabel) =>
              setCreating({ type, parentId, parentLabel })
            }
            onLinkJira={() => setLinkingJira(true)}
          />

          <OkrNotesCard
            teamSlug={teamSlug}
            data={data!}
            quarterId={quarterId!}
            node={node}
          />

          <div className="card">
            <h3>Progress history</h3>
            <OkrProgressChart updates={updates} />
          </div>

          <div className="card">
            <h3>Status changes</h3>
            {!updates.length ? (
              <p className="small muted">No status updates logged yet.</p>
            ) : (
              [...updates].reverse().map((u, i) => {
                const meta = statusMeta(u.status);
                return (
                  <div
                    key={i}
                    className={`timeline-item${
                      u.status === "at_risk" || u.status === "off_track"
                        ? " concerning"
                        : u.status === "done"
                          ? " resolved"
                          : ""
                    }`}
                  >
                    <div className="date">{u.date.slice(0, 10)}</div>
                    <div className="source">
                      <span className={`chip ${meta.cls}`}>{meta.label}</span>{" "}
                      Progress {u.progress}%{u.author ? ` · ${u.author}` : ""}
                    </div>
                    {u.note && <p className="small">{u.note}</p>}
                  </div>
                );
              })
            )}
          </div>

          {node.link && (
            <p className="small">
              <a href={node.link} target="_blank" rel="noopener noreferrer">
                Open source
              </a>
            </p>
          )}
        </div>

        <div className="okr-detail-sidebar">
          <GradeCard
            node={node}
            quarter={quarter}
            onStatusChange={(status) => tree.editField(node.id, { status })}
            onModeChange={(patch) => tree.editField(node.id, patch)}
          />

          <div className="card">
            <div className="detail-list">
              <div className="detail-list-row">
                <span className="label">Owner</span>
                <span className="value">
                  {node.owner ? (
                    <span className="okr-owner">
                      <span
                        className="avatar"
                        style={{ width: 22, height: 22, fontSize: 10 }}
                      >
                        {initials(node.owner)}
                      </span>
                      {node.owner}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="detail-list-row">
                <span className="label">Groups</span>
                <span className="value">
                  <ClusterChip
                    cluster={resolveCluster(effectiveGroups(path))}
                    teamSlug={teamSlug}
                  />
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="detail-list">
              <div className="detail-list-row">
                <span className="label">Interval</span>
                <span className="value">{quarter.label}</span>
              </div>
              <div className="detail-list-row">
                <span className="label">Dates</span>
                <span className="value">
                  <DatesEditor
                    node={node}
                    quarter={quarter}
                    path={path}
                    onCommit={(patch) => tree.editField(node.id, patch)}
                  />
                </span>
              </div>
              <div className="detail-list-row">
                <span className="label">Labels</span>
                <span className="value">
                  {node.labels?.length ? node.labels.join(", ") : "—"}
                </span>
              </div>
              <div className="detail-list-row">
                <span className="label">Weight</span>
                <span className="value">{node.weight ?? "—"}</span>
              </div>
              <div className="detail-list-row">
                <span className="label">Team allocation (planned)</span>
                <span className="value">
                  <AllocationInput
                    value={node.allocation}
                    onCommit={(n) => tree.editField(node.id, { allocation: n })}
                  />
                </span>
              </div>
              <div className="detail-list-row">
                <span className="label">Team allocation (actual)</span>
                <span className="value">
                  <AllocationInput
                    value={node.actualAllocation}
                    onCommit={(n) =>
                      tree.editField(node.id, { actualAllocation: n })
                    }
                  />
                </span>
              </div>
              {node.type === "milestone" && (
                <div className="detail-list-row">
                  <span className="label">Effort</span>
                  <span
                    className="value"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span className="muted">Fixed at 2 engineers ×</span>
                    <EffortNumberInput
                      value={node.effortWeeks}
                      onCommit={(effortWeeks) =>
                        tree.editField(
                          node.id,
                          effortWeeksPatch(node, path[0], quarter, effortWeeks),
                        )
                      }
                    />
                    <span className="muted">weeks</span>
                  </span>
                </div>
              )}
              {node.type === "objective" && (
                <div className="detail-list-row">
                  <span className="label">Total effort</span>
                  <span className="value">
                    {objectiveTotalEffortEngineerWeeks(node) || "—"}
                    {objectiveTotalEffortEngineerWeeks(node) > 0 &&
                      " engineer-weeks (sum of milestones)"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {creating && (
        <OkrCreatePanel
          teamName={data!.team}
          clusters={clusters}
          allowedTypes={[creating.type]}
          parentLabel={creating.parentLabel}
          quarterLabel={quarter.label}
          pending={tree.isPending}
          ownerOptions={collectOwners(data!.quarters)}
          labelOptions={collectLabels(data!.quarters)}
          onCreate={(type, fields) =>
            tree.create(creating.parentId, type, fields.title, fields)
          }
          onClose={() => setCreating(null)}
        />
      )}

      {linkingJira && (
        <OkrLinkJiraPanel
          teamSlug={teamSlug}
          existingKeys={node.jiraKeys ?? []}
          parentLabel={`${node.id} ${node.title}`}
          pending={tree.isPending}
          onLink={(keys) => {
            void tree.linkJira(node.id, keys);
            setLinkingJira(false);
          }}
          onClose={() => setLinkingJira(false)}
        />
      )}
    </div>
  );
}
