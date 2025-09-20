import type { EmptyObject, JsonObject } from "../Utility";
import type { Exception, PlayerState, TrackEndReason } from "../API";
import type { CreateNodeOptions, NodeEventMap } from "../Node";
import type { CreateQueueOptions } from "../Queue";

import type { Node } from "../../Node";
import type { VoiceState } from "../../Voice";
import type { Playlist, Queue, Track } from "../../Queue";
import type { Player } from "../../Main";

type ExcludeLast<T extends any[]> = T extends [...infer Items, any] ? Items : never;

export interface PlayerEventMap extends Record<string & {}, any> {
  init: [];

  nodeConnect: [node: Node, ...ExcludeLast<NodeEventMap["connect"]>];
  nodeReady: [node: Node, ...ExcludeLast<NodeEventMap["ready"]>];
  nodeDispatch: [node: Node, ...ExcludeLast<NodeEventMap["dispatch"]>];
  nodeError: [node: Node, ...ExcludeLast<NodeEventMap["error"]>];
  nodeClose: [node: Node, ...ExcludeLast<NodeEventMap["close"]>];
  nodeDisconnect: [node: Node, ...ExcludeLast<NodeEventMap["disconnect"]>];

  voiceConnect: [voice: VoiceState];
  voiceClose: [voice: VoiceState, code: number, reason: string, byRemote: boolean];
  voiceChange: [voice: VoiceState, previousNode: Node, wasPlaying: boolean];
  voiceDestroy: [voice: VoiceState, reason: string];

  queueCreate: [queue: Queue];
  queueUpdate: [queue: Queue, state: PlayerState];
  queueFinish: [queue: Queue];
  queueDestroy: [queue: Queue, reason: string];

  trackStart: [queue: Queue, track: Track];
  trackStuck: [queue: Queue, track: Track, thresholdMs: number];
  trackError: [queue: Queue, track: Track, exception: Exception];
  trackFinish: [queue: Queue, track: Track, reason: TrackEndReason];
}

export interface Plugin {
  readonly name: string;
  eventMap: Record<string & {}, any[]>;
  init(player: Player): void;
}

export type PluginRecord<Plugins extends Plugin[]> = {
  [Name in Plugins[number]["name"]]: Extract<Plugins[number], { name: Name }>;
};

export interface PlayerOptions<Plugins extends Plugin[] = Plugin[]> {
  /**
   * Options for creating node(s)
   */
  nodes: CreateNodeOptions[];

  /**
   * Plugins to initialize after creating nodes
   */
  plugins?: Plugins;

  /**
   * Default prefix to use for search queries (not URLs).
   * Default: `ytsearch`
   */
  queryPrefix?: string;

  /**
   * Whether to relocate queues across nodes on disruption.
   * Default: `true`
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
   */
  fetchRelatedTracks?: (queue: Queue, track: Track) => Promise<Track[]>;
}

export interface VoiceUpdatePayload {
  op: 4;
  d: {
    guild_id: string;
    channel_id: string | null;
    self_deaf: boolean;
    self_mute: boolean;
  };
}

export interface SearchOptions {
  node?: string;
  prefix?: string;
}

export interface PlayOptions<
  Context extends Record<string, unknown> = EmptyObject,
  UserData extends JsonObject = EmptyObject,
> extends SearchOptions,
    CreateQueueOptions<Context> {
  userData?: UserData;
}

export interface TrackSearchResult {
  type: "track";
  data: Track;
}

export interface PlaylistSearchResult {
  type: "playlist";
  data: Playlist;
}

export interface QuerySearchResult {
  type: "query";
  data: Track[];
}

export interface EmptySearchResult {
  type: "empty";
  data: [];
}

export interface ErrorSearchResult {
  type: "error";
  data: Exception;
}

export type SearchResult =
  | TrackSearchResult
  | PlaylistSearchResult
  | QuerySearchResult
  | EmptySearchResult
  | ErrorSearchResult;
