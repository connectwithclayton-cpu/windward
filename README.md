# Windward

A human-in-the-loop supervision console for simulated AI-dispatched field
service.

A deliberately myopic simulated dispatcher assigns technicians to jobs. You
watch the board, see what it chose and what it passed over, and override it when
it is about to get something wrong.

Built around a question worth asking: when a system dispatches on its own, what is
the human actually for?

**Status:** the pure dispatch and replay engine and the complete authored
supervision scenario are implemented. The console covers orientation, the
guided route cascade, the live coverage tradeoff, the no-cool emergency, and a
causal branch-ledger debrief.

## Supervision console

The dependency-free static client in `index.html` imports the compiled engine and
console layer from `dist/`. It presents the fixed five-technician board, the two
persistent operational signals, the shared Keep/Override decision grammar, the
engine-backed Why drawer, both authored outcome branches, a causal comparison
with the untouched AI-only baseline, and a separate reproducible engineering
trace.

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
  events.

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
