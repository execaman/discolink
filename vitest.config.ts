import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const packageJsonString = readFileSync("./package.json", "utf8");
const { name, version, repository } = JSON.parse(packageJsonString);

export default defineConfig({
  define: {
    $clientName: `"${name}"`,
    $clientVersion: `"${version}"`,
    $clientRepository: `"${repository}"`,
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
      include: ["src/Functions/{utility,validation}.ts", "src/Node/{REST,Node}.ts", "src/Queue/{Track,Playlist}.ts"],
    },
  },
});
