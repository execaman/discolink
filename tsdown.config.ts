import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const packageJsonString = readFileSync("./package.json", "utf8");
const { name, version, repository } = JSON.parse(packageJsonString);

export default defineConfig({
  define: {
    $clientName: `"${name}"`,
    $clientVersion: `"${version}"`,
    $clientRepository: `"${repository}"`,
  },
  dts: true,
  exports: false,
  treeshake: true,
  nodeProtocol: true,
  fixedExtension: false,
  outDir: "lib",
  target: "esnext",
  platform: "node",
  entry: "src/index.ts",
  format: ["cjs", "esm"],
  outputOptions: { comments: false },
  deps: { skipNodeModulesBundle: true },
});
