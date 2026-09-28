package timewindow

import "time"

type Window struct {
	Since time.Time
	Until time.Time
}

func (w Window) UTC() Window {
	return Window{Since: w.Since.UTC(), Until: w.Until.UTC()}
}
