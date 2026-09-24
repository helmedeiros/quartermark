#!/bin/sh
# Fails if any denylisted token appears in this repository's source.
#
#   ./scripts/leak-check.sh            scan the staged diff (what pre-commit does)
#   ./scripts/leak-check.sh --tracked  scan every tracked source file
#   ./scripts/leak-check.sh --history [repo]
#                                      scan every blob in every commit and
#                                      every commit message of `repo`
#                                      (default: this one). Slow. Run it
#                                      against a repository you are about to
#                                      publish.
#
#                                      Against THIS repository it is expected
#                                      to fail: the private history really
#                                      does contain the data the list
#                                      forbids. Path exclusions do not apply
#                                      in history mode, because the whole
#                                      point is that nothing is exempt in a
#                                      repository that is going public.
#   ./scripts/leak-check.sh a.ts b.go  scan the named files
#
# Patterns come from scripts/denylist.txt plus, if present, the gitignored
# scripts/denylist.local.txt. See those files for why the list is split.
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Only the pattern files themselves, which necessarily contain what they
# forbid. Nothing else is exempt: this repository is public.
is_excluded() {
	case "$1" in
	scripts/denylist*.txt | scripts/allowlist.txt) return 0 ;;
	*) return 1 ;;
	esac
}

PATTERNS="$(mktemp)"
for list in "$ROOT_DIR/scripts/denylist.txt" "$ROOT_DIR/scripts/denylist.local.txt"; do
	[ -f "$list" ] || continue
	sed -e 's/[[:space:]]*$//' -e '/^#/d' -e '/^$/d' "$list" >>"$PATTERNS"
done
ALLOW="$(mktemp)"
if [ -f "$ROOT_DIR/scripts/allowlist.txt" ]; then
	sed -e 's/[[:space:]]*$//' -e '/^#/d' -e '/^$/d' "$ROOT_DIR/scripts/allowlist.txt" >"$ALLOW"
fi

if [ ! -s "$PATTERNS" ]; then
	echo "leak-check: no patterns found — is scripts/denylist.txt missing?" >&2
	exit 2
fi

# One path per line, never word-split: filenames here contain spaces, and
# splitting them turns one excluded file into several unreadable ones.
FILELIST="$(mktemp)"
trap 'rm -f "$PATTERNS" "$ALLOW" "$FILELIST"' EXIT
# Scanning files is not scanning a repository. A file deleted from HEAD
# is still in the objects, and publishing a repository publishes those:
# a company identifier once survived here in a seed file that had already
# been deleted, with every working-tree scan reporting clean.
if [ "${1:-}" = "--history" ]; then
	SCAN_REPO="${2:-$ROOT_DIR}"
	if ! git -C "$SCAN_REPO" rev-parse --git-dir >/dev/null 2>&1; then
		echo "leak-check: $SCAN_REPO is not a git repository" >&2
		exit 2
	fi

	scan_history() {
		hits=0

		# Blobs, not paths — one blob can live at several paths and in
		# many commits, and unreachable-but-present objects still ship.
		paths="$(mktemp)"
		git -C "$SCAN_REPO" rev-list --all --objects >"$paths" 2>/dev/null || true
		for blob in $(git -C "$SCAN_REPO" cat-file --batch-check --batch-all-objects |
			awk '$2 == "blob" { print $1 }'); do
			match="$(git -C "$SCAN_REPO" cat-file blob "$blob" 2>/dev/null |
				grep -aIiEm3 -f "$PATTERNS" || true)"
			[ -n "$match" ] || continue
			if [ -s "$ALLOW" ]; then
				match="$(printf '%s\n' "$match" | grep -vaIiE -f "$ALLOW" || true)"
			fi
			[ -n "$match" ] || continue

			where="$(grep -m1 "^$blob " "$paths" | cut -d' ' -f2- || true)"
			echo "  blob $blob ${where:+(seen at $where)}"
			printf '%s\n' "$match" | sed 's/^/    /'
			hits=1
		done
		rm -f "$paths"

		# Commit messages ship too, and ours have named people before.
		msgs="$(git -C "$SCAN_REPO" log --all --format='%H %s%n%b' |
			grep -aIiE -f "$PATTERNS" || true)"
		if [ -s "$ALLOW" ] && [ -n "$msgs" ]; then
			msgs="$(printf '%s\n' "$msgs" | grep -vaIiE -f "$ALLOW" || true)"
		fi
		if [ -n "$msgs" ]; then
			echo "  in commit messages:"
			printf '%s\n' "$msgs" | sed 's/^/    /'
			hits=1
		fi

		return "$hits"
	}

	echo "leak-check: scanning every object and commit message in $SCAN_REPO (this takes a while)"
	if scan_history; then
		echo "leak-check passed (history)"
		exit 0
	fi
	echo ""
	echo "leak-check FAILED: the objects above match scripts/denylist*.txt."
	echo "A file deleted from HEAD is still published. Rewrite the history"
	echo "(git filter-repo) rather than deleting the file again."
	exit 1
fi

case "${1:---staged}" in
--staged) git -C "$ROOT_DIR" diff --cached --name-only --diff-filter=ACMR >"$FILELIST" ;;
--tracked) git -C "$ROOT_DIR" ls-files >"$FILELIST" ;;
*) for arg in "$@"; do printf '%s\n' "$arg"; done >"$FILELIST" ;;
esac

STATUS=0
while IFS= read -r f; do
	[ -n "$f" ] || continue
	is_excluded "$f" && continue

	# Repo-relative (from git) or absolute/relative (from the caller).
	case "$f" in
	/*) path="$f" ;;
	*) path="$ROOT_DIR/$f"; [ -f "$path" ] || path="$f" ;;
	esac

	if [ ! -f "$path" ]; then
		# Never skip quietly: a scanner that silently passes over a file
		# it could not read reports "passed" for something it never saw.
		echo "leak-check: cannot read $f" >&2
		STATUS=1
		continue
	fi

	# -I skips binaries. Extended regex, not Perl: the shell's grep here
	# is BSD and has no -P, which is why exceptions live in allowlist.txt
	# rather than as negative lookaheads.
	MATCHES="$(grep -nIiE -f "$PATTERNS" "$path" || true)"
	RC=$?
	if [ "$RC" -gt 1 ]; then
		# grep failed rather than found nothing. Treating that as "clean"
		# is how a broken pattern turns into a silent pass.
		echo "leak-check: grep failed on $f (exit $RC)" >&2
		STATUS=1
		continue
	fi

	[ -n "$MATCHES" ] || continue
	if [ -s "$ALLOW" ]; then
		MATCHES="$(printf '%s\n' "$MATCHES" | grep -vIiE -f "$ALLOW" || true)"
	fi
	[ -n "$MATCHES" ] || continue

	STATUS=1
	printf '%s\n' "$MATCHES" | while IFS= read -r line; do
		echo "  $f:$line"
	done
done <"$FILELIST"

if [ "$STATUS" -ne 0 ]; then
	echo ""
	echo "leak-check FAILED: the lines above match scripts/denylist*.txt."
	echo "Company identifiers and credentials do not belong in source."
	exit 1
fi
echo "leak-check passed"
