import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Exclude test and script files
    "**/*.test.ts",
    "**/*.test.tsx",
    "__tests__/**",
    "scripts/**",
    "test-*.js",
    "backtest-*.js",
    "generate-*.js",
    "jest.config.js",
    "lint-full-report.txt",
  ]),
]);

export default eslintConfig;
