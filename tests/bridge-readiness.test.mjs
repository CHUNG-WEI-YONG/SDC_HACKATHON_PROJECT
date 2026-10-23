import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import vm from "node:vm";

// Exercise the actual server bridge wiring without credentials or external calls.
const source = readFileSync(new URL("../src/server/index.js", import.meta.url), "utf8");
const wiring = source.slice(source.indexOf("const bridge = spawn("), source.indexOf("function signSession"));

function setup() {
  const bridge = new EventEmitter();
  bridge.stdout = new EventEmitter();
  bridge.stdout.setEncoding = () => {};
  bridge.stdin = new EventEmitter();
  bridge.stdin.writable = true;
  bridge.stdin.write = (_data, done) => done();
  let health;
  const context = vm.createContext({
    spawn: () => bridge,
    process: { env: {}, exit: () => assert.fail("website must remain running") },
    path: { join: (...parts) => parts.join("/") },
    projectRoot: "/project",
    randomUUID: () => "request-id",
    console: { error() {} },
    app: { get: (route, handler) => { assert.equal(route, "/api/health"); health = handler; } },
  });
  vm.runInContext(wiring, context);
  return {
    bridge,
    call: () => vm.runInContext('callInvoiceAgent({action: "business_data"})', context),
    health: () => {
      const result = {};
      const res = {
        set: (key, value) => { result[key] = value; return res; },
        status: (code) => { result.status = code; return res; },
        json: (body) => { result.body = body; },
      };
      health({}, res);
      return result;
    },
  };
}

test("health stays unavailable until a complete ready signal arrives", () => {
  const app = setup();
  assert.equal(app.health().status, 503);
  assert.equal(app.health().body.invoiceAgent, "starting");
  assert.throws(app.call, /unavailable/);
  app.bridge.stdout.emit("data", 'not-json\n{"type":"rea');
  assert.equal(app.health().status, 503);
  app.bridge.stdout.emit("data", 'dy"}\n');
  assert.equal(app.health().status, 200);
  assert.equal(app.health().body.ok, true);
  assert.equal(app.health()["Cache-Control"], "no-store");
});

for (const failure of ["spawn", "exit", "signal", "stdin", "stdout", "end", "write"]) {
  test(`${failure} failure reports 503 without stopping the website or leaking details`, async () => {
    const app = setup();
    if (failure !== "spawn") app.bridge.stdout.emit("data", '{"type":"ready"}\n');
    let pending;
    if (failure !== "spawn") {
      if (failure === "write") app.bridge.stdin.write = (_data, done) => done(new Error("private path"));
      pending = assert.rejects(app.call());
    }
    if (failure === "spawn") app.bridge.emit("error", new Error("private path"));
    if (failure === "exit") app.bridge.emit("exit", 0, null);
    if (failure === "signal") app.bridge.emit("exit", null, "SIGTERM");
    if (failure === "stdin") app.bridge.stdin.emit("error", new Error("private path"));
    if (failure === "stdout") app.bridge.stdout.emit("error", new Error("private path"));
    if (failure === "end") app.bridge.stdout.emit("end");
    await pending;
    app.bridge.stdout.emit("data", '{"type":"ready"}\n');
    assert.equal(app.health().status, 503);
    assert.equal(app.health().body.ok, false);
    assert.equal(app.health().body.invoiceAgent, "failed");
    assert.doesNotMatch(JSON.stringify(app.health()), /private path|SIGTERM/);
    assert.throws(app.call, /unavailable/);
  });
}

test("ordinary request errors do not mark a ready bridge as failed", async () => {
  const app = setup();
  app.bridge.stdout.emit("data", '{"type":"ready"}\n');
  const pending = assert.rejects(app.call(), /invalid invoice/);
  app.bridge.stdout.emit("data", '{"id":"request-id","ok":false,"error":"invalid invoice"}\n');
  await pending;
  assert.equal(app.health().status, 200);
});
