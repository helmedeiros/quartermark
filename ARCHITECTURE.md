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
okr/            the domain. Tree, quarters, schema versioning, Jira
                progress roll-up, and Store — the persistence port.
jirasource/     the Jira port and its data. No HTTP, no storage.
timewindow/     the half-open range every source is queried over. Its own
                package because both the GitHub-shaped and Jira-shaped
                callers take one, and neither should import the other.
org/            team registry entry and connector configuration.
storeerr/       not-found and already-exists, shared by value so errors.Is
                matches across ports that both report them.
httpx/          JSON response plumbing, and a way for an error to carry the
                status it should be reported as.
jsontree/       walking an untyped JSON tree.

adapters/jira/       HTTP client implementing jirasource.Source.
adapters/sqlite/     reference okr.Store. Two tables.
adapters/connectors/ resolves a team's Jira client per request.
adapters/okrapi/     the HTTP routes, mountable onto a mux you own.

cmd/okrd/       the standalone server.
web/src/okr/    the frontend module: one importable unit, one export.
web/src/        the shell around it — routing, first run, section registry.
```

Dependencies point inward. `okr` imports `jirasource` and `jsontree` and
nothing else; adapters import the domain; the domain imports no adapter.

## The two ports that matter

**`okr.Store`** is five methods: list, get and create a team, and get and put
a JSON document by (team, section). Deliberately small — a host application
embedding this has a much larger repository of its own and should not have to
hand the whole thing over, and this module should not be able to reach
anything it has no business reading.

Narrowness is also what makes one implementation serve both cases. The
two-table SQLite store here and a twenty-table application store satisfy the
same interface, so neither needs an adapter in between.

**`jirasource.Source`** is four methods for reading issues. It is a port
rather than a client so the domain's progress roll-up can be tested without a
network, and so an organisation on a different tracker has one file to write.

## Mounting into a host

`okrapi.Mount(mux, store, resolver)` registers absolute paths onto a mux the
caller owns, rather than building one. The resolver it takes is Jira-only:
these routes read Jira and nothing else, so requiring a GitHub client to
mount them would be asking for a dependency none of the handlers can use.

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

- Go: unit tests per package; `adapters/okrapi` drives `Mount` on a bare mux
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
