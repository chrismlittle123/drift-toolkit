import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Enforce minimum coverage thresholds (target: 80%)
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      // Only measure coverage for src files, excluding tests and re-export files
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/index.ts", // Re-export barrels
        "src/types.ts", // Type definitions only
        "src/cli.ts", // CLI entry point
        "src/github/org-scanner.ts", // Complex integration, tested via e2e
      ],
    },
  },
});
