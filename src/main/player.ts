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
      throw err;
    } finally {
      this.#initPromise = null;
    }
  }

  /**
   * Returns the queue of a guild
   * @param guildId Id of the guild
   * @param error Whether to throw an error if queue is not found
   */
  getQueue(guildId: string): Queue<Context> | undefined;
  getQueue(guildId: string, error: true): Queue<Context>;
  getQueue(guildId: string, error?: true) {
    const queue = this.queues.get(guildId);
    if (error && !queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue;
  }

  /**
   * Creates a queue from options
   * @param options Options to create from
   */
  async createQueue(options: CreateQueueOptions<Context>) {
    return this.queues.create(options);
  }

  /**
   * Destroys the queue of a guild
   * @param guildId Id of the guild
   * @param reason Reason for destroying
   */
  async destroyQueue(guildId: string, reason?: string) {
    return this.queues.destroy(guildId, reason);
  }

  /**
   * Searches for results based on query and options
   * @param query Query (or URL as well)
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
   * Adds or searches if source is query and resumes the queue if stopped
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
   * Jumps to the specified index in queue of a guild
   * @param guildId Id of the guild
   * @param index Index to jump to
   */
  async jump(guildId: string, index: number) {
    return this.getQueue(guildId, true).jump(index);
  }

  /**
   * Pauses the queue of a guild
   * @param guildId Id of the guild
   */
  async pause(guildId: string) {
    return this.getQueue(guildId, true).pause();
  }

  /**
   * Plays the previous track in queue of a guild
   * @param guildId Id of the guild
   */
  async previous(guildId: string) {
    return this.getQueue(guildId, true).previous();
  }

  /**
   * Resumes the queue of a guild
   * @param guildId Id of the guild
   */
  async resume(guildId: string) {
    return this.getQueue(guildId, true).resume();
  }

  /**
   * Seeks to a position in the current track of a guild
   * @param guildId Id of the guild
   * @param ms Position in milliseconds
   */
  async seek(guildId: string, ms: number) {
    return this.getQueue(guildId, true).seek(ms);
  }

  /**
   * Enables or disables autoplay for the queue of a guild
   * @param guildId Id of the guild
   * @param autoplay Whether to enable autoplay
   */
  setAutoplay(guildId: string, autoplay?: boolean) {
    return this.getQueue(guildId, true).setAutoplay(autoplay);
  }

  /**
   * Sets the repeat mode for the queue of a guild
   * @param guildId Id of the guild
   * @param repeatMode The repeat mode
   */
  setRepeatMode(guildId: string, repeatMode: RepeatMode) {
    return this.getQueue(guildId, true).setRepeatMode(repeatMode);
  }

  /**
   * Sets the volume of the queue of a guild
   * @param guildId Id of the guild
   * @param volume The volume to set
   */
  async setVolume(guildId: string, volume: number) {
    return this.getQueue(guildId, true).setVolume(volume);
  }

  /**
   * Shuffles tracks for the queue of a guild
   * @param guildId Id of the guild
   * @param includePrevious Whether to pull previous tracks to current
   */
  shuffle(guildId: string, includePrevious?: boolean) {
    return this.getQueue(guildId, true).shuffle(includePrevious);
  }

  /**
   * Plays the next track in queue of a guild
   * @param guildId Id of the guild
   */
  async next(guildId: string) {
    return this.getQueue(guildId, true).next();
  }

  /**
   * Stops the queue of a guild
   * @param guildId Id of the guild
   */
  async stop(guildId: string) {
    return this.getQueue(guildId, true).stop();
  }
}
