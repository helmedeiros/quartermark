package okr

import "fmt"

type NodeType string

const (
	Objective NodeType = "objective"
	KeyResult NodeType = "key_result"
	Milestone NodeType = "milestone"
)

func ParseNodeType(s string) (NodeType, error) {
	switch NodeType(s) {
	case Objective, KeyResult, Milestone:
		return NodeType(s), nil
	}
	return "", fmt.Errorf("okr: %q is not a node type", s)
}

func (t NodeType) CanContain(child NodeType) bool {
	switch t {
	case Objective:
		return child == Objective || child == KeyResult || child == Milestone
	case KeyResult:
		return child == Milestone
	default:
		return false
	}
}

type Status string

const (
	NotStarted Status = "not_started"
	OnTrack    Status = "on_track"
	AtRisk     Status = "at_risk"
	OffTrack   Status = "off_track"
	Done       Status = "done"
)

func ParseStatus(s string) (Status, error) {
	switch Status(s) {
	case NotStarted, OnTrack, AtRisk, OffTrack, Done:
		return Status(s), nil
	}
	return "", fmt.Errorf("okr: %q is not a status", s)
}

type Commitment string

const (
	Proposed   Commitment = "proposed"
	Committed  Commitment = "committed"
	IfPossible Commitment = "if_possible"
	Rejected   Commitment = "rejected"
	Extra      Commitment = "extra"
)

func ParseCommitment(s string) (Commitment, error) {
	switch Commitment(s) {
	case Proposed, Committed, IfPossible, Rejected, Extra:
		return Commitment(s), nil
	}
	return "", fmt.Errorf("okr: %q is not a commitment", s)
}

type MetricType string

const (
	Percent  MetricType = "percent"
	Number   MetricType = "number"
	Currency MetricType = "currency"
	Boolean  MetricType = "boolean"
)

func ParseMetricType(s string) (MetricType, error) {
	switch MetricType(s) {
	case Percent, Number, Currency, Boolean:
		return MetricType(s), nil
	}
	return "", fmt.Errorf("okr: %q is not a metric type", s)
}

type Progress int

func NewProgress(v int) (Progress, error) {
	if v < 0 || v > 100 {
		return 0, fmt.Errorf("okr: progress %d is outside 0–100", v)
	}
	return Progress(v), nil
}

func (p Progress) Int() int { return int(p) }

type Mode string

const (
	Auto   Mode = "auto"
	Manual Mode = "manual"
)

func ParseMode(s string) (Mode, error) {
	switch Mode(s) {
	case Auto, Manual:
		return Mode(s), nil
	}
	return "", fmt.Errorf("okr: %q is not a mode", s)
}
