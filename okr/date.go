package okr

import (
	"fmt"
	"time"
)

// Date is a calendar day with no time and no zone.
//
// A quarter is planned in days: a milestone is due on the 14th, not at
// an instant. Using time.Time for that invites a timezone to decide
// whether a deadline fell on Friday or Saturday, which is how a bar
// moves a day when the viewer travels.
type Date struct {
	// Zero value means "not set", which most dates on a node are.
	year  int
	month time.Month
	day   int
}

const dateLayout = "2006-01-02"

func NewDate(year int, month time.Month, day int) (Date, error) {
	// time.Date normalises out-of-range parts (month 13 becomes January
	// of the next year) rather than complaining, so round-tripping is
	// the check.
	t := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	if t.Year() != year || t.Month() != month || t.Day() != day {
		return Date{}, fmt.Errorf("okr: %04d-%02d-%02d is not a date", year, month, day)
	}
	return Date{year: year, month: month, day: day}, nil
}

// ParseDate reads the ISO form. An empty string is the zero Date rather
// than an error: most dates on a node are genuinely unset.
func ParseDate(s string) (Date, error) {
	if s == "" {
		return Date{}, nil
	}
	t, err := time.Parse(dateLayout, s)
	if err != nil {
		return Date{}, fmt.Errorf("okr: %q is not an ISO date", s)
	}
	return Date{year: t.Year(), month: t.Month(), day: t.Day()}, nil
}

func (d Date) IsZero() bool { return d.year == 0 && d.month == 0 && d.day == 0 }

// String is the ISO form, or empty for an unset date — which is what a
// serializer wants to write back.
func (d Date) String() string {
	if d.IsZero() {
		return ""
	}
	return fmt.Sprintf("%04d-%02d-%02d", d.year, int(d.month), d.day)
}

func (d Date) Time() time.Time {
	return time.Date(d.year, d.month, d.day, 0, 0, 0, 0, time.UTC)
}

func (d Date) Before(other Date) bool { return d.Time().Before(other.Time()) }
func (d Date) After(other Date) bool  { return d.Time().After(other.Time()) }
