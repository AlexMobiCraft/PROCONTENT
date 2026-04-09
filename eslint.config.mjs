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
    ".obsidian/**",
    "next-env.d.ts",
    "everything-claude-code/**",
  ]),
  {
    // Disable camelcase rule for Supabase DB type compatibility (snake_case fields)
    // Only applied to specific files to maintain code quality elsewhere
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      camelcase: ["error", { properties: "never", ignoreDestructuring: true, ignoreImports: true }]
    },
  },
  {
      // Completely disable for auto-generated types if they exist or will exist
      files: ["src/types/supabase.ts", "src/types/database.types.ts"],
      rules: {
          camelcase: "off"
      }
  }
]);

export default eslintConfig;
