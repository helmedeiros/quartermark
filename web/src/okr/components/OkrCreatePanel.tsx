import { useId, useState } from "react";
import {
  NON_CLUSTER,
  currentNumberFor,
  deriveMetricProgress,
  targetNumberFor,
  TYPE_BADGE_CLASS,
  TYPE_META,
  type Cluster,
} from "../okrTree";
import { MetricFieldsBlock } from "./MetricFieldsBlock";
import type { OkrMetricType, OkrNodeType } from "./types";

export interface OkrCreateFields {
  title: string;
  description?: string;
  owner?: string;
  groups?: string[];
  labels?: string[];
  metricType?: OkrMetricType;
  unit?: string;
  target?: number;
  current?: number;
  progress?: number;
}

type CreateState =
  | { type: "objective" }
  | { type: "milestone" }
  | {
      type: "key_result";
      metricType: OkrMetricType;
      unit: string;
      target: string;
      current: string;
    };

function initialStateFor(type: OkrNodeType): CreateState {
  if (type === "key_result") {
    return {
      type,
      metricType: "percent",
      unit: "",
      target: "100",
      current: "0",
    };
  }
  return { type };
}

function metricFieldsFor(state: Extract<CreateState, { type: "key_result" }>) {
  const targetNum = targetNumberFor(state.metricType, state.target);
  const currentNum = currentNumberFor(state.metricType, state.current);
  const displayUnit = state.metricType === "percent" ? "%" : state.unit;
  return {
    metricType: state.metricType,
    unit: displayUnit.trim() || undefined,
    target: targetNum,
    current: currentNum,
    progress:
      currentNum != null && targetNum != null
        ? deriveMetricProgress(state.metricType, currentNum, targetNum)
        : undefined,
  };
}

export function OkrCreatePanel({
  allowedTypes,
  parentLabel,
  quarterLabel,
  teamName,
  clusters,
  pending,
  ownerOptions = [],
  labelOptions = [],
  onCreate,
  onClose,
}: {
  allowedTypes: OkrNodeType[];
  parentLabel?: string;
  quarterLabel: string;
  teamName: string;
  clusters: string[];
  pending: boolean;
  ownerOptions?: string[];
  labelOptions?: string[];
  onCreate: (type: OkrNodeType, fields: OkrCreateFields) => void;
  onClose: () => void;
}) {
  const ownerListId = useId();
  const labelListId = useId();
  const [state, setState] = useState<CreateState>(
    initialStateFor(allowedTypes[0]),
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [cluster, setCluster] = useState<Cluster>("Non-Cluster");
  const [labels, setLabels] = useState("");
  const [createAnother, setCreateAnother] = useState(false);

  const type = state.type;

  const setType = (t: OkrNodeType) => setState(initialStateFor(t));
  const updateMetric = (
    patch: Partial<Omit<Extract<CreateState, { type: "key_result" }>, "type">>,
  ) => setState((s) => (s.type === "key_result" ? { ...s, ...patch } : s));

  const reset = () => {
    setTitle("");
    setDescription("");
    setLabels("");
  };

  const submit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || pending) return;
    const labelList = labels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    onCreate(type, {
      title: trimmedTitle,
      description: description.trim() || undefined,
      owner: owner.trim() || undefined,
      groups: cluster === NON_CLUSTER ? undefined : [teamName, cluster],
      labels: labelList.length ? labelList : undefined,
      ...(state.type === "key_result" ? metricFieldsFor(state) : {}),
    });
    if (createAnother) reset();
    else onClose();
  };

  return (
    <>
      <div className="okr-create-backdrop" onClick={onClose} />
      <div className="okr-create-panel" role="dialog" aria-modal="true">
        <div className="okr-create-header">
          {allowedTypes.length > 1 ? (
            <div className="okr-create-type-picker">
              {allowedTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`okr-create-type-option${t === type ? " active" : ""}`}
                  onClick={() => setType(t)}
                >
                  <span className={`okr-badge ${TYPE_BADGE_CLASS[t]}`}>
                    {TYPE_META[t].short}
                  </span>
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          ) : (
            <span className="okr-create-header-label">
              <span className={`okr-badge ${TYPE_BADGE_CLASS[type]}`}>
                {TYPE_META[type].short}
              </span>
              Create New {TYPE_META[type].label}
            </span>
          )}
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

        <input
          autoFocus
          className="okr-create-title-input"
          placeholder={`Enter ${TYPE_META[type].label.toLowerCase()} name`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <textarea
          className="okr-create-description-input"
          placeholder="Add a description…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        {state.type === "key_result" && (
          <MetricFieldsBlock
            metricType={state.metricType}
            unit={state.unit}
            current={state.current}
            target={state.target}
            currentLabel="Start"
            booleanLabel="Status"
            onMetricTypeChange={(metricType) => updateMetric({ metricType })}
            onUnitChange={(unit) => updateMetric({ unit })}
            onCurrentChange={(current) => updateMetric({ current })}
            onTargetChange={(target) => updateMetric({ target })}
          />
        )}

        <div className="okr-create-fields">
          <label className="okr-create-field">
            <span className="small muted">Owner</span>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Unassigned"
              list={ownerListId}
            />
            <datalist id={ownerListId}>
              {ownerOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
          <label className="okr-create-field">
            <span className="small muted">Cluster</span>
            <select
              value={cluster}
              onChange={(e) => setCluster(e.target.value as Cluster)}
            >
              {[...clusters, NON_CLUSTER].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="okr-create-field">
            <span className="small muted">Labels</span>
            <input
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="comma, separated"
              list={labelListId}
            />
            <datalist id={labelListId}>
              {labelOptions.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
          <div className="okr-create-field">
            <span className="small muted">Quarter</span>
            <span>{quarterLabel}</span>
          </div>
        </div>

        <div className="okr-create-footer">
          <label className="okr-create-another">
            <input
              type="checkbox"
              checked={createAnother}
              onChange={(e) => setCreateAnother(e.target.checked)}
            />
            Create another
          </label>
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
              disabled={pending || !title.trim()}
            >
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
