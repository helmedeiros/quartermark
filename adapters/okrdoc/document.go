package okrdoc

import "encoding/json"

type document struct {
	SchemaVersion int          `json:"schemaVersion,omitempty"`
	Team          string       `json:"team,omitempty"`
	Clusters      []string     `json:"clusters,omitempty"`
	Quarters      []quarterDoc `json:"quarters"`

	extra extras `json:"-"`
}

var documentKnown = []string{"schemaVersion", "team", "clusters", "quarters"}

type quarterDoc struct {
	QuarterID       string    `json:"quarterId"`
	Label           string    `json:"label,omitempty"`
	StartDate       string    `json:"startDate,omitempty"`
	EndDate         string    `json:"endDate,omitempty"`
	Locked          *bool     `json:"locked,omitempty"`
	TeamCapacity    *float64  `json:"teamCapacity,omitempty"`
	JiraRefreshedAt string    `json:"jiraRefreshedAt,omitempty"`
	JiraAsOf        string    `json:"jiraAsOf,omitempty"`
	Objectives      []nodeDoc `json:"objectives"`

	extra extras `json:"-"`
}

var quarterKnown = []string{
	"quarterId", "label", "startDate", "endDate", "locked",
	"teamCapacity", "jiraRefreshedAt", "jiraAsOf", "objectives",
}

type nodeDoc struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title"`

	Description string   `json:"description,omitempty"`
	Owner       string   `json:"owner,omitempty"`
	Groups      []string `json:"groups,omitempty"`
	Labels      []string `json:"labels,omitempty"`
	Link        string   `json:"link,omitempty"`

	Status       string `json:"status"`
	StatusMode   string `json:"statusMode,omitempty"`
	Progress     int    `json:"progress"`
	ProgressMode string `json:"progressMode,omitempty"`

	Weight           *float64 `json:"weight,omitempty"`
	Allocation       *float64 `json:"allocation,omitempty"`
	ActualAllocation *float64 `json:"actualAllocation,omitempty"`

	MetricType string   `json:"metricType,omitempty"`
	Target     *float64 `json:"target,omitempty"`
	Current    *float64 `json:"current,omitempty"`
	Unit       string   `json:"unit,omitempty"`

	StartDate   string   `json:"startDate,omitempty"`
	DueDate     string   `json:"dueDate,omitempty"`
	EffortWeeks *float64 `json:"effortWeeks,omitempty"`

	Commitment               string `json:"commitment,omitempty"`
	ContributesToParentGrade *bool  `json:"contributesToParentGrade,omitempty"`

	Updates       []updateDoc                `json:"updates,omitempty"`
	Notes         []noteDoc                  `json:"notes,omitempty"`
	MetricHistory []metricPointDoc           `json:"metricHistory,omitempty"`
	JiraKeys      []string                   `json:"jiraKeys,omitempty"`
	JiraIssues    map[string]json.RawMessage `json:"jiraIssues,omitempty"`

	Children []nodeDoc `json:"children,omitempty"`

	extra extras `json:"-"`
}

var nodeKnown = []string{
	"id", "type", "title", "description", "owner", "groups", "labels", "link",
	"status", "statusMode", "progress", "progressMode",
	"weight", "allocation", "actualAllocation",
	"metricType", "target", "current", "unit",
	"startDate", "dueDate", "effortWeeks",
	"commitment", "contributesToParentGrade",
	"updates", "notes", "metricHistory", "jiraKeys", "jiraIssues", "children",
}

var nodeCollections = []string{
	"groups", "labels", "jiraKeys", "updates", "notes", "metricHistory", "children",
}

type updateDoc struct {
	Date     string `json:"date"`
	Status   string `json:"status,omitempty"`
	Progress int    `json:"progress"`
	Note     string `json:"note,omitempty"`
	Author   string `json:"author,omitempty"`
}

type noteDoc struct {
	Date      string `json:"date"`
	Author    string `json:"author,omitempty"`
	Comment   string `json:"comment,omitempty"`
	Learnings string `json:"learnings,omitempty"`
	NextSteps string `json:"nextSteps,omitempty"`
}

type metricPointDoc struct {
	Date    string  `json:"date"`
	Current float64 `json:"current"`
}

type snapshotDoc struct {
	Summary   string      `json:"summary,omitempty"`
	IssueType string      `json:"issueType,omitempty"`
	Status    string      `json:"status,omitempty"`
	Progress  int         `json:"progress,omitempty"`
	Assignee  string      `json:"assignee,omitempty"`
	Labels    []string    `json:"labels,omitempty"`
	DueDate   string      `json:"dueDate,omitempty"`
	Sprints   []sprintDoc `json:"sprints,omitempty"`
	SyncedAt  string      `json:"syncedAt,omitempty"`
}

type sprintDoc struct {
	Name      string `json:"name"`
	StartDate string `json:"startDate,omitempty"`
	EndDate   string `json:"endDate,omitempty"`
}
