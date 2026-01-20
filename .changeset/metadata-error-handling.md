---
"drift-toolkit": patch
---

Improve metadata loading error handling to distinguish between different failure modes.

Previously, `parseRepoMetadata` and `getRepoMetadata` returned `null` for empty files, invalid YAML, and non-object content, making debugging difficult. Now these functions return default metadata with descriptive warnings:

- Empty file: "File is empty, using default values"
- Invalid YAML syntax: "Failed to parse YAML: <error>, using default values"
- Non-object content: "Invalid metadata format (expected object, got <type>), using default values"

`getRepoMetadata` now only returns `null` when the file doesn't exist. For all other error cases, it returns default metadata (tier: internal, status: active) with appropriate warnings.
