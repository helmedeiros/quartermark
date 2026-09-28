import type { ReactNode } from "react";
import { METRIC_TYPE_META } from "../domain/tree";
import type { OkrMetricType } from "../domain/model";

const METRIC_TYPE_ICON: Record<
  OkrMetricType,
  { cls: string; glyph: ReactNode }
> = {
  percent: {
    cls: "okr-badge-metric-percent",
    glyph: (
      <svg viewBox="0 0 16 16" width="12" height="12">
        <circle cx="5" cy="5" r="2" fill="white" />
        <circle cx="11" cy="11" r="2" fill="white" />
        <line
          x1="11.5"
          y1="4.5"
          x2="4.5"
          y2="11.5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  number: {
    cls: "okr-badge-metric-number",
    glyph: (
      <svg viewBox="0 0 16 16" width="12" height="12">
        <line x1="6" y1="3" x2="6" y2="13" stroke="white" strokeWidth="1.5" />
        <line x1="10" y1="3" x2="10" y2="13" stroke="white" strokeWidth="1.5" />
        <line x1="3" y1="6" x2="13" y2="6" stroke="white" strokeWidth="1.5" />
        <line x1="3" y1="10" x2="13" y2="10" stroke="white" strokeWidth="1.5" />
      </svg>
    ),
  },
  currency: {
    cls: "okr-badge-metric-currency",
    glyph: (
      <svg viewBox="0 0 16 16" width="12" height="12">
        <line x1="8" y1="2" x2="8" y2="14" stroke="white" strokeWidth="1.5" />
        <path
          d="M11 5.5C11 4.5 9.8 4 8 4C6.2 4 5 4.7 5 6C5 7.3 6.2 7.6 8 8C9.8 8.4 11 8.7 11 10C11 11.3 9.8 12 8 12C6.2 12 5 11.5 5 10.5"
          stroke="white"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  boolean: {
    cls: "okr-badge-metric-boolean",
    glyph: (
      <svg viewBox="0 0 16 16" width="12" height="12">
        <path
          d="M3 8L6.5 11.5L13 4"
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};

export function MetricTypeBadge({ type }: { type: OkrMetricType }) {
  const meta = METRIC_TYPE_ICON[type];
  return (
    <span
      className={`okr-badge ${meta.cls}`}
      title={METRIC_TYPE_META[type].label}
    >
      {meta.glyph}
    </span>
  );
}

export function MetricTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: OkrMetricType;
  onChange: (type: OkrMetricType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="okr-create-metric-type-picker">
      {Object.entries(METRIC_TYPE_META).map(([type, meta]) => (
        <button
          key={type}
          type="button"
          className={`okr-create-metric-type-option${type === value ? " active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(type as OkrMetricType)}
        >
          <MetricTypeBadge type={type as OkrMetricType} />
          {meta.label}
        </button>
      ))}
    </div>
  );
}

export function MetricValueInput({
  value,
  onChange,
  showPercent,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  showPercent: boolean;
  disabled?: boolean;
}) {
  const input = (
    <input
      type="number"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (!showPercent) return input;
  return (
    <div className="okr-create-metric-input-group">
      {input}
      <span>%</span>
    </div>
  );
}

export function MetricBooleanToggle({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="okr-create-metric-toggle">
      <button
        type="button"
        className={`okr-create-metric-toggle-option${value !== "1" ? " active" : ""}`}
        disabled={disabled}
        onClick={() => onChange("0")}
      >
        ✕ Incomplete
      </button>
      <button
        type="button"
        className={`okr-create-metric-toggle-option${value === "1" ? " active" : ""}`}
        disabled={disabled}
        onClick={() => onChange("1")}
      >
        ✓ Complete
      </button>
    </div>
  );
}
