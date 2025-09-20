import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const packageJsonString = readFileSync("./package.json", "utf8");
const { name, version, repository } = JSON.parse(packageJsonString);

export default defineConfig({
  clean: true,
  define: {
    $clientName: `"${name}"`,
    $clientVersion: `"${version}"`,
    $clientRepository: `"${repository}"`,
  },
  dts: true,
  entry: ["src/index.ts"],
  experimentalDts: false,
  format: ["cjs", "esm"],
  minify: false,
  outDir: "lib",
  platform: "node",
  removeNodeProtocol: false,
  skipNodeModulesBundle: true,
  target: "esnext",
  treeshake: true,
});
