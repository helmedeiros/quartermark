package httpx

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func DecodeAndClose(resp *http.Response, v any, source string) error {
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s API returned status %d", source, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(v)
}
