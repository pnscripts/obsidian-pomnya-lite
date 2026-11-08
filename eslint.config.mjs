// Obsidian's own lint rules (eslint-plugin-obsidianmd, the rules the review of
// community plugins applies), with the type-checked rules reading tsconfig.json.
// Run from the project root, so manifest.json, package.json and LICENSE are
// checked too.
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // Build output and the Node build scripts are not plugin code. The tests
  // run against a stand-in for the obsidian module that vitest swaps in at run
  // time, sit outside tsconfig.json and never ship, so the type-checked plugin
  // rules have nothing true to say about them; vitest checks them instead.
  globalIgnores(["node_modules", "dist", "build", "main.js", "esbuild.config.mjs", "vitest.config.ts", "tests"]),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*"],
        },
      },
    },
  },
]);
