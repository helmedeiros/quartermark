package httpx

import (
	"errors"
)

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

func WithStatus(err error, status int) error {
	if err == nil {
		return nil
	}
	return statusError{err: err, status: status}
}

func StatusFor(err error, fallback int) int {
	var sc statusCoder
	if errors.As(err, &sc) {
		return sc.HTTPStatus()
	}
	return fallback
}
