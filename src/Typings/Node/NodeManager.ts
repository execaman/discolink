import type { NodeOptions } from "./Node";

/**
 * Options for creating a node via manager
 */
export type CreateNodeOptions = Omit<NodeOptions, "clientId">;

/**
 * NodeManager intrinsic data
 */
export interface NodeMetrics {
  memory: number;
  workload: number;
  streaming: number;
}
