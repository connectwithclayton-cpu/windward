import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_ONE_DECISION,
  EVENT_ONE_GRAMMAR,
  INITIAL_COVERAGE,
  closeTrace,
  continueToActiveShift,
  createInitialConsoleState,
  openTrace,
  recordRouteChoice,
  startShift,
  tick,
  togglePause,
} from "../dist/console/runtime.js";

test("Event 1 presentation is bound to engine ranking and evidence", () => {
  assert.equal(EVENT_ONE_GRAMMAR.decisionId, EVENT_ONE_DECISION.decisionId);
  assert.equal(
    EVENT_ONE_GRAMMAR.chosen.technicianId,
    EVENT_ONE_DECISION.winner.technicianId,
  );
  const secondEligible = EVENT_ONE_DECISION.rankedAlternatives.find(
    (candidate) => candidate.eligibility.eligible,
  );
  assert.ok(secondEligible);
  assert.equal(EVENT_ONE_GRAMMAR.second.technicianId, secondEligible.technicianId);
  assert.equal(
    EVENT_ONE_GRAMMAR.chosen.travelMinutes,
    EVENT_ONE_DECISION.winner.factors.travelTime.value.minutes,
  );
  assert.equal(
    EVENT_ONE_GRAMMAR.chosen.revenueCents,
    EVENT_ONE_DECISION.winner.immediateDeltas.revenueCents,
  );
  assert.equal(EVENT_ONE_GRAMMAR.immediateMinuteDifference, 4);
  assert.equal(EVENT_ONE_GRAMMAR.immediateRevenueDifferenceCents, 0);
  assert.equal(EVENT_ONE_GRAMMAR.laterMinutesSavedByOverride, 47);
  assert.equal(EVENT_ONE_GRAMMAR.omittedConsequence?.laterDriveMinutes, 52);
  assert.equal(EVENT_ONE_GRAMMAR.hardConstraints.length, 1);
  assert.equal(EVENT_ONE_GRAMMAR.hardConstraints[0]?.technicianId, "sofia-reyes");
  assert.equal(EVENT_ONE_GRAMMAR.hardConstraints[0]?.reasonCode, "HARD_CONSTRAINT_FAILED");
  assert.equal(INITIAL_COVERAGE.availableQualifiedCount, 1);
});

test("guided choice records both paths before the active clock starts", () => {
  const decision = startShift(createInitialConsoleState());
  assert.equal(decision.phase, "decision");
  assert.equal(decision.timerStarted, false);

  const kept = recordRouteChoice(decision, "keep");
  assert.equal(kept.phase, "receipt");
  assert.equal(kept.timerStarted, false);
  assert.equal(kept.assignedTechnicianId, EVENT_ONE_GRAMMAR.chosen.technicianId);
  assert.match(kept.eventLog[0] ?? "", /choice kept/i);

  const overridden = recordRouteChoice(decision, "override");
  assert.equal(overridden.phase, "receipt");
  assert.equal(overridden.timerStarted, false);
  assert.equal(overridden.assignedTechnicianId, EVENT_ONE_GRAMMAR.second.technicianId);
  assert.equal(overridden.result?.outcomes[0]?.overridden, true);
  assert.match(overridden.eventLog[0] ?? "", /override recorded/i);
  assert.match(overridden.eventLog[0] ?? "", /47 min saved later/i);

  const active = continueToActiveShift(overridden);
  assert.equal(active.phase, "shift");
  assert.equal(active.timerStarted, true);
  assert.equal(tick(active).timerRemaining, 89);
});

test("pause, restart state, and engineering trace remain deterministic", () => {
  const active = continueToActiveShift(
    recordRouteChoice(startShift(createInitialConsoleState()), "override"),
  );
  const paused = togglePause(active);
  assert.equal(paused.paused, true);
  assert.equal(tick(paused), paused);

  const trace = openTrace(paused);
  assert.equal(trace.phase, "trace");
  assert.equal(trace.result?.seed, "windward-guided-route-v1");
  assert.equal(trace.result?.decisions[0]?.decisionId, EVENT_ONE_DECISION.decisionId);
  assert.equal(tick(trace), trace);
  assert.equal(closeTrace(trace).phase, "shift");

  const restarted = createInitialConsoleState();
  assert.equal(restarted.phase, "briefing");
  assert.equal(restarted.timerRemaining, 90);
  assert.deepEqual(restarted.eventLog, []);
});
