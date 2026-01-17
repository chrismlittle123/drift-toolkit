---
"drift-toolkit": patch
---

Integrate check-my-toolkit for code quality checks

- Simplify pre-push hook to only run branch name validation
- Move linting, type checking, and code quality checks to CI via check-my-toolkit
- Rename dashboard components to kebab-case for naming convention compliance
- Update CI workflow to run cm code audit, cm code check, and cm process check
