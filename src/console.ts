import {
  INITIAL_COVERAGE,
  EVENT_ONE_DECISION,
  EVENT_ONE_GRAMMAR,
  closeTrace,
  continueToEmergency,
  continueToActiveShift,
  createInitialConsoleState,
  getCoverageDecision,
  openCoverageDecision,
  openDebrief,
  openTrace,
  recordCoverageChoice,
  recordRouteChoice,
  startShift,
  tick,
  togglePause,
  type ConsoleState,
} from "./console/runtime.js";
import { formatClockMinute, formatMoney } from "./console/decision-model.js";
import { buildDecisionGrammar } from "./console/decision-model.js";
import { computeCoverage } from "./index.js";
import {
  EMERGENCY_COVERAGE_REQUIREMENT,
  EVENT_ONE_SCENARIO,
  ROSTER,
} from "./console/scenario.js";

const app = requireElement<HTMLElement>("#app");
const clock = requireElement<HTMLElement>("#shift-clock");
const pauseButton = requireElement<HTMLButtonElement>("#pause-button");
const restartButton = requireElement<HTMLButtonElement>("#restart-button");

let state = createInitialConsoleState();

function render(): void {
  app.innerHTML = state.phase === "trace" ? renderTrace(state) : renderConsole(state);
  updateHeader();
}

function renderConsole(current: ConsoleState): string {
  if (current.phase === "briefing") {
    return renderBriefing(current);
  }
  if (current.phase === "debrief") return renderDebrief(current);
  if (current.phase === "emergency") return renderEmergency(current);

  const hasRouteDecision = current.phase === "route-decision" || current.phase === "route-receipt";
  const hasCoverageDecision = current.phase === "coverage-decision" || current.phase === "coverage-receipt";
  const decisionFirst = hasRouteDecision
    ? `<section class="decision-shell" aria-labelledby="decision-title">${renderDecision(current)}</section>`
    : hasCoverageDecision
      ? `<section class="decision-shell" aria-labelledby="coverage-title">${renderCoverageDecision(current)}</section>`
      : "";
  const completion = current.phase === "observation" ? renderObservation() : "";

  return `
    <main id="main-content" class="console-shell">
      ${renderSignals(current)}
      ${current.paused ? `<p class="paused-notice" role="status">Shift paused. Resume or restart to continue.</p>` : ""}
      <div class="workspace ${hasRouteDecision || hasCoverageDecision ? "has-decision" : ""}">
        <div class="board-column">
          ${renderBoard(current)}
          ${renderEventLog(current)}
        </div>
        ${decisionFirst}
      </div>
      ${completion}
      ${renderProvenance()}
    </main>`;
}

function renderBriefing(current: ConsoleState): string {
  return `
    <main id="main-content" class="briefing-stage">
      <div class="console-shell frozen-board" aria-hidden="true">
        ${renderSignals(current)}
        ${renderBoard(current)}
      </div>
      <div class="briefing-scrim">
        <section class="briefing-card" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
          <p class="eyebrow">Morning dispatch · Central Florida</p>
          <h1 id="briefing-title" tabindex="-1">You supervise an AI dispatcher.</h1>
          <p class="briefing-copy">The dispatcher schedules five technicians one job at a time. Compare what it chose with what it ranked second, then choose <strong>Keep</strong> or <strong>Override</strong>.</p>
          <p class="safe-copy"><span aria-hidden="true">✓</span> The first decision is frozen. There is no time pressure and no penalty. The 90-second clock starts only after you finish reviewing that decision.</p>
          <button class="primary-button wide" type="button" data-action="start">Start 90-second shift</button>
          ${renderProvenance()}
        </section>
      </div>
    </main>`;
}

function renderSignals(current: ConsoleState): string {
  const coverage = current.coverage;
  const coverageMaximum = Math.max(INITIAL_COVERAGE.availableQualifiedCount, coverage, 1);
  const coveragePercent = Math.max(0, Math.min(100, (coverage / coverageMaximum) * 100));
  return `
    <section class="signals" aria-label="Persistent operational signals">
      <article class="signal context-signal">
        <span class="signal-mark" aria-hidden="true">☀</span>
        <div><span class="signal-label">Context</span><strong>Extreme heat advisory · no-cool calls usually rise after lunch</strong></div>
      </article>
      <article class="signal coverage-signal" role="meter" aria-label="Emergency coverage after 2 PM" aria-valuemin="0" aria-valuemax="${coverageMaximum}" aria-valuenow="${coverage}" aria-valuetext="${coverage} technician">
        <span class="signal-mark" aria-hidden="true">${coverage}</span>
        <div><span class="signal-label">Coverage</span><strong>Emergency coverage after 2 PM: ${coverage} tech</strong></div>
        <span class="coverage-track" aria-hidden="true"><span class="coverage-fill" style="width: ${coveragePercent}%;"></span></span>
      </article>
    </section>`;
}

function renderBoard(current: ConsoleState): string {
  const excluded = new Set(EVENT_ONE_GRAMMAR.hardConstraints.map((entry) => entry.technicianId));
  const activeId = current.assignedTechnicianId ??
    (current.phase === "route-decision" ? EVENT_ONE_GRAMMAR.chosen.technicianId : null);
  const lanes = ROSTER.map((profile) => {
    const isExcluded = excluded.has(profile.id) &&
      (current.phase === "route-decision" || current.phase === "route-receipt");
    const isActive = profile.id === activeId;
    return `
      <article class="technician-lane ${isActive ? "is-active" : ""} ${isExcluded ? "is-excluded" : ""}">
        <header>
          <span class="lane-state" aria-hidden="true">${isExcluded ? "×" : isActive ? "→" : "•"}</span>
          <div><h3>${escapeHtml(profile.name)}</h3><p>${escapeHtml(profile.homeArea)}</p></div>
        </header>
        <p class="status-label">${isExcluded ? "Excluded by hard rule" : isActive ? "Current route choice" : "Available as listed"}</p>
        <dl>
          <div><dt>Primary work</dt><dd>${escapeHtml(profile.primarySkill)}</dd></div>
          <div><dt>Qualification</dt><dd>${escapeHtml(profile.qualification)}</dd></div>
          <div><dt>Today</dt><dd>${escapeHtml(profile.availability)}</dd></div>
        </dl>
      </article>`;
  }).join("");

  return `
    <section class="board-panel" aria-labelledby="board-title">
      <div class="section-heading">
        <div><p class="eyebrow">Schedule board</p><h2 id="board-title">Five fictional technicians</h2></div>
        <span class="board-note">${current.phase === "briefing" ? "Frozen for orientation" : "Decision-relevant work"}</span>
      </div>
      <div class="technician-grid">${lanes}</div>
    </section>`;
}

function renderDecision(current: ConsoleState): string {
  const recorded = current.phase === "route-receipt";
  const exclusion = EVENT_ONE_GRAMMAR.hardConstraints[0];
  const selectedId = current.assignedTechnicianId;
  const selectedName = selectedId === EVENT_ONE_GRAMMAR.second.technicianId
    ? EVENT_ONE_GRAMMAR.second.name
    : EVENT_ONE_GRAMMAR.chosen.name;
  const confirmation = recorded
    ? `<div class="recorded" id="decision-confirmation" role="status" tabindex="-1">
        <strong>${current.routeChoice === "override" ? "Override recorded" : "Keep recorded"} — ${escapeHtml(selectedName)} assigned.</strong>
        <span>The route and event log changed immediately.</span>
      </div>`
    : "";

  return `
    <header class="decision-header">
      <p class="eyebrow">Event 1 · Guided route cascade</p>
      <h1 id="decision-title" tabindex="-1">Who should take the new repair?</h1>
      <span class="frozen-label"><span aria-hidden="true">❚❚</span> Frozen · no pressure · no penalty</span>
    </header>
    <div class="decision-content">
      ${current.phase === "route-decision" || current.phase === "route-receipt" ? renderRouteMap(current) : ""}
      ${renderSharedDecisionGrammar({
        chosen: {
          rankLabel: "Dispatcher chose",
          title: EVENT_ONE_GRAMMAR.chosen.name,
          minutes: `${EVENT_ONE_GRAMMAR.chosen.travelMinutes} min to job · ${EVENT_ONE_GRAMMAR.chosen.totalImmediateMinutes} min total`,
          dollars: `${formatMoney(EVENT_ONE_GRAMMAR.chosen.revenueCents)} job value`,
        },
        second: {
          rankLabel: "Ranked second",
          title: EVENT_ONE_GRAMMAR.second.name,
          minutes: `${EVENT_ONE_GRAMMAR.second.travelMinutes} min to job · ${EVENT_ONE_GRAMMAR.second.totalImmediateMinutes} min total`,
          dollars: `${formatMoney(EVENT_ONE_GRAMMAR.second.revenueCents)} job value`,
        },
        keepLabel: EVENT_ONE_GRAMMAR.keepLabel,
        overrideLabel: EVENT_ONE_GRAMMAR.overrideLabel,
        keepAction: "keep",
        overrideAction: "override",
        disabled: recorded,
      })}
      ${exclusion === undefined ? "" : `
        <p class="constraint-callout"><span aria-hidden="true">×</span> <strong>Hard constraint:</strong> ${escapeHtml(exclusion.name)} was correctly excluded — ${escapeHtml(exclusion.plainReason.toLowerCase())}.</p>`}
      ${confirmation}
      ${recorded ? `<button class="primary-button wide continue-button" type="button" data-action="continue">Continue to active shift</button>` : ""}
      ${renderWhyDrawer()}
    </div>`;
}

interface SharedChoiceView {
  readonly rankLabel: string;
  readonly title: string;
  readonly minutes: string;
  readonly dollars: string;
}

interface SharedDecisionView {
  readonly chosen: SharedChoiceView;
  readonly second: SharedChoiceView;
  readonly keepLabel: string;
  readonly overrideLabel: string;
  readonly keepAction: string;
  readonly overrideAction: string;
  readonly disabled: boolean;
}

function renderSharedDecisionGrammar(view: SharedDecisionView): string {
  return `<div class="choice-grid">
      ${renderChoice(view.chosen, "dispatcher")}
      ${renderChoice(view.second, "second")}
    </div>
    <div class="decision-actions" aria-label="Decision actions">
      <button class="secondary-button" type="button" data-action="${escapeHtml(view.keepAction)}" ${view.disabled ? "disabled" : ""}>${escapeHtml(view.keepLabel)}</button>
      <button class="primary-button" type="button" data-action="${escapeHtml(view.overrideAction)}" ${view.disabled ? "disabled" : ""}>${escapeHtml(view.overrideLabel)}</button>
    </div>`;
}

function renderChoice(choice: SharedChoiceView, variant: string): string {
  return `
    <article class="choice-card ${variant}">
      <span class="choice-rank">${escapeHtml(choice.rankLabel)}</span>
      <h2>${escapeHtml(choice.title)}</h2>
      <dl class="costs">
        <div><dt>Minutes</dt><dd>${escapeHtml(choice.minutes)}</dd></div>
        <div><dt>Dollars</dt><dd>${escapeHtml(choice.dollars)}</dd></div>
      </dl>
    </article>`;
}

function renderRouteMap(current: ConsoleState): string {
  const consequence = EVENT_ONE_GRAMMAR.omittedConsequence;
  if (consequence === null) return "";
  const overrideSelected = current.assignedTechnicianId === EVENT_ONE_GRAMMAR.second.technicianId;
  const keepSelected = current.assignedTechnicianId === EVENT_ONE_GRAMMAR.chosen.technicianId;
  const laterSaved = EVENT_ONE_GRAMMAR.laterMinutesSavedByOverride ?? 0;
  const caption = overrideSelected
    ? `Route updated: ${EVENT_ONE_GRAMMAR.second.name} takes the direct assignment and saves ${laterSaved} minutes of later driving.`
    : keepSelected
      ? `Route kept: ${EVENT_ONE_GRAMMAR.chosen.name} crosses the same area twice before a later booking ${consequence.laterBookingDistanceMiles} miles east.`
      : `Dashed route: dispatcher pick, ${EVENT_ONE_GRAMMAR.chosen.name}. Solid route: second-ranked ${EVENT_ONE_GRAMMAR.second.name}.`;
  return `
    <figure class="route-map">
      <svg viewBox="0 0 620 300" role="img" aria-labelledby="route-title route-description">
        <title id="route-title">Route comparison for ${escapeHtml(EVENT_ONE_GRAMMAR.chosen.name)} and ${escapeHtml(EVENT_ONE_GRAMMAR.second.name)}</title>
        <desc id="route-description">The dispatcher route crosses the work area twice before a ${formatClockMinute(consequence.laterBookingMinute)} booking ${consequence.laterBookingDistanceMiles} miles east. The alternative route saves ${laterSaved} later minutes.</desc>
        <rect width="620" height="300" class="map-ground"></rect>
        <path class="road major" d="M36 226 C145 150 242 250 354 160 S505 105 590 52"></path>
        <path class="road minor" d="M90 42 C164 112 235 119 350 99"></path>
        <path class="road minor" d="M276 272 C300 208 337 171 420 142"></path>
        <path class="route maya ${overrideSelected ? "dimmed" : ""}" d="M102 70 C170 104 250 132 337 163 C259 195 184 169 132 130 C251 110 414 118 560 60"></path>
        <path class="route luis ${keepSelected ? "dimmed" : ""}" d="M52 262 C124 222 221 190 337 163"></path>
        <g class="map-pin"><circle cx="102" cy="70" r="10"></circle><text x="118" y="64">Maya now</text></g>
        <g class="map-pin"><circle cx="52" cy="262" r="10"></circle><text x="68" y="280">Luis now</text></g>
        <g class="job-pin"><circle cx="337" cy="163" r="11"></circle><text x="353" y="186">New repair</text></g>
        <g class="later-pin"><circle cx="560" cy="60" r="11"></circle><text x="345" y="31">${formatClockMinute(consequence.laterBookingMinute)} booking · ${consequence.laterBookingDistanceMiles} miles east</text></g>
        <g class="route-cost-label maya-cost"><rect x="166" y="74" width="201" height="31" rx="15"></rect><text x="180" y="95">+${consequence.laterDriveMinutes} min · crosses area twice</text></g>
        <g class="route-cost-label luis-cost"><rect x="105" y="225" width="145" height="31" rx="15"></rect><text x="121" y="246">saves ${laterSaved} min later</text></g>
      </svg>
      <figcaption aria-live="polite">${escapeHtml(caption)}</figcaption>
    </figure>`;
}

function renderWhyDrawer(): string {
  const consequence = EVENT_ONE_GRAMMAR.omittedConsequence;
  const exclusionItems = EVENT_ONE_GRAMMAR.hardConstraints.map((entry) => `
    <article class="why-block hard-rule">
      <h3>${escapeHtml(entry.name)} · correctly excluded</h3>
      <p>${escapeHtml(entry.plainReason)}.</p>
      <dl class="detail-pairs">
        <div><dt>Job requires</dt><dd>${escapeHtml(entry.requiredDetail)}</dd></div>
        <div><dt>Technician has</dt><dd>${escapeHtml(entry.technicianDetail)}</dd></div>
        <div><dt>Engine reason</dt><dd><code>${escapeHtml(entry.reasonCode)}</code></dd></div>
      </dl>
    </article>`).join("");
  return `
    <details class="why-drawer">
      <summary>Why the dispatcher chose ${escapeHtml(EVENT_ONE_GRAMMAR.chosen.name)}</summary>
      <div class="why-content">
        <article class="why-block">
          <h3>Immediate reasons</h3>
          <ul>${EVENT_ONE_GRAMMAR.immediateReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
        </article>
        <article class="why-block">
          <h3>Second-ranked eligible alternative</h3>
          <p>${escapeHtml(EVENT_ONE_GRAMMAR.second.name)} was rank ${EVENT_ONE_GRAMMAR.second.rank}. The engine kept this option eligible.</p>
        </article>
        <article class="why-block">
          <h3>Immediate counterfactual</h3>
          <p>Assigning ${escapeHtml(EVENT_ONE_GRAMMAR.second.name)} adds ${EVENT_ONE_GRAMMAR.immediateMinuteDifference} immediate minutes and changes immediate revenue by ${formatMoney(EVENT_ONE_GRAMMAR.immediateRevenueDifferenceCents)}.</p>
        </article>
        <section class="why-section" aria-labelledby="constraints-title">
          <h3 id="constraints-title">Explicit hard-constraint exclusions</h3>
          ${exclusionItems}
        </section>
        ${consequence === null ? "" : `
          <article class="why-block omitted">
            <h3>Downstream consequence the policy did not use</h3>
            <p>${escapeHtml(EVENT_ONE_GRAMMAR.chosen.name)} has a ${formatClockMinute(consequence.laterBookingMinute)} booking ${consequence.laterBookingDistanceMiles} miles east. This route adds ${consequence.laterDriveMinutes} minutes of later driving${consequence.crossesSameAreaTwice ? " and crosses the same area twice" : ""}.</p>
            <p class="policy-note">This evidence is returned by the engine for supervision. It is not a scoring factor: the simulated dispatcher has no lookahead.</p>
          </article>`}
      </div>
    </details>`;
}

function renderEventLog(current: ConsoleState): string {
  const entries = current.eventLog.length === 0
    ? "<li>No decisions recorded yet.</li>"
    : current.eventLog.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  return `
    <aside class="event-log" aria-labelledby="event-log-title">
      <h2 id="event-log-title">Event log</h2>
      <ol aria-live="polite">${entries}</ol>
    </aside>`;
}

function renderObservation(): string {
  return `
    <section class="shift-handoff" aria-labelledby="shift-active-title">
      <div>
        <p class="eyebrow">Before the next booking</p>
        <h2 id="shift-active-title">The board is live.</h2>
        <p>The route map is gone. Review the heat context and remaining emergency coverage before the next job arrives.</p>
      </div>
      <button class="primary-button" type="button" data-action="open-coverage">Continue shift</button>
    </section>`;
}

function renderCoverageDecision(current: ConsoleState): string {
  const decision = getCoverageDecision(current);
  const evidence = buildDecisionGrammar(
    decision,
    Object.fromEntries(ROSTER.map((profile) => [profile.id, profile.name])),
  );
  const transition = (current.result?.transitions ?? [])[1];
  if (transition === undefined) return "";
  const coverageBefore = computeCoverage(
    transition.beforeBoard,
    EMERGENCY_COVERAGE_REQUIREMENT,
  ).availableQualifiedCount;
  const coverageAfterKeep = computeCoverage(
    transition.afterBoard,
    EMERGENCY_COVERAGE_REQUIREMENT,
  ).availableQualifiedCount;
  const revenueCents = decision.winner.immediateDeltas.revenueCents;
  const recorded = current.phase === "coverage-receipt";
  const confirmation = recorded
    ? `<div class="recorded" id="decision-confirmation" role="status" tabindex="-1">
        <strong>${current.coverageChoice === "hold" ? "Override recorded — window held open." : "Keep recorded — maintenance job accepted."}</strong>
        <span>Emergency coverage is now ${current.coverage} tech. The meter and event log updated immediately.</span>
      </div>`
    : "";
  return `
    <header class="decision-header">
      <p class="eyebrow">Event 2 · Live coverage tradeoff</p>
      <h1 id="coverage-title" tabindex="-1">Use the last qualified afternoon window?</h1>
    </header>
    <div class="decision-content">
      <p class="decision-lede">The maintenance job has positive immediate value. Accepting it changes emergency coverage from ${coverageBefore} to ${coverageAfterKeep}.</p>
      ${renderSharedDecisionGrammar({
        chosen: {
          rankLabel: "Dispatcher chose · Keep",
          title: "Accept maintenance job",
          minutes: `${decision.winner.immediateDeltas.timeMinutes} assignment min · emergency coverage ${coverageAfterKeep}`,
          dollars: `+${formatMoney(revenueCents)} scheduled revenue`,
        },
        second: {
          rankLabel: "Override alternative",
          title: "Hold window open",
          minutes: `0 assignment min · emergency coverage ${coverageBefore}`,
          dollars: `${formatMoney(revenueCents)} at risk`,
        },
        keepLabel: "Keep · Accept maintenance job",
        overrideLabel: "Override · Hold window open",
        keepAction: "accept-coverage",
        overrideAction: "hold-coverage",
        disabled: recorded,
      })}
      ${confirmation}
      ${recorded ? `<button class="primary-button wide continue-button" type="button" data-action="continue-emergency">Continue to 2:03 PM emergency</button>` : ""}
      <details class="why-drawer">
        <summary>Why the dispatcher preferred the maintenance job</summary>
        <div class="why-content">
          <article class="why-block"><h3>Immediate reasons</h3><ul>${evidence.immediateReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}<li>${formatMoney(revenueCents)} of immediate scheduled revenue</li></ul></article>
          <article class="why-block"><h3>Second alternative</h3><p>Holding the window adds 0 assignment minutes and leaves ${formatMoney(revenueCents)} at risk.</p></article>
          <article class="why-block"><h3>Immediate counterfactual</h3><p>Keep schedules ${formatMoney(revenueCents)} now. Override schedules ${formatMoney(0)} now.</p></article>
          <article class="why-block hard-rule"><h3>Explicit hard constraints</h3><p>${evidence.hardConstraints.map((entry) => `${escapeHtml(entry.name)}: ${escapeHtml(entry.plainReason.toLowerCase())} (${escapeHtml(entry.reasonCode)})`).join("; ") || "No hard-constraint exclusions."}</p></article>
          <article class="why-block omitted"><h3>Downstream consequence the policy did not use</h3><p>Assigning the job changes qualified emergency coverage after 2 PM from ${coverageBefore} to ${coverageAfterKeep}. Coverage is descriptive engine evidence and never a ranking factor.</p></article>
        </div>
      </details>
    </div>`;
}

function renderEmergency(current: ConsoleState): string {
  const outcome = current.result?.outcomes[2];
  const maintenance = current.result?.outcomes[1];
  const maintenanceDecision = current.result?.decisions[1];
  if (outcome === undefined || maintenance === undefined || maintenanceDecision === undefined) return "";
  const covered = outcome.serviceOutcomeCode === "COMPLETED_IN_WINDOW";
  const maintenanceRevenue = maintenanceDecision.winner.immediateDeltas.revenueCents;
  const safetyImpact = covered
    ? "Safety impact: same-day service reduces how long residents remain exposed to dangerous indoor heat."
    : "Safety impact: residents remain without cooling until tomorrow, extending exposure to dangerous indoor heat.";
  const serviceImpact = covered
    ? "Service level: the no-cool emergency receives same-day service."
    : "Service level: the no-cool call moves to tomorrow.";
  return `<main id="main-content" class="console-shell">
    ${renderSignals(current)}
    ${renderBoard(current)}
    <section class="emergency-panel ${covered ? "covered" : "deferred"}" aria-labelledby="emergency-title">
      <div class="event-heading"><div><p class="eyebrow">Event 3 · Emergency</p><h1 id="emergency-title" tabindex="-1">No-cool call arrives</h1></div><span class="time-stamp">2:03 PM</span></div>
      <div class="outcome-first"><h2>${covered ? "Same-day emergency coverage is available." : "Emergency coverage is zero."}</h2><p>${safetyImpact}</p><p>${serviceImpact}</p></div>
      <div class="revenue-second"><strong>Revenue consequence · secondary</strong><p>${covered ? `The ${formatMoney(maintenanceRevenue)} tune-up was deferred. The emergency is completed today for +${formatMoney(outcome.immediateDeltas.revenueCents)}.` : `The +${formatMoney(maintenanceRevenue)} maintenance job remains scheduled. Emergency revenue moves with the call to tomorrow.`}</p></div>
      ${renderEventLog(current)}
      <button class="primary-button wide" type="button" data-action="open-debrief">Open causal debrief</button>
    </section>
    ${renderProvenance()}
  </main>`;
}

function renderDebrief(current: ConsoleState): string {
  const comparison = current.comparison;
  if (comparison === null) return "";
  const playerMaintenance = comparison.player.outcomes[1];
  const playerEmergency = comparison.player.outcomes[2];
  const baselineEmergency = comparison.baseline.outcomes[2];
  if (playerMaintenance === undefined || playerEmergency === undefined || baselineEmergency === undefined) return "";
  const held = playerMaintenance.serviceOutcomeCode === "DECLINED";
  const maintenanceRevenue = comparison.baseline.outcomes[1]?.immediateDeltas.revenueCents ?? 0;
  const emergencyRevenue = playerEmergency.immediateDeltas.revenueCents;
  const netCents = held ? emergencyRevenue - maintenanceRevenue : 0;
  const satisfactionDifference = playerEmergency.satisfactionDelta - baselineEmergency.satisfactionDelta;
  return `<main id="main-content" class="console-shell">
    <section class="debrief-panel" aria-labelledby="debrief-title">
      <div class="ledger-heading"><div><p class="eyebrow">Causal debrief · branch ledger</p><h1 id="debrief-title" tabindex="-1">What changed, and why</h1></div><span class="not-score">No overall score</span></div>
      <p class="trace-intro">Your day is compared with the untouched AI-only day. Both branches use the same seed, arrivals, durations, travel times, and promised windows.</p>
      <div class="branch-ledger">
        <div class="ledger-row"><div class="ledger-key">2:03 PM · No-cool emergency</div><div class="ledger-value">${held ? "You kept the last qualified afternoon slot open." : "You accepted the tune-up and used the last qualified afternoon slot."}</div></div>
        ${held ? `
          <div class="ledger-row"><div class="ledger-key">Revenue</div><div class="ledger-value">Deferred tune-up: −${formatMoney(maintenanceRevenue)}<br>Emergency completed today: +${formatMoney(emergencyRevenue)}</div></div>
          <div class="ledger-row"><div class="ledger-key">Customer outcome</div><div class="ledger-value">+${satisfactionDifference} satisfaction · one same-day emergency</div></div>
          <div class="ledger-row net-difference"><div class="ledger-key">Compared with AI-only day</div><div class="ledger-value">Net difference from AI-only day: +${formatMoney(netCents)} and one same-day emergency</div></div>` : `
          <div class="ledger-row"><div class="ledger-key">Service level</div><div class="ledger-value">The 2:03 PM no-cool call moved to tomorrow.</div></div>
          <div class="ledger-row"><div class="ledger-key">Revenue</div><div class="ledger-value">+${formatMoney(maintenanceRevenue)} maintenance scheduled · emergency revenue deferred</div></div>
          <div class="ledger-row net-difference"><div class="ledger-key">Compared with AI-only day</div><div class="ledger-value">This matches the AI-only emergency-coverage outcome.</div></div>`}
      </div>
      <div class="causal-summary"><strong>The earlier decision that caused this outcome</strong><span>${held ? "At 11:40 AM you held the last qualified afternoon window open. That decision covered the 2:03 PM emergency." : "At 11:40 AM, accepting the tune-up reduced emergency coverage from 1 to 0. The 2:03 PM no-cool call moved to tomorrow."}</span></div>
      <div class="separate-measures">
        <div><span>Revenue</span><strong>${held ? `+${formatMoney(netCents)} vs AI-only` : "Matches AI-only"}</strong></div>
        <div><span>Drive time</span><strong>${current.routeChoice === "override" ? `${EVENT_ONE_GRAMMAR.laterMinutesSavedByOverride ?? 0} min saved later` : `${EVENT_ONE_GRAMMAR.omittedConsequence?.laterDriveMinutes ?? 0} min added later`}</strong></div>
        <div><span>Same-day completion</span><strong>${held ? "Emergency completed today" : "Emergency moved to tomorrow"}</strong></div>
        <div><span>Customer outcome</span><strong>${held ? `+${satisfactionDifference} satisfaction` : "No same-day emergency service"}</strong></div>
      </div>
      <div class="debrief-actions"><button class="secondary-button" type="button" data-action="trace">Open engineering trace</button><button class="primary-button" type="button" data-action="restart">Restart authored case study</button></div>
    </section>
    ${renderProvenance()}
  </main>`;
}

function renderTrace(current: ConsoleState): string {
  const result = current.comparison?.player ?? current.result;
  if (result === null) return "";
  const decision = result.decisions[0];
  if (decision === undefined) return "";
  const overrides = [
    ...(current.routeChoice === "override"
      ? [{ eventId: "event-1-guided-route", technicianId: EVENT_ONE_GRAMMAR.second.technicianId }]
      : []),
    ...(current.coverageChoice === "hold"
      ? [{ eventId: "event-2-coverage-tradeoff", type: "DECLINE" }]
      : []),
  ];
  return `
    <main id="main-content" class="trace-shell">
      <header class="trace-heading">
        <div><p class="eyebrow">Reading depth four · reproducible trace</p><h1 tabindex="-1">Engineering trace</h1></div>
        <button class="secondary-button" type="button" data-action="close-trace">Back to live board</button>
      </header>
      <p class="trace-intro">This view is separate from the live board. It exposes the exact seeded engine inputs and outputs behind the recorded route decision.</p>
      <dl class="trace-facts">
        <div><dt>Seed</dt><dd><code>${escapeHtml(String(result.seed))}</code></dd></div>
        <div><dt>Decision IDs</dt><dd><code>${escapeHtml(result.decisions.map((entry) => entry.decisionId).join(" · "))}</code></dd></div>
        <div><dt>Event IDs</dt><dd><code>${escapeHtml(result.outcomes.map((entry) => entry.eventId).join(" · "))}</code></dd></div>
        <div><dt>Replay path</dt><dd><code>simulateScenario(EVENT_ONE_SCENARIO, ${escapeHtml(JSON.stringify(overrides))})</code></dd></div>
      </dl>
      <div class="trace-grid">
        ${renderJsonPanel("Initial input snapshot", decision.inputSnapshot)}
        ${renderJsonPanel("State transitions", result.transitions)}
        ${renderJsonPanel("Decision JSON", result.decisions)}
        ${renderJsonPanel("Untouched baseline", current.comparison?.baseline ?? null)}
      </div>
      <nav class="source-links" aria-label="Engine source and tests">
        <a href="./src/dispatch.ts">Open dispatch engine source</a>
        <a href="./src/simulation.ts">Open replay source</a>
        <a href="./test/dispatch.test.mjs">Open dispatch tests</a>
        <a href="./test/replay.test.mjs">Open replay tests</a>
      </nav>
      ${renderProvenance()}
    </main>`;
}

function renderJsonPanel(title: string, value: unknown): string {
  return `
    <details class="json-panel">
      <summary>${escapeHtml(title)}</summary>
      <pre><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></pre>
    </details>`;
}

function renderProvenance(): string {
  return `
    <footer class="provenance">
      <strong>Focused simulation, fictional data.</strong> Windward uses a deliberately myopic simulated dispatcher; it does not show how any real vendor model behaves. This independent portfolio project is not affiliated with, endorsed by, or built for any company. It was inspired by a public “AI Operations Strategist” job posting. All companies, technicians, customers, and data are fictional.
    </footer>`;
}

function updateHeader(): void {
  if (!state.timerStarted) {
    clock.textContent = "90 sec · not started";
  } else if (state.phase === "trace") {
    clock.textContent = "Trace · shift held";
  } else if (state.phase === "emergency" || state.phase === "debrief") {
    clock.textContent = "Shift frozen";
  } else {
    clock.textContent = `${state.timerRemaining} sec${state.paused ? " · paused" : " remaining"}`;
  }
  pauseButton.disabled = !["observation", "coverage-decision", "coverage-receipt"].includes(state.phase) || !state.timerStarted;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
}

app.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action === undefined) return;

  if (action === "start") state = startShift(state);
  if (action === "keep") state = recordRouteChoice(state, "keep");
  if (action === "override") state = recordRouteChoice(state, "override");
  if (action === "continue") state = continueToActiveShift(state);
  if (action === "open-coverage") state = openCoverageDecision(state);
  if (action === "accept-coverage") state = recordCoverageChoice(state, "accept");
  if (action === "hold-coverage") state = recordCoverageChoice(state, "hold");
  if (action === "continue-emergency") state = continueToEmergency(state);
  if (action === "open-debrief") state = openDebrief(state);
  if (action === "trace") state = openTrace(state);
  if (action === "close-trace") state = closeTrace(state);
  if (action === "restart") state = createInitialConsoleState();
  render();
  focusCurrent(action);
});

pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  state = createInitialConsoleState();
  render();
  focusCurrent("restart");
});

window.setInterval(() => {
  const next = tick(state);
  if (next !== state) {
    state = next;
    updateHeader();
  }
}, 1_000);

function focusCurrent(action: string): void {
  window.requestAnimationFrame(() => {
    const selector = action === "keep" || action === "override"
      ? "#decision-confirmation"
      : "#main-content h1[tabindex='-1']";
    app.querySelector<HTMLElement>(selector)?.focus();
  });
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
focusCurrent("initial");
