# Architecture

Quartermark is a small application built to be taken apart. The shape below
exists so the OKR half can be mounted inside a much larger application
without either side knowing about the other.

## The idea in one paragraph

A quarter is a tree — objectives contain key results contain milestones —
stored as one JSON document per team. The server does almost nothing to it:
it validates the document's schema version, serves it, stores it back, and
optionally refreshes progress from Jira. Everything about laying that tree
out on a timeline, sizing it against capacity and rendering it lives in the
frontend. That split is deliberate: the interesting logic is in the planning,
and planning is what you want to iterate on without a migration.

## Why a JSON document instead of tables

The tree is edited as a whole. Every save rewrites it, nothing queries across
objectives, and normalising it would mean a schema migration each time a
milestone gains a field. So the document is the unit of storage, and the
*shape* is versioned instead — `okr.SchemaVersion`, stamped on every write,
with an `upgradeSteps` table indexed by source version.

Version 1 is not a change. It names the shape already in use, so later
changes have a numbered predecessor to migrate from. That anchor cannot be
added retroactively, which is why it exists before it is needed.

Two rules the versioning enforces:

- A blob already at the current version is returned byte-identical, so the
  steady state is a passthrough rather than a re-marshal of a large document
  on every save.
- A blob from a *newer* version is refused, not silently downgraded. It was
  written by a build that knows a shape this one does not, and writing it
  back through this code would drop whatever that build added. The HTTP layer
  reports that as a conflict; the domain package does not know what HTTP is.

## Packages

```
okr/                  the domain. Tree, quarters, calendar dates, schema
                      versioning, progress roll-up, and the ports it owns:
                      Repository, Teams, and its error vocabulary.
okr/tracker/          the issue tracker port and the data it returns. Inside
                      the hexagon because the domain decides what it needs to
                      read; its own package because a tracker's Sprint and a
                      plan's Sprint are different things.

app/                  the use cases. One Service, one method per thing a
                      caller can ask for, and the two ports it needs that the
                      domain does not: Documents and Tracker.

adapters/driving/okrapi/      HTTP routes, mountable onto a mux you own.
adapters/driven/jira/         HTTP client implementing tracker.Source.
adapters/driven/sqlite/       reference Repository and Documents. Two tables.
adapters/driven/okrdoc/       the JSON document: decode to domain, apply a
                              changed domain back, preserve everything the
                              domain does not model.
adapters/driven/connectors/   resolves a team's tracker per request, and the
                              configuration record that describes one.

shared/httpx/         JSON response plumbing, and a way for an error to carry
                      the status it should be reported as.
shared/timewindow/    the half-open range sources are queried over. Shared
                      because Jira-shaped and GitHub-shaped callers both take
                      one and neither should import the other.

cmd/okrd/             the standalone server. The only place that builds a
                      concrete adapter and hands it to app.New.
web/src/okr/          the frontend module: one importable unit, one export.
web/src/              the shell around it — routing, first run, registry.
```

The frontend module is laid out as the same hexagon:

```
web/src/okr/
  domain/             the model, the tree rules, issue-type classification.
                      No React, no fetching, no adapter import.
  application/        the use cases — read a plan, apply a rule, write it
                      back (useClusters, useOkrTreeMutations).
  adapters/inbound/   React components. A person drives the module through
                      them, which makes them this hexagon's controllers.
  adapters/outbound/  Jira URLs and the xlsx workbook — the module reaching
                      at another system and at the filesystem.
  config/             what an organisation supplies rather than what the
                      module decides, arriving through a React context.
  index.ts            the whole public surface. The host imports nothing
                      else, which is what lets the inside be rearranged.
```

`layers.test.ts` enforces the same dependency rule `architecture_test.go`
enforces for Go, by resolving each relative import against the filesystem.

## Why the folders read this way

`okr` and `app` sit at the root because they are the hexagon and its use
cases; everything else is named by its relation to them. Adapters are grouped
by which way control flows — `driving` is called by the outside world,
`driven` is called by the application through a port — because that is the
distinction the word "adapter" alone hides. `shared` holds what belongs to
neither side.

There is no `internal/`, which is where a Go application would usually put
all of this. Quartermark is consumed as a library by a host application, and
Go makes `internal/` unimportable from outside the module, so anything a host
mounts has to stay reachable.

`architecture_test.go` enforces the dependency rule with `go list -deps`: an
allowed-import set per layer, the domain reaching no adapter, the application
reaching no transport, and no adapter depending on another. A restructure
that breaks the hexagon fails there rather than in review.

## The ports that matter

**`okr.Repository`** loads and saves a team's plan as typed domain objects —
two methods. **`okr.Teams`** lists, gets and creates a team. They are
deliberately small: a host application embedding this has a much larger
repository of its own and should not have to hand the whole thing over, and
this module should not be able to reach anything it has no business reading.

Narrowness is also what makes one implementation serve both cases. The
two-table SQLite store here and a twenty-table application store satisfy the
same interfaces, so neither needs an adapter in between.

**`app.Documents`** is the byte-level escape hatch — get and put a JSON
document by (team, section). It exists because some sections are passed
through without the domain having an opinion about them.

**`tracker.Source`** is four methods for reading issues. It is a port rather
than a client so the domain's progress roll-up can be tested without a
network, and so an organisation on a different tracker has one file to write.

## Mounting into a host

`okrapi.Mount(mux, service)` registers absolute paths onto a mux the caller
owns, rather than building one. It takes the application service and nothing
else: the routes decode a request, call one use case and encode the result,
so every decision about storage or trackers has already been made by whoever
constructed the service.

The frontend mirrors this. `web/src/okr` exports one section definition that a
host registers alongside its own. Two tests hold the boundary — what the
module may import from its host, and what the host may import from the module
— because a boundary nobody checks erodes one convenient import at a time.
The allowlist in that test is the contract a packaging step has to keep.

## Configuration versus code

Anything an organisation would word differently is data:

- the **cluster vocabulary** lives on the team's OKR document
- the **export column set** arrives through a React context, defaulting to a
  neutral layout
- the **Jira host** comes from the team's connector record, never a constant

This is not fastidiousness. Each of these started as a literal, and each one
made the module unusable by anyone whose words differed.

## Secrets

A team's connector record holds a Jira API token. The frontend needs the base
URL from that same record to build ticket links, so there is a separate route
serving only that field, decoding only that field — a token cannot leak later
by someone adding a field to the record.

## Testing

- Go: unit tests per package; `adapters/driving/okrapi` drives `Mount` on a bare mux
  against an in-memory store and a stub Jira, which is also the proof that
  the narrow port is sufficient — nothing in those tests needs SQLite.
- Frontend: component and pure-function tests, plus the two boundary tests.
- The demo dataset is hand-written JSON no compiler checks, so a test
  validates every status, metric type and id in it. A value outside the
  vocabulary does not degrade — the chart throws.

## What is deliberately absent

No authentication, no multi-tenancy, no deployment story. Quartermark assumes
one trusted operator on one machine, or embedding inside an application that
already solved those problems. Adding a half-answer to any of them would be
worse than the honest absence.
