package okr

import (
	"encoding/json"
	"errors"
	"fmt"
)

var ErrFutureSchemaVersion = errors.New("okrs blob is from a newer schema version")

const SchemaVersion = 1

const schemaVersionField = "schemaVersion"

var upgradeStepFromVersion = []func(doc map[string]any){
	stampVersionOnADocumentThatPredatesVersioning,
}

func stampVersionOnADocumentThatPredatesVersioning(doc map[string]any) {
	doc[schemaVersionField] = SchemaVersion
}

func BlobVersion(raw []byte) int {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return 0
	}
	return versionOf(doc)
}

func versionOf(doc map[string]any) int {
	v, ok := doc[schemaVersionField].(float64)
	if !ok {
		return 0
	}
	return int(v)
}

func UpgradeBlob(raw []byte) ([]byte, bool, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, false, fmt.Errorf("parse okrs blob: %w", err)
	}

	from := versionOf(doc)
	if from == SchemaVersion {
		return raw, false, nil
	}
	if from > SchemaVersion {
		return nil, false, fmt.Errorf(
			"%w: blob is version %d, this build understands %d — upgrade before writing",
			ErrFutureSchemaVersion, from, SchemaVersion)
	}

	for _, step := range upgradeStepFromVersion[from:SchemaVersion] {
		step(doc)
	}

	out, err := json.Marshal(doc)
	if err != nil {
		return nil, false, fmt.Errorf("marshal upgraded okrs blob: %w", err)
	}
	return out, true, nil
}
