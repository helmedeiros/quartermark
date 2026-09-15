package httpx

import (
	"errors"
)

// An error may carry the HTTP status it should be reported as, so that a
// handler does not have to re-derive it from the error's identity at
// every write site.
//
// Domain packages deliberately do not implement this — knowing about HTTP
// is an adapter's job. Adapters attach a status with WithStatus when they
// translate a domain error into a response.
type statusCoder interface {
	HTTPStatus() int
}

type statusError struct {
	err    error
	status int
}

func (e statusError) Error() string   { return e.err.Error() }
func (e statusError) Unwrap() error   { return e.err }
func (e statusError) HTTPStatus() int { return e.status }

// WithStatus tags err with the status it should be reported as. The
// original error stays wrapped, so errors.Is and errors.As still see it.
func WithStatus(err error, status int) error {
	if err == nil {
		return nil
	}
	return statusError{err: err, status: status}
}

// StatusFor reports the status tagged on err, or fallback if none is.
func StatusFor(err error, fallback int) int {
	var sc statusCoder
	if errors.As(err, &sc) {
		return sc.HTTPStatus()
	}
	return fallback
}
