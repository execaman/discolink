import type { NonNullableProp } from "../Utility";
import type { PlayerState } from "../API";
import type { CreateQueueOptions } from "../Queue";

/**
 * Common info in Discord's 'dispatch' payload type
 */
export interface CommonDispatchPayloadInfo {
  op: 0;
  s: number;
}

/**
 * Discord client ready payload (partial, essential only)
 */
export interface ClientReadyPayload extends CommonDispatchPayloadInfo {
  t: "READY";
  d: { user: { id: string } };
}

/**
 * Discord voice state update payload
 */
export interface VoiceStateUpdatePayload extends CommonDispatchPayloadInfo {
  t: "VOICE_STATE_UPDATE";
  d: {
    guild_id?: string;
    channel_id: string | null;
    user_id: string;
    session_id: string;
    deaf: boolean;
    mute: boolean;
    self_deaf: boolean;
    self_mute: boolean;
    suppress: boolean;
  };
}

/**
 * Discord voice server update payload
 */
export interface VoiceServerUpdatePayload extends CommonDispatchPayloadInfo {
  t: "VOICE_SERVER_UPDATE";
  d: {
    token: string;
    guild_id: string;
    endpoint: string | null;
  };
}

/**
 * VoiceManager intrinsic data
 */
export interface VoiceStateInfo
  extends NonNullableProp<Omit<VoiceStateUpdatePayload["d"], "user_id" | "guild_id">, "channel_id">,
    NonNullableProp<VoiceServerUpdatePayload["d"], "endpoint">,
    Pick<PlayerState, "connected" | "ping"> {
  node_session_id: string;
  region_id: string;
}

/**
 * Options for customizing the player while connecting
 */
export interface ConnectOptions extends Pick<CreateQueueOptions, "context" | "filters" | "node" | "volume"> {}
