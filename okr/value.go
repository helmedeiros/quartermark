package okr

import "fmt"

// The vocabulary of a quarter, as types that cannot hold a value outside
// it.
//
// Parsing happens once, at the edge. Everything inside is then free to
// switch on these without a default case that wonders what to do — which
// is the difference between a domain model and a map with opinions.

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

// CanContain reports whether a node of this type may hold one of the
// other. The tree is objective → key result → milestone, and nothing
// else: a milestone under an objective would have no key result to
// contribute its progress to.
func (t NodeType) CanContain(child NodeType) bool {
	switch t {
	case Objective:
		return child == KeyResult
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

// Progress is a whole percentage. Bounded because every consumer treats
// it as one — a bar width, a roll-up average, a spreadsheet cell — and
// none of them has anything sensible to do with 140.
type Progress int

func NewProgress(v int) (Progress, error) {
	if v < 0 || v > 100 {
		return 0, fmt.Errorf("okr: progress %d is outside 0–100", v)
	}
	return Progress(v), nil
}

func (p Progress) Int() int { return int(p) }

// Mode says whether a value is derived from the tree below or set by
// hand. Stored per node because a team will pin one objective's status
// while leaving the rest to roll up.
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
