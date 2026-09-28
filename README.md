# Quartermark

A quarter planner for engineering teams that run on OKRs.

Most OKR tools are trackers: you type a number in every week and watch a bar
fill up. Quartermark is a **planner**. It holds the tree — objective → key
result → milestone — on a quarter timeline, tells you when the plan needs more
engineers than you have, and reads progress back out of Jira so the number
isn't something a human has to remember to type.

> **Status: early.** The Go API and the React frontend both run, and there
> is a demo dataset to look at. It has not been packaged, versioned or
> deployed anywhere yet.

## See it working

No account, no setup, no data of your own:

```
make demo                      # API on :8770, loads a worked example
cd web && npm install && npm run dev
```

Then open `http://127.0.0.1:5173/t/atlas/okrs`.

You get a fictional team, Atlas, with three quarters: one finished and
locked, one in flight with progress part-way through, and one still a
sketch. Enough to see the tree, the quarter timeline, the capacity
warning and the spreadsheet export before deciding whether to put your
own quarter in.

`make demo` only ever writes into a database with no teams in it. Point
it at one that has them and it declines rather than overwriting.

## What it does

- **An OKR tree, not a list.** Objectives contain key results contain
  milestones. Progress rolls up; nothing is a flat spreadsheet row.
- **A quarter Gantt with capacity.** Milestones are sized in weeks and
  staffed. The timeline shows which weeks are over-committed, so a plan that
  can't fit says so while it's still a plan.
- **Jira progress sync.** Link a node to Jira keys and progress is computed
  from the issues underneath it, including an as-of history so a closed
  quarter keeps telling the truth about what it looked like at the time.
- **Spreadsheet export.** Because the quarterly planning conversation still
  happens in a spreadsheet somewhere.
- **Local-first.** A single Go binary over SQLite, bound to loopback, plus a
  React frontend. No account, no tenant, no telemetry.

## Configuring Jira

Optional. Without it, progress is whatever you type; with it, progress on a
node is computed from the issues underneath its linked keys.

Open the team's connector settings and give it a Jira base URL, an account
email and an API token. The token is stored in the team's connector record
and is never sent to the browser — the frontend asks a separate route for the
one non-secret field it needs to build a ticket link.

A team with no Jira configured is a normal state, not a broken one. Refresh
routes answer "not configured" and every view renders without links.

## Running it for real

```
go build -o okrd ./cmd/okrd
./okrd -db /path/to/quartermark.db            # API, loopback, port 8770
cd web && npm run build                       # static files in web/dist
```

`okrd` binds `127.0.0.1` unless told otherwise. A quarter plan names people
and unshipped work, so reaching further is something you should have to ask
for: `-addr` and `QUARTERMARK_ADDR` exist, and putting it on a network is
your decision to make deliberately, behind whatever authentication you
already run.

## Adapting it to your organisation

Two things every organisation words differently, both configuration rather
than code:

- **Clusters** — the strategic themes objectives group under. Set
  `clusters` on the team's OKR document. Absent, a neutral default list
  applies. Colours come from position in your list, so any vocabulary gets
  stable, distinct colours without maintaining a palette.
- **Export columns** — the spreadsheet layout. The default is plain; a host
  application supplies its own by mounting `OkrConfigProvider` with an
  `exportColumns` array. Each column carries its own header, width and value
  function.

## Embedding it in a larger application

Quartermark is built to be mounted inside something bigger, not only run on
its own.

On the server, implement four narrow ports over storage you already have —
`okr.Repository` and `okr.Teams` for plans and teams, `app.Documents` for
pass-through sections, `app.Tracker` to resolve a team's issue tracker — then
mount the routes onto a mux you own:

```go
okrapi.Mount(mux, app.New(plans, teams, documents, tracker))
```

Whatever storage you already have almost certainly satisfies those ports
without an adapter. The reference implementation here is two tables; an
application with twenty satisfies it equally, and neither knows about the
other.

On the client, the OKR section is one importable unit:

```ts
import { okrSection } from "quartermark/okr";

export const SECTIONS = [yourSection, okrSection, yourOtherSection];
```

Nothing outside the module reaches past its barrel, and a test in the module
enforces that in both directions — what it may import from its host, and what
its host may import from it. That list is the contract a packaging step has
to keep.

## Development

```
make check        # go vet, gofmt, and the Go tests with -race
make web-test     # typecheck, lint, format check, tests, build
make demo         # a worked example to click around in
```

## How it fits together

See [ARCHITECTURE.md](ARCHITECTURE.md) for the package layout, the two ports
that matter, and why the OKR tree is a versioned JSON document rather than a
set of tables.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `make check`,
`make web-test`, and squash merges.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
