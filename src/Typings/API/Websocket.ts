import type { APITrack } from "./Rest";

export const enum Severity {
  /**
   * The cause is known and expected, indicates that there is nothing wrong with the library itself
   */
  Common = "common",

  /**
   * The cause might not be exactly known, but is possibly caused by outside factors.
   * For example when an outside service responds in a format that we do not expect
   */
  Suspicious = "suspicious",

  /**
   * The probable cause is an issue with the library or there is no way to tell what the cause might be.
   * This is the default level and other levels are used in cases where the thrower has more in-depth knowledge about the error
   */
  Fault = "fault",
}

export const enum OPType {
  /**
   * Dispatched when you successfully connect to the Lavalink node
   */
  Ready = "ready",

  /**
   * Dispatched every x seconds with the latest player state
   */
  PlayerUpdate = "playerUpdate",

  /**
   * Dispatched when the node sends stats once per minute
   */
  Stats = "stats",

  /**
   * Dispatched when player or voice events occur
   */
  Event = "event",
}

export const enum EventType {
  /**
   * Dispatched when a track starts playing
   */
  TrackStart = "TrackStartEvent",

  /**
   * Dispatched when a track ends
   */
  TrackEnd = "TrackEndEvent",

  /**
   * Dispatched when a track throws an exception
   */
  TrackException = "TrackExceptionEvent",

  /**
   * Dispatched when a track gets stuck while playing
   */
  TrackStuck = "TrackStuckEvent",

  /**
   * Dispatched when the websocket connection to Discord voice servers is closed
   */
  WebSocketClosed = "WebSocketClosedEvent",
}

export const enum TrackEndReason {
  /**
   * The track finished playing.
   * May start next: true
   */
  Finished = "finished",

  /**
   * The track failed to load.
   * May start next: true
   */
  LoadFailed = "loadFailed",

  /**
   * The track was stopped.
   * May start next: false
   */
  Stopped = "stopped",

  /**
   * The track was replaced.
   * May start next: false
   */
  Replaced = "replaced",

  /**
   * The track was cleaned up.
   * May start next: false
   */
  Cleanup = "cleanup",
}

export interface ClientHeaders {
  /**
   * The password you set in your Lavalink config
   */
  Authorization: string;

  /**
   * The user id of the bot
   */
  "User-Id": string;

  /**
   * The name of the client in `NAME/VERSION` format
   */
  "Client-Name": string;

  /**
   * The id of the previous session to resume
   */
  "Session-Id"?: string;
}

export interface BaseMessagePayload {
  /**
   * The op type
   */
  op: OPType | string;
}

export interface ReadyPayload extends BaseMessagePayload {
  op: OPType.Ready;

  /**
   * Whether this session was resumed
   */
  resumed: boolean;

  /**
   * The Lavalink session id of this connection. Not to be confused with a Discord voice session id
   */
  sessionId: string;
}

export interface PlayerUpdatePayload extends BaseMessagePayload {
  op: OPType.PlayerUpdate;

  /**
   * The guild id of the player
   */
  guildId: string;

  /**
   * The player state
   */
  state: PlayerState;
}

export interface PlayerState {
  /**
   * Unix timestamp in milliseconds
   */
  time: number;

  /**
   * The position of the track in milliseconds
   */
  position: number;

  /**
   * Whether Lavalink is connected to the voice gateway
   */
  connected: boolean;

  /**
   * The ping of the node to the Discord voice server in milliseconds (`-1` if not connected)
   */
  ping: number;
}

export interface StatsPayload extends BaseMessagePayload, NodeStats {
  op: OPType.Stats;
}

export interface NodeStats {
  /**
   * The amount of players connected to the node
   */
  players: number;

  /**
   * The amount of players playing a track
   */
  playingPlayers: number;

  /**
   * The uptime of the node in milliseconds
   */
  uptime: number;

  /**
   * The memory stats of the node
   */
  memory: NodeMemory;

  /**
   * The cpu stats of the node
   */
  cpu: NodeCPU;

  /**
   * The frame stats of the node. `null` if the node has no players or when retrieved via `/v4/stats`
   */
  frameStats: FrameStats | null;
}

export interface NodeMemory {
  /**
   * The amount of free memory in bytes
   */
  free: number;

  /**
   * The amount of used memory in bytes
   */
  used: number;

  /**
   * The amount of allocated memory in bytes
   */
  allocated: number;

  /**
   * The amount of reservable memory in bytes
   */
  reservable: number;
}

export interface NodeCPU {
  /**
   * The amount of cores the node has
   */
  cores: number;

  /**
   * The system load of the node
   */
  systemLoad: number;

  /**
   * The load of Lavalink on the node
   */
  lavalinkLoad: number;
}

export interface FrameStats {
  /**
   * The amount of frames sent to Discord
   */
  sent: number;

  /**
   * The amount of frames that were nulled
   */
  nulled: number;

  /**
   * The difference between sent frames and the expected amount of frames
   * The expected amount of frames is 3000 (1 every 20 ms) per player.
   * If the deficit is negative, too many frames were sent, and if it's positive, not enough frames got sent.
   */
  deficit: number;
}

export interface BaseEventPayload extends BaseMessagePayload {
  op: OPType.Event;

  /**
   * The type of event
   */
  type: EventType | string;

  /**
   * The guild id
   */
  guildId: string;
}

export interface TrackStartEventPayload extends BaseEventPayload {
  type: EventType.TrackStart;

  /**
   * The track that started playing
   */
  track: APITrack;
}

export interface TrackEndEventPayload extends BaseEventPayload {
  type: EventType.TrackEnd;

  /**
   * The track that ended playing
   */
  track: APITrack;

  /**
   * The reason the track ended
   */
  reason: TrackEndReason;
}

export interface TrackExceptionEventPayload extends BaseEventPayload {
  type: EventType.TrackException;

  /**
   * The track that threw the exception
   */
  track: APITrack;

  /**
   * The occurred exception
   */
  exception: Exception;
}

export interface Exception {
  /**
   * The message of the exception
   */
  message: string | null;

  /**
   * The severity of the exception
   */
  severity: Severity;

  /**
   * The cause of the exception
   */
  cause: string;

  /**
   * The full stack trace of the cause
   */
  causeStackTrace: string;
}

export interface TrackStuckEventPayload extends BaseEventPayload {
  type: EventType.TrackStuck;

  /**
   * The track that got stuck
   */
  track: APITrack;

  /**
   * The threshold in milliseconds that was exceeded
   */
  thresholdMs: number;
}

export interface WebSocketClosedEventPayload extends BaseEventPayload {
  type: EventType.WebSocketClosed;

  /**
   * The [Discord close event code](https://discord.com/developers/docs/topics/opcodes-and-status-codes#voice-voice-close-event-codes)
   */
  code: number;

  /**
   * The close reason
   */
  reason: string;

  /**
   * Whether the connection was closed by Discord
   */
  byRemote: boolean;
}

export type EventPayload =
  | TrackStartEventPayload
  | TrackEndEventPayload
  | TrackExceptionEventPayload
  | TrackStuckEventPayload
  | WebSocketClosedEventPayload;

export type MessagePayload = ReadyPayload | PlayerUpdatePayload | StatsPayload | EventPayload;
