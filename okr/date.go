package okr

import (
	"fmt"
	"time"
)

type Date struct {
	year  int
	month time.Month
	day   int
}

const dateLayout = "2006-01-02"

func NewDate(year int, month time.Month, day int) (Date, error) {
	if wasNormalisedIntoADifferentDay(year, month, day) {
		return Date{}, fmt.Errorf("okr: %04d-%02d-%02d is not a date", year, month, day)
	}
	return Date{year: year, month: month, day: day}, nil
}

func wasNormalisedIntoADifferentDay(year int, month time.Month, day int) bool {
	t := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	return t.Year() != year || t.Month() != month || t.Day() != day
}

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
