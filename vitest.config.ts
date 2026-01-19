import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Enforce minimum coverage thresholds (current: ~58%, target: 80%)
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
      // Only measure coverage for src files, excluding tests
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    },
  },
});
