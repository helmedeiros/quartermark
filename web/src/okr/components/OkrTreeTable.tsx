import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  canDropOkrNode,
  NON_CLUSTER,
  COMMITMENT_META,
  effectiveProgress,
  findParentNode,
  flattenVisible,
  hasContributingChildren,
  latestUpdate,
  resolveCluster,
  STATUS_META,
  statusMeta,
  TYPE_BADGE_CLASS,
  TYPE_META,
} from "../domain/tree";
import {
  initialColumnWidths,
  OKR_COLUMNS,
  resizeColumn,
  type OkrColumnKey,
} from "../okrTableColumns";
import { formatRelativeTime, initials } from "../../lib/format";
import { jiraTicketUrl } from "../jira";
import { ClusterChip } from "./ClusterChip";
import { useClusters } from "../useClusters";
import { JiraTypeBadge } from "./JiraTypeBadge";
import { OkrLinkJiraPanel } from "./OkrLinkJiraPanel";
import { OkrRowMenu } from "./OkrRowMenu";
import type {
  OkrCommitment,
  OkrNode,
  OkrNodeType,
  OkrStatus,
  TeamOkrsData,
} from "../domain/model";
import { useOkrTreeMutations } from "./useOkrTreeMutations";
import { useJiraBaseUrl } from "../../api/useOkrSettings";

const COLUMN_LABELS: Record<OkrColumnKey, string> = {
  title: "OKR",
  cluster: "Cluster",
  owner: "Owner",
  status: "Status",
  progress: "Progress",
  weight: "Weight",
  allocation: "Allocation",
  dates: "Dates",
  labels: "Labels",
  update: "Latest Update",
};

const ICON_COLUMN_WIDTH = 28;

function ResizableHeader({
  label,
  onResize,
}: {
  label: ReactNode;
  onResize: (deltaX: number) => void;
}) {
  const handleMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    let lastX = e.clientX;
    const onMouseMove = (ev: globalThis.MouseEvent) => {
      onResize(ev.clientX - lastX);
      lastX = ev.clientX;
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <th className="okr-col-th">
      {label}
      <span
        className="okr-col-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} column`}
        onMouseDown={handleMouseDown}
      />
    </th>
  );
}

type DropPosition = "before" | "after" | "onto";

function dropPositionFor(
  rect: { top: number; height: number },
  clientY: number,
): DropPosition {
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "onto";
}

function collectIds(nodes: OkrNode[]): string[] {
  return nodes.flatMap((n) => [
    n.id,
    ...(n.children ? collectIds(n.children) : []),
  ]);
}

function EditableText({
  value,
  placeholder,
  disabled,
  onCommit,
  renderDisplay,
}: {
  value: string;
  placeholder?: string;
  disabled: boolean;
  onCommit: (value: string) => void;
  renderDisplay?: (value: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        className="okr-editable-trigger"
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value ? (
          renderDisplay ? (
            renderDisplay(value)
          ) : (
            value
          )
        ) : (
          <span className="muted">{placeholder ?? "—"}</span>
        )}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      autoFocus
      className="okr-editable-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function EditableNumber({
  value,
  disabled,
  onCommit,
}: {
  value: number | undefined;
  disabled: boolean;
  onCommit: (value: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        className="okr-editable-trigger"
        disabled={disabled}
        onClick={() => {
          setDraft(value?.toString() ?? "");
          setEditing(true);
        }}
      >
        {value ?? <span className="muted">—</span>}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const n = draft.trim() === "" ? undefined : Number(draft);
    if (n === undefined || !Number.isNaN(n)) onCommit(n);
  };
  return (
    <input
      autoFocus
      type="number"
      className="okr-editable-input okr-editable-input-number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function EditableDate({
  value,
  disabled,
  onCommit,
}: {
  value: string | undefined;
  disabled: boolean;
  onCommit: (value: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        className="okr-editable-trigger"
        disabled={disabled}
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
      >
        {value ?? <span className="muted">—</span>}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    onCommit(draft.trim() === "" ? undefined : draft);
  };
  return (
    <input
      autoFocus
      type="date"
      className="okr-editable-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function EditableStatus({
  value,
  disabled,
  onCommit,
}: {
  value: OkrStatus;
  disabled: boolean;
  onCommit: (value: OkrStatus) => void;
}) {
  const [editing, setEditing] = useState(false);
  const meta = statusMeta(value);

  if (!editing) {
    return (
      <button
        type="button"
        className="okr-editable-trigger"
        disabled={disabled}
        onClick={() => setEditing(true)}
      >
        <span className={`chip ${meta.cls}`}>{meta.label}</span>
      </button>
    );
  }
  return (
    <select
      autoFocus
      className="okr-editable-select"
      value={value}
      onChange={(e) => {
        onCommit(e.target.value as OkrStatus);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
    >
      {Object.entries(STATUS_META).map(([status, m]) => (
        <option key={status} value={status}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

function EditableCommitment({
  value,
  disabled,
  onCommit,
}: {
  value: OkrCommitment;
  disabled: boolean;
  onCommit: (value: OkrCommitment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const meta = COMMITMENT_META[value];

  if (!editing) {
    return (
      <button
        type="button"
        className="okr-editable-trigger"
        disabled={disabled}
        onClick={() => setEditing(true)}
      >
        <span className={`chip ${meta.cls}`}>{meta.label}</span>
      </button>
    );
  }
  return (
    <select
      autoFocus
      className="okr-editable-select"
      value={value}
      onChange={(e) => {
        onCommit(e.target.value as OkrCommitment);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
    >
      {Object.entries(COMMITMENT_META).map(([commitment, m]) => (
        <option key={commitment} value={commitment}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

function EditableCluster({
  groups,
  teamSlug,
  teamName,
  disabled,
  onCommit,
}: {
  groups: string[];
  teamSlug: string;
  teamName: string;
  disabled: boolean;
  onCommit: (groups: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const clusters = useClusters(teamSlug);
  const current = resolveCluster(groups, clusters);
  const allClusters = [...clusters, NON_CLUSTER];

  if (!editing) {
    return (
      <span className="okr-inline-edit-wrap">
        <ClusterChip cluster={current} teamSlug={teamSlug} />
        {!disabled && (
          <button
            type="button"
            className="okr-inline-edit-btn"
            aria-label="Edit cluster"
            onClick={() => setEditing(true)}
          >
            ✎
          </button>
        )}
      </span>
    );
  }
  return (
    <select
      autoFocus
      className="okr-editable-select"
      value={current}
      onChange={(e) => {
        const chosen = e.target.value;
        const team = groups[0] ?? teamName;
        onCommit(chosen === NON_CLUSTER ? [team] : [team, chosen]);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
    >
      {allClusters.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

function EditableTitle({
  node,
  teamSlug,
  quarterId,
  disabled,
  onCommit,
}: {
  node: OkrNode;
  teamSlug: string;
  quarterId: string;
  disabled: boolean;
  onCommit: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);

  if (editing) {
    const commit = () => {
      setEditing(false);
      const trimmed = draft.trim();
      if (trimmed && trimmed !== node.title) onCommit(trimmed);
    };
    return (
      <input
        autoFocus
        className="okr-editable-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <>
      <Link
        to={`/t/${teamSlug}/okrs/${quarterId}/${node.id}`}
        className="okr-title-link"
        title={`${node.id} ${node.title}`}
      >
        <strong>{node.id}</strong> {node.title}
      </Link>
      {!disabled && (
        <button
          type="button"
          className="okr-inline-edit-btn"
          aria-label="Rename"
          onClick={() => {
            setDraft(node.title);
            setEditing(true);
          }}
        >
          ✎
        </button>
      )}
    </>
  );
}

export function OkrTreeTable({
  objectives,
  quarterId,
  teamSlug,
  data,
  editable,
  onRequestCreate,
  hiddenColumns = [],
  showNewButton = true,
}: {
  objectives: OkrNode[];
  quarterId: string;
  teamSlug: string;
  data: TeamOkrsData;
  editable: boolean;
  onRequestCreate?: (
    type: OkrNodeType,
    parentId: string | null,
    parentLabel?: string,
  ) => void;
  hiddenColumns?: OkrColumnKey[];
  showNewButton?: boolean;
}) {
  const visibleColumns = OKR_COLUMNS.filter(
    (key) => !hiddenColumns.includes(key),
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [lastQuarterId, setLastQuarterId] = useState(quarterId);
  if (quarterId !== lastQuarterId) {
    setLastQuarterId(quarterId);
    setExpanded(new Set());
  }
  const [query, setQuery] = useState("");
  const [linkingJiraFor, setLinkingJiraFor] = useState<OkrNode | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: DropPosition;
  } | null>(null);
  const tree = useOkrTreeMutations(teamSlug, data, quarterId);
  const jiraBaseUrl = useJiraBaseUrl(teamSlug);
  const clusters = useClusters(teamSlug);
  const quarter = data.quarters.find((q) => q.quarterId === quarterId);
  const canEdit = editable && !!quarter;

  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<Record<
    OkrColumnKey,
    number
  > | null>(null);

  useLayoutEffect(() => {
    if (colWidths || !tableWrapperRef.current) return;
    const iconColumns = canEdit ? 2 : 0;
    const available =
      tableWrapperRef.current.clientWidth - iconColumns * ICON_COLUMN_WIDTH;
    setColWidths(initialColumnWidths(Math.max(available, 400)));
  }, [colWidths, canEdit]);

  const resizeCol = (key: OkrColumnKey, deltaX: number) =>
    setColWidths((prev) => (prev ? resizeColumn(prev, key, deltaX) : prev));

  const rows = useMemo(
    () => flattenVisible(objectives, expanded, query.trim()),
    [objectives, expanded, query],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allIds = useMemo(() => collectIds(objectives), [objectives]);

  const endDrag = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  const rowDragHandlers = (node: OkrNode) => ({
    onDragStart: (e: DragEvent<HTMLTableRowElement>) => {
      if (!canEdit) return;
      setDraggedId(node.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", node.id);
    },
    onDragEnd: endDrag,
    onDragEnter: (e: DragEvent<HTMLTableRowElement>) => {
      if (!canEdit || !draggedId || draggedId === node.id) return;
      e.preventDefault();
    },
    onDragOver: (e: DragEvent<HTMLTableRowElement>) => {
      if (!canEdit || !draggedId || draggedId === node.id || !quarter) return;
      const position = dropPositionFor(
        e.currentTarget.getBoundingClientRect(),
        e.clientY,
      );
      if (!canDropOkrNode(quarter.objectives, draggedId, node.id, position)) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget?.id !== node.id || dropTarget.position !== position) {
        setDropTarget({ id: node.id, position });
      }
    },
    onDrop: (e: DragEvent<HTMLTableRowElement>) => {
      e.preventDefault();
      if (draggedId && draggedId !== node.id && quarter) {
        const position = dropPositionFor(
          e.currentTarget.getBoundingClientRect(),
          e.clientY,
        );
        if (canDropOkrNode(quarter.objectives, draggedId, node.id, position)) {
          if (position === "onto") {
            tree.moveInto(draggedId, node.id);
          } else {
            const draggedParentId =
              findParentNode(quarter.objectives, draggedId)?.id ?? null;
            const targetParentId =
              findParentNode(quarter.objectives, node.id)?.id ?? null;
            const changesParent = draggedParentId !== targetParentId;
            if (
              !changesParent ||
              window.confirm(
                `Move ${draggedId} out from under ${draggedParentId ?? "the top level"} to sit next to ${node.id}? This changes its parent, not just its order.`,
              )
            ) {
              tree.moveRelative(draggedId, node.id, position);
            }
          }
        }
      }
      endDrag();
    },
  });

  return (
    <div>
      <div className="filter-bar">
        <input
          className="okr-search"
          placeholder="Search OKRs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="timeline-nav-btn"
          onClick={() => setExpanded(new Set(allIds))}
        >
          Expand all
        </button>
        <button
          type="button"
          className="timeline-nav-btn"
          onClick={() => setExpanded(new Set())}
        >
          Collapse all
        </button>
        {canEdit && onRequestCreate && showNewButton && (
          <button
            type="button"
            className="timeline-nav-btn"
            onClick={() => onRequestCreate("objective", null)}
          >
            + New OKR
          </button>
        )}
      </div>

      {tree.isError && (
        <p className="small" style={{ color: "var(--status-critical)" }}>
          Failed to save: {String(tree.error)}
        </p>
      )}

      {!rows.length ? (
        <p className="small muted">No OKRs match this search.</p>
      ) : (
        <div className="okr-tree-table-wrapper" ref={tableWrapperRef}>
          <table
            className="data-table okr-tree-table"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              {canEdit && <col style={{ width: ICON_COLUMN_WIDTH }} />}
              {visibleColumns.map((key) => (
                <col key={key} style={{ width: colWidths?.[key] }} />
              ))}
              {canEdit && <col style={{ width: ICON_COLUMN_WIDTH }} />}
            </colgroup>
            <thead>
              <tr>
                {canEdit && <th />}
                {visibleColumns.map((key) => (
                  <ResizableHeader
                    key={key}
                    label={COLUMN_LABELS[key]}
                    onResize={(deltaX) => resizeCol(key, deltaX)}
                  />
                ))}
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node, depth, hasChildren, groups, jiraKey }) => {
                if (jiraKey) {
                  const snapshot = node.jiraIssues?.[jiraKey];
                  const jiraStatus = snapshot?.status
                    ? statusMeta(snapshot.status)
                    : undefined;
                  return (
                    <tr key={`${node.id}::jira::${jiraKey}`}>
                      {canEdit && <td />}
                      <td>
                        <div
                          className="okr-title-cell"
                          style={{ paddingLeft: depth * 20 }}
                        >
                          <span className="okr-caret-spacer" />
                          <JiraTypeBadge issueType={snapshot?.issueType} />
                          <a
                            href={jiraTicketUrl(jiraBaseUrl, jiraKey)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="okr-title-link"
                          >
                            <strong>{jiraKey}</strong>
                            {snapshot?.summary ? ` ${snapshot.summary}` : ""}
                          </a>
                        </div>
                      </td>
                      {!hiddenColumns.includes("cluster") && (
                        <td>
                          <ClusterChip
                            cluster={resolveCluster(groups, clusters)}
                            teamSlug={teamSlug}
                          />
                        </td>
                      )}
                      <td>
                        {snapshot?.assignee ? (
                          <span className="okr-owner">
                            <span
                              className="avatar"
                              style={{ width: 22, height: 22, fontSize: 10 }}
                            >
                              {initials(snapshot.assignee)}
                            </span>
                            {snapshot.assignee}
                          </span>
                        ) : (
                          <span className="muted">Unassigned</span>
                        )}
                      </td>
                      <td>
                        {jiraStatus ? (
                          <span className={`chip ${jiraStatus.cls}`}>
                            {jiraStatus.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {snapshot?.progress != null
                          ? `${snapshot.progress}%`
                          : "—"}
                      </td>
                      <td>—</td>
                      {!hiddenColumns.includes("allocation") && <td>—</td>}
                      {!hiddenColumns.includes("dates") && <td>—</td>}
                      <td>
                        {snapshot?.labels?.length ? (
                          <span className="chip neutral">
                            {snapshot.labels.join(", ")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {!hiddenColumns.includes("update") && (
                        <td className="small muted okr-update-cell">
                          {snapshot?.syncedAt
                            ? `Synced ${formatRelativeTime(snapshot.syncedAt)}`
                            : "Not yet synced from Jira"}
                        </td>
                      )}
                      {canEdit && <td />}
                    </tr>
                  );
                }
                const typeMeta = TYPE_META[node.type];
                const update = latestUpdate(node);
                const isDropTarget = dropTarget?.id === node.id;
                const rowClass = [
                  draggedId === node.id ? "okr-row-dragging" : "",
                  isDropTarget ? `okr-row-drop-${dropTarget!.position}` : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr
                    key={node.id}
                    className={rowClass || undefined}
                    draggable={canEdit}
                    {...rowDragHandlers(node)}
                  >
                    {canEdit && (
                      <td className="okr-drag-handle-cell">
                        <span className="okr-drag-handle" aria-hidden="true">
                          ⠿
                        </span>
                      </td>
                    )}
                    <td>
                      <div
                        className="okr-title-cell"
                        style={{ paddingLeft: depth * 20 }}
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            className="expandable-caret okr-caret"
                            onClick={() => toggle(node.id)}
                            aria-label={
                              expanded.has(node.id) ? "Collapse" : "Expand"
                            }
                          >
                            {expanded.has(node.id) ? "▾" : "▸"}
                          </button>
                        ) : (
                          <span className="okr-caret-spacer" />
                        )}
                        <span
                          className={`okr-badge ${TYPE_BADGE_CLASS[node.type]}`}
                          title={typeMeta.label}
                        >
                          {typeMeta.short}
                        </span>
                        <EditableTitle
                          node={node}
                          teamSlug={teamSlug}
                          quarterId={quarterId}
                          disabled={!canEdit}
                          onCommit={(title) =>
                            tree.editField(node.id, { title })
                          }
                        />
                        {node.type === "objective" && (
                          <EditableCommitment
                            value={node.commitment ?? "proposed"}
                            disabled={!canEdit}
                            onCommit={(commitment) =>
                              tree.editField(node.id, { commitment })
                            }
                          />
                        )}
                      </div>
                    </td>
                    {!hiddenColumns.includes("cluster") && (
                      <td>
                        <EditableCluster
                          groups={groups}
                          teamSlug={teamSlug}
                          teamName={data.team}
                          disabled={!canEdit}
                          onCommit={(newGroups) =>
                            tree.editField(node.id, { groups: newGroups })
                          }
                        />
                      </td>
                    )}
                    <td>
                      <EditableText
                        value={node.owner ?? ""}
                        placeholder="Unassigned"
                        disabled={!canEdit}
                        onCommit={(owner) =>
                          tree.editField(node.id, { owner: owner || undefined })
                        }
                        renderDisplay={(owner) => (
                          <span className="okr-owner">
                            <span
                              className="avatar"
                              style={{ width: 22, height: 22, fontSize: 10 }}
                            >
                              {initials(owner)}
                            </span>
                            {owner}
                          </span>
                        )}
                      />
                    </td>
                    <td>
                      <EditableStatus
                        value={node.status}
                        disabled={!canEdit}
                        onCommit={(status) =>
                          tree.editField(node.id, { status })
                        }
                      />
                    </td>
                    <td>
                      <EditableNumber
                        value={effectiveProgress(node)}
                        disabled={
                          !canEdit ||
                          (node.progressMode !== "manual" &&
                            hasContributingChildren(node))
                        }
                        onCommit={(progress) =>
                          tree.editField(node.id, { progress: progress ?? 0 })
                        }
                      />
                      %
                    </td>
                    <td>
                      <EditableNumber
                        value={node.weight}
                        disabled={!canEdit}
                        onCommit={(weight) =>
                          tree.editField(node.id, { weight })
                        }
                      />
                    </td>
                    {!hiddenColumns.includes("allocation") && (
                      <td>
                        <span
                          className="okr-allocation-cell"
                          title="Planned / actual team allocation"
                        >
                          <EditableNumber
                            value={node.allocation}
                            disabled={!canEdit}
                            onCommit={(allocation) =>
                              tree.editField(node.id, { allocation })
                            }
                          />
                          <span className="muted">/</span>
                          <EditableNumber
                            value={node.actualAllocation}
                            disabled={!canEdit}
                            onCommit={(actualAllocation) =>
                              tree.editField(node.id, { actualAllocation })
                            }
                          />
                        </span>
                      </td>
                    )}
                    {!hiddenColumns.includes("dates") && (
                      <td>
                        <span
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <EditableDate
                              value={node.startDate}
                              disabled={!canEdit}
                              onCommit={(startDate) =>
                                tree.editField(node.id, { startDate })
                              }
                            />
                            <span className="muted">–</span>
                            <EditableDate
                              value={node.dueDate}
                              disabled={!canEdit}
                              onCommit={(dueDate) =>
                                tree.editField(node.id, { dueDate })
                              }
                            />
                          </span>
                          {node.type !== "objective" &&
                            !node.startDate &&
                            !node.dueDate && (
                              <span className="small muted">Inherited</span>
                            )}
                        </span>
                      </td>
                    )}
                    <td>
                      <EditableText
                        value={node.labels?.join(", ") ?? ""}
                        placeholder="—"
                        disabled={!canEdit}
                        renderDisplay={(labels) => (
                          <span className="chip neutral">{labels}</span>
                        )}
                        onCommit={(raw) =>
                          tree.editField(node.id, {
                            labels: raw
                              .split(",")
                              .map((l) => l.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </td>
                    {!hiddenColumns.includes("update") && (
                      <td className="small muted okr-update-cell">
                        {update?.note || "—"}
                      </td>
                    )}
                    {canEdit && (
                      <td>
                        <div className="okr-row-actions">
                          <OkrRowMenu
                            node={node}
                            disabled={tree.isPending}
                            onAddChild={(type) =>
                              onRequestCreate?.(
                                type,
                                node.id,
                                `${node.id} ${node.title}`,
                              )
                            }
                            onLinkJira={() => setLinkingJiraFor(node)}
                            onDelete={() => {
                              if (
                                window.confirm(
                                  `Delete ${node.id} ${node.title}? This also removes any of its own sub-items.`,
                                )
                              ) {
                                tree.remove(node.id);
                              }
                            }}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {linkingJiraFor && (
        <OkrLinkJiraPanel
          teamSlug={teamSlug}
          existingKeys={linkingJiraFor.jiraKeys ?? []}
          parentLabel={`${linkingJiraFor.id} ${linkingJiraFor.title}`}
          pending={tree.isPending}
          onLink={(keys) => {
            void tree.linkJira(linkingJiraFor.id, keys);
            setLinkingJiraFor(null);
          }}
          onClose={() => setLinkingJiraFor(null)}
        />
      )}
    </div>
  );
}
