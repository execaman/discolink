import { defineConfig } from "tsdown";
import { readFileSync } from "node:fs";

const packageJsonString = readFileSync("./package.json", "utf8");
const { name, version, homepage } = JSON.parse(packageJsonString);

export default defineConfig({
  define: {
    $clientName: `"${name}"`,
    $clientVersion: `"${version}"`,
    $clientHomepage: `"${homepage}"`,
  },
  dts: true,
  exports: false,
  treeshake: true,
  nodeProtocol: true,
  fixedExtension: false,
  outDir: "dist",
  target: "es2025",
  platform: "node",
  entry: "src/index.ts",
  format: ["cjs", "esm"],
  outputOptions: { comments: false },
  deps: { skipNodeModulesBundle: true },
});
