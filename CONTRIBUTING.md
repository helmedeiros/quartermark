# Contributing

## Before you open a pull request

```
make check        # go vet, gofmt, tests with -race
make web-test     # typecheck, lint, format check, tests, build
./scripts/leak-check.sh --tracked
```

CI runs the same four things plus a secret scan over the full history and
a check that the demo still boots.

## What CI will not let through

- **Anything that looks like a credential**, in any commit — not just the
  tip. A file deleted from HEAD is still published.
- **A formatting difference.** `npm run format` before you push.
- **A broken demo.** It is the first thing anyone sees, so it breaking
  should break the build rather than someone's first impression.

## The module boundary

`web/src/okr` is meant to be liftable into its own package. Two tests
enforce that, and they will fail you rather than the reviewer noticing:

- the module may not import the host application's areas at all
- it may reach outside itself only for an explicit list of shared
  utilities — that list is the contract a packaging step has to keep
- the host may reach the module only through its barrel, `okr/index.ts`

If you need something new across that line, add it to the list in
`web/src/okr/boundary.test.ts` deliberately, in the same commit, so the
decision is visible in review.

## Merging

Squash only. Every pull request becomes one commit on `main`, so a
contributor branch cannot reintroduce something through merge-commit
ancestry that the tip no longer shows.

## Adapting this to a private codebase

If you are running this alongside an internal fork, put your
organisation's own vocabulary — team names, strategic themes, internal
hostnames — in `scripts/denylist.local.txt`. It is gitignored. The
committed `denylist.txt` deliberately holds only generic patterns,
because writing a name into a public file to forbid that name publishes
it.
