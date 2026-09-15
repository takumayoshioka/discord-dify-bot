import js from "@eslint/js"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores([
    "dist/",
    "coverage/",
    "**/*.js",
    "**/*.cjs",
    "**/*.mjs",
  ]),

  {
    files: ["src/**/*.{ts,tsx,mts,cts}"],

    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
    ],

    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",

          varsIgnorePattern: "^_",

          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",

          destructuredArrayIgnorePattern: "^_",

          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-floating-promises": "error"
    },
  },
])
