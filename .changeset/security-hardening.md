---
"drift-toolkit": patch
---

Security hardening and test coverage improvements

- Fix token exposure by using GIT_ASKPASS instead of URL embedding
- Add safeJoinPath to config loader to prevent path traversal
- Replace execSync with execFileSync via shared git utility
- Add try-finally cleanup for guaranteed temp directory removal
- Add verbose logging option for skipped directories
- Set 80% coverage thresholds in vitest config
- Add tests for client.ts, loader.ts, and scan.ts (69 new tests)
