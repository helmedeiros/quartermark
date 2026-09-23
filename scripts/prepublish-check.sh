#!/bin/sh
# Everything that must be true before this repository is made public, or
# before a release is tagged.
#
# Run from the repository root:  ./scripts/prepublish-check.sh
#
# This is the half that can live in the open. The operator extracting
# this project from a private codebase runs a second, private check with
# a denylist of their organisation's own vocabulary — names that nothing
# generic can recognise. See README/ARCHITECTURE for why.
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

step() { printf '\n== %s ==\n' "$1"; }
fail() { echo "  FAIL: $1" >&2; FAILED=1; }
ok() { echo "  ok   $1"; }

step "Secrets, across the whole history"
if command -v gitleaks >/dev/null 2>&1; then
	# `gitleaks git`, not the older `detect`: in 8.x `detect` scans
	# something else and reported clean on a repository with three
	# planted secrets in it. A scanner that cannot fail is worse than
	# no scanner, so this one is checked against a planted secret.
	if gitleaks git "$ROOT_DIR" --no-banner --redact >/dev/null 2>&1; then
		ok "gitleaks found nothing in any commit"
	else
		fail "gitleaks found something — run 'gitleaks git .' for the detail"
	fi
else
	fail "gitleaks is not installed; a publish must not skip this"
fi

step "Author identity on every commit"
# A work email in an author field is a leak that survives every file-level
# scan, and it is in metadata rather than content so no grep of the tree
# finds it.
AUTHORS="$(git -C "$ROOT_DIR" log --all --format='%an <%ae>%n%cn <%ce>' | sort -u)"
echo "$AUTHORS" | sed 's/^/       /'
if echo "$AUTHORS" | grep -qiE '@(.*\.)?(corp|internal)\.|noreply\.github\.com' &&
	! echo "$AUTHORS" | grep -qvE 'noreply\.github\.com'; then
	ok "all commits use a publishable identity"
else
	echo "       (review the list above by eye — only you know which are yours)"
fi

step "The test suite, from a clean clone"
# Not the working tree: a clone has only what is committed. Anything the
# suite needs that was never added shows up here and nowhere else.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone --quiet "$ROOT_DIR" "$TMP/repo"
if (cd "$TMP/repo" && make check >"$TMP/go.log" 2>&1); then
	ok "Go: vet, gofmt and tests pass on a fresh clone"
else
	fail "Go checks failed on a fresh clone — see $TMP/go.log"
	tail -20 "$TMP/go.log" >&2
fi

if (cd "$TMP/repo/web" && npm install --silent >"$TMP/npm.log" 2>&1 &&
	npm run typecheck >>"$TMP/npm.log" 2>&1 &&
	npm run lint >>"$TMP/npm.log" 2>&1 &&
	npm test >>"$TMP/npm.log" 2>&1 &&
	npm run build >>"$TMP/npm.log" 2>&1); then
	ok "web: typecheck, lint, tests and build pass on a fresh clone"
else
	fail "web checks failed on a fresh clone — see $TMP/npm.log"
	tail -20 "$TMP/npm.log" >&2
fi

step "The demo, on a database that has never existed"
if (cd "$TMP/repo" && go build -o "$TMP/okrd" ./cmd/okrd >/dev/null 2>&1) &&
	QUARTERMARK_DB="$TMP/fresh.db" "$TMP/okrd" -demo -addr 127.0.0.1:18999 >"$TMP/okrd.log" 2>&1 &
then
	sleep 2
	TEAMS="$(curl -s --max-time 5 http://127.0.0.1:18999/api/teams || echo '')"
	if echo "$TEAMS" | grep -q '"slug"'; then
		ok "a stranger cloning this repo can see it working"
	else
		fail "the demo did not come up — a first impression that 404s is worse than none"
	fi
	lsof -ti :18999 2>/dev/null | xargs kill 2>/dev/null || true
fi

printf '\n'
if [ "$FAILED" -ne 0 ]; then
	echo "PRE-PUBLISH CHECK FAILED — do not publish."
	exit 1
fi
echo "PRE-PUBLISH CHECK PASSED"
echo "Remember the private half: the extracting operator's own denylist,"
echo "run against this repository's full history, not just its files."
