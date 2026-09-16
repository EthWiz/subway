// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * The dependencies for this were declared from the start and the config was
 * not, so `pnpm run lint` — and therefore `pnpm run check`, which the README
 * tells people to run — failed on a fresh clone.
 *
 * Type-aware rules are deliberately off. The research tooling parses untyped
 * JSON-RPC responses at its edges, where `no-unsafe-*` fires constantly and
 * correctly without saying anything useful; the boundaries are already
 * validated by hand in `research/lib/`.
 */
export default tseslint.config(
  {
    ignores: [
      "contracts/**",
      "research/generated/**",
      "node_modules/**",
      "dist/**",
      ".claude/**",
      "apps/**",
      "packages/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      // A deliberately unused binding is spelled with a leading underscore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
