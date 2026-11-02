import { LoadType } from "@/types";
import { NodeManager } from "@/node";
import { VoiceManager } from "@/voice";
import { isPlugin, isString } from "@/functions";
import { Playlist, Queue, QueueManager, Track } from "@/queue";
import { DefaultPlayerOptions, SnowflakeRegex } from "@/constants";
import { EventEmitter } from "node:events";

import type {
  ConstrainEventMap,
  CreateQueueOptions,
  MergeUnionType,
  PlayOptions,
  PlayerEventMap,
  PlayerInstanceOptions,
  PlayerOptions,
  PlayerPlugin,
  PluginEventMap,
  PluginRecord,
  QueueContext,
  RepeatMode,
  SearchOptions,
  SearchResult,
} from "@/types";

/**
 * Main class putting together all essential managers, also the entry point to get you started
 */
export class Player<
  Context extends Record<string, unknown> = QueueContext,
  Plugins extends PlayerPlugin[] = [],
> extends EventEmitter<ConstrainEventMap<PlayerEventMap & MergeUnionType<PluginEventMap<Plugins[number]>>>> {
  #initialized = false;
  #initPromise: Promise<void> | null = null;

  #clientId: string | null = null;

  readonly options: PlayerInstanceOptions;
  readonly plugins: PluginRecord<Plugins>;

  readonly nodes: NodeManager;
  readonly voices: VoiceManager;
  readonly queues: QueueManager<Context>;

  constructor(options: PlayerOptions<Plugins>) {
    super({ captureRejections: false });

    const _options = { ...DefaultPlayerOptions, ...options };

    if (typeof _options.forwardVoiceUpdate !== "function") throw new Error("Missing voice update function");

    this.options = _options;
    this.plugins = {} as PluginRecord<Plugins>;

    if (_options.plugins !== undefined) {
      for (const plugin of _options.plugins) {
        if (!isPlugin(plugin)) throw new Error("Invalid set of plugin(s)");
        (this.plugins as { [x: string]: PlayerPlugin })[plugin.name] = plugin;
      }
      delete _options.plugins;
    }

    this.nodes = new NodeManager(this);
    this.voices = new VoiceManager(this);
    this.queues = new QueueManager(this);

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      options: immutable,
      plugins: immutable,
      nodes: immutable,
      voices: immutable,
      queues: immutable,
    } satisfies { [k in keyof Player]?: PropertyDescriptor });
  }

  get ready() {
    return this.#initialized;
  }

  get clientId() {
    return this.#clientId;
  }

  async init(clientId: string, nodes = this.options.nodes!) {
    if (!isString(clientId, SnowflakeRegex)) throw new Error("Client Id is not a valid Discord Id");
    if (this.#initPromise !== null) return this.#initPromise;
    if (this.#initialized) return;

    const resolver = Promise.withResolvers<void>();
    this.#initPromise = resolver.promise;

    this.#clientId = clientId;
    try {
      nodes?.forEach((node) => this.nodes.create(node));
      for (const name in this.plugins) (this.plugins as { [x: string]: PlayerPlugin })[name]!.init(this);
      await this.nodes.connect();
      this.#initialized = true;
      (this as Player).emit("init");
      resolver.resolve();
    } catch (err) {
      resolver.reject(err);
    } finally {
      this.#initPromise = null;
      return resolver.promise;
    }
  }

  /**
   * Get the queue of a guild
   * @param guildId Id of the guild
   */
  getQueue(guildId: string): Queue<Context> | undefined;
  /**
   * Get the queue of a guild
   * @param guildId Id of the guild
   * @param error Whether to throw an error if no queue is found
   */
  getQueue(guildId: string, error: true): Queue<Context>;
  getQueue(guildId: string, error?: true) {
    const queue = this.queues.get(guildId);
    if (error && !queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue;
  }

  /**
   * Create (or get) the queue of a guild
   * @param options Options for customization
   */
  async createQueue(options: CreateQueueOptions<Context>) {
    return this.queues.create(options);
  }

  /**
   * Destroy the queue of a guild
   * @param guildId Id of the guild
   * @param reason Reason for destroying
   */
  async destroyQueue(guildId: string, reason?: string) {
    return this.queues.destroy(guildId, reason);
  }

  /**
   * Search tracks by query
   * @param query Query or URL
   * @param options Options for customization
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    if (!isString(query, "non-empty")) throw new Error("Query must be a non-empty string");

    const node = options?.node === undefined ? this.nodes.relevant()[0] : this.nodes.get(options.node);
    if (!node) throw new Error(options?.node === undefined ? "No nodes available" : `Node '${options.node}' not found`);

    query = isString(query, "url") ? query : `${options?.prefix ?? this.options.queryPrefix}:${query}`;
    const result = await node.rest.loadTracks(query);

    switch (result.loadType) {
      case LoadType.Empty:
        return { node: node.name, type: "empty", data: [] };
      case LoadType.Error:
        return { node: node.name, type: "error", data: result.data };
      case LoadType.Playlist:
        return { node: node.name, type: "playlist", data: new Playlist(result.data) };
      case LoadType.Search:
        return { node: node.name, type: "query", data: result.data.map((t) => new Track(t)) };
      case LoadType.Track:
        return { node: node.name, type: "track", data: new Track(result.data) };
      default:
        throw new Error(`Unexpected load result type from node '${node.name}'`);
    }
  }

  /**
   * Add (or search) and play the first resolvable track from source
   * @param source Source to play from
   * @param options Options for customization
   */
  async play(source: string | Parameters<Queue["add"]>[0], options: PlayOptions<Context>) {
    let queue = this.queues.get(options.guildId);
    if (typeof source === "string") {
      let result: SearchResult;
      if (!queue) result = await this.search(source, options);
      else result = await queue.search(source, options.prefix);
      if (result.type === "empty") throw new Error(`No results found for '${source}'`);
      if (result.type === "error") throw new Error(result.data.message ?? result.data.cause, { cause: result.data });
      source = result.type === "query" ? result.data[0]! : result.data;
    }
    queue ??= await this.queues.create(options);
    if (options.context !== undefined) Object.assign(queue.context, options.context);
    queue.add(source, options.userData);
    if (queue.stopped) await queue.resume();
    return queue;
  }

  /**
   * Jump to a specific track in queue
   * @param guildId Id of the guild
   * @param index Index of the track
   */
  async jump(guildId: string, index: number) {
    return this.getQueue(guildId, true).jump(index);
  }

  /**
   * Pause the queue of a guild
   * @param guildId Id of the guild
   */
  async pause(guildId: string) {
    return this.getQueue(guildId, true).pause();
  }

  /**
   * Play the previous track in queue
   * @param guildId Id of the guild
   */
  async previous(guildId: string) {
    return this.getQueue(guildId, true).previous();
  }

  /**
   * Resume the queue of a guild
   * @param guildId Id of the guild
   */
  async resume(guildId: string) {
    return this.getQueue(guildId, true).resume();
  }

  /**
   * Seek to a specific position in the current track
   * @param guildId Id of the guild
   * @param ms Position in milliseconds
   */
  async seek(guildId: string, ms: number) {
    return this.getQueue(guildId, true).seek(ms);
  }

  /**
   * Set autoplay of a queue
   * @param guildId Id of the guild
   * @param autoplay Whether to enable autoplay (`false` by default)
   */
  setAutoplay(guildId: string, autoplay?: boolean) {
    return this.getQueue(guildId, true).setAutoplay(autoplay);
  }

  /**
   * Set repeat mode of a queue
   * @param guildId Id of the guild
   * @param repeatMode `track`, `queue`, `none` (`none` by default)
   */
  setRepeatMode(guildId: string, repeatMode: RepeatMode) {
    return this.getQueue(guildId, true).setRepeatMode(repeatMode);
  }

  /**
   * Set volume of a queue
   * @param guildId Id of the guild
   * @param volume Numeric value between 0 and 1000
   */
  async setVolume(guildId: string, volume: number) {
    return this.getQueue(guildId, true).setVolume(volume);
  }

  /**
   * Shuffle tracks of a queue
   * @param guildId Id of the guild
   * @param includePrevious Whether to move previous tracks to current
   */
  shuffle(guildId: string, includePrevious?: boolean) {
    return this.getQueue(guildId, true).shuffle(includePrevious);
  }

  /**
   * Play the next track in queue
   * @param guildId Id of the guild
   */
  async next(guildId: string) {
    return this.getQueue(guildId, true).next();
  }

  /**
   * Stop the queue of a guild
   * @param guildId Id of the guild
   */
  async stop(guildId: string) {
    return this.getQueue(guildId, true).stop();
  }
}
