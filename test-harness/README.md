# Ver.135 deletion harness

This folder is Work-only. It must never load `../config.js` or a production URL.

1. Copy `test-config.example.js` to a local, untracked test configuration if needed.
2. Run `powershell -ExecutionPolicy Bypass -File .\production-guard.test.ps1` first. It requires the same `{ emulator: true, host, port }` contract that `app.js` checks, a localhost URL, and a `test-` room; it rejects the known production project/RTDB host.
3. With Node 20+ available, run `node --test .\delete-protocol.test.mjs`. The Work-only `package.json` marks the shared protocol as an ES module for this command.

The Node cases cover normal root deletion, revision-only stale retry eligibility, legacy missing revisions, malformed revisions, user-visible/unknown-field conflicts, knowledge ownership, related-record changes, already-deleted classification, commit barriers, abort invariance, reverse-order snapshots, partial snapshots, acknowledgement, and room reset. Emulator and browser tests remain manual until a dedicated full-application Emulator entry is supplied; this static harness never loads `config.js` and must not be treated as a browser integration result.
