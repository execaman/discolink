import type { NodeOptions, RESTOptions } from "../Typings";

export const DefaultNodeOptions = Object.seal({
  statsInterval: 60_000,
  highestLatency: 2_000,
  reconnectDelay: 10_000,
  reconnectLimit: 3,
  handshakeTimeout: 5_000,
} as const satisfies Partial<Omit<NodeOptions, keyof RESTOptions>>);
