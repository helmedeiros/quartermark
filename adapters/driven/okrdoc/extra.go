package okrdoc

import "encoding/json"

type extras map[string]json.RawMessage

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
