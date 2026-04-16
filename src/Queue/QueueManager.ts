import { setImmediate } from "node:timers/promises";
import { EventType, TrackEndReason } from "../Typings";
import {
  LastTrackSymbol,
  LookupSymbol,
  OnEventUpdateSymbol,
  OnPingUpdateSymbol,
  OnStateUpdateSymbol,
  OnVoiceCloseSymbol,
  UpdateSymbol,
} from "../Constants/Symbols";
import { isRecord, noop } from "../Functions";
import { Queue, Track } from "./index";
import type {
  APIPlayer,
  PlayerUpdatePayload,
  EventPayload,
  TrackEndEventPayload,
  CreateQueueOptions,
  TrackStartEventPayload,
  TrackExceptionEventPayload,
  TrackStuckEventPayload,
  QueueContext,
  APITrack,
} from "../Typings";
import type { Player } from "../Main";

/**
 * Utility class for managing queues
 */
export class QueueManager<Context extends Record<string, unknown> = QueueContext> implements Partial<
  Map<string, Queue<Context>>
> {
  #cache = new Map<string, APIPlayer>();
  #queues = new Map<string, Queue<Context>>();

  #destroys = new Map<string, Promise<void>>();
  #relocations = new Map<string, Promise<void>>();

  readonly player: Player;

  constructor(player: Player) {
    if (player.queues === undefined) this.player = player;
    else throw new Error("Manager already exists for this Player");

    Object.defineProperty(this, "player" satisfies keyof QueueManager, {
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  get size() {
    return this.#queues.size;
  }

  get(guildId: string) {
    return this.#queues.get(guildId);
  }

  has(guildId: string) {
    return this.#queues.has(guildId);
  }

  keys() {
    return this.#queues.keys();
  }

  values() {
    return this.#queues.values();
  }

  entries() {
    return this.#queues.entries();
  }

  /**
   * Create a queue
   * @param options Options for creating the queue
   */
  async create(options: CreateQueueOptions<Context>) {
    if (!isRecord(options)) throw new Error("Queue create options must be an object");

    const guildId = options.guildId;
    if (this.#queues.has(guildId)) return this.#queues.get(guildId)!;

    if (!this.player.voices.has(guildId)) {
      await this.player.voices.connect(guildId, options.voiceId, options);
      return this.#queues.get(guildId)!;
    }

    const queue = new Queue<Context>(this.player, guildId, options.context);
    this.#queues.set(guildId, queue);

    this.player.emit("queueCreate", queue);
    return queue;
  }

  /**
   * Destroy a queue
   * @param guildId Id of the guild
   * @param reason Reason for destroying
   */
  async destroy(guildId: string, reason = "destroyed") {
    if (this.#destroys.has(guildId)) return this.#destroys.get(guildId)!;

    const queue = this.#queues.get(guildId);
    if (!queue) return;

    const resolver = Promise.withResolvers<void>();
    this.#destroys.set(guildId, resolver.promise);

    await queue.rest.destroyPlayer(guildId).catch(noop);

    this.#cache.delete(guildId);
    this.#queues.delete(guildId);

    this.player.emit("queueDestroy", queue, reason);

    await this.player.voices.destroy(guildId, reason);

    resolver.resolve();
    this.#destroys.delete(guildId);
  }

  /**
   * Sync multiple lavalink player data
   * @param node Name of the node
   * @param target Target to update (`local` for queues, `remote` for node)
   */
  async sync(node: string, target: "local" | "remote" = "local") {
    const _node = this.player.nodes.get(node);

    if (!_node) throw new Error(`Node '${node}' not found`);
    if (!_node.ready) throw new Error(`Node '${node}' not ready`);

    if (target === "local") {
      const players = await _node.rest.fetchPlayers();
      for (const player of players) this[UpdateSymbol](player.guildId, player);
      return;
    }
    if (target === "remote") {
      const queues = this.#queues.values().filter((q) => q.node.name === node);
      for (const queue of queues) await queue.sync("remote").then(setImmediate, noop);
      return;
    }
    throw new Error("Target must be 'local' or 'remote'");
  }

  /**
   * Relocate all queues of a specific node
   * @param node Name of the node
   */
  async relocate(node: string) {
    if (this.#relocations.has(node)) return this.#relocations.get(node)!;

    const nodes = [] as {
      name: string;
      load: number;
      score: number;
      target: number;
    }[];

    let totalScore = 0;

    for (const [name, stats] of this.player.nodes.metrics) {
      if (name === node || !this.player.nodes.state(name, "ready")) continue;
      const score = stats.memory * 0.6 + stats.workload * 0.4;
      totalScore += score;
      nodes.push({ name, score, load: 0, target: 0 });
    }

    if (nodes.length === 0) return;

    let totalLoad = 0;

    const isEligible = (q: Queue) => q.node.name === node && !q.destroyed && !q.voice.reconnecting;

    const queues = this.#queues.values().reduce<{ load: number; value: Queue }[]>((t, q) => {
      if (!isEligible(q)) return t;
      const load = this.#cache.get(q.guildId)!.track === null ? 1 : 2;
      totalLoad += load;
      t.push({ load, value: q });
      return t;
    }, []);

    if (queues.length === 0) return;

    const resolver = Promise.withResolvers<void>();
    this.#relocations.set(node, resolver.promise);

    queues.sort((a, b) => a.load - b.load);

    for (const n of nodes) {
      n.score /= totalScore;
      n.target = n.score * totalLoad;
    }

    do {
      const q = queues.pop()!;
      if (!isEligible(q.value)) continue;
      let curr = nodes[0]!;
      for (const n of nodes) {
        const cap = n.target - n.load;
        const currCap = curr.target - curr.load;
        if (cap > currCap) curr = n;
      }
      curr.load += q.load;
      try {
        await q.value.voice.changeNode(curr.name);
      } catch {}
      await setImmediate();
    } while (queues.length !== 0);

    resolver.resolve();
    this.#relocations.delete(node);
  }

  #getLocalTrack(queue: Queue, track: APITrack, replaced = false) {
    const trackId = track.info.identifier;
    const lastTrack = queue[LastTrackSymbol];
    if (lastTrack !== null) queue[LastTrackSymbol] = null;
    const _track =
      !replaced && queue.track?.id === trackId ? queue.track
      : lastTrack?.id === trackId ? lastTrack
      : null;
    return [_track ?? new Track(track), _track !== null] as const;
  }

  async #onTrackStart(queue: Queue, payload: TrackStartEventPayload) {
    this.player.emit("trackStart", queue, ...this.#getLocalTrack(queue, payload.track));
  }

  async #onTrackError(queue: Queue, payload: TrackExceptionEventPayload) {
    const [track, inQueue] = this.#getLocalTrack(queue, payload.track);
    this.player.emit("trackError", queue, track, payload.exception, inQueue);
  }

  async #onTrackStuck(queue: Queue, payload: TrackStuckEventPayload) {
    const [track, inQueue] = this.#getLocalTrack(queue, payload.track);
    this.player.emit("trackStuck", queue, track, payload.thresholdMs, inQueue);
  }

  async #onTrackEnd(queue: Queue, payload: TrackEndEventPayload) {
    const [track, inQueue] = this.#getLocalTrack(queue, payload.track, payload.reason === TrackEndReason.Replaced);
    switch (payload.reason) {
      case TrackEndReason.Cleanup:
        if (track.id !== queue.track?.id) break;
        queue.previousTracks.push(queue.tracks.shift()!);
        break;
      case TrackEndReason.Finished:
        if (track.id !== queue.track?.id) break;
        if (queue.repeatMode !== "track") queue.previousTracks.push(queue.tracks.shift()!);
        break;
      default:
        this.player.emit("trackFinish", queue, track, payload.reason, inQueue);
        return;
    }
    this.player.emit("trackFinish", queue, track, payload.reason, inQueue);
    try {
      if (queue.finished) {
        if (queue.hasPrevious && queue.repeatMode === "queue") queue.tracks.push(queue.previousTracks.shift()!);
        else if (queue.autoplay) await queue.addRelated(track);
      }
      if (queue.finished) this.player.emit("queueFinish", queue);
      else await queue.resume();
    } catch (err) {
      return this.destroy(queue.guildId, `${err.message ?? err}`);
    }
  }

  async [OnStateUpdateSymbol](payload: PlayerUpdatePayload) {
    const queue = this.#queues.get(payload.guildId);
    if (!queue) return;
    this[UpdateSymbol](payload.guildId, { state: payload.state });
    this.player.voices.regions.get(queue.voice.regionId)?.[OnPingUpdateSymbol](queue.node.name, payload.state);
    this.player.emit("queueUpdate", queue, payload.state);
  }

  async [OnEventUpdateSymbol](payload: EventPayload) {
    const cache = this.#cache.get(payload.guildId);
    const queue = this.#queues.get(payload.guildId);

    if (!cache || !queue) return;

    switch (payload.type) {
      case EventType.TrackStart:
        cache.track = payload.track;
        return this.#onTrackStart(queue, payload);

      case EventType.TrackEnd:
        cache.track = null;
        return this.#onTrackEnd(queue, payload);

      case EventType.TrackException:
        cache.track = null;
        return this.#onTrackError(queue, payload);

      case EventType.TrackStuck:
        cache.track = payload.track;
        return this.#onTrackStuck(queue, payload);

      case EventType.WebSocketClosed:
        cache.state.connected = false;
        return this.player.voices[OnVoiceCloseSymbol](queue.voice, payload);
    }
  }

  [LookupSymbol](guildId: string) {
    return this.#cache.get(guildId);
  }

  [UpdateSymbol](guildId: string, payload: Partial<APIPlayer>, partial = true) {
    const data = this.#cache.get(guildId);
    if (data !== undefined) Object.assign(data, payload);
    else if (!partial) this.#cache.set(guildId, payload as APIPlayer);
  }

  [Symbol.iterator]() {
    return this.#queues[Symbol.iterator]();
  }
}
