---
name: Express listen failures
description: Observed occupied-port startup behavior with the installed Express version.
---

Do not assume a bind failure will throw an uncaught error and terminate the server.

**Why:** An isolated startup check with an occupied port observed a success log and a still-running process. The installed Express version passes listen errors to the callback, so a callback that ignores its error argument can misreport startup.

**How to apply:** When changing startup handling, explicitly handle listen errors and test using an occupied local port. Preserve the separate policy that invoice-agent unavailability alone does not stop the website.
