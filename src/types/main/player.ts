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
  /**
   * Fired when the player is initialized.
   */
  init: [];

  /**
   * Fired when connection to a node succeeds.
   */
  nodeConnect: [node: Node, ...TuplePop<NodeEventMap["connect"]>];

  /**
   * Fired when a connected node signals ready.
   */
  nodeReady: [node: Node, ...TuplePop<NodeEventMap["ready"]>];

  /**
   * Fired when a node receives a payload.
   */
  nodeDispatch: [node: Node, ...TuplePop<NodeEventMap["dispatch"]>];

  /**
   * Fired when connection to a node errors.
   */
  nodeError: [node: Node, ...TuplePop<NodeEventMap["error"]>];

  /**
   * Fired when connection to a node closes and enters reconnecting.
   *
   * This event is skipped for `nodeDisconnect` in case of explicit disconnects or nodes with reconnections disabled.
   */
  nodeClose: [node: Node, ...TuplePop<NodeEventMap["close"]>];

  /**
   * Fired when a node is disconnected and no longer reconnecting.
   */
  nodeDisconnect: [node: Node, ...TuplePop<NodeEventMap["disconnect"]>];

  /**
   * Fired when a new (or disconnected) {@linkcode VoiceState}'s node connects to a voice server.
   */
  voiceConnect: [voice: VoiceState];

  /**
   * Fired when the connection between a {@linkcode VoiceState}'s node and voice server closes.
   *
   * Depending on the close code and {@linkcode PlayerOptions.voiceReconnect}, the {@linkcode VoiceState} will attempt a reconnect.
   */
  voiceClose: [voice: VoiceState, code: number, reason: string, byRemote: boolean];

  /**
   * Fired when a {@linkcode VoiceState}'s node is changed.
   */
  voiceChange: [voice: VoiceState, previousNode: Node, wasPlaying: boolean];

  /**
   * Fired when a {@linkcode VoiceState} has failed to reconnect and disconnected.
   *
   * As such, this event will never fire if {@linkcode PlayerOptions.voiceReconnect} is disabled.
   */
  voiceDisconnect: [voice: VoiceState, details: VoiceDisconnectDetails];

  /**
   * Fired when a queue is created.
   */
  queueCreate: [queue: Queue];

  /**
   * Fired when a queue's lavalink player state updates.
   */
  queueUpdate: [queue: Queue, state: PlayerState];

  /**
   * Fired when a queue finishes.
   */
  queueFinish: [queue: Queue, reason: QueueEndReason, error?: Error];

  /**
   * Fired when a queue is destroyed.
   */
  queueDestroy: [queue: Queue, reason: string];

  /**
   * Fired when a track starts playing.
   */
  trackStart: [queue: Queue, track: Track];

  /**
   * Fired when a track is stuck.
   */
  trackStuck: [queue: Queue, track: Track, thresholdMs: number];

  /**
   * Fired when a track errors.
   */
  trackError: [queue: Queue, track: Track, exception: Exception];

  /**
   * Fired when a track finishes.
   */
  trackFinish: [queue: Queue, track: Track, reason: TrackEndReason];
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

export interface BaseSearchResult {
  /**
   * Name of the node this result came from
   */
  node: string;
}

/**
 * Track search result
 */
export interface TrackSearchResult extends BaseSearchResult {
  type: "track";
  data: Track;
}

/**
 * Playlist search result
 */
export interface PlaylistSearchResult extends BaseSearchResult {
  type: "playlist";
  data: Playlist;
}

/**
 * Query search result
 */
export interface QuerySearchResult extends BaseSearchResult {
  type: "query";
  data: Track[];
}

/**
 * Empty search result
 */
export interface EmptySearchResult extends BaseSearchResult {
  type: "empty";
  data: [];
}

/**
 * Error search result
 */
export interface ErrorSearchResult extends BaseSearchResult {
  type: "error";
  data: Exception;
}

/**
 * Search result
 */
export type SearchResult =
  TrackSearchResult | PlaylistSearchResult | QuerySearchResult | EmptySearchResult | ErrorSearchResult;
