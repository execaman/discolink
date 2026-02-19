import { EventEmitter } from "node:events";
import { LoadType } from "../Typings";
import { DefaultPlayerOptions } from "../Constants";
import { isString } from "../Functions";
import { NodeManager } from "../Node";
import { VoiceManager } from "../Voice";
import { Playlist, Queue, QueueManager, Track } from "../Queue";
import type {
  CreateQueueOptions,
  PlayerEventMap,
  PlayerOptions,
  PlayOptions,
  PlayerPlugin,
  PluginRecord,
  RepeatMode,
  SearchOptions,
  SearchResult,
  CreateNodeOptions,
  PlayerInstanceOptions,
  QueueContext,
} from "../Typings";

export class Player<
  Context extends Record<string, unknown> = QueueContext,
  Plugins extends PlayerPlugin[] = PlayerPlugin[],
> extends EventEmitter<Plugins[number]["eventMap"] & PlayerEventMap> {
  #initialized = false;
  #initPromise: Promise<void> | null = null;

  #clientId: string | null = null;
  #nodes: CreateNodeOptions[] | null = null;

  readonly options: PlayerInstanceOptions;
  readonly plugins: PluginRecord<Plugins>;

  readonly nodes: NodeManager;
  readonly voices: VoiceManager;
  readonly queues: QueueManager<Context>;

  constructor(options: PlayerOptions<Plugins>) {
    super({ captureRejections: false });

    const _options = { ...DefaultPlayerOptions, ...options };

    if (_options.nodes.length === 0) throw new Error("Missing node create options");
    if (typeof _options.forwardVoiceUpdate !== "function") throw new Error("Missing voice update function");

    this.#nodes = _options.nodes;
    delete (_options as Partial<typeof _options>).nodes;

    this.options = _options;
    this.plugins = {} as PluginRecord<Plugins>;

    if (_options.plugins !== undefined) {
      for (const plugin of _options.plugins) (this.plugins as { [x: string]: PlayerPlugin })[plugin.name] = plugin;
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

  async init(clientId: string) {
    if (this.#initPromise !== null) return this.#initPromise;
    if (this.#initialized) return;
    const resolver = Promise.withResolvers<void>();
    this.#initPromise = resolver.promise;
    this.#clientId = clientId;
    try {
      for (const node of this.#nodes!) this.nodes.create(node);
      for (const name in this.plugins) (this.plugins as { [x: string]: PlayerPlugin })[name]!.init(this);
      await this.nodes.connect();
      this.#initialized = true;
      this.#nodes = null;
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
   */
  getQueue(guildId: string) {
    return this.queues.get(guildId);
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
    const node = options?.node !== undefined ? this.nodes.get(options.node) : this.nodes.relevant()[0];
    if (!node) {
      if (options?.node === undefined) throw new Error("No nodes available");
      throw new Error(`Node '${options.node}' not found`);
    }
    query = isString(query, "url") ? query : `${options?.prefix ?? this.options.queryPrefix}:${query}`;
    const result = await node.rest.loadTracks(query);
    switch (result.loadType) {
      case LoadType.Empty:
        return { type: "empty", data: [] };
      case LoadType.Error:
        return { type: "error", data: result.data };
      case LoadType.Playlist:
        return { type: "playlist", data: new Playlist(result.data) };
      case LoadType.Search:
        return { type: "query", data: result.data.map((t) => new Track(t)) };
      case LoadType.Track:
        return { type: "track", data: new Track(result.data) };
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
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.jump(index);
  }

  /**
   * Pauses the queue of a guild
   * @param guildId Id of the guild
   */
  async pause(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.pause();
  }

  /**
   * Plays the previous track in queue of a guild
   * @param guildId Id of the guild
   */
  async previous(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.previous();
  }

  /**
   * Resumes the queue of a guild
   * @param guildId Id of the guild
   */
  async resume(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.resume();
  }

  /**
   * Seeks to a position in the current track of a guild
   * @param guildId Id of the guild
   * @param ms Position in milliseconds
   */
  async seek(guildId: string, ms: number) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.seek(ms);
  }

  /**
   * Enables or disables autoplay for the queue of a guild
   * @param guildId Id of the guild
   * @param autoplay Whether to enable autoplay
   */
  setAutoplay(guildId: string, autoplay?: boolean) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.setAutoplay(autoplay);
  }

  /**
   * Sets the repeat mode for the queue of a guild
   * @param guildId Id of the guild
   * @param repeatMode The repeat mode
   */
  setRepeatMode(guildId: string, repeatMode: RepeatMode) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.setRepeatMode(repeatMode);
  }

  /**
   * Sets the volume of the queue of a guild
   * @param guildId Id of the guild
   * @param volume The volume to set
   */
  async setVolume(guildId: string, volume: number) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.setVolume(volume);
  }

  /**
   * Shuffles tracks for the queue of a guild
   * @param guildId Id of the guild
   * @param includePrevious Whether to pull previous tracks to current
   */
  shuffle(guildId: string, includePrevious?: boolean) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.shuffle(includePrevious);
  }

  /**
   * Plays the next track in queue of a guild
   * @param guildId Id of the guild
   */
  async next(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.next();
  }

  /**
   * Stops the queue of a guild
   * @param guildId Id of the guild
   */
  async stop(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.stop();
  }
}
