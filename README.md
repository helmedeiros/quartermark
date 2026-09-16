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

## Design

Two pieces, usable together or apart:

- A **Go module** — the OKR domain, a narrow persistence port, a Jira port,
  and an HTTP sub-router you can mount into a larger application's mux.
- A **React package** — the OKR section as one importable unit, registered
  into a host app's section registry.

The persistence port is deliberately small: the team registry plus a JSON blob
per team. That is what lets one implementation back both the standalone app
here and a much larger host application, without either knowing about the
other.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
