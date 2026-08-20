# Windward

A human-in-the-loop supervision console for simulated AI-dispatched field
service.

A deliberately myopic simulated dispatcher assigns technicians to jobs. You
watch the board, see what it chose and what it passed over, and decide when its
evidence is safe to release or needs an override.

Built around a question worth asking: when a system dispatches on its own, what is
the human actually for?

**Status:** three complete authored supervision cases are implemented. **Horizon**
covers the guided route cascade, live coverage tradeoff, no-cool emergency, and
causal branch-ledger debrief. **Risk appetite** compares a higher-average plan
with a bounded-downside override, resolves one fixed world, then judges both
plans across an exact weighted set of 100 matched worlds. **Breadth** recovers
four visits from an absent technician one at a time, then asks whether to
release the current-board recovery or choose the minimum-touch alternative.

## Supervision console

[Play Windward in your browser][live-console].

[Open Case 2 · Risk appetite directly][risk-console].

[Open Case 3 · Breadth directly][breadth-console].

[live-console]: https://connectwithclayton.github.io/windward/
[risk-console]: https://connectwithclayton.github.io/windward/#risk-appetite
[breadth-console]: https://connectwithclayton.github.io/windward/#breadth

The dependency-free static client in `index.html` imports the compiled engine and
console layer from `dist/`. The Horizon case presents the fixed
five-technician board; Risk appetite presents its separate plan-and-replay
surface; Breadth presents its serial current-board recovery evidence and finite,
replayable focus walk. All cases use two persistent signals, the shared
Keep/Override decision grammar, engine-backed explanations, authored outcome
branches, a causal comparison with the untouched AI-only baseline, and a
separate reproducible engineering trace. Each case debrief also includes a
plain-language scope-boundary panel describing what this authored case study
does not prove.

Risk appetite is a separate static case, not another event in the Horizon
shift. Its `15 of 100` likelihood, `$15,000` one-job loss limit, plans, outcomes,
and money are authored fictional assumptions. They are not measured HVAC
failure rates, real prices, actuarial evidence, or advice.

After `npm run build`, serve the repository root with any static file server and
open `index.html`. For example:

```sh
python3 -m http.server 4173
```

The UI does not score, re-rank, or re-derive eligibility. Descriptive downstream
route evidence is returned by the engine alongside each candidate but remains
outside the dispatcher's scoring factors. Emergency coverage is computed
separately and never feeds back into ranking.

## Dispatch engine

The dependency-free TypeScript package exposes:

- `dispatch(boardState, job)`, which returns its winner only as part of a full
  evidence-bearing ranking;
- `computeCoverage(boardState, requirement)`, a separate descriptive coverage
  calculation that never feeds back into ranking;
- seeded scenario and replay functions that run player and empty-override
  baseline branches from independent board states and identical exogenous
  events;
- `rankPlans(input)`, a separate expected-value-only plan evaluator that does
  not accept or apply a loss limit;
- an exact, versioned 100-world risk replay that pairs player and AI-only plans
  against identical outside conditions and computes policy evidence outside
  ranking;
- a fixed Breadth recovery that dispatches four visits serially, retaining each
  current ranking, state transition, and matched branch outcome as evidence.

Jobs carry an explicit promised time window for replay and late-outcome
evidence. That window is not a ranking factor. The ranker uses only travel time,
skill match, certification, availability, revenue fit, and utilisation.
Certification is a hard constraint; a missing certification remains visible in
the ranking evidence as a named disqualifier.

The dispatcher's lack of lookahead and reserve logic is deliberate. Windward
does not call a model, does not claim to reproduce a production dispatcher, and
does not demonstrate or imply how any real vendor's model behaves.

---

Independent portfolio project inspired by a public “AI Operations Strategist”
job posting. Not affiliated with, endorsed by, or built for any company. Every
company, technician, customer, and data point in the simulation is fictional.
