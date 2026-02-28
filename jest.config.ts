import { createDefaultPreset } from "ts-jest";
import type { Config } from "jest";

const config: Config = {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["src/Functions/{utility,validation}.ts", "src/Queue/{Track,Playlist}.ts"],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  globals: {
    $clientName: "name",
    $clientVersion: "version",
    $clientRepository: "repository",
  },
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  ...createDefaultPreset(),
};

export default config;
