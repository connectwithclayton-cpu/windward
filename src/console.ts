import {
  INITIAL_COVERAGE,
  EVENT_ONE_DECISION,
  EVENT_ONE_GRAMMAR,
  closeTrace,
  continueToActiveShift,
  createInitialConsoleState,
  openTrace,
  recordRouteChoice,
  startShift,
  tick,
  togglePause,
  type ConsoleState,
} from "./console/runtime.js";
import { formatClockMinute, formatMoney } from "./console/decision-model.js";
import { EVENT_ONE_SCENARIO, ROSTER } from "./console/scenario.js";

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
    return renderBriefing();
  }

  const hasRouteDecision = current.phase === "decision" || current.phase === "receipt";
  const decisionFirst = hasRouteDecision
    ? `<section class="decision-shell" aria-labelledby="decision-title">${renderDecision(current)}</section>`
    : "";
  const completion = current.phase === "shift" ? renderShiftHandoff(current) : "";

  return `
    <main id="main-content" class="console-shell">
      ${renderSignals()}
      <div class="workspace ${hasRouteDecision ? "has-decision" : ""}">
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

function renderBriefing(): string {
  return `
    <main id="main-content" class="briefing-stage">
      <div class="console-shell frozen-board" aria-hidden="true">
        ${renderSignals()}
        ${renderBoard(state)}
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

function renderSignals(): string {
  const coverage = INITIAL_COVERAGE.availableQualifiedCount;
  return `
    <section class="signals" aria-label="Persistent operational signals">
      <article class="signal context-signal">
        <span class="signal-mark" aria-hidden="true">☀</span>
        <div><span class="signal-label">Context</span><strong>Extreme heat advisory · no-cool calls usually rise after lunch</strong></div>
      </article>
      <article class="signal coverage-signal" role="meter" aria-label="Emergency coverage after 2 PM" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${coverage}" aria-valuetext="${coverage} technician">
        <span class="signal-mark" aria-hidden="true">${coverage}</span>
        <div><span class="signal-label">Coverage</span><strong>Emergency coverage after 2 PM: ${coverage} tech</strong></div>
        <span class="coverage-track" aria-hidden="true"><span class="coverage-fill"></span></span>
      </article>
    </section>`;
}

function renderBoard(current: ConsoleState): string {
  const excluded = new Set(EVENT_ONE_GRAMMAR.hardConstraints.map((entry) => entry.technicianId));
  const activeId = current.assignedTechnicianId ??
    (current.phase === "decision" ? EVENT_ONE_GRAMMAR.chosen.technicianId : null);
  const lanes = ROSTER.map((profile) => {
    const isExcluded = excluded.has(profile.id) &&
      (current.phase === "decision" || current.phase === "receipt");
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
  const recorded = current.phase === "receipt";
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
      ${renderRouteMap(current)}
      <div class="choice-grid">
        ${renderChoice("Dispatcher chose", EVENT_ONE_GRAMMAR.chosen, "dispatcher")}
        ${renderChoice("Ranked second", EVENT_ONE_GRAMMAR.second, "second")}
      </div>
      ${exclusion === undefined ? "" : `
        <p class="constraint-callout"><span aria-hidden="true">×</span> <strong>Hard constraint:</strong> ${escapeHtml(exclusion.name)} was correctly excluded — ${escapeHtml(exclusion.plainReason.toLowerCase())}.</p>`}
      <div class="decision-actions" aria-label="Route decision actions">
        <button class="secondary-button" type="button" data-action="keep" ${recorded ? "disabled" : ""}>${escapeHtml(EVENT_ONE_GRAMMAR.keepLabel)}</button>
        <button class="primary-button" type="button" data-action="override" ${recorded ? "disabled" : ""}>${escapeHtml(EVENT_ONE_GRAMMAR.overrideLabel)}</button>
      </div>
      ${confirmation}
      ${recorded ? `<button class="primary-button wide continue-button" type="button" data-action="continue">Continue to active shift</button>` : ""}
      ${renderWhyDrawer()}
    </div>`;
}

function renderChoice(
  rankLabel: string,
  choice: typeof EVENT_ONE_GRAMMAR.chosen,
  variant: string,
): string {
  return `
    <article class="choice-card ${variant}">
      <span class="choice-rank">${escapeHtml(rankLabel)}</span>
      <h2>${escapeHtml(choice.name)}</h2>
      <dl class="costs">
        <div><dt>Minutes</dt><dd>${choice.travelMinutes} min to job · ${choice.totalImmediateMinutes} min total</dd></div>
        <div><dt>Dollars</dt><dd>${formatMoney(choice.revenueCents)} job value</dd></div>
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

function renderShiftHandoff(current: ConsoleState): string {
  return `
    <section class="shift-handoff" aria-labelledby="shift-active-title">
      <div>
        <p class="eyebrow">Guided event complete</p>
        <h2 id="shift-active-title">The active shift is running.</h2>
        <p>The route map is gone because no route decision is live. Pause and restart remain available.</p>
      </div>
      <button class="secondary-button" type="button" data-action="trace" ${current.result === null ? "disabled" : ""}>Open engineering trace</button>
    </section>`;
}

function renderTrace(current: ConsoleState): string {
  const result = current.result;
  if (result === null) return "";
  const decision = result.decisions[0];
  const outcome = result.outcomes[0];
  if (decision === undefined || outcome === undefined) return "";
  const overrides = current.routeChoice === "override"
    ? [{ eventId: outcome.eventId, technicianId: outcome.assignedTechnicianId }]
    : [];
  const transition = {
    before: decision.inputSnapshot.boardState,
    selectedTechnicianId: outcome.assignedTechnicianId,
    outcome,
    after: result.finalBoard,
  };
  return `
    <main id="main-content" class="trace-shell">
      <header class="trace-heading">
        <div><p class="eyebrow">Reading depth four · reproducible trace</p><h1 tabindex="-1">Engineering trace</h1></div>
        <button class="secondary-button" type="button" data-action="close-trace">Back to live board</button>
      </header>
      <p class="trace-intro">This view is separate from the live board. It exposes the exact seeded engine inputs and outputs behind the recorded route decision.</p>
      <dl class="trace-facts">
        <div><dt>Seed</dt><dd><code>${escapeHtml(String(result.seed))}</code></dd></div>
        <div><dt>Decision ID</dt><dd><code>${escapeHtml(decision.decisionId)}</code></dd></div>
        <div><dt>Event ID</dt><dd><code>${escapeHtml(outcome.eventId)}</code></dd></div>
        <div><dt>Replay path</dt><dd><code>simulateScenario(EVENT_ONE_SCENARIO, ${escapeHtml(JSON.stringify(overrides))})</code></dd></div>
      </dl>
      <div class="trace-grid">
        ${renderJsonPanel("Input snapshot", decision.inputSnapshot)}
        ${renderJsonPanel("State transition", transition)}
        ${renderJsonPanel("Decision JSON", decision)}
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
  } else {
    clock.textContent = `${state.timerRemaining} sec${state.paused ? " · paused" : " remaining"}`;
  }
  pauseButton.disabled = state.phase !== "shift" || !state.timerStarted;
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
  if (action === "trace") state = openTrace(state);
  if (action === "close-trace") state = closeTrace(state);
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
