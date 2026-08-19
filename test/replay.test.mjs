import assert from "node:assert/strict";
import test from "node:test";

import {
  runPlayerAndBaseline,
  simulateScenario,
} from "../dist/index.js";

function fixed(value) {
  return { min: value, max: value };
}

const initialBoard = {
  technicians: [
    {
      id: "alpha",
      skills: ["repair"],
      certifications: ["epa-608-ii"],
      availableAtMinute: 0,
      assignedMinutes: 0,
      capacityMinutes: 480,
    },
    {
      id: "bravo",
      skills: ["repair"],
      certifications: ["epa-608-ii"],
      availableAtMinute: 0,
      assignedMinutes: 0,
      capacityMinutes: 480,
    },
  ],
};

const scenario = {
  seed: "windward-replay-fixture",
  initialBoard,
  jobs: [
    {
      id: "job-a",
      arrivalMinute: { min: 10, max: 20 },
      requestedStartOffsetMinutes: { min: 5, max: 10 },
      promisedWindowStartOffsetMinutes: { min: 20, max: 30 },
      promisedWindowDurationMinutes: { min: 60, max: 90 },
      durationMinutes: { min: 30, max: 50 },
      requiredSkills: ["repair"],
      requiredCertifications: ["epa-608-ii"],
      revenueCents: { min: 10_000, max: 15_000 },
      travelMinutesByTechnician: {
        alpha: { min: 2, max: 5 },
        bravo: { min: 25, max: 35 },
      },
      routeDeltaMinutesByTechnician: {
        alpha: { min: 40, max: 55 },
        bravo: { min: -10, max: -2 },
      },
      expectedRevenueCentsByTechnician: {
        alpha: fixed(12_000),
        bravo: fixed(12_000),
      },
    },
    {
      id: "job-b",
      arrivalMinute: { min: 100, max: 110 },
      requestedStartOffsetMinutes: { min: 10, max: 20 },
      promisedWindowStartOffsetMinutes: { min: 20, max: 25 },
      promisedWindowDurationMinutes: { min: 30, max: 45 },
      durationMinutes: { min: 45, max: 60 },
      requiredSkills: ["repair"],
      requiredCertifications: ["epa-608-ii"],
      revenueCents: { min: 20_000, max: 25_000 },
      travelMinutesByTechnician: {
        alpha: { min: 8, max: 15 },
        bravo: { min: 8, max: 15 },
      },
      routeDeltaMinutesByTechnician: {
        alpha: fixed(5),
        bravo: fixed(5),
      },
      expectedRevenueCentsByTechnician: {
        alpha: fixed(22_000),
        bravo: fixed(22_000),
      },
    },
  ],
};

const overrides = [{ eventId: "job-a", technicianId: "bravo" }];

test("seed, initial state, and override list replay identical decisions and outcomes", () => {
  const first = simulateScenario(scenario, overrides);
  const second = simulateScenario(scenario, overrides);

  assert.deepEqual(first, second);
  assert.deepEqual(first.exogenousEvents, second.exogenousEvents);
  assert.deepEqual(first.decisions, second.decisions);
  assert.deepEqual(first.outcomes, second.outcomes);
  assert.deepEqual(first.finalBoard, second.finalBoard);
  assert.equal(first.outcomes[0].overridden, true);
  assert.deepEqual(first.outcomes[0].promisedWindow, first.exogenousEvents[0].job.promisedWindow);
  assert.equal(
    first.outcomes[0].lateByMinutes,
    Math.max(
      0,
      first.outcomes[0].completionMinute -
        first.exogenousEvents[0].job.promisedWindow.endMinute,
    ),
  );
});

test("player and empty-override baseline share exogenous facts but not mutable board state", () => {
  const originalInitialBoard = JSON.parse(JSON.stringify(initialBoard));
  const comparison = runPlayerAndBaseline(scenario, overrides);

  assert.deepEqual(comparison.player.exogenousEvents, comparison.baseline.exogenousEvents);
  assert.notEqual(comparison.player.exogenousEvents, comparison.baseline.exogenousEvents);
  assert.deepEqual(
    comparison.player.exogenousEvents.map((event) => ({
      eventId: event.eventId,
      sequence: event.sequence,
      arrivalMinute: event.job.arrivalMinute,
      durationMinutes: event.job.durationMinutes,
      promisedWindow: event.job.promisedWindow,
      travelMinutesByTechnician: event.job.travelMinutesByTechnician,
      routeDeltaMinutesByTechnician: event.job.routeDeltaMinutesByTechnician,
      revenueCents: event.job.revenueCents,
    })),
    comparison.baseline.exogenousEvents.map((event) => ({
      eventId: event.eventId,
      sequence: event.sequence,
      arrivalMinute: event.job.arrivalMinute,
      durationMinutes: event.job.durationMinutes,
      promisedWindow: event.job.promisedWindow,
      travelMinutesByTechnician: event.job.travelMinutesByTechnician,
      routeDeltaMinutesByTechnician: event.job.routeDeltaMinutesByTechnician,
      revenueCents: event.job.revenueCents,
    })),
  );
  assert.equal(comparison.player.outcomes[0].assignedTechnicianId, "bravo");
  assert.equal(comparison.baseline.outcomes[0].assignedTechnicianId, "alpha");
  assert.notDeepEqual(comparison.player.finalBoard, comparison.baseline.finalBoard);
  assert.notEqual(comparison.player.finalBoard, comparison.baseline.finalBoard);
  assert.deepEqual(initialBoard, originalInitialBoard);
  assert.equal(Object.isFrozen(comparison.player.finalBoard), true);
  assert.equal(Object.isFrozen(comparison.baseline.finalBoard), true);
});

test("an override cannot bypass certification eligibility", () => {
  const unsafeScenario = {
    ...scenario,
    initialBoard: {
      technicians: [
        initialBoard.technicians[0],
        { ...initialBoard.technicians[1], certifications: [] },
      ],
    },
  };

  assert.throws(
    () => simulateScenario(unsafeScenario, overrides),
    /selects ineligible technician bravo/,
  );
});
