// Package storeerr holds the sentinel errors a persistence port returns,
// so that more than one port can share them.
//
// They live apart from any single port because both the application's
// repository and the OKR module's narrow Store report the same two
// conditions, and errors.Is across them only works if it is literally the
// same value on both sides.
package storeerr

import "errors"

var (
	ErrNotFound      = errors.New("not found")
	ErrAlreadyExists = errors.New("already exists")
)
