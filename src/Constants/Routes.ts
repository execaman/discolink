/**
 * An object holding methods that construct api routes based on params
 */
export const Routes = {
  websocket() {
    return "/websocket" as const;
  },

  trackLoading() {
    return "/loadtracks" as const;
  },

  trackDecoding(multiple?: boolean) {
    if (multiple) return "/decodetracks" as const;
    return "/decodetrack" as const;
  },

  player(sessionId: string, guildId?: string) {
    if (guildId) return `/sessions/${sessionId}/players/${guildId}` as const;
    return `/sessions/${sessionId}/players` as const;
  },

  session(sessionId: string) {
    return `/sessions/${sessionId}` as const;
  },

  info() {
    return "/info" as const;
  },

  stats() {
    return "/stats" as const;
  },

  routePlanner(free?: "address" | "all") {
    if (free) return `/routeplanner/free/${free}` as const;
    return "/routeplanner/status" as const;
  },
};
