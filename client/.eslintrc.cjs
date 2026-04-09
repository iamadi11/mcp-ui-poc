/* eslint-env node */
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", "node_modules"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["react-refresh"],
  settings: { react: { version: "detect" } },
  rules: {
    "react/prop-types": "off",
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      files: ["src/components/ui/**/*.{js,jsx}"],
      rules: {
        "react-refresh/only-export-components": "off",
      },
    },
    {
      files: ["src/StructuredUIPreview.jsx"],
      rules: {
        "react-refresh/only-export-components": "off",
      },
    },
  ],
};
