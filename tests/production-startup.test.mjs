import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, cp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));

// Deliberately do not inherit credentials, NODE_OPTIONS, or project .env files.
const safeEnv = {
  PATH: process.env.PATH,
  HOME: tmpdir(),
  SESSION_SECRET: "production-smoke-test-only-not-a-real-secret",
  GCLOUD_PROJECT: "demo-liggy-smoke",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:1",
};

function launch(command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd, env: { ...safeEnv, ...env }, detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  return { child, exited, output: () => output };
}

function signalGroup(proc, signal) {
  try { process.kill(-proc.child.pid, signal); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
}

async function stop(proc) {
  // Kill the whole isolated group even when its launcher has already exited.
  signalGroup(proc, "SIGTERM");
  await delay(150);
  signalGroup(proc, "SIGKILL");
  await proc.exited;
}

async function until(check, diagnostic, timeout = 15000) {
  const end = Date.now() + timeout;
  do {
    if (await check()) return;
    await delay(50);
  } while (Date.now() < end);
  assert.fail(`Timed out: ${diagnostic()}`);
}

async function finish(proc, timeout = 120000) {
  let result;
  proc.exited.then((value) => { result = value; });
  await until(() => result, proc.output, timeout);
  return result;
}

async function unusedPort() {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

test("production build, routing, and required-process failures", { timeout: 240000 }, async (t) => {
  const workspace = await mkdtemp(path.join(tmpdir(), "liggy-startup-"));
  const running = [];
  t.after(async () => {
    try { for (const proc of running.reverse()) await stop(proc); }
    finally { await rm(workspace, { recursive: true, force: true }); }
  });
  for (const name of ["client", "server", "replit-build.sh", "replit-start.sh"]) {
    await cp(path.join(root, name), path.join(workspace, name), {
      recursive: true,
      filter: (source) => !["node_modules", "dist", ".env"].includes(path.basename(source))
        && !path.basename(source).startsWith(".env."),
    });
  }
  const fakePython = path.join(workspace, "test-python");
  await writeFile(fakePython, `#!${process.execPath}
process.stdout.write('{"type":"ready"}\\n');
process.stdin.resume();
process.stdin.on("data", () => { throw new Error("Smoke test must not call invoice services"); });
process.stdin.on("end", () => process.exit(0));
`, { mode: 0o755 });

  await t.test("deployment build script builds the real client", async () => {
    const build = launch("bash", ["./replit-build.sh"], workspace);
    running.push(build);
    assert.deepEqual(await finish(build), { code: 0, signal: null }, build.output());
    assert.match(await readFile(path.join(workspace, "client/dist/index.html"), "utf8"), /\/assets\//);
  });

  await t.test("production launcher serves HTML and assets without swallowing API routes", async () => {
    const port = await unusedPort();
    const server = launch("bash", ["./replit-start.sh", "production"], workspace, {
      PORT: String(port), PYTHON_EXECUTABLE: fakePython,
    });
    running.push(server);
    const request = (route) => fetch(`http://127.0.0.1:${port}${route}`, {
      signal: AbortSignal.timeout(1500),
    });
    await until(async () => {
      assert.equal(server.child.exitCode, null, server.output());
      try { return (await request("/api/health")).status === 200; }
      catch { return false; }
    }, server.output);
    const page = await request("/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    const html = await page.text();
    assert.equal(html, await readFile(path.join(workspace, "client/dist/index.html"), "utf8"));
    const assetPath = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    assert.ok(assetPath, "built HTML must reference a JavaScript asset");
    const asset = await request(assetPath);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /javascript/);
    assert.equal(await asset.text(), await readFile(path.join(workspace, "client/dist", assetPath), "utf8"));
    const health = await request("/api/health");
    assert.equal(health.status, 200);
    assert.match(health.headers.get("content-type"), /application\/json/);
    assert.equal((await health.json()).invoiceAgent, "ready");
    for (const route of ["/api/business-data", "/api/not-a-page"]) {
      const response = await request(route);
      assert.equal(response.status, 401);
      assert.match(response.headers.get("content-type"), /application\/json/);
      assert.match((await response.json()).error, /sign in/i);
    }
    await stop(server);
  });

  await t.test("production configuration failure exits visibly with nonzero status", async () => {
    const server = launch("bash", ["./replit-start.sh", "production"], workspace, {
      PORT: String(await unusedPort()), PYTHON_EXECUTABLE: fakePython, SESSION_SECRET: "",
    });
    running.push(server);
    const result = await finish(server, 15000);
    assert.notEqual(result.code, 0, server.output());
    assert.equal(result.signal, null);
    assert.match(server.output(), /Set SESSION_SECRET/);
  });

  await t.test("required development child failure propagates and stops its sibling", async () => {
    // Test the real supervisor without occupying the user's development ports.
    const fixture = path.join(workspace, "supervisor");
    await mkdir(path.join(fixture, "server/node_modules/@google-cloud/firestore"), { recursive: true });
    await mkdir(path.join(fixture, "client/node_modules/.bin"), { recursive: true });
    await cp(path.join(root, "replit-start.sh"), path.join(fixture, "replit-start.sh"));
    await writeFile(path.join(fixture, "server/index.js"), `
const fs = require("node:fs");
const timer = setInterval(() => {
  if (fs.existsSync("sibling.pid")) {
    clearInterval(timer);
    console.error("Injected required API startup failure");
    process.exit(23);
  }
}, 20);
`);
    await writeFile(path.join(fixture, "client/node_modules/.bin/vite"), `#!${process.execPath}
require("node:fs").writeFileSync("sibling.pid", String(process.pid));
setInterval(() => {}, 1000);
`, { mode: 0o755 });
    const launcher = launch("bash", ["./replit-start.sh"], fixture);
    running.push(launcher);
    assert.deepEqual(await finish(launcher, 15000), { code: 23, signal: null }, launcher.output());
    assert.match(launcher.output(), /Injected required API startup failure/);
    assert.match(launcher.output(), /API server stopped unexpectedly/);
    const sibling = Number(await readFile(path.join(fixture, "sibling.pid"), "utf8"));
    await until(() => {
      try { process.kill(sibling, 0); return false; }
      catch (error) { if (error.code === "ESRCH") return true; throw error; }
    }, () => `sibling process ${sibling} was not cleaned up`);
  });
});
