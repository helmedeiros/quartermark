package okrdoc

import (
	"encoding/json"
	"fmt"
)

func decodeDocument(raw []byte) (document, error) {
	var doc document
	e, err := splitExtras(raw, &doc, documentKnown)
	if err != nil {
		return document{}, fmt.Errorf("okrdoc: %w", err)
	}
	doc.extra = e

	var shell struct {
		Quarters []json.RawMessage `json:"quarters"`
	}
	if err := json.Unmarshal(raw, &shell); err != nil {
		return document{}, fmt.Errorf("okrdoc: %w", err)
	}

	doc.Quarters = make([]quarterDoc, 0, len(shell.Quarters))
	for i, rawQuarter := range shell.Quarters {
		q, err := decodeQuarter(rawQuarter)
		if err != nil {
			return document{}, fmt.Errorf("quarter %d: %w", i, err)
		}
		doc.Quarters = append(doc.Quarters, q)
	}
	return doc, nil
}

func decodeQuarter(raw []byte) (quarterDoc, error) {
	var q quarterDoc
	e, err := splitExtras(raw, &q, quarterKnown)
	if err != nil {
		return quarterDoc{}, err
	}
	if q.extra, err = keepEmptyPresence(raw, e, []string{"objectives"}); err != nil {
		return quarterDoc{}, err
	}

	var shell struct {
		Objectives []json.RawMessage `json:"objectives"`
	}
	if err := json.Unmarshal(raw, &shell); err != nil {
		return quarterDoc{}, err
	}

	q.Objectives = make([]nodeDoc, 0, len(shell.Objectives))
	for i, rawNode := range shell.Objectives {
		n, err := decodeNode(rawNode)
		if err != nil {
			return quarterDoc{}, fmt.Errorf("objective %d: %w", i, err)
		}
		q.Objectives = append(q.Objectives, n)
	}
	return q, nil
}

func decodeNode(raw []byte) (nodeDoc, error) {
	var n nodeDoc
	e, err := splitExtras(raw, &n, nodeKnown)
	if err != nil {
		return nodeDoc{}, err
	}
	if n.extra, err = keepEmptyPresence(raw, e, nodeCollections); err != nil {
		return nodeDoc{}, err
	}

	var shell struct {
		Children []json.RawMessage `json:"children"`
	}
	if err := json.Unmarshal(raw, &shell); err != nil {
		return nodeDoc{}, err
	}
	if len(shell.Children) == 0 {
		n.Children = nil
		return n, nil
	}

	n.Children = make([]nodeDoc, 0, len(shell.Children))
	for i, rawChild := range shell.Children {
		child, err := decodeNode(rawChild)
		if err != nil {
			return nodeDoc{}, fmt.Errorf("child %d of %s: %w", i, n.ID, err)
		}
		n.Children = append(n.Children, child)
	}
	return n, nil
}

func encodeDocument(doc document) ([]byte, error) {
	quarters := make([]json.RawMessage, 0, len(doc.Quarters))
	for _, q := range doc.Quarters {
		encoded, err := encodeQuarter(q)
		if err != nil {
			return nil, fmt.Errorf("quarter %s: %w", q.QuarterID, err)
		}
		quarters = append(quarters, encoded)
	}

	type alias document
	shell := struct {
		alias
		Quarters []json.RawMessage `json:"quarters"`
	}{alias: alias(doc), Quarters: quarters}

	return mergeExtras(shell, doc.extra)
}

func encodeQuarter(q quarterDoc) ([]byte, error) {
	objectives := make([]json.RawMessage, 0, len(q.Objectives))
	for _, o := range q.Objectives {
		encoded, err := encodeNode(o)
		if err != nil {
			return nil, err
		}
		objectives = append(objectives, encoded)
	}

	type alias quarterDoc
	shell := struct {
		alias
		Objectives []json.RawMessage `json:"objectives"`
	}{alias: alias(q), Objectives: objectives}

	return mergeExtras(shell, q.extra)
}

func encodeNode(n nodeDoc) ([]byte, error) {
	type alias nodeDoc

	if len(n.Children) == 0 {
		return mergeExtras(struct {
			alias
			Children []json.RawMessage `json:"children,omitempty"`
		}{alias: alias(n)}, n.extra)
	}

	children := make([]json.RawMessage, 0, len(n.Children))
	for _, c := range n.Children {
		encoded, err := encodeNode(c)
		if err != nil {
			return nil, err
		}
		children = append(children, encoded)
	}

	shell := struct {
		alias
		Children []json.RawMessage `json:"children,omitempty"`
	}{alias: alias(n), Children: children}

	return mergeExtras(shell, n.extra)
}
