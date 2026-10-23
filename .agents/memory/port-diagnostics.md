---
name: Port diagnostics in this runner
description: A practical alternative for checking local ports when standard socket utilities are absent.
---

`ss` is not installed in this Replit runner. A small Node `net` listener and connection probe can verify whether a local port is open.

**Why:** Assuming an unavailable port-inspection command means a port is free can make startup-failure tests misleading.

**How to apply:** Use Node's built-in `net` module for temporary port checks, and clean up the listener and any test child processes afterward.
