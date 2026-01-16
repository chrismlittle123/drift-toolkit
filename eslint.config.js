import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // Code complexity rules
      "max-depth": ["error", 4],
      "max-params": ["error", { max: 4 }],
      "max-lines-per-function": [
        "error",
        { max: 100, skipBlankLines: true, skipComments: true },
      ],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 15],
      // Code style rules
      "no-console": ["error", { allow: ["error", "warn"] }],
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "prefer-const": "error",
      "no-var": "error",
      // Best practices
      "array-callback-return": "error",
      "no-template-curly-in-string": "error",
      "consistent-return": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "error",
      "require-await": "error",
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",
      "no-param-reassign": "error",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "error",
      // Import rules
      "import/no-cycle": ["error", { maxDepth: 10 }],
      // TypeScript specific
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      // Naming conventions
      camelcase: "off",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE", "camelCase"] },
        { selector: "property", format: null },
        { selector: "objectLiteralProperty", format: null },
      ],
    },
  },
  // Relaxed rules for CLI source files that need console.log
  {
    files: ["src/commands/**/*.ts", "src/github/org-scanner.ts", "src/cli.ts"],
    rules: {
      "no-console": "off", // CLI tool legitimately needs console output
      "max-lines-per-function": [
        "error",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      "max-lines": [
        "error",
        { max: 600, skipBlankLines: true, skipComments: true },
      ], // CLI/scanner files need more lines
      complexity: ["error", 40], // CLI commands have higher complexity due to output formatting
      "max-depth": ["error", 5],
    },
  },
  // Relaxed rules for test files
  {
    files: ["src/tests/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-console": "off",
      "max-lines-per-function": "off",
      "max-lines": "off",
      complexity: "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "*.config.js"],
  },
];
