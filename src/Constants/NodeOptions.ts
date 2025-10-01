import type { NodeOptions, RESTOptions } from "../Typings";

/**
 * These options are writable but neither extendable, nor configurable
 */
export const DefaultNodeOptions = Object.seal({
  statsInterval: 60_000,
  highestLatency: 2_000,
  reconnectDelay: 10_000,
  reconnectLimit: 3,
  handshakeTimeout: 5_000,
} as const satisfies Partial<Omit<NodeOptions, keyof RESTOptions>>);
