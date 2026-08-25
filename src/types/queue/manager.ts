import type { PlayerUpdateRequestBody, QueueContext } from "@/types";

/**
 * Reasons for queue finish
 */
export const enum QueueEndReason {
  /**
   * The queue ended normally
   */
  Finished = "finished",

  /**
   * The queue ended for being empty with autoplay enabled
   */
  NoRelated = "noRelated",

  /**
   * The queue ended for an unsuccessful request to Lavalink
   */
  RequestFailed = "requestFailed",
}

/**
 * Options for creating a queue via manager
 */
export interface CreateQueueOptions<Context extends Record<string, unknown> = QueueContext> extends Pick<
  PlayerUpdateRequestBody,
  "filters" | "volume"
> {
  guildId: string;
  voiceId: string;
  node?: string;
  context?: Context;
}
