import type {
  CoverageRequirement,
  ScenarioDefinition,
  TechnicianId,
} from "../index.js";

export interface RosterProfile {
  readonly id: TechnicianId;
  readonly name: string;
  readonly homeArea: string;
  readonly primarySkill: string;
  readonly qualification: string;
  readonly availability: string;
}

export const EVENT_ONE_SEED = "windward-guided-route-v1";

export const ROSTER: readonly RosterProfile[] = Object.freeze([
  {
    id: "maya-ortiz",
    name: "Maya Ortiz",
    homeArea: "Winter Park",
    primarySkill: "Diagnostics and repair",
    qualification: "Certified for residential systems",
    availability: "Free at 11:00 · booked in the east at 1:00",
  },
  {
    id: "luis-alvarez",
    name: "Luis Alvarez",
    homeArea: "Kissimmee",
    primarySkill: "Diagnostics and repair",
    qualification: "Certified for residential systems",
    availability: "Free at 11:00 · available for this route",
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    homeArea: "Lake Mary",
    primarySkill: "Maintenance",
    qualification: "Certified for residential systems",
    availability: "Available for the afternoon maintenance window",
  },
  {
    id: "andre-brooks",
    name: "Andre Brooks",
    homeArea: "Orlando",
    primarySkill: "No-cool repair",
    qualification: "Certified for all covered equipment",
    availability: "Qualified for the after-2-PM emergency slot",
  },
  {
    id: "sofia-reyes",
    name: "Sofia Reyes",
    homeArea: "Apopka",
    primarySkill: "Maintenance and repair",
    qualification: "Certified for small appliances only",
    availability: "Available this morning · not qualified for no-cool work",
  },
]);

const fixed = (value: number) => ({ min: value, max: value });

export const EVENT_ONE_SCENARIO = Object.freeze({
  seed: EVENT_ONE_SEED,
  initialBoard: {
    technicians: [
      {
        id: "maya-ortiz",
        skills: ["diagnostics", "repair"],
        certifications: ["epa-608-ii"],
        availableAtMinute: 660,
        assignedMinutes: 120,
        capacityMinutes: 480,
      },
      {
        id: "luis-alvarez",
        skills: ["diagnostics", "repair"],
        certifications: ["epa-608-ii"],
        availableAtMinute: 660,
        assignedMinutes: 120,
        capacityMinutes: 480,
      },
      {
        id: "priya-shah",
        skills: ["maintenance"],
        certifications: ["epa-608-ii"],
        availableAtMinute: 780,
        assignedMinutes: 120,
        capacityMinutes: 480,
      },
      {
        id: "andre-brooks",
        skills: ["maintenance", "no-cool", "repair"],
        certifications: ["epa-608-ii", "epa-608-universal"],
        availableAtMinute: 840,
        assignedMinutes: 120,
        capacityMinutes: 480,
      },
      {
        id: "sofia-reyes",
        skills: ["maintenance", "repair"],
        certifications: ["epa-608-i"],
        availableAtMinute: 660,
        assignedMinutes: 120,
        capacityMinutes: 480,
      },
    ],
  },
  jobs: [
    {
      id: "event-1-guided-route",
      arrivalMinute: fixed(645),
      requestedStartOffsetMinutes: fixed(15),
      promisedWindowStartOffsetMinutes: fixed(15),
      promisedWindowDurationMinutes: fixed(120),
      durationMinutes: fixed(60),
      requiredSkills: ["repair"],
      requiredCertifications: ["epa-608-ii"],
      revenueCents: fixed(24_500),
      travelMinutesByTechnician: {
        "maya-ortiz": fixed(16),
        "luis-alvarez": fixed(20),
        "priya-shah": fixed(27),
        "andre-brooks": fixed(31),
        "sofia-reyes": fixed(12),
      },
      routeDeltaMinutesByTechnician: {
        "maya-ortiz": fixed(0),
        "luis-alvarez": fixed(0),
        "priya-shah": fixed(0),
        "andre-brooks": fixed(0),
        "sofia-reyes": fixed(0),
      },
      expectedRevenueCentsByTechnician: {
        "maya-ortiz": fixed(24_500),
        "luis-alvarez": fixed(24_500),
        "priya-shah": fixed(24_500),
        "andre-brooks": fixed(24_500),
        "sofia-reyes": fixed(24_500),
      },
      downstreamRouteConsequencesByTechnician: {
        "maya-ortiz": {
          kind: "ROUTE_LOOKAHEAD",
          laterBookingMinute: 780,
          laterBookingDistanceMiles: 31,
          laterDriveMinutes: 52,
          crossesSameAreaTwice: true,
        },
        "luis-alvarez": {
          kind: "ROUTE_LOOKAHEAD",
          laterBookingMinute: 780,
          laterBookingDistanceMiles: 31,
          laterDriveMinutes: 5,
          crossesSameAreaTwice: false,
        },
      },
    },
    {
      id: "event-2-coverage-tradeoff",
      arrivalMinute: fixed(700),
      requestedStartOffsetMinutes: fixed(140),
      promisedWindowStartOffsetMinutes: fixed(140),
      promisedWindowDurationMinutes: fixed(300),
      durationMinutes: fixed(180),
      requiredSkills: ["maintenance"],
      requiredCertifications: ["epa-608-ii"],
      revenueCents: fixed(11_900),
      travelMinutesByTechnician: {
        "maya-ortiz": fixed(25),
        "luis-alvarez": fixed(28),
        "priya-shah": fixed(22),
        "andre-brooks": fixed(5),
        "sofia-reyes": fixed(18),
      },
      routeDeltaMinutesByTechnician: {
        "maya-ortiz": fixed(0),
        "luis-alvarez": fixed(0),
        "priya-shah": fixed(0),
        "andre-brooks": fixed(0),
        "sofia-reyes": fixed(0),
      },
      expectedRevenueCentsByTechnician: {
        "maya-ortiz": fixed(11_900),
        "luis-alvarez": fixed(11_900),
        "priya-shah": fixed(11_900),
        "andre-brooks": fixed(11_900),
        "sofia-reyes": fixed(11_900),
      },
    },
    {
      id: "event-3-no-cool-emergency",
      arrivalMinute: fixed(843),
      requestedStartOffsetMinutes: fixed(0),
      promisedWindowStartOffsetMinutes: fixed(0),
      promisedWindowDurationMinutes: fixed(120),
      durationMinutes: fixed(90),
      requiredSkills: ["no-cool", "repair"],
      requiredCertifications: ["epa-608-universal"],
      revenueCents: fixed(64_000),
      lateOutcomeCode: "DEFER_TO_NEXT_DAY",
      completionSatisfactionDelta: 18,
      travelMinutesByTechnician: {
        "maya-ortiz": fixed(24),
        "luis-alvarez": fixed(29),
        "priya-shah": fixed(31),
        "andre-brooks": fixed(17),
        "sofia-reyes": fixed(26),
      },
      routeDeltaMinutesByTechnician: {
        "maya-ortiz": fixed(0),
        "luis-alvarez": fixed(0),
        "priya-shah": fixed(0),
        "andre-brooks": fixed(0),
        "sofia-reyes": fixed(0),
      },
      expectedRevenueCentsByTechnician: {
        "maya-ortiz": fixed(64_000),
        "luis-alvarez": fixed(64_000),
        "priya-shah": fixed(64_000),
        "andre-brooks": fixed(64_000),
        "sofia-reyes": fixed(64_000),
      },
    },
  ],
} satisfies ScenarioDefinition);

export const EMERGENCY_COVERAGE_REQUIREMENT: CoverageRequirement = Object.freeze({
  atMinute: 840,
  requiredSkills: ["repair"],
  requiredCertifications: ["epa-608-universal"],
});
