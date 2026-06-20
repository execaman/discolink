import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

const packageJsonString = readFileSync("./package.json", "utf8");
const { name, version, homepage } = JSON.parse(packageJsonString);

export default defineConfig({
  define: {
    $clientName: `"${name}"`,
    $clientVersion: `"${version}"`,
    $clientHomepage: `"${homepage}"`,
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: false,
    environment: "node",
    reporters: process.env.GITHUB_ACTIONS ? ["tree", "github-actions"] : ["tree"],
    coverage: {
      enabled: true,
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "lcov", "clover", "json"],
      include: ["src/functions/{utility,validation}.ts", "src/node/{rest,node}.ts", "src/queue/{track,playlist}.ts"],
    },
  },
});
