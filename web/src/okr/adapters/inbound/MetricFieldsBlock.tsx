import {
  MetricBooleanToggle,
  MetricTypePicker,
  MetricValueInput,
} from "./MetricTypeControls";
import type { OkrMetricType } from "../../domain/model";

export function MetricFieldsBlock({
  metricType,
  unit,
  current,
  target,
  disabled = false,
  currentLabel = "Current",
  booleanLabel = "Current",
  onMetricTypeChange,
  onUnitChange,
  onCurrentChange,
  onTargetChange,
}: {
  metricType: OkrMetricType;
  unit: string;
  current: string;
  target: string;
  disabled?: boolean;
  currentLabel?: string;
  booleanLabel?: string;
  onMetricTypeChange: (metricType: OkrMetricType) => void;
  onUnitChange: (unit: string) => void;
  onCurrentChange: (current: string) => void;
  onTargetChange: (target: string) => void;
}) {
  return (
    <div className="okr-create-metric">
      <label className="okr-create-metric-field">
        <span className="small muted">Measure as</span>
        <MetricTypePicker
          value={metricType}
          disabled={disabled}
          onChange={onMetricTypeChange}
        />
      </label>

      {metricType !== "percent" && metricType !== "boolean" && (
        <label className="okr-create-metric-field">
          <span className="small muted">Unit label</span>
          <input
            type="text"
            placeholder={
              metricType === "currency" ? "$, €, £…" : "signups, hours…"
            }
            value={unit}
            disabled={disabled}
            onChange={(e) => onUnitChange(e.target.value)}
          />
        </label>
      )}

      {metricType === "boolean" ? (
        <label className="okr-create-metric-field">
          <span className="small muted">{booleanLabel}</span>
          <MetricBooleanToggle
            value={current}
            disabled={disabled}
            onChange={onCurrentChange}
          />
        </label>
      ) : (
        <div className="okr-create-metric-row">
          <label className="okr-create-metric-field">
            <span className="small muted">{currentLabel}</span>
            <MetricValueInput
              value={current}
              disabled={disabled}
              onChange={onCurrentChange}
              showPercent={metricType === "percent"}
            />
          </label>
          <label className="okr-create-metric-field">
            <span className="small muted">Target</span>
            <MetricValueInput
              value={target}
              disabled={disabled}
              onChange={onTargetChange}
              showPercent={metricType === "percent"}
            />
          </label>
        </div>
      )}
    </div>
  );
}
