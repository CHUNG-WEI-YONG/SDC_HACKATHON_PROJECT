---
name: Python TLS trust
description: Why Python AI requests should use the system CA bundle on Replit.
---

Use the system CA bundle for Python AI clients in this environment, preserving
any explicitly configured custom trust store.

**Why:** Node could reach the configured AI provider while Python HTTP clients
failed certificate verification with certifi's bundled roots. A request using
the system CA bundle succeeded. This is a trust-store difference, not a reason
to disable TLS checks or replace the AI provider.

**How to apply:** When adding Python entry points or testing them outside the
launcher, ensure they inherit the same system certificate configuration. Never
work around this with `verify=False`.
