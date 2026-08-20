import {
  BREADTH_CASE,
  type BreadthComparison,
  type BreadthPinnedVisit,
  type BreadthRecoverySummary,
  type CandidateEvidence,
  type Decision,
  type FactorBreakdown,
  type SimulationResult,
  type TechnicianId,
} from "../index.js";
import {
  BREADTH_MACHINE_PREVIEW,
  BREADTH_MINIMUM_TOUCH_PREVIEW,
  type BreadthConsoleState,
} from "./breadth-runtime.js";
import {
  escapeHtml,
  renderBadge,
  renderDecisionPanel,
  renderEventLog,
  renderStatCell,
} from "./components.js";
import { formatClockMinute } from "./decision-model.js";
import { renderCaseCards } from "./risk-view.js";

interface BreadthRosterProfile {
  readonly id: TechnicianId;
  readonly name: string;
  readonly capability: string;
  readonly qualification: string;
  readonly startingState: string;
}

const BREADTH_ROSTER: readonly BreadthRosterProfile[] = Object.freeze([
  {
    id: "jordan-kim",
    name: "Jordan Kim",
    capability: "Senior swing technician",
    qualification: "Authored owner of the four recovered visits",
    startingState: "Absent before leaving home",
  },
  {
    id: "elena-park",
    name: "Elena Park",
    capability: "Maintenance, diagnostics, repair",
    qualification: "Certified for residential systems",
    startingState: "Available 9:00 · 160/480 min assigned",
  },
  {
    id: "marcus-reed",
    name: "Marcus Reed",
    capability: "Maintenance, diagnostics, repair",
    qualification: "Certified for residential systems",
    startingState: "Available 9:00 · 120/480 min assigned",
  },
  {
    id: "dev-shah",
    name: "Dev Shah",
    capability: "Maintenance, no-cool, repair",
    qualification: "Universal certification",
    startingState: "Available 10:00 · 180/480 min assigned",
  },
  {
    id: "nina-flores",
    name: "Nina Flores",
    capability: "Appliance and repair",
    qualification: "Small-appliance certification",
    startingState: "Available 8:30 · 100/480 min assigned",
  },
]);

const NAMES = Object.freeze(
  Object.fromEntries(BREADTH_ROSTER.map((profile) => [profile.id, profile.name])),
);

const JOB_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "breadth-maintenance-tune-up": "Maintenance tune-up",
  "breadth-diagnostic-repair": "Diagnostic repair",
  "breadth-small-appliance-repair": "Small-appliance repair",
  "breadth-no-cool-repair": "No-cool repair",
});

const KEY_REASONS = Object.freeze([
  "Closer, fully qualified, available",
  "No wait and lower utilisation after Elena's first assignment",
  "Only technician with the required small-appliance certification",
  "Only technician with universal certification",
]);

const FACTOR_ORDER: readonly (keyof FactorBreakdown)[] = Object.freeze([
  "travelTime",
  "skillMatch",
  "certification",
  "availability",
  "revenueFit",
  "utilisation",
]);

const FACTOR_LABELS: Readonly<Record<keyof FactorBreakdown, string>> = Object.freeze({
  travelTime: "Travel time",
  skillMatch: "Skill match",
  certification: "Certification",
  availability: "Availability",
  revenueFit: "Revenue fit",
  utilisation: "Utilisation",
});

export function renderBreadthConsole(state: BreadthConsoleState): string {
  if (state.phase === "briefing") return renderBreadthBriefing();
  if (state.phase === "decision" || state.phase === "receipt") {
    return renderBreadthDecision(state);
  }
  if (state.phase === "outcome") return renderBreadthOutcome(state);
  if (state.phase === "debrief") return renderBreadthDebrief(state);
  return renderBreadthTrace(state);
}

function renderBreadthBriefing(): string {
  return `<main id="main-content" class="breadth-shell breadth-briefing phase-enter">
    ${renderBreadthSignals(null)}
    <section class="risk-briefing-card breadth-briefing-card" role="dialog" aria-modal="true" aria-labelledby="breadth-briefing-title">
      <p class="eyebrow">7:05 AM · Sick-day recovery</p>
      <h1 id="breadth-briefing-title" tabindex="-1">You supervise a dispatch recovery.</h1>
      ${renderCaseCards("breadth")}
      <p class="briefing-copy">One technician is out. The dispatcher reassigned four visits across the four remaining technicians. It checked the current board again after every assignment. You decide whether to release that recovery or keep the two flexible visits together.</p>
      <p class="safe-copy"><span aria-hidden="true">✓</span> Eight other visits stay pinned in both paths. The dispatcher does not look ahead or replan the day. Both choices keep certification rules; they trade one changed technician against one promised window.</p>
      <button class="primary-button wide" type="button" data-action="start-breadth">Review the recovery</button>
      ${renderBreadthProvenance()}
    </section>
  </main>`;
}

function renderBreadthSignals(comparison: BreadthComparison | null): string {
  const releaseResult = comparison === null
    ? "Promised-window result shown after ranking"
    : comparison.playerSummary.recoveredVisitsInsideWindow === 4
      ? "4 of 4 certified · 4 of 4 inside windows"
      : "4 of 4 certified · 3 of 4 inside windows";
  return `<section class="signals breadth-signals" aria-label="Persistent operational signals">
    <article class="signal context-signal">
      <span class="signal-mark" aria-hidden="true">4</span>
      <div><span class="signal-label">Recovery</span><strong>Jordan out · 4 recovered visits · 8 visits pinned</strong></div>
    </article>
    <article class="signal coverage-signal">
      <span class="signal-mark" aria-hidden="true">✓</span>
      <div><span class="signal-label">Release check</span><strong>Certification required · ${escapeHtml(releaseResult)}</strong></div>
    </article>
  </section>`;
}

function renderBreadthDecision(state: BreadthConsoleState): string {
  const recorded = state.phase === "receipt";
  const comparison = state.comparison;
  const confirmation = comparison === null
    ? ""
    : state.choice === "dispatcher-recovery"
      ? `<strong>Keep recorded — dispatcher recovery released.</strong><span>Four recovered visits now have certified owners. All four remain inside their promised windows; four technician-days changed.</span>`
      : `<strong>Override recorded — flexible visits kept with Elena.</strong><span>Three technician-days changed and seven drive minutes were removed. The diagnostic visit now completes 13 minutes outside its promised window.</span>`;
  return `<main id="main-content" class="breadth-shell phase-enter phase-breadth-${state.phase}">
    ${renderBreadthSignals(comparison)}
    ${renderDecisionPanel({
      titleId: "breadth-decision-title",
      eyebrow: "Case 3 · Breadth",
      title: "Release the broader recovery?",
      className: "breadth-decision-shell",
      contentClassName: "breadth-decision-content",
      badge: {
        label: "Frozen · no countdown",
        icon: "❚❚",
        tone: "quiet",
        className: "frozen-label",
      },
      content: `
        <p class="breadth-decision-lede">The dispatcher spread four visits across four technicians. Keeping both flexible visits with Elena changes one fewer morning and drives seven fewer minutes, but completes the diagnostic visit 13 minutes late.</p>
        ${renderChoiceCards(recorded)}
        ${comparison === null ? "" : `<div class="recorded breadth-recorded" id="breadth-confirmation" role="status" tabindex="-1">${confirmation}</div>
          ${renderEventLog({ titleId: "breadth-event-log-title", entries: state.eventLog, className: "breadth-event-log" })}
          <button class="primary-button wide continue-button" type="button" data-action="continue-breadth-outcome">Continue through recovered work</button>`}
        ${renderRecoveryMatrix(BREADTH_MACHINE_PREVIEW.baseline)}
      `,
    })}
    ${renderBreadthBoard(state)}
    ${renderBreadthProvenance()}
  </main>`;
}

function renderChoiceCards(disabled: boolean): string {
  const machine = BREADTH_MACHINE_PREVIEW.playerSummary;
  const minimum = BREADTH_MINIMUM_TOUCH_PREVIEW.playerSummary;
  return `<div class="breadth-choice-grid">
    <article class="breadth-choice-card dispatcher">
      <span class="choice-rank">Dispatcher recovery</span>
      <h2>Broader current-board recovery</h2>
      <p class="breadth-choice-summary">${machine.workingTechniciansTouched} technicians touched · ${machine.addedTravelMinutes} added drive min</p>
      <div class="breadth-choice-facts">
        ${renderStatCell({ label: "Working technicians touched", value: String(machine.workingTechniciansTouched), detail: `${machine.addedTravelMinutes} added drive min` })}
        ${renderStatCell({ label: "Certification", value: `${machine.recoveredVisitsCertified} of 4`, detail: "All required certifications met", tone: "accent" })}
        ${renderStatCell({ label: "Promised-window outcome", value: `${machine.recoveredVisitsInsideWindow} of 4`, detail: "Calculated after assignment", tone: "accent" })}
      </div>
      <button class="secondary-button wide" type="button" data-action="keep-breadth" ${disabled ? "disabled" : ""}>Keep · Release dispatcher recovery</button>
    </article>
    <article class="breadth-choice-card minimum-touch">
      <span class="choice-rank">Minimum-touch recovery</span>
      <h2>Keep flexible visits with Elena</h2>
      <p class="breadth-choice-summary">${minimum.workingTechniciansTouched} technicians touched · ${minimum.addedTravelMinutes} added drive min</p>
      <div class="breadth-choice-facts">
        ${renderStatCell({ label: "Working technicians touched", value: String(minimum.workingTechniciansTouched), detail: `${minimum.addedTravelMinutes} added drive min` })}
        ${renderStatCell({ label: "Certification", value: `${minimum.recoveredVisitsCertified} of 4`, detail: "All required certifications met", tone: "accent" })}
        ${renderStatCell({ label: "Promised-window outcome", value: `${minimum.recoveredVisitsInsideWindow} of 4`, detail: "Diagnostic completes 13 min late", tone: "warning" })}
      </div>
      <button class="primary-button wide" type="button" data-action="minimum-touch-breadth" ${disabled ? "disabled" : ""}>Override · Keep flexible visits with Elena</button>
    </article>
  </div>`;
}

function renderRecoveryMatrix(result: SimulationResult): string {
  return `<section class="breadth-matrix" aria-labelledby="breadth-matrix-title">
    <div class="section-heading"><div><p class="eyebrow">Recovery matrix · engine evidence</p><h2 id="breadth-matrix-title">Four serial assignments</h2></div><span class="board-note">16 candidate rows · same six factors</span></div>
    <p class="matrix-intro">Each visit became current in this order. After every actual assignment, the dispatcher used the updated availability and assigned work to rank all four remaining technicians again.</p>
    <div class="recovery-rows">
      ${result.decisions.map((decision, index) => renderRecoveryRow(decision, result, index)).join("")}
    </div>
  </section>`;
}

function renderRecoveryRow(
  decision: Decision,
  result: SimulationResult,
  index: number,
): string {
  const outcome = result.outcomes[index];
  if (outcome === undefined) throw new Error(`Missing Breadth outcome ${index + 1}`);
  const eligible = decision.ranking.filter((candidate) => candidate.eligibility.eligible).length;
  const excluded = decision.ranking.length - eligible;
  const pivotal = index === 1;
  const windowResult = outcome.lateByMinutes === 0
    ? `${decision.inputSnapshot.job.promisedWindow.endMinute - (outcome.completionMinute ?? 0)} min inside window`
    : `${outcome.lateByMinutes} min late`;
  const turn = pivotal
    ? `<span class="breadth-turn"><strong>Elena</strong><i aria-hidden="true">→</i><span>first assignment recorded</span><i aria-hidden="true">→</i><strong>All 4 rechecked</strong><i aria-hidden="true">→</i><strong>Marcus</strong></span>`
    : "";
  return `<details class="recovery-row ${pivotal ? "is-pivotal" : ""}">
    <summary>
      <span class="recovery-order">${index + 1}</span>
      <span class="recovery-visit"><strong>${escapeHtml(JOB_NAMES[decision.inputSnapshot.job.id] ?? decision.inputSnapshot.job.id)}</strong><small>${formatClockMinute(decision.inputSnapshot.job.requestedStartMinute)} requested</small></span>
      <span class="recovery-winner"><small>Current winner</small><strong>${escapeHtml(NAMES[decision.winner.technicianId] ?? decision.winner.technicianId)}</strong></span>
      <span class="recovery-reason"><small>Key reason</small><strong>${escapeHtml(KEY_REASONS[index] ?? "Highest current six-factor score")}</strong></span>
      <span class="recovery-field"><small>Eligible field</small><strong>${eligible} eligible · ${excluded} excluded</strong></span>
      <span class="recovery-window"><small>Outcome replay</small><strong>${escapeHtml(windowResult)}</strong></span>
      ${turn}
    </summary>
    <div class="recovery-evidence">
      ${index === 0 ? renderStateHandoff(result) : ""}
      ${pivotal ? renderPivotalComparison(decision, outcome) : ""}
      <div class="candidate-grid" aria-label="All four candidate evidence rows for ${escapeHtml(JOB_NAMES[decision.inputSnapshot.job.id] ?? decision.inputSnapshot.job.id)}">
        ${decision.ranking.map((candidate) => renderCandidateEvidence(candidate)).join("")}
      </div>
      ${renderBreadthOmission()}
    </div>
  </details>`;
}

function renderStateHandoff(result: SimulationResult): string {
  const elena = result.transitions[0]?.afterBoard.technicians.find(
    (technician) => technician.id === "elena-park",
  );
  if (elena === undefined) return "";
  return `<div class="state-handoff">
    <span class="component-label">Recorded state becomes the next current input</span>
    <strong>Elena's tune-up assignment: available at ${formatClockMinute(elena.availableAtMinute)} · ${elena.assignedMinutes}/${elena.capacityMinutes} minutes assigned.</strong>
    <p>The first decision did not anticipate the diagnostic. These values were present when that visit became current.</p>
  </div>`;
}

function renderPivotalComparison(decision: Decision, outcome: SimulationResult["outcomes"][number]): string {
  const marcus = requireCandidate(decision, "marcus-reed");
  const elena = requireCandidate(decision, "elena-park");
  return `<section class="pivotal-evidence" aria-labelledby="pivotal-title">
    <div class="pivotal-heading"><p class="eyebrow">The non-obvious turn</p><h3 id="pivotal-title">Elena remains closer. Marcus becomes the best current choice.</h3></div>
    <div class="pivotal-factor-grid" role="table" aria-label="Pivotal score comparison">
      <div class="pivotal-factor-head" role="row"><span role="columnheader">Factor</span><strong role="columnheader">Marcus Reed</strong><strong role="columnheader">Elena Park</strong></div>
      ${FACTOR_ORDER.map((key) => `<div class="pivotal-factor-row" role="row"><span role="cell">${FACTOR_LABELS[key]}</span><strong role="cell">${escapeHtml(formatFactorValue(marcus, key))} · +${formatScore(marcus.factors[key].contribution)}</strong><strong role="cell">${escapeHtml(formatFactorValue(elena, key))} · +${formatScore(elena.factors[key].contribution)}</strong></div>`).join("")}
      <div class="pivotal-factor-row total" role="row"><span role="cell">Immediate score</span><strong role="cell">${formatScore(marcus.score)}</strong><strong role="cell">${formatScore(elena.score)}</strong></div>
    </div>
    <figure class="breadth-path" aria-labelledby="breadth-path-title breadth-path-caption">
      <figcaption id="breadth-path-title"><strong>Current path and outcome replay</strong><span>Outcome suffix is not scored</span></figcaption>
      <div class="path-track scored-path"><span>9:30 requested</span><i></i><span>Marcus · 12 min travel</span><i></i><strong>${formatClockMinute(outcome.completionMinute ?? 0)} complete · 18 min inside</strong></div>
      <div class="path-track scored-path"><span>9:30 requested</span><i></i><span>Elena · 38 min wait + 5 min travel</span><i></i><strong>11:43 complete</strong></div>
      <div class="path-track ghosted-path"><span>Promise ends 11:30</span><i></i><span>Marcus · 18 min inside</span><i></i><strong>Elena · 13 min late</strong></div>
      <p id="breadth-path-caption">Promised-window outcomes were calculated after assignment. They did not change the dispatcher score.</p>
    </figure>
  </section>`;
}

function renderCandidateEvidence(candidate: CandidateEvidence): string {
  const eligible = candidate.eligibility.eligible;
  const status = eligible
    ? candidate.reasonCode === "BEST_IMMEDIATE_SCORE" ? "Selected current winner" : `Eligible · rank ${candidate.rank}`
    : "Excluded · hard constraint";
  return `<article class="candidate-evidence ${eligible ? "is-eligible" : "is-excluded"}">
    <header><div><h3>${escapeHtml(NAMES[candidate.technicianId] ?? candidate.technicianId)}</h3><span>${escapeHtml(status)}</span></div>${renderBadge({ label: eligible ? candidate.reasonCode : "HARD_CONSTRAINT_FAILED", icon: eligible ? "✓" : "×", tone: eligible ? "accent" : "danger" })}</header>
    <p class="candidate-score">${eligible ? `Immediate score ${formatScore(candidate.score)}` : `Not eligible · candidate score not used`}</p>
    <div class="candidate-factors">
      ${FACTOR_ORDER.map((key) => renderStatCell({
        label: FACTOR_LABELS[key],
        value: `+${formatScore(candidate.factors[key].contribution)}`,
        detail: formatFactorValue(candidate, key),
        className: "factor-cell",
        tone: key === "certification" && !eligible ? "danger" : "neutral",
      })).join("")}
    </div>
    ${eligible ? "" : `<p class="constraint-callout"><span aria-hidden="true">×</span> Certification requirement not met. This row remains in the audit trail and cannot be assigned.</p>`}
  </article>`;
}

function renderBreadthOmission(): string {
  return `<aside class="omission-stage breadth-omission" aria-label="Future impact is absent by design">
    <span class="omission-mark" aria-hidden="true">—</span>
    <div><span class="component-label">Future impact</span><strong>Absent by design</strong><p>Later jobs, route chain, promised-window result. Outcomes are replay evidence after ranking.</p></div>
    ${renderBadge({ label: "Not in model", icon: "○", tone: "warning" })}
  </aside>`;
}

function renderBreadthBoard(state: BreadthConsoleState): string {
  const result = state.comparison?.player ?? null;
  const assigned = result !== null;
  const recoveredCards = BREADTH_MACHINE_PREVIEW.baseline.decisions.map((decision, index) => {
    const selectedId = result?.outcomes[index]?.assignedTechnicianId ?? null;
    return `<article class="recovered-visit ${assigned ? "is-placed" : "is-unassigned"}">
      <span class="component-label">Recovered visit ${index + 1}</span>
      <h3>${escapeHtml(JOB_NAMES[decision.inputSnapshot.job.id] ?? decision.inputSnapshot.job.id)}</h3>
      <p>${formatClockMinute(decision.inputSnapshot.job.requestedStartMinute)}–${formatClockMinute(decision.inputSnapshot.job.promisedWindow.endMinute)}</p>
      ${renderBadge({ label: selectedId === null ? "Awaiting release" : `Assigned · ${NAMES[selectedId] ?? selectedId}`, icon: selectedId === null ? "○" : "✓", tone: selectedId === null ? "warning" : "accent" })}
    </article>`;
  }).join("");
  return `<section class="surface breadth-board" aria-labelledby="breadth-board-title">
    <div class="section-heading"><div><p class="eyebrow">12-visit board</p><h2 id="breadth-board-title">Eight pinned. Four recovered.</h2></div><span class="board-note">No pinned visit enters ranking</span></div>
    ${renderPinnedBand(BREADTH_CASE.pinnedVisits)}
    <div class="breadth-roster" aria-label="Five fictional technicians">
      ${BREADTH_ROSTER.map((profile) => renderBreadthLane(profile, result)).join("")}
    </div>
    <section class="recovered-visit-list" aria-labelledby="recovered-visits-title">
      <h3 id="recovered-visits-title">Recovered visit ownership</h3>
      <div>${recoveredCards}</div>
    </section>
  </section>`;
}

function renderPinnedBand(visits: readonly BreadthPinnedVisit[]): string {
  return `<details class="pinned-band">
    <summary><span aria-hidden="true">▣</span><strong>8 pinned visits · unchanged</strong><small>Never re-ranked in either path</small></summary>
    <div class="pinned-grid">
      ${visits.map((visit) => `<article><span class="component-label">Pinned · ${escapeHtml(NAMES[visit.ownerId] ?? visit.ownerId)}</span><strong>${escapeHtml(visit.name)}</strong><small>${formatClockMinute(visit.promisedWindow.startMinute)}–${formatClockMinute(visit.promisedWindow.endMinute)} · in window</small></article>`).join("")}
    </div>
  </details>`;
}

function renderBreadthLane(
  profile: BreadthRosterProfile,
  result: SimulationResult | null,
): string {
  const absent = profile.id === "jordan-kim";
  const assignments = result?.outcomes.filter(
    (outcome) => outcome.assignedTechnicianId === profile.id,
  ) ?? [];
  const status = absent
    ? { label: "Absent · removed before dispatch", icon: "×", tone: "danger" as const }
    : assignments.length > 0
      ? { label: `${assignments.length} recovered visit${assignments.length === 1 ? "" : "s"}`, icon: "✓", tone: "accent" as const }
      : { label: "Pinned work only", icon: "•", tone: "quiet" as const };
  return `<article class="breadth-lane ${absent ? "is-absent" : ""}">
    <header><h3>${escapeHtml(profile.name)}</h3>${renderBadge(status)}</header>
    <strong>${escapeHtml(profile.startingState)}</strong>
    <details><summary>Capability &amp; qualification</summary><p>${escapeHtml(profile.capability)} · ${escapeHtml(profile.qualification)}</p></details>
  </article>`;
}

function renderBreadthOutcome(state: BreadthConsoleState): string {
  const comparison = requireComparison(state);
  const summary = comparison.playerSummary;
  const released = state.choice === "dispatcher-recovery";
  return `<main id="main-content" class="breadth-shell phase-enter phase-breadth-outcome">
    ${renderBreadthSignals(comparison)}
    <section class="breadth-outcome-panel" aria-labelledby="breadth-outcome-title">
      <div class="event-heading"><div><p class="eyebrow">Recovery outcome · concise timeline</p><h1 id="breadth-outcome-title" tabindex="-1">Recovery complete — ${summary.wholeDayInsideWindow} of 12 commitments stayed inside their windows.</h1></div><span class="time-stamp">7:05 AM recovery</span></div>
      <div class="breadth-outcome-callout ${released ? "released" : "minimum-touch"}">
        <strong>${released ? "All four recovered visits stayed inside their windows." : "One fewer technician's morning changed and seven drive minutes were saved."}</strong>
        <span>${released ? "The dispatcher changed all four remaining technicians' mornings. No pinned visit moved." : "The diagnostic visit completed 13 minutes late. No pinned visit moved."}</span>
      </div>
      <div class="recovery-timeline">
        ${comparison.player.decisions.map((decision, index) => renderOutcomeCard(decision, comparison.player, index)).join("")}
      </div>
      <p class="pinned-outcome"><strong>8 pinned visits · unchanged</strong><span>All eight authored pinned visits remained inside their windows in both paths.</span></p>
      <button class="primary-button wide" type="button" data-action="open-breadth-debrief">Open causal debrief</button>
    </section>
    ${renderBreadthBoard(state)}
    ${renderBreadthProvenance()}
  </main>`;
}

function renderOutcomeCard(decision: Decision, result: SimulationResult, index: number): string {
  const outcome = result.outcomes[index];
  if (outcome === undefined || outcome.assignedTechnicianId === null || outcome.completionMinute === null) return "";
  const selected = requireCandidate(decision, outcome.assignedTechnicianId);
  const certified = selected.factors.certification.value.missing.length === 0;
  return `<article class="outcome-visit ${outcome.lateByMinutes > 0 ? "is-late" : "is-inside"}">
    <span class="recovery-order">${index + 1}</span>
    <div><h2>${escapeHtml(JOB_NAMES[outcome.eventId] ?? outcome.eventId)}</h2><p>${escapeHtml(NAMES[outcome.assignedTechnicianId] ?? outcome.assignedTechnicianId)}</p></div>
    <dl><div><dt>Certification</dt><dd>${certified ? "Required certification met" : "Missing"}</dd></div><div><dt>Complete</dt><dd>${formatClockMinute(outcome.completionMinute)}</dd></div><div><dt>Window</dt><dd>${outcome.lateByMinutes === 0 ? `${decision.inputSnapshot.job.promisedWindow.endMinute - outcome.completionMinute} min inside` : `${outcome.lateByMinutes} min late`}</dd></div></dl>
  </article>`;
}

function renderBreadthDebrief(state: BreadthConsoleState): string {
  const comparison = requireComparison(state);
  const player = comparison.playerSummary;
  const baseline = comparison.baselineSummary;
  const released = state.choice === "dispatcher-recovery";
  const finalTeaching = released
    ? "The machine was better at breadth and consistency: every current candidate, every time, under the same rules. You supplied release authority. Approving sound machine work is supervision, not spectatorship."
    : "Your alternative achieved its stated goal. The cost was one late commitment. The machine did not foresee that result; it consistently re-ranked the current board and selected Marcus on the pivotal row.";
  const causal = released
    ? "At the second recovered visit, the dispatcher selected Marcus even though Elena was seven minutes closer. Elena's first recovery had changed her current wait to 38 minutes and her assigned load to 228/480. Rechecking all four technicians kept the diagnostic visit 18 minutes inside its window. The dispatcher did not predict a future job; it used the current board in front of it."
    : "At the second recovered visit, you kept the diagnostic with Elena. That saved seven drive minutes and left Marcus's morning unchanged. Elena was still working through the first recovery, so the diagnostic completed at 11:43—13 minutes outside its promised window. No certification rule was broken and no pinned visit moved.";
  return `<main id="main-content" class="breadth-shell phase-enter phase-breadth-debrief">
    <section class="debrief-panel breadth-debrief-panel" aria-labelledby="breadth-debrief-title">
      <div class="ledger-heading"><div><p class="eyebrow">Causal debrief · branch ledger</p><h1 id="breadth-debrief-title" tabindex="-1">7:05 AM · Sick-day recovery</h1></div><span class="not-score">No overall score</span></div>
      <p class="debrief-position">${released ? "You released the dispatcher-ranked assignments." : "You kept both flexible visits with Elena."}</p>
      ${renderBreadthLedger(player, baseline, released ? "Your released recovery" : "Your minimum-touch recovery")}
      ${released ? renderReleasedCounterfactual() : ""}
      <div class="causal-summary"><strong>The only branch difference</strong><span>${escapeHtml(causal)}</span></div>
      <blockquote class="breadth-central-sentence">The dispatcher did not foresee the day. It re-evaluated every technician after each assignment and applied the same rules every time. Your job was to decide whether that evidence was sufficient to release the recovery—not to repair each row yourself.</blockquote>
      <p class="breadth-teaching">${escapeHtml(finalTeaching)}</p>
      <div class="debrief-actions"><button class="secondary-button" type="button" data-action="open-breadth-trace">Open engineering trace</button><button class="primary-button" type="button" data-action="restart-breadth">Restart authored case</button></div>
    </section>
    ${renderBreadthProvenance()}
  </main>`;
}

function renderBreadthLedger(
  player: BreadthRecoverySummary,
  baseline: BreadthRecoverySummary,
  playerLabel: string,
): string {
  const rows: readonly (readonly [string, string, string])[] = [
    ["Pinned visits moved", String(player.pinnedVisitsMoved), String(baseline.pinnedVisitsMoved)],
    ["Recovered visits certified", `${player.recoveredVisitsCertified} of 4`, `${baseline.recoveredVisitsCertified} of 4`],
    ["Recovered visits inside window", `${player.recoveredVisitsInsideWindow} of 4`, `${baseline.recoveredVisitsInsideWindow} of 4`],
    ["Whole day inside window", `${player.wholeDayInsideWindow} of 12`, `${baseline.wholeDayInsideWindow} of 12`],
    ["Added travel", `${player.addedTravelMinutes} min`, `${baseline.addedTravelMinutes} min`],
    ["Working technicians touched", String(player.workingTechniciansTouched), String(baseline.workingTechniciansTouched)],
  ];
  return `<section class="comparison-ledger breadth-ledger" aria-label="Recovery branch ledger">
    <h2>Recovery branch ledger</h2>
    <div class="comparison-row comparison-head"><span>Measure</span><strong>${escapeHtml(playerLabel)}</strong><strong>Untouched AI-only recovery</strong></div>
    ${rows.map(([measure, playerValue, baselineValue]) => `<div class="comparison-row"><span>${escapeHtml(measure)}</span><strong>${escapeHtml(playerValue)}</strong><strong>${escapeHtml(baselineValue)}</strong></div>`).join("")}
  </section>`;
}

function renderReleasedCounterfactual(): string {
  return `<section class="breadth-counterfactual" aria-labelledby="counterfactual-title">
    <h2 id="counterfactual-title">If flexible visits stayed with Elena</h2>
    <dl><div><dt>Added travel</dt><dd>−7 min</dd></div><div><dt>Working technicians touched</dt><dd>−1</dd></div><div><dt>Diagnostic completion</dt><dd>+31 min later</dd></div><div><dt>Promised-window result</dt><dd>13 min late</dd></div></dl>
  </section>`;
}

function renderBreadthTrace(state: BreadthConsoleState): string {
  const comparison = requireComparison(state);
  const candidateRows = comparison.player.decisions.reduce(
    (total, decision) => total + decision.ranking.length,
    0,
  );
  return `<main id="main-content" class="trace-shell phase-enter phase-breadth-trace">
    <header class="trace-heading"><div><p class="eyebrow">Reading depth four · reproducible trace</p><h1 tabindex="-1">Breadth recovery trace</h1></div><button class="secondary-button" type="button" data-action="close-breadth-trace">Back to debrief</button></header>
    <p class="trace-intro">This trace exposes the versioned initial board, four fixed recovered visits, ${candidateRows} candidate evidence rows, one authored eligible override when selected, serial state transitions, outcomes, pinned manifest, and matched branch fingerprints.</p>
    <dl class="trace-facts">
      <div><dt>Case version</dt><dd><code>${escapeHtml(comparison.caseVersion)}</code></dd></div>
      <div><dt>Seed</dt><dd><code>${escapeHtml(String(comparison.player.seed))}</code></dd></div>
      <div><dt>Candidate evidence</dt><dd>${candidateRows} rows · 4 current decisions</dd></div>
      <div><dt>Player choice</dt><dd><code>${escapeHtml(comparison.choice)}</code></dd></div>
      <div><dt>Case fingerprint</dt><dd><code>${escapeHtml(comparison.caseFingerprint)}</code></dd></div>
      <div><dt>Comparison fingerprint</dt><dd><code>${escapeHtml(comparison.comparisonFingerprint)}</code></dd></div>
      <div><dt>Exogenous fingerprint</dt><dd><code>${escapeHtml(comparison.exogenousFingerprint)}</code></dd></div>
      <div><dt>Replay path</dt><dd><code>runBreadthComparison(BREADTH_CASE, "${escapeHtml(comparison.choice)}")</code></dd></div>
    </dl>
    <div class="trace-grid">
      ${renderJsonPanel("Validated eight-visit pinned manifest", comparison.pinnedVisits)}
      ${renderJsonPanel("Initial four-technician board", comparison.player.decisions[0]?.inputSnapshot.boardState ?? null)}
      ${renderJsonPanel("Four fixed recovered visits", comparison.player.exogenousEvents)}
      ${renderJsonPanel("Player decision evidence — 16 candidate rows", comparison.player.decisions)}
      ${renderJsonPanel("Player serial transitions and outcomes", comparison.player.transitions)}
      ${renderJsonPanel("Untouched AI-only recovery", comparison.baseline)}
    </div>
    <nav class="source-links" aria-label="Breadth source and tests"><a href="https://github.com/connectwithclayton/windward/blob/main/src/breadth.ts">Open Breadth evidence source</a><a href="https://github.com/connectwithclayton/windward/blob/main/test/breadth.test.mjs">Open Breadth replay tests</a><a href="https://github.com/connectwithclayton/windward/blob/main/src/dispatch.ts">Open dispatch engine source</a></nav>
    ${renderBreadthProvenance()}
  </main>`;
}

function renderJsonPanel(title: string, value: unknown): string {
  return `<details class="json-panel"><summary>${escapeHtml(title)}</summary><pre><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></pre></details>`;
}

function renderBreadthProvenance(): string {
  return `<footer class="provenance"><strong>Focused simulation, fictional data.</strong> The people, jobs, locations, times, skills, certifications, windows, and impacts are authored inputs. Windward uses a deliberately myopic simulated dispatcher; it does not show how any real vendor model behaves. This independent portfolio project is not affiliated with, endorsed by, or built for any company.</footer>`;
}

function requireComparison(state: BreadthConsoleState): BreadthComparison {
  if (state.comparison === null) throw new Error("Breadth phase requires a paired comparison");
  return state.comparison;
}

function requireCandidate(decision: Decision, technicianId: TechnicianId): CandidateEvidence {
  const candidate = decision.ranking.find((entry) => entry.technicianId === technicianId);
  if (candidate === undefined) throw new Error(`Missing Breadth candidate ${technicianId}`);
  return candidate;
}

function formatFactorValue(candidate: CandidateEvidence, key: keyof FactorBreakdown): string {
  if (key === "travelTime") return `${candidate.factors.travelTime.value.minutes} min`;
  if (key === "skillMatch") {
    const value = candidate.factors.skillMatch.value;
    return `${value.matched.length}/${value.matched.length + value.missing.length} skills`;
  }
  if (key === "certification") {
    return candidate.factors.certification.value.missing.length === 0
      ? "Required certification met"
      : `Missing ${candidate.factors.certification.value.missing.join(", ")}`;
  }
  if (key === "availability") {
    const wait = candidate.factors.availability.value.waitMinutes;
    return wait === 0 ? "No wait" : `${wait} min wait`;
  }
  if (key === "revenueFit") return "Full revenue fit";
  const value = candidate.factors.utilisation.value;
  return `${value.assignedMinutes}/${value.capacityMinutes} min`;
}

function formatScore(value: number): string {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
