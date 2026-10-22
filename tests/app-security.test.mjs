import test from "node:test";
import assert from "node:assert/strict";

const apiUrl = (process.env.LIGGY_API_URL || "http://localhost:3001").replace(/\/$/, "");

async function request(path, options = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

test("backend health endpoint responds", async () => {
  const response = await request("/api/health");
  assert.equal(response.status, 200, "backend should respond on the configured URL");
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.app, "Liggy");
});

test("private business data is not available without signing in", async () => {
  const response = await request("/api/business-data");
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.match(body.error || "", /sign in/i);
});

test("invoice creation is not available without signing in", async () => {
  const response = await request("/api/invoices/manual", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 401);
});

test("a malformed or forged session cannot access private data", async () => {
  const response = await request("/api/business-data", {
    headers: { Cookie: "liggy_session=not-a-valid-session" },
  });
  assert.equal(response.status, 401);
});

test("registration rejects invalid input before creating an account", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: "x", email: "not-an-email", password: "short" }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error || "", /username/i);
});

test("a known local test account receives a protected session and logout clears it", {
  skip: !process.env.TEST_LOGIN_EMAIL || !process.env.TEST_LOGIN_PASSWORD,
}, async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: process.env.TEST_LOGIN_EMAIL,
      password: process.env.TEST_LOGIN_PASSWORD,
    }),
  });
  assert.equal(response.status, 200, "test account credentials should be valid");
  const body = await response.json();
  assert.ok(body.user?.id, "login should return the signed-in user's public profile");
  assert.equal("password_hash" in body.user, false, "login must not expose the password hash");
  const cookie = response.headers.get("set-cookie") || "";
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  const sessionCookie = cookie.split(";")[0];

  const sessionResponse = await request("/api/auth/me", { headers: { Cookie: sessionCookie } });
  assert.equal(sessionResponse.status, 200, "the session cookie should authenticate the test account");

  const logoutResponse = await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie") || "", /Max-Age=0/i);
});
