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
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  closest() {
    return this;
  }

  querySelector() {
    return null;
  }

  focus() {}

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
  app.click("override");

  assert.match(app.innerHTML, /Override recorded/);
  assert.doesNotMatch(app.innerHTML, /class="route-map"/);
  assert.match(app.innerHTML, /aria-valuenow="1"/);

  app.click("continue");
  app.click("open-coverage");
  app.click("accept-coverage");

  assert.match(app.innerHTML, /aria-valuenow="0"/);
  assert.match(app.innerHTML, /Emergency coverage after 2 PM: 0 tech/);
  assert.match(app.innerHTML, /class="coverage-fill" style="width: 0%;"/);
});
