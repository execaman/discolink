import type { Node } from "@/node";
import type { Player } from "@/main";
import type { VoiceState } from "@/voice";
import type { Playlist, Queue, Track } from "@/queue";
import type { DefaultPlayerOptions } from "@/constants";
import type {
  CommonUserData,
  CreateNodeOptions,
  CreateQueueOptions,
  Exception,
  JsonObject,
  NodeEventMap,
  PlayerState,
  QueueContext,
  QueueEndReason,
  RequiredProp,
  TrackEndReason,
  TuplePop,
  VoiceDisconnectDetails,
} from "@/types";

export interface PlayerEventMap {
  init: [];

  nodeConnect: [node: Node, ...TuplePop<NodeEventMap["connect"]>];
  nodeReady: [node: Node, ...TuplePop<NodeEventMap["ready"]>];
  nodeDispatch: [node: Node, ...TuplePop<NodeEventMap["dispatch"]>];
  nodeError: [node: Node, ...TuplePop<NodeEventMap["error"]>];
  nodeClose: [node: Node, ...TuplePop<NodeEventMap["close"]>];
  nodeDisconnect: [node: Node, ...TuplePop<NodeEventMap["disconnect"]>];

  voiceConnect: [voice: VoiceState];
  voiceClose: [voice: VoiceState, code: number, reason: string, byRemote: boolean];
  voiceChange: [voice: VoiceState, previousNode: Node, wasPlaying: boolean];
  voiceDestroy: [voice: VoiceState, reason: string];
  voiceDisconnect: [voice: VoiceState, details: VoiceDisconnectDetails];

  queueCreate: [queue: Queue];
  queueUpdate: [queue: Queue, state: PlayerState];
  queueFinish: [queue: Queue, reason: QueueEndReason, error?: Error];
  queueDestroy: [queue: Queue, reason: string];

  trackStart: [queue: Queue, track: Track, inQueue: boolean];
  trackStuck: [queue: Queue, track: Track, thresholdMs: number, inQueue: boolean];
  trackError: [queue: Queue, track: Track, exception: Exception, inQueue: boolean];
  trackFinish: [queue: Queue, track: Track, reason: TrackEndReason, inQueue: boolean];
}

/**
 * Interface for plugins to implement
 */
export interface PlayerPlugin<EventMap extends Record<string, unknown[]> = {}> {
  readonly _: EventMap;
  readonly name: string;
  init(player: Player): void;
}

/**
 * Constructs a record type mapping plugins by their names
 */
export type PluginRecord<Plugins extends PlayerPlugin[]> = {
  [Name in Plugins[number]["name"]]: Extract<Plugins[number], { name: Name }>;
};

/**
 * Options for creating a Player
 */
export interface PlayerOptions<Plugins extends PlayerPlugin[] = PlayerPlugin[]> {
  /**
   * Options for creating nodes on init
   */
  nodes?: CreateNodeOptions[];

  /**
   * Plugins to initialize after creating nodes
   */
  plugins?: Plugins;

  /**
   * Whether to initialize automatically upon receiving the bot's ready event.
   * @default true
   */
  autoInit?: boolean;

  /**
   * Whether to update players for nodes that couldn't resume.
   * @default true
   */
  autoSync?: boolean;

  /**
   * The prefix to use for search queries (not URLs) by default.
   * @default "ytsearch"
   */
  queryPrefix?: string;

  /**
   * Timeout for voice updates from Discord in ms.
   * @default 10_000
   */
  voiceTimeout?: number;

  /**
   * Whether to reconnect (=> rejoin) for these voice close codes:
   * - `4004` - incorrect token
   * - `4011` - server not found
   * - `4006` - session invalid
   *
   * You might want to turn this off for handling edge cases like being dragged into a private voice channel, etc.
   * @default true
   */
  voiceReconnect?: boolean;

  /**
   * Whether to relocate queues when a node closes/disconnects.
   * @default true
   */
  relocateQueues?: boolean;

  /**
   * Forward voice state updates to your bot's gateway connection
   * @param guildId Id of the guild this voice update is meant for
   * @param payload The voice state update payload to be forwarded
   */
  forwardVoiceUpdate: (guildId: string, payload: VoiceUpdatePayload) => Promise<void>;

  /**
   * Return empty or populated array of related tracks
   * @param queue The queue requesting track(s)
   * @param track The track suggested for reference
   * @remarks DO NOT throw an error
   */
  fetchRelatedTracks?: (queue: Queue, track: Track) => Promise<Track[]>;
}

export type PlayerInstanceOptions = Omit<RequiredProp<PlayerOptions, keyof typeof DefaultPlayerOptions>, "plugins">;

/**
 * Voice state update payload
 */
export interface VoiceUpdatePayload {
  op: 4;
  d: {
    guild_id: string;
    channel_id: string | null;
    self_deaf: boolean;
    self_mute: boolean;
  };
}

/**
 * Options for searching tracks
 */
export interface SearchOptions {
  node?: string;
  prefix?: string;
}

/**
 * Options for playing tracks
 */
export interface PlayOptions<
  Context extends Record<string, unknown> = QueueContext,
  UserData extends JsonObject = CommonUserData,
>
  extends SearchOptions, CreateQueueOptions<Context> {
  userData?: UserData;
}

/**
 * Track search result
 */
export interface TrackSearchResult {
  type: "track";
  data: Track;
}

/**
 * Playlist search result
 */
export interface PlaylistSearchResult {
  type: "playlist";
  data: Playlist;
}

/**
 * Query search result
 */
export interface QuerySearchResult {
  type: "query";
  data: Track[];
}

/**
 * Empty search result
 */
export interface EmptySearchResult {
  type: "empty";
  data: [];
}

/**
 * Error search result
 */
export interface ErrorSearchResult {
  type: "error";
  data: Exception;
}

/**
 * Search result
 */
export type SearchResult =
  TrackSearchResult | PlaylistSearchResult | QuerySearchResult | EmptySearchResult | ErrorSearchResult;
