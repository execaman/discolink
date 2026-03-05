import { defineConfig } from "vitest/config";
import { name, version, repository } from "./package.json";

export default defineConfig({
  define: {
    $clientName: `"${name}"`,
    $clientVersion: `"${version}"`,
    $clientRepository: `"${repository}"`,
  },
  test: {
    globals: true,
    reporters: process.env.GITHUB_ACTIONS ? ["tree", "github-actions"] : ["tree"],
    environment: "node",
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "lcov", "clover"],
      reportsDirectory: "coverage",
      include: ["src/Functions/{utility,validation}.ts", "src/Node/{REST,Node}.ts", "src/Queue/{Track,Playlist}.ts"],
    },
  },
});
