import { defineConfig } from "tsup";
import { name, version, repository } from "./package.json";

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
