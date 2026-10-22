# Run the app checks

These checks use Node.js and its built-in test and `fetch` features. They do not need another package install. Start with the security checks, then increase the load level gradually.

## 1. Start the backend

Open the project folder in VS Code. In the first terminal, start the backend using the same setup and environment files described in the root README:

```powershell
cd liggy\server
npm start
```

Keep that terminal running. The checks call the backend at `http://localhost:3001`; they do not need the website terminal open.

## 2. Run security and API checks

Open a second VS Code terminal at the project root (`SDC_HACKATHON_PROJECT`) and run:

```powershell
node --test testing/app-security.test.mjs
```

The default checks verify that the health route responds, private business data and invoice creation reject signed-out requests, a forged session cookie is rejected, and invalid registration input is rejected before account creation.

The optional login check also checks that a successful sign-in returns a public profile without a password hash, the session cookie has `HttpOnly` and `SameSite=Lax`, `/api/auth/me` accepts the cookie, and logout tells the browser to clear it. It uses an existing account and does not create invoices or customers. Use a dedicated test account, never a production account. In PowerShell, set credentials only in the terminal where you run the test:

```powershell
$env:TEST_LOGIN_EMAIL = "test-account@example.com"
$env:TEST_LOGIN_PASSWORD = "your-test-account-password"
node --test testing/app-security.test.mjs
Remove-Item Env:TEST_LOGIN_EMAIL
Remove-Item Env:TEST_LOGIN_PASSWORD
```

Logout currently clears the cookie in the browser. The app uses a signed, stateless cookie, so a copied cookie may remain usable until its seven-day expiry. This test checks the cookie-clearing response; it does not claim that logout revokes a copied token.

## 3. Run the load levels

From the project root, run the smallest level first:

```powershell
node testing/load-test.mjs light
```

If the backend stays responsive, continue with:

```powershell
node testing/load-test.mjs medium
node testing/load-test.mjs stress
```

| Level | Concurrent requests | Total requests |
| --- | ---: | ---: |
| `light` | 5 | 100 |
| `medium` | 20 | 1,000 |
| `stress` | 50 | 5,000 |

Each request calls only `GET /api/health`. The script reports success count, duration, throughput, and p50/p95/maximum response times. It exits with an error if requests fail. A p95 above one second raises a warning. Compare runs on the same computer and under similar conditions; these numbers are a basic local check, not a capacity guarantee.

The load test deliberately does not submit invoices, call the AI provider, send email, or write to Firestore. Those actions can cost money or create persistent records. Stop the run with **Ctrl+C** if the computer or backend becomes unresponsive.

## Use another backend URL

By default, checks target `http://localhost:3001`. To target a different local or staging backend, set `LIGGY_API_URL` in PowerShell before running a check:

```powershell
$env:LIGGY_API_URL = "http://localhost:3001"
node --test testing/app-security.test.mjs
node testing/load-test.mjs light
Remove-Item Env:LIGGY_API_URL
```

Only run these checks against an app you own or have permission to assess. Do not point the load test at the public production service without an agreed test window and capacity limits.

## What this does and does not measure

- **Security/API behavior:** basic signed-out access control, forged-cookie rejection, input validation, and session-cookie attributes.
- **Efficiency:** response time and throughput for the lightweight health endpoint at the listed concurrency levels.
- **Not covered:** real invoice generation, AI model latency or cost, Firestore throughput, generated PDF storage, email delivery, full customer data separation, browser UI behavior, or a full security/penetration review.

Passing these checks is a useful first signal, not proof that the whole application is secure or ready for production. A full workflow check should use a separate staging project, test accounts, test AI credentials, and a cleanup plan for any generated records.
