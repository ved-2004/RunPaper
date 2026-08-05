import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["components/ui/sidebar.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  {
    files: ["components/ui/{command,textarea}.tsx"],
    rules: { "@typescript-eslint/no-empty-object-type": "off" },
  },
  {
    files: ["next.config.ts", "tailwind.config.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
