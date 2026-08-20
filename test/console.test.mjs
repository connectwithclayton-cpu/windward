import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_ONE_DECISION,
  EVENT_ONE_GRAMMAR,
  INITIAL_COVERAGE,
  closeTrace,
  continueToActiveShift,
  continueToEmergency,
  createInitialConsoleState,
  openCoverageDecision,
  openDebrief,
  openTrace,
  recordCoverageChoice,
  recordRouteChoice,
  startShift,
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
  assert.deepEqual(
    EVENT_ONE_GRAMMAR.chosen.factors.map(({ key, contribution }) => ({ key, contribution })),
    Object.entries(EVENT_ONE_DECISION.winner.factors).map(([key, factor]) => ({
      key,
      contribution: factor.contribution,
    })),
  );
  assert.equal(EVENT_ONE_GRAMMAR.chosen.factors.length, 6);
  assert.equal(EVENT_ONE_GRAMMAR.hardConstraints.length, 1);
  assert.equal(EVENT_ONE_GRAMMAR.hardConstraints[0]?.technicianId, "sofia-reyes");
  assert.equal(EVENT_ONE_GRAMMAR.hardConstraints[0]?.reasonCode, "HARD_CONSTRAINT_FAILED");
  assert.equal(INITIAL_COVERAGE.availableQualifiedCount, 1);
});

test("guided route choice records both paths before the active shift starts", () => {
  const decision = startShift(createInitialConsoleState());
  assert.equal(decision.phase, "route-decision");

  const kept = recordRouteChoice(decision, "keep");
  assert.equal(kept.phase, "route-receipt");
  assert.equal(kept.assignedTechnicianId, EVENT_ONE_GRAMMAR.chosen.technicianId);
  assert.match(kept.eventLog[0] ?? "", /choice kept/i);

  const overridden = recordRouteChoice(decision, "override");
  assert.equal(overridden.phase, "route-receipt");
  assert.equal(overridden.assignedTechnicianId, EVENT_ONE_GRAMMAR.second.technicianId);
  assert.equal(overridden.result?.outcomes[0]?.overridden, true);
  assert.match(overridden.eventLog[0] ?? "", /override recorded/i);
  assert.match(overridden.eventLog[0] ?? "", /47 min saved later/i);

  const active = continueToActiveShift(overridden);
  assert.equal(active.phase, "observation");
});

function reachCoverageDecision(routeChoice = "override") {
  return openCoverageDecision(
    continueToActiveShift(
      recordRouteChoice(startShift(createInitialConsoleState()), routeChoice),
    ),
  );
}

test("coverage decision moves the descriptive meter immediately on both paths", () => {
  const decision = reachCoverageDecision();
  assert.equal(decision.phase, "coverage-decision");
  assert.equal(decision.coverage, 1);

  const accepted = recordCoverageChoice(decision, "accept");
  assert.equal(accepted.phase, "coverage-receipt");
  assert.equal(accepted.coverage, 0);
  assert.equal(accepted.result?.outcomes[1]?.serviceOutcomeCode, "COMPLETED_IN_WINDOW");
  assert.match(accepted.eventLog.at(-1) ?? "", /coverage moved 1 → 0/i);

  const held = recordCoverageChoice(decision, "hold");
  assert.equal(held.phase, "coverage-receipt");
  assert.equal(held.coverage, 1);
  assert.equal(held.result?.outcomes[1]?.serviceOutcomeCode, "DECLINED");
  assert.match(held.eventLog.at(-1) ?? "", /window held/i);
});

test("the 2:03 emergency branches from the earlier coverage decision", () => {
  const accepted = continueToEmergency(
    recordCoverageChoice(reachCoverageDecision("keep"), "accept"),
  );
  assert.equal(accepted.phase, "emergency");
  assert.equal(accepted.result?.outcomes[2]?.serviceOutcomeCode, "DEFERRED_TO_NEXT_DAY");
  assert.equal(accepted.result?.outcomes[2]?.satisfactionDelta, 0);

  const held = continueToEmergency(
    recordCoverageChoice(reachCoverageDecision("keep"), "hold"),
  );
  assert.equal(held.phase, "emergency");
  assert.equal(held.result?.outcomes[2]?.serviceOutcomeCode, "COMPLETED_IN_WINDOW");
  assert.equal(held.result?.outcomes[2]?.satisfactionDelta, 18);
});

test("causal debrief compares the player branch with an untouched baseline", () => {
  const emergency = continueToEmergency(
    recordCoverageChoice(reachCoverageDecision("override"), "hold"),
  );
  const debrief = openDebrief(emergency);
  assert.equal(debrief.phase, "debrief");
  assert.ok(debrief.comparison);
  assert.deepEqual(
    debrief.comparison.player.exogenousEvents,
    debrief.comparison.baseline.exogenousEvents,
  );
  assert.notEqual(
    debrief.comparison.player.exogenousEvents,
    debrief.comparison.baseline.exogenousEvents,
  );
  assert.equal(debrief.comparison.player.outcomes[1]?.serviceOutcomeCode, "DECLINED");
  assert.equal(
    debrief.comparison.player.outcomes[2]?.serviceOutcomeCode,
    "COMPLETED_IN_WINDOW",
  );
  assert.equal(
    debrief.comparison.baseline.outcomes[2]?.serviceOutcomeCode,
    "DEFERRED_TO_NEXT_DAY",
  );

  const trace = openTrace(debrief);
  assert.equal(trace.phase, "trace");
  assert.equal(trace.comparison?.player.seed, "windward-guided-route-v1");
  assert.equal(trace.comparison?.player.transitions.length, 3);
  assert.equal(closeTrace(trace).phase, "debrief");
});

test("pause and restart state remain deterministic throughout the active shift", () => {
  const active = continueToActiveShift(
    recordRouteChoice(startShift(createInitialConsoleState()), "override"),
  );
  const paused = togglePause(active);
  assert.equal(paused.paused, true);
  assert.equal(openCoverageDecision(paused), paused);

  const restarted = createInitialConsoleState();
  assert.equal(restarted.phase, "briefing");
  assert.deepEqual(restarted.eventLog, []);
});
