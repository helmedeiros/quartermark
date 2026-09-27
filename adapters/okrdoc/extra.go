// Package okrdoc maps the OKR domain to and from the JSON document it
// is stored as.
//
// The wire format lives here rather than in the domain: a domain that
// carries json tags is a domain that knows its transport, and this one
// is stored as a document today only because that suits how a quarter
// is edited.
//
// Everything here exists to make one guarantee — a document survives a
// round trip unchanged, including the parts Go does not model. Before
// the domain was typed, the server stored the bytes it was given and
// nothing could be lost. Now that it decodes, anything unmodelled would
// vanish on every save unless it is deliberately carried.
package okrdoc

import "encoding/json"

// extras are the members of a JSON object that no field of the target
// struct claimed.
type extras map[string]json.RawMessage

// splitExtras decodes raw into v and returns whatever members v did not
// account for.
//
// Two passes rather than one: Go's decoder silently drops unknown
// members, and "silently drops" is precisely the failure this package
// exists to prevent.
func splitExtras(raw []byte, v any, known []string) (extras, error) {
	if err := json.Unmarshal(raw, v); err != nil {
		return nil, err
	}
	var all map[string]json.RawMessage
	if err := json.Unmarshal(raw, &all); err != nil {
		return nil, err
	}
	for _, k := range known {
		delete(all, k)
	}
	if len(all) == 0 {
		return nil, nil
	}
	return all, nil
}

// keepEmptyPresence records collection members that are present but
// empty, so they come back the way they went in.
//
// An empty list and no list mean the same thing to every consumer, so
// normalising would be defensible — but it would also rewrite documents
// that already exist the first time they are saved, turning a read into
// a diff. Cheaper to keep them than to explain them.
func keepEmptyPresence(raw []byte, e extras, fields []string) (extras, error) {
	var all map[string]json.RawMessage
	if err := json.Unmarshal(raw, &all); err != nil {
		return e, err
	}
	for _, f := range fields {
		v, present := all[f]
		if !present {
			continue
		}
		var probe []json.RawMessage
		// A non-list (or null) decodes to nil here too, which is the
		// case worth keeping: the member was written and says nothing.
		if err := json.Unmarshal(v, &probe); err == nil && len(probe) > 0 {
			continue
		}
		if e == nil {
			e = extras{}
		}
		e[f] = v
	}
	return e, nil
}

// mergeExtras marshals v and folds the unclaimed members back in.
//
// A known field wins over a carried one: if the domain now models
// something that was once unknown, the domain's value is the current
// one and the carried copy is stale.
func mergeExtras(v any, e extras) ([]byte, error) {
	encoded, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	if len(e) == 0 {
		return encoded, nil
	}
	var out map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &out); err != nil {
		return nil, err
	}
	for k, v := range e {
		if _, claimed := out[k]; !claimed {
			out[k] = v
		}
	}
	return json.Marshal(out)
}
