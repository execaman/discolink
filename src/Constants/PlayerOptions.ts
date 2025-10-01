import type { PlayerOptions } from "../Typings";

/**
 * These options are writable but neither extendable, nor configurable
 */
export const DefaultPlayerOptions = Object.seal({
  queryPrefix: "ytsearch",
  relocateQueues: true,
  async fetchRelatedTracks() {
    return [];
  },
} as const satisfies Partial<PlayerOptions>);
