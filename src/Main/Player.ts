import { EventEmitter } from "node:events";
import { LoadType } from "../Typings";
import { isRecord, isString } from "../Functions";
import { NodeManager } from "../Node";
import { VoiceManager } from "../Voice";
import { Playlist, Queue, QueueManager, Track } from "../Queue";

import type {
  CreateQueueOptions,
  EmptyObject,
  PlayerEventMap,
  PlayerOptions,
  PlayOptions,
  Plugin,
  PluginRecord,
  RepeatMode,
  RequiredProp,
  SearchOptions,
  SearchResult,
} from "../Typings";
import { DefaultPlayerOptions } from "../Constants";

export class Player<
  Context extends Record<string, unknown> = EmptyObject,
  Plugins extends Plugin[] = Plugin[],
> extends EventEmitter<Plugins[number]["eventMap"] & PlayerEventMap> {
  #initialized = false;
  #clientId: string | null = null;
  #initPromise: Promise<void> | null = null;

  readonly nodes: NodeManager;
  readonly voices: VoiceManager;
  readonly queues: QueueManager<Context>;

  readonly options: RequiredProp<Omit<PlayerOptions<Plugins>, "plugins">, keyof typeof DefaultPlayerOptions>;
  readonly plugins: PluginRecord<Plugins>;

  constructor(options: PlayerOptions<Plugins>) {
    super({ captureRejections: false });

    const _options = { ...DefaultPlayerOptions, ...options };

    if (isRecord(_options, "non-empty")) this.options = _options;
    else throw new Error("Player options must be a non-empty object");

    if (_options.nodes.length === 0) throw new Error("Missing node options");

    this.nodes = new NodeManager(this);
    this.voices = new VoiceManager(this);
    this.queues = new QueueManager(this);

    this.plugins = {} as any;

    if (_options.plugins !== undefined) {
      for (const plugin of _options.plugins) (this.plugins as any)[plugin.name] = plugin;
      delete _options.plugins;
    }

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      nodes: immutable,
      voices: immutable,
      queues: immutable,
      options: immutable,
      plugins: immutable,
    } satisfies { [k in keyof Player]?: PropertyDescriptor });
  }

  get clientId() {
    return this.#clientId;
  }

  get initialized() {
    return this.#initialized;
  }

  async init(clientId: string) {
    if (this.#initPromise !== null) return this.#initPromise;
    if (this.#initialized) return;
    const resolver = Promise.withResolvers<void>();
    this.#initPromise = resolver.promise;
    this.#clientId = clientId;
    try {
      for (const node of this.options.nodes) this.nodes.create(node);
      for (const name in this.plugins) (this.plugins as any)[name].init(this);
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

  getQueue(guildId: string) {
    return this.queues.get(guildId);
  }

  async createQueue(options: CreateQueueOptions<Context>) {
    return this.queues.create(options);
  }

  async destroyQueue(guildId: string, reason?: string) {
    return this.queues.destroy(guildId, reason);
  }

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

  async jump(guildId: string, index: number) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.jump(index);
  }

  async pause(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.pause();
  }

  async previous(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.previous();
  }

  async resume(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.resume();
  }

  async seek(guildId: string, ms: number) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.seek(ms);
  }

  setAutoplay(guildId: string, autoplay?: boolean) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.setAutoplay(autoplay);
  }

  setRepeatMode(guildId: string, repeatMode: RepeatMode) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.setRepeatMode(repeatMode);
  }

  async setVolume(guildId: string, volume: number) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.setVolume(volume);
  }

  shuffle(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.shuffle();
  }

  async next(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.next();
  }

  async stop(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    return queue.stop();
  }
}
