import type { EmptyObject } from "../Utility";
import type { PlayerUpdateRequestBody } from "../API";

/**
 * Options for creating a queue via manager
 */
export interface CreateQueueOptions<Context extends Record<string, unknown> = EmptyObject>
  extends Pick<PlayerUpdateRequestBody, "filters" | "volume"> {
  guildId: string;
  voiceId: string;
  node?: string;
  context?: Context;
}

/**
 * https://discord.com/developers/docs/topics/opcodes-and-status-codes#voice-voice-close-event-codes
 */
export const enum VoiceCloseCodes {
  /**
   * You sent an invalid [opcode](https://discord.com/developers/docs/topics/opcodes-and-status-codes#voice-voice-opcodes).
   */
  UnknownOpcode = 4001,

  /**
   * You sent an invalid payload in your [identifying](https://discord.com/developers/docs/events/gateway-events#identify) to the Gateway.
   */
  FailedToDecodePayload,

  /**
   * You sent a payload before [identifying](https://discord.com/developers/docs/events/gateway-events#identify) with the Gateway.
   */
  NotAuthenticated,

  /**
   * The token you sent in your identify payload is incorrect.
   */
  AuthenticationFailed,

  /**
   * You sent more than one [identify](https://discord.com/developers/docs/events/gateway-events#identify) payload.
   */
  AlreadyAuthenticated,

  /**
   * Your session is no longer valid.
   */
  SessionNoLongerValid,

  /**
   * Your session has timed out.
   */
  SessionTimeout = 4009,

  /**
   * We can't find the server you're trying to connect to.
   */
  ServerNotFound = 4011,

  /**
   * We didn't recognize the [protocol](https://discord.com/developers/docs/topics/voice-connections#establishing-a-voice-udp-connection-example-select-protocol-payload) you sent.
   */
  UnknownProtocol,

  /**
   * Disconnect individual client (you were kicked, the main gateway session was dropped, etc.). Should not reconnect.
   */
  Disconnected = 4014,

  /**
   * The server crashed. Our bad! Try [resuming](https://discord.com/developers/docs/topics/voice-connections#resuming-voice-connection).
   */
  VoiceServerCrashed,

  /**
   * We didn't recognize your [encryption](https://discord.com/developers/docs/topics/voice-connections#transport-encryption-and-sending-voice).
   */
  UnknownEncryptionMode,

  /**
   * You sent a malformed request.
   */
  BadRequest = 4020,

  /**
   * Disconnect due to rate limit exceeded. Should not reconnect.
   */
  DisconnectedRateLimited,

  /**
   * Disconnect all clients due to call terminated (channel deleted, voice server changed, etc.). Should not reconnect.
   */
  DisconnectedCallTerminated,
}
