import type { PlayerOptions } from "../Typings";

export const DefaultPlayerOptions = Object.seal({
  queryPrefix: "ytsearch",
  relocateQueues: true,
  async fetchRelatedTracks() {
    return [];
  },
} as const satisfies Partial<PlayerOptions>);
