import tseslint from "typescript-eslint";

const packages = [
  "core",
  "indexer",
  "storage",
  "service",
  "server",
  "web",
  "mcp",
];
const allowed = {
  core: [],
  indexer: ["core"],
  storage: ["core"],
  service: ["core"],
  server: ["core", "service", "indexer", "storage"],
  web: ["core"],
  mcp: ["core"],
};
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "artifacts/**",
      ".agents/**",
      ".superpowers/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  ...packages.map((name) => ({
    files: [
      `${["server", "web", "mcp"].includes(name) ? "apps" : "packages"}/${name}/src/**/*.{ts,tsx}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@codemap/*/*",
                ...packages.flatMap((other) => [
                  `**/${other}/src/**`,
                  `**/${other}/dist/**`,
                ]),
              ],
              message: "Use workspace public entry points.",
            },
            ...packages
              .filter((other) => !allowed[name].includes(other))
              .map((other) => ({
                group: [`@codemap/${other}`],
                message: `The ${name} workspace cannot depend on ${other}.`,
              })),
            ...(name === "core"
              ? [
                  {
                    group: [
                      "node:*",
                      "fs",
                      "path",
                      "crypto",
                      "http",
                      "https",
                      "child_process",
                      "react",
                      "react-dom",
                      "fastify",
                    ],
                    message: "Core must remain pure and free of platform I/O.",
                  },
                ]
              : []),
          ],
        },
      ],
    },
  })),
);
