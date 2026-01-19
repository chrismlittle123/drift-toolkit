---
"drift-toolkit": minor
---

Add cm dependencies integration for tracking configuration files

- New `getDependencies()` function to get tracked config files from check-my-toolkit
- Supports filtering by check type and monorepo projects
- Includes caching for scan session performance
- Graceful error handling for cm not installed or network issues
