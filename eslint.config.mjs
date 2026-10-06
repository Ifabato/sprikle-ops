import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Domain rules and shared validation must stay pure, deterministic, and client-safe.
const serverOnlyImports = {
  patterns: [
    {
      group: [
        "@/generated/*",
        "@/generated/**",
        "@/server/*",
        "@/server/**",
        "@/app/*",
        "@/app/**",
      ],
      message:
        "Domain and validation modules must not import server, generated Prisma, or app code.",
    },
    {
      group: ["@prisma/*", "prisma", "prisma/*", "pg", "next", "next/*", "node:*", "fs", "path"],
      message: "Domain and validation modules must stay framework-, database-, and Node-free.",
    },
  ],
};

const noImplicitClockOrLocalTime = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "Pass `now` explicitly; do not read the clock with `new Date()`.",
  },
  {
    selector: "CallExpression[callee.name='Date']",
    message: "Do not call Date() as a function; it reads the clock.",
  },
  {
    selector: "MemberExpression[object.name='Date'][property.name=/^(now|parse)$/]",
    message: "Do not read the clock (Date.now) or parse date strings (Date.parse) in domain code.",
  },
  {
    selector:
      "MemberExpression[property.name=/^(get|set)(FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds)$/]",
    message:
      "Process-local time methods depend on the server TZ; use UTC methods or src/domain/time.ts.",
  },
  {
    selector:
      "MemberExpression[property.name=/^(getTimezoneOffset|toLocaleString|toLocaleDateString|toLocaleTimeString)$/]",
    message: "Do not depend on the process time zone or locale formatting in domain code.",
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.ts", "src/validation/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", serverOnlyImports],
      "no-restricted-syntax": ["error", ...noImplicitClockOrLocalTime],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);
