import type { EmptyObject } from "../Utility";
import type { PlayerUpdateRequestBody } from "../API";

/**
 * Options for creating a queue via manager
 */
export interface CreateQueueOptions<Context extends Record<string, unknown> = EmptyObject> extends Pick<
  PlayerUpdateRequestBody,
  "filters" | "volume"
> {
  guildId: string;
  voiceId: string;
  node?: string;
  context?: Context;
}
