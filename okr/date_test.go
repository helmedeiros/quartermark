package okr_test

import (
	"testing"
	"time"

	"github.com/helmedeiros/quartermark/okr"
)

func TestDateRoundTripsThroughItsISOForm(t *testing.T) {
	for _, s := range []string{"2027-01-04", "2026-12-31", "2027-02-28", "2028-02-29"} {
		d, err := okr.ParseDate(s)
		if err != nil {
			t.Fatalf("ParseDate(%q): %v", s, err)
		}
		if got := d.String(); got != s {
			t.Errorf("round trip of %q gave %q", s, got)
		}
	}
}

// Most dates on a node are genuinely unset, so absence is a value
// rather than an error — and it has to serialize back to absence.
func TestUnsetDateIsNotAnError(t *testing.T) {
	d, err := okr.ParseDate("")
	if err != nil {
		t.Fatalf("an empty date should parse: %v", err)
	}
	if !d.IsZero() {
		t.Error("an empty date should be the zero Date")
	}
	if d.String() != "" {
		t.Errorf("the zero Date should write back as empty, got %q", d.String())
	}
}

func TestDateRejectsWhatIsNotADate(t *testing.T) {
	for _, s := range []string{
		"2027-13-01",       // no thirteenth month
		"2027-02-30",       // February is short
		"2026-02-29",       // 2026 is not a leap year
		"04/01/2027",       // not ISO
		"2027-01-04T10:00", // a date, not an instant
		"nonsense",
	} {
		if _, err := okr.ParseDate(s); err == nil {
			t.Errorf("%q should not parse as a date", s)
		}
	}
}

// time.Date silently normalises month 13 into next January. A
// constructor that accepted that would turn a typo into a plausible
// wrong answer.
func TestNewDateRefusesToNormaliseNonsense(t *testing.T) {
	if _, err := okr.NewDate(2027, time.Month(13), 1); err == nil {
		t.Error("month 13 should be rejected, not rolled into next year")
	}
	if _, err := okr.NewDate(2027, time.February, 30); err == nil {
		t.Error("30 February should be rejected, not rolled into March")
	}
	if _, err := okr.NewDate(2027, time.January, 4); err != nil {
		t.Errorf("a real date should be accepted: %v", err)
	}
}

func TestDatesCompareByDay(t *testing.T) {
	earlier, _ := okr.ParseDate("2027-01-04")
	later, _ := okr.ParseDate("2027-03-31")

	if !earlier.Before(later) {
		t.Error("January should be before March")
	}
	if !later.After(earlier) {
		t.Error("March should be after January")
	}
	if earlier.Before(earlier) || earlier.After(earlier) {
		t.Error("a date should be neither before nor after itself")
	}
}
