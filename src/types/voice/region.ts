/**
 * VoiceRegion ping stats for a node
 * @internal
 */
export interface VoiceNodePingStats {
  samples: number[];
  startTime: number;
  lastProbe: number;
}
