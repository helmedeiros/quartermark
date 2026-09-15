package okr

import (
	"encoding/json"
	"errors"
	"fmt"
)

// ErrFutureSchemaVersion reports a blob written by a build that knows a
// newer shape than this one. Exported so an adapter can translate it into
// whatever its transport calls a conflict — this package deliberately
// does not know what an HTTP status is.
var ErrFutureSchemaVersion = errors.New("okrs blob is from a newer schema version")

// SchemaVersion is the shape of the okrs team blob this build writes and
// understands.
//
// Version 1 is not a change: it names the shape already in use, so that
// later changes have a numbered predecessor to migrate from. team_blobs
// stores opaque JSON with no version column, which is survivable only
// while a single codebase owns the shape. Once the OKR module is
// module can be embedded in a host application that evolves separately,
// a quarters blob with no version is a blob with no migration path — and
// there is no way to add the anchor retroactively.
//
// Adding a version: bump this constant and add its step to upgradeSteps.
const SchemaVersion = 1

// schemaVersionField is the top-level key carrying the version. Named
// once because BlobVersion reads it and upgradeTo1 writes it.
const schemaVersionField = "schemaVersion"

// upgradeSteps[v] migrates a blob from version v to v+1, in place.
// Indexed by source version, so upgrading 0 -> SchemaVersion runs
// upgradeSteps[0:SchemaVersion] in order.
var upgradeSteps = []func(doc map[string]any){
	upgradeTo1,
}

// upgradeTo1 stamps the version onto a blob that predates versioning.
// There is deliberately no structural change: every unversioned blob in
// existence already has the version-1 shape.
func upgradeTo1(doc map[string]any) {
	doc[schemaVersionField] = SchemaVersion
}

// BlobVersion reports the schema version of an okrs blob. Anything that
// isn't a JSON object carrying a numeric schemaVersion — including a blob
// written before versioning existed, and an unparsable one — is version
// 0. Reading a version never fails: callers that need to reject a blob do
// so via UpgradeBlob, which reports the parse error properly.
func BlobVersion(raw []byte) int {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return 0
	}
	return versionOf(doc)
}

// versionOf reads the version off an already-parsed blob. A missing or
// non-numeric field means the blob predates versioning: version 0.
func versionOf(doc map[string]any) int {
	v, ok := doc[schemaVersionField].(float64)
	if !ok {
		return 0
	}
	return int(v)
}

// UpgradeBlob brings an okrs blob up to SchemaVersion, reporting whether
// it had to rewrite anything. A blob already at the current version is
// returned byte-identical and changed=false, so the steady state is a
// pure passthrough rather than a re-marshal of the whole document on
// every save.
//
// A blob from a future version is an error, not a silent downgrade: it
// was written by a build that knows a shape this one does not, and
// marshaling it back out through this code would drop whatever that build
// added.
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

	for _, step := range upgradeSteps[from:SchemaVersion] {
		step(doc)
	}

	out, err := json.Marshal(doc)
	if err != nil {
		return nil, false, fmt.Errorf("marshal upgraded okrs blob: %w", err)
	}
	return out, true, nil
}
