import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor(selector) {
    this.selector = selector;
    this.innerHTML = "";
    this.textContent = "";
    this.disabled = false;
    this.dataset = {};
    this.listeners = new Map();
    this.queryResults = new Map();
    this.focusCount = 0;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  closest() {
    return this;
  }

  querySelector(selector) {
    return this.queryResults.get(selector) ?? null;
  }

  focus() {
    this.focusCount += 1;
  }

  click(action) {
    const listener = this.listeners.get("click");
    listener?.({
      target: new ActionTarget(action),
    });
  }
}

class ActionTarget extends FakeElement {
  constructor(action) {
    super("[data-action]");
    this.dataset = { action };
  }
}

const elements = new Map([
  ["#app", new FakeElement("#app")],
  ["#shift-clock", new FakeElement("#shift-clock")],
  ["#pause-button", new FakeElement("#pause-button")],
  ["#restart-button", new FakeElement("#restart-button")],
]);

globalThis.Element = FakeElement;
globalThis.document = {
  querySelector(selector) {
    return elements.get(selector) ?? null;
  },
};
globalThis.window = {
  requestAnimationFrame(callback) {
    callback();
    return 0;
  },
  setInterval() {
    return 0;
  },
};

await import("../dist/console.js");

const app = elements.get("#app");
assert.ok(app);

test("console meter and route map follow live state at the render boundary", () => {
  app.click("start");

  assert.doesNotMatch(app.innerHTML, /No decisions recorded yet/);
  assert.match(app.innerHTML, /class="score-window"/);
  assert.match(app.innerHTML, /Future impact/);
  assert.match(app.innerHTML, /Not in model/);
  assert.match(app.innerHTML, /class="consequence-ghost/);
  assert.match(app.innerHTML, /Not scored · \+52 min later/);
  app.click("override");

  assert.match(app.innerHTML, /Override recorded/);
  assert.match(app.innerHTML, /class="route-map /);
  assert.match(app.innerHTML, /Route updated: Luis Alvarez/);
  assert.match(app.innerHTML, /aria-valuenow="1"/);

  const activeShiftHeading = new FakeElement("#shift-active-title");
  app.queryResults.set("#shift-active-title", activeShiftHeading);
  app.click("continue");
  assert.equal(activeShiftHeading.focusCount, 1);
  assert.match(app.innerHTML, /id="shift-active-title" tabindex="-1"/);
  assert.doesNotMatch(app.innerHTML, /class="route-map"/);
  app.click("open-coverage");
  assert.match(app.innerHTML, /<div class="technician-grid">\s*<article[^>]*>[\s\S]*?<h3>Andre Brooks<\/h3>/);
  const coverageConfirmation = new FakeElement("#decision-confirmation");
  app.queryResults.set("#decision-confirmation", coverageConfirmation);
  app.click("accept-coverage");

  assert.equal(coverageConfirmation.focusCount, 1);
  assert.match(app.innerHTML, /aria-valuenow="0"/);
  assert.match(app.innerHTML, /Emergency coverage after 2 PM: 0 tech/);
  assert.match(app.innerHTML, /class="signal coverage-signal is-changing"/);
  assert.match(app.innerHTML, /Changed 1 → 0/);
  assert.match(app.innerHTML, /--coverage-to: 0/);

  app.click("continue-emergency");
  assert.match(app.innerHTML, /Safety impact: residents remain without cooling until tomorrow/);
  assert.match(app.innerHTML, /aria-labelledby="board-title"/);
  assert.match(app.innerHTML, /Five fictional technicians/);
  assert.match(app.innerHTML, /The \+\$119 maintenance job remains scheduled/);

  app.click("restart");
  app.click("start");
  app.click("keep");
  assert.match(app.innerHTML, /Route kept: Maya Ortiz/);
  app.click("continue");
  app.click("open-coverage");
  app.click("hold-coverage");
  app.click("continue-emergency");
  assert.match(app.innerHTML, /Safety impact: same-day service reduces/);
  assert.match(app.innerHTML, /The \$119 tune-up was deferred/);
});
