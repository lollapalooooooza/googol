---
name: App Storage SDK compatibility
description: Why the documented sidecar client currently uses the older supported SDK major.
---

Keep the documented Replit sidecar credential configuration intact and verify SDK major upgrades against a real upload before adopting them.

**Why:** On 2026-11-14, the documented client configuration with an empty project ID failed in `@google-cloud/storage` 9 / `google-auth-library` 11 with “Unable to detect a Project Id.” The same configuration successfully uploaded assets using Storage 7 / Auth 9. This was a client-version incompatibility, not missing user credentials.

**How to apply:** Do not ask the user for Google credentials or invent a project ID to work around this failure. Use the compatible SDKs until the platform's setup guidance supports the newer authentication behavior, then verify upload, HEAD, full reads, and byte-range reads.

Do not destroy the Storage 7 download stream before its upstream pipeline is established.

**Why:** On Node 24, cancelling a browser video seek before GCS responded caused a later SDK callback to throw `ERR_STREAM_UNABLE_TO_PIPE` outside Express and terminate the entire API process. A normal stream error listener did not catch it.

**How to apply:** Skip downloads for already-disconnected clients. For a download that has started connecting, unpipe the closed response and defer destroying the source until its first data event, after pipeline setup. Verify rapid cancelled range requests as well as successful reads when upgrading this SDK.
