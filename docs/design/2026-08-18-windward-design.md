# Windward design specification

**Date:** 2026-08-18\
**Status:** Approved design; implementation is not part of this specification

## Product definition

Windward is a browser-based, human-in-the-loop supervision console for an AI
that dispatches HVAC technicians. The viewer plays the human supervisor: they
watch the AI assign work, see what it chose and passed over, and override it
when it is about to get something wrong.

Windward is a public portfolio piece with no company affiliation. It is
inspired by a public job posting for an “AI Operations Strategist” whose role is
to monitor an AI dispatch board and think several moves ahead. Every company,
technician, customer, and data point in the simulation is fictional.

The product thesis is:

> When a system dispatches on its own, the human supplies horizon, policy, and
> risk appetite—not error correction.

Windward demonstrates that thesis with a deliberately myopic simulated
dispatcher. It does not call a model and must never imply that its behavior
represents any real vendor’s model.

## Experience contract

- The viewer is a player, not a spectator.
- A complete first session lasts two to three minutes.
- The scenario is hand-authored rather than procedural.
- The experience does not auto-play. It begins only after the player starts it.
- One deterministic scenario supports operations, AI/product, engineering, and
  generalist readers through progressive disclosure.
- Every scored mistake has one cause: the dispatcher makes a locally reasonable
  choice that is globally bad because it does not look ahead.
- The ending is a causal debrief, not a score.

The active shift is 90 seconds. Orientation, the frozen guided decision, and the
debrief sit outside that clock so a cold reviewer can read and experiment
without losing the scenario.

## Four reading depths

Windward serves four audiences in one artifact without placing all four levels
of detail on the live board at once.

| Reading depth | Audience need | How Windward serves it |
|---|---|---|
| Immediate action | Generalist | The start screen states the role, each decision presents one warning and two explicit actions, and every action produces visible cause and effect. No field-service knowledge is required. |
| Operational state | Operations | The five-lane board shows schedule state, qualifications, availability, the heat context, and remaining emergency coverage. Route detail appears only for the selected route decision. |
| Decision reasoning | AI/product | A **Why** drawer shows the winner, ranked alternatives, plain-language factor contributions, ineligible options, and the immediate counterfactual costs. It also states what the greedy policy omitted. |
| Reproducible trace | Engineering | After the run, an engineering trace exposes the seed, decision IDs or input snapshots, state transitions, decision JSON, replay path, and links to the pure-engine source and tests. |

The default reading order is immediate action, operational state, decision
reasoning, then reproducible trace. The generalist and operations bridge is the
default surface; deeper AI/product and engineering material is available on
demand and after the run.

## Scenario

### Setting

The scenario is a summer morning in Central Florida with five fictional
technicians. The fixed roster is:

| Technician | Home area | Primary skill | Certification | Availability in the scenario |
|---|---|---|---|---|
| Maya Ortiz | Winter Park | Diagnostics and repair | EPA 608 Type II | Free at 11:00; booked in the east at 1:00 |
| Luis Alvarez | Kissimmee | Diagnostics and repair | EPA 608 Type II | Free at 11:00; available for the route alternative |
| Priya Shah | Lake Mary | Maintenance | EPA 608 Type II | Available for the afternoon maintenance window |
| Andre Brooks | Orlando | No-cool repair | EPA 608 Universal | Qualified for the after-2-PM emergency slot |
| Sofia Reyes | Apopka | Maintenance and repair | EPA 608 Type I | Available for morning work; not qualified for the no-cool slot |

Five lanes are deliberate: eight-lane boards are common in real dispatch
products but are unreadable to a cold reviewer when combined with instructions
and AI explanations.

The scenario has one teaching arc: route lookahead makes the dispatcher’s
myopia visible, then the player applies the same insight to uncertain future
demand.

### Start and orientation

The board is frozen behind a briefing card. The role statement is:

> **You supervise an AI dispatcher.**

Supporting copy explains that the dispatcher schedules five technicians one
job at a time, and that the player compares its choice and chooses **Keep** or
**Override**. The primary action is **Start 90-second shift**. Starting reveals
the frozen guided event; the clock does not begin until that event is resolved.

### Event 1: guided route cascade

The dispatcher chooses the technician who is four minutes closer to the new job
now. That technician already has a later booking across town, so the assignment
creates unnecessary backtracking.

The event freezes with no time pressure and no penalty. The board remains the
persistent surface while the map appears for this route decision only. It draws
the proposed route against the second-ranked alternative and places the cost on
the route itself:

> **+52 min, crosses the same area twice.**

The player sees the dispatcher’s pick, the second-ranked alternative, the
minutes and dollars associated with each, and **Keep** and **Override** buttons.
The one-click alternative is labelled **Assign Luis · saves 47 min**.
The explanation uses the following shape:

> **Why the AI chose Maya**\
> 4 min closer · correct repair skill · free at 11:00\
> **What it missed**\
> Her 1:00 booking is 31 miles east. This choice adds 52 min of later driving.

The guided event also shows a certification-required option that the dispatcher
correctly excludes. Its exact requirement and certification type are written in
plain language. Certification mismatch is never presented as a dispatcher
mistake because certification is a hard engine constraint.

If the player overrides, the route redraws immediately and a one-line event-log
entry confirms the action. Resolving this event starts the active-shift clock.

### Event 2: live coverage tradeoff

Before the relevant maintenance booking arrives, the interface already shows
both persistent signals:

- Context strip: **Extreme heat advisory · no-cool calls usually rise after
  lunch**
- Coverage meter: **Emergency coverage after 2 PM: 1 tech**

The dispatcher proposes filling the last qualified afternoon window because the
job has positive immediate value. The proposal visibly changes emergency
coverage from 1 to 0. The decision is explicitly two-sided:

- **Accept maintenance job** — `+$119 scheduled revenue · emergency coverage 0`
- **Hold window open** — `$119 at risk · emergency coverage 1`

In the shared decision grammar, accepting is **Keep** and holding the window is
**Override**. The player knows afternoon no-cool demand is likely but is never
told that a particular customer will call at a particular time. The decision is
therefore a trade of certain revenue against probable need, not hidden-answer
recall.

The coverage meter moves immediately after the player acts, and the event log
records the choice in one line. Non-scored board activity may carry the shift
forward, but it must not introduce another failure type or compete with the
heat context and coverage state.

### Event 3: the emergency

At 2:03 PM, a no-cool call arrives. The call tests whether the player acted on
the visible heat-demand signal and coverage tradeoff. It does not reveal a new
rule or require HVAC knowledge.

If the player held the window, the emergency receives same-day coverage. If the
player accepted the maintenance job, emergency coverage is zero and the call
moves to tomorrow. The outcome is described first as a safety and service-level
consequence; revenue remains secondary. Customer age or vulnerability never
changes job value.

The shift then freezes and advances to the causal debrief.

## Interface specification

### Persistent surface

The scheduling board is the persistent surface. It has five technician lanes
and keeps the decision-relevant work visible. The map is not a permanent second
dashboard; it appears only while a route decision is live and disappears when
that decision is resolved.

Exactly two operational signals persist throughout play:

1. the context strip;
2. the emergency-coverage meter.

No other persistent alert, metric, or status treatment may compete with them.

### Decision grammar

Every decision moment has the same shape:

1. what the dispatcher chose;
2. what it ranked second;
3. the cost of each choice in minutes and dollars;
4. **Keep** and **Override** buttons.

Buttons are the primary interaction. Drag-and-drop is not required. The visible
buttons must work with keyboard, pointer, and touch input.

Every override changes the relevant state immediately:

- a route decision redraws the route;
- a coverage decision moves the coverage meter;
- every override adds a one-line event-log entry.

The player must never have to infer whether an override was recorded.

### Explanation language

Cards use plain language first. Acronyms such as EPA 608, RSC, SLA, maintenance
plan codes, and technician levels appear only inside detail drawers and only
with enough context to interpret them. Color is never the only qualification or
status indicator.

The interface never requires local geographic knowledge. A place name may
provide flavor, but route shape, time, and distance carry the decision.

The **Why** drawer distinguishes:

- immediate reasons the dispatcher preferred its winner;
- explicit hard-constraint exclusions;
- the second-ranked eligible alternative;
- immediate minute and dollar deltas;
- the downstream route or coverage consequence the myopic policy did not use.

### Control and accessibility

Pause and restart are always visible during the shift. The guided event has no
clock pressure or penalty, so trying the control is safe. A required decision
and its relevant technician must remain in view.

On narrow viewports, the same information becomes a focused, single-decision
layout rather than a horizontally scrolling board. The experience does not wait
until after the timer starts to announce a desktop requirement.

All state changes are reduced-motion safe. With reduced motion enabled, route
and meter updates may change directly or use a restrained transition; meaning
cannot depend on animation. No element continuously pulses or moves.

## Dispatcher and replay contract

### Pure engine

The engine is a pure package with no UI dependency. Its public decision function
is:

```text
dispatch(boardState, job) -> Decision
```

`Decision` contains the winner and ranked alternatives. Each candidate includes
the evidence needed to show the engine’s work:

- eligibility and explicit hard-constraint disqualifiers;
- normalized job requirements;
- factor values and their contributions;
- a short, machine-readable reason code;
- immediate time, route, and revenue deltas;
- a decision ID or input snapshot for deterministic replay.

The ranking factors are travel time, skill match, certification, availability,
revenue fit, and utilisation. Certification is a hard constraint: an ineligible
technician cannot win or appear as an eligible alternative.

Explainability is structural. The engine cannot return only a winner; it must
return the ranked evidence that allows the interface to show what it chose and
passed over.

### Deliberate omission

The simulated dispatcher has no lookahead and no reserve heuristic. It optimises
the assignment in front of it. That omission—not a scoring bug or a hard-rule
violation—is the flaw the scenario demonstrates.

The coverage meter is descriptive evidence about the board state. It can expose
that qualified future coverage becomes zero without pretending the greedy
dispatcher considered reserve capacity when ranking the immediate job.

### Determinism and baseline

All scenario behavior is seeded: the same seed produces the same day. Arrival
order, job durations, travel times, and every other exogenous event are frozen.

The unsupervised baseline is the same simulation from the same initial state
with an empty override list. The player branch and baseline branch differ only
in player overrides. They do not share a player-mutated final board.

Replay tests must prove that seed + initial state + override list reproduces the
same decisions and outcomes, and that all exogenous events are equal between
the player and baseline runs. If arrival order, durations, travel times, or
other exogenous data drift, the comparison is invalid and the debrief must not
claim a causal difference.

## Causal debrief

The first ending surface is a branch ledger, not an aggregate score. It replays
the player’s day against the untouched baseline and names the earlier decision
that caused the different outcome.

A winning debrief uses this shape:

> **2:03 PM · No-cool emergency**\
> You kept the last qualified afternoon slot open.\
> Deferred tune-up: `-$119`\
> Emergency completed today: `+$640`, `+18 satisfaction`\
> **Net difference from AI-only day: +$521 and one same-day emergency**

Its causal summary is:

> At 11:40 you kept Maya’s afternoon open. That’s the call that covered the
> 2:03 emergency.

A losing debrief uses the same causality in reverse:

> At 11:42, accepting the tune-up reduced emergency coverage from 1 to 0.\
> The 2:03 no-cool call moved to tomorrow.\
> **Replay the decision**

Revenue, drive time, same-day completion, and customer outcome remain separate
measures. There is no overall score. A losing player must be able to point to
the exact decision where the outcome changed.

## Validation protocol

Before production implementation, build only a disposable clickable storyboard
in paper or HTML. It contains the briefing, one route decision, the reserve
choice, the emergency, and the causal debrief. It does not require the
production engine.

Test the storyboard with five people who have never worked in field service. Do
not explain the scenario aloud. Record these five measures:

| Moment | Measure |
|---|---|
| At 10 seconds | Can the participant state the role and action in their own words—for example, “The AI schedules technicians and I can change a bad choice”? |
| On the first event | Can the participant operate **Keep** or **Override** without help? |
| Before the emergency | Can the participant articulate why zero afternoon coverage is risky? |
| After losing | Can the participant point to the exact earlier decision that caused the outcome? |
| After the debrief | Can the participant explain the engine’s flaw as “good now, bad later” without using the author’s words? |

The pass thresholds established by the critique are:

- at least 4 of 5 participants pass each of the three pre-emergency measures;
- 5 of 5 losing participants can identify the causal decision.

The reserve finale has a hard kill criterion: if fewer than 4 of 5 participants
can articulate why zero afternoon coverage is risky **before** the emergency,
replace the reserve finale with the promised-window cascade. Do not try to save
the reserve finale by adding more prose.

The promised-window cascade is the approved fallback: a new locally attractive
job makes an existing customer late, shown on a timeline with a visible late
marker. It preserves the same “locally reasonable, globally bad” flaw.

## Tab-closing risks

| Risk | Why a reviewer leaves | Required mitigation |
|---|---|---|
| Auto-start before orientation | The first event arrives while the reviewer is still classifying the screen, so the demo appears broken. | Use an explicit start screen and freeze the guided first event until the player acts. |
| Strawman “AI” | A deterministic greedy scorer presented as representative of real AI makes the argument feel dishonest. | Call it a deliberately myopic simulated dispatcher in the product and README; state that it does not show how any real vendor model behaves. |
| Too many acronyms | Domain codes turn every card into a glossary and make a novice feel unqualified. | Use plain-language labels first and keep jargon inside detail drawers. |
| Geographic obscurity | Central Florida place names do not make route quality legible to outsiders. | Always show route shape plus minutes and distance; never require local knowledge. |
| No safe exploration | A reviewer afraid of ruining a short run avoids acting. | Keep pause and restart visible and impose no pressure or penalty on the guided event. |
| Invisible override effect | A card moves but the reviewer cannot tell whether the decision changed anything. | Immediately redraw the route or move the coverage meter and write a one-line event-log entry. |
| Score gaming instead of insight | A fixed emergency can teach “always reserve Maya” on replay rather than transferable supervision. | Frame the run as an authored case study and make replay focus on the causal counterfactual, not a higher score. |
| Baseline drift | Different exogenous events make the player-versus-baseline comparison invalid. | Freeze arrivals, durations, and travel times and test replay equality. Fail closed on drift. |
| No visible provenance | The work can be mistaken for a real company product or real operational data. | Keep the unaffiliated portfolio disclaimer, link the public inspiration after the run, and label all companies, people, customers, and data fictional. |
| Marketing-board mimicry without operator truth | A polished board may imply production fidelity while omitting cancellations, uncertain durations, parts, callbacks, agreements, and communication. | Describe Windward as a focused simulation, never a faithful production dispatcher. |

## Scope boundaries

Windward deliberately is not:

- a faithful production dispatcher or a claim about the full complexity of
  field-service operations;
- evidence of how a real vendor’s model behaves;
- a real-time system;
- a model-powered or procedural simulation;
- a backend service;
- an account system;
- a persistent product or system of record.

The deployable product is a static client that consumes the pure engine package.
It has no backend, accounts, database, or persistence. This zero-infrastructure
architecture is intentional so the public demo can continue to work years from
now.

This specification authorizes no engine code, UI code, scaffolding, dependency,
or production storyboard. Those belong to separate implementation and
validation tasks.

## Documentation and provenance requirements

The public README and the experience must say plainly that Windward uses a
deliberately myopic simulated dispatcher. Neither may imply that the project
demonstrates how any real vendor’s model behaves.

The public presentation must also preserve these facts:

- Windward is an independent portfolio project;
- it is not affiliated with, endorsed by, or built for any company;
- its inspiration is a public “AI Operations Strategist” job posting;
- all companies, technicians, customers, and data in the simulation are
  fictional.

## Open questions

The critique defines five validation measures but assigns numeric thresholds
only to the three pre-emergency measures and loss causality. It does not assign
a numeric threshold to the fifth measure—explaining the engine’s “good now, bad
later” flaw after the debrief. That threshold remains to be settled before the
storyboard study is scored.
