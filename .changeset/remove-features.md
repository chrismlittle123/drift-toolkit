---
"drift-toolkit": major
---

Remove Integrity Checking and Custom Scans features

**Breaking Changes:**

**Integrity Checking (#105):**
- Removed `checkIntegrity`, `checkAllIntegrity`, `discoverFiles` exports
- Removed `IntegrityCheck`, `IntegrityResult`, `DiscoveryPattern`, `DiscoveryResult` types
- Removed `drift code fix` command
- Removed integrity-related config schema

**Custom Scans (#106):**
- Removed `runScan`, `runAllScans` exports
- Removed `ScanDefinition`, `ScanResult` types
- Removed scan-related config schema

The tool now focuses on repository metadata validation, tier-ruleset alignment, and dependency file change detection.
