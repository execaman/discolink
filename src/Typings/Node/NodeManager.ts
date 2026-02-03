import type { NodeOptions } from "./Node";

/**
 * Options for creating a node via manager
 */
export type CreateNodeOptions = Omit<NodeOptions, "clientId">;

/**
 * Types of node features for support evaluation
 */
export type FeatureTypes = "filter" | "source" | "plugin";

/**
 * Simplified node stats for relevance evaluation.
 *
 * The value of each field lies within [0, 1]
 * except `streaming`, where -1 reports insufficient data
 */
export interface NodeMetrics {
  memory: number;
  workload: number;
  streaming: number;
}
