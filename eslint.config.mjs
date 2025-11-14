import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // ===== TYPESCRIPT RULES (Keep your overrides but add safety) =====
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off", // Changed from "off" to "warn"
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "offnpm run lint",

      // ===== CRITICAL ERRORS (Will catch bugs) =====
      "no-debugger": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-alert": "warn",
      "no-eval": "error",
      "no-implied-eval": "error",

      // ===== REACT RULES =====
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/no-children-prop": "warn",
      "react/no-danger-with-children": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-unescaped-entities": "warn",
      "react/jsx-no-undef": "error",

      // ===== REACT HOOKS RULES =====
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ===== GENERAL JAVASCRIPT =====
      "no-var": "error",
      "prefer-const": "warn",
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-constant-condition": "warn",
      "no-empty": "warn",
      "no-fallthrough": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",

      // ===== ASYNC/AWAIT =====
      "require-await": "warn",
      "no-async-promise-executor": "error",
      "no-return-await": "warn",

      // ===== BEST PRACTICES =====
      eqeqeq: ["warn", "smart"],
      "no-script-url": "error",

      // ===== NEXT.JS SPECIFIC =====
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-img-element": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "public/**",
      ".vercel/**",
    ],
  },
];

export default eslintConfig;
