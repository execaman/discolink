import type { NodeOptions } from "./Node";

export type CreateNodeOptions = Omit<NodeOptions, "clientId">;

export interface NodeMetrics {
  memory: number;
  workload: number;
  streaming: number;
}
