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
    // Generated artifacts (vitest coverage, playwright reports)
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Supabase CLI-generated artifacts (supabase start/db reset)
    "supabase/.temp/**",
    // Vendored agent skills (installed via `npx skills add`, not app source)
    ".agents/**",
    ".opencode/**",
    ".claude/**",
    ".codex/**",
    // Firebase hosting build artifacts (created by build.sh, not app source)
    "functions/.next/**",
    "functions/public/**",
    "functions/node_modules/**",
  ]),
]);

export default eslintConfig;
