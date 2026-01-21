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
      },
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        Response: "readonly",
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

      // Code quality limits
      "max-depth": ["error", { max: 4 }],
      "max-params": ["error", { max: 4 }],
      "max-lines-per-function": ["error", { max: 50 }],
      "max-lines": ["error", { max: 400 }],
      complexity: ["error", { max: 15 }],
      "no-console": ["error", { allow: ["error", "warn"] }],

      // Core ESLint - Best practices
      eqeqeq: "error",
      curly: "error",
      "prefer-const": "error",
      "no-var": "error",

      // Core ESLint - Security
      "no-eval": "error",
      "no-implied-eval": "error",

      // Core ESLint - Bug prevention
      "array-callback-return": "error",
      "no-template-curly-in-string": "error",
      "consistent-return": "error",

      // Import plugin
      "import/no-cycle": ["error", { maxDepth: 2 }],

      // TypeScript-ESLint - Basic checks (AST-based, fast)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",

      // TypeScript-ESLint - Naming conventions
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "enumMember", format: ["UPPER_CASE"] },
        { selector: "typeLike", format: ["PascalCase"] },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        { selector: "function", format: ["camelCase"] },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        { selector: "classMethod", format: ["camelCase"] },
        { selector: "classProperty", format: ["camelCase", "UPPER_CASE"] },
      ],
    },
  },
  // CLI files legitimately need console output
  {
    files: ["src/commands/**/*.ts", "src/cli.ts", "src/github/org-scanner.ts"],
    rules: {
      "no-console": "off",
      "max-lines-per-function": "off",
      "max-lines": "off",
      complexity: "off",
      "max-depth": ["error", { max: 6 }],
    },
  },
  // Test files need relaxed rules
  {
    files: ["src/tests/**/*.ts", "tests/**/*.ts", "src/**/*.test.ts"],
    rules: {
      "no-console": "off",
      "max-lines-per-function": "off",
      "max-lines": "off",
      complexity: "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "build/**"],
  },
];
