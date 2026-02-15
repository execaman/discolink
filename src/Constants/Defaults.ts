declare const $clientName: string;
declare const $clientVersion: string;
declare const $clientRepository: string;

import type { NodeOptions, PlayerOptions, RESTOptions } from "../Typings";

/**
 * Default REST constructor options
 */
export const DefaultRestOptions = Object.seal({
  version: 4,
  userAgent: $clientName + "/" + $clientVersion + " (" + $clientRepository + ")",
  stackTrace: false,
  requestTimeout: 10_000,
} as const satisfies Partial<RESTOptions>);

/**
 * Default Node constructor options
 */
export const DefaultNodeOptions = Object.seal({
  statsInterval: 60_000,
  highestLatency: 2_000,
  reconnectDelay: 10_000,
  reconnectLimit: 3,
  handshakeTimeout: 5_000,
} as const satisfies Partial<Omit<NodeOptions, keyof RESTOptions>>);

/**
 * Default Player constructor options
 */
export const DefaultPlayerOptions = Object.seal({
  autoInit: true,
  autoSync: true,
  queryPrefix: "ytsearch",
  relocateQueues: true,
  async fetchRelatedTracks() {
    return [];
  },
} as const satisfies Partial<PlayerOptions>);
