---
"drift-toolkit": major
---

Remove public Library API exports. drift-toolkit is now CLI-only.

**Breaking Changes:**
- All programmatic imports from `drift-toolkit` are removed
- The `drift-toolkit/constants` export is removed
- Only the CLI (`drift` command) is now supported

**Migration:** If you were importing from drift-toolkit programmatically, you'll need to either:
1. Use the CLI instead
2. Fork the repo and import directly from source files
