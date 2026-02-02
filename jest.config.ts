import { createDefaultPreset } from "ts-jest";
import type { Config } from "jest";

const config: Config = {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    "src/Functions/**/*.ts",
    "src/Queue/Playlist.ts",
    "src/Queue/Track.ts",
    "!src/Typings/**/*",
    "!src/**/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  globals: {
    $clientName: "name",
    $clientVersion: "version",
    $clientRepository: "repository",
  },
  preset: "ts-jest",
  testEnvironment: "node",
  ...createDefaultPreset(),
};

export default config;
