import { Queue, Track } from "@/queue";
import { isRecord, noop } from "@/functions";
import { EventType, QueueEndReason, TrackEndReason } from "@/types";
import {
  OnEventUpdateSymbol,
  OnPingUpdateSymbol,
  OnStateUpdateSymbol,
  OnVoiceCloseSymbol,
  QueueCreateSymbol,
  QueueDestroySymbol,
  UpdateSymbol,
  VoiceDestroySymbol,
} from "@/constants";
import { setImmediate } from "node:timers/promises";

import type { Player } from "@/main";
import type {
  APIPlayer,
  APITrack,
  CreateQueueOptions,
  EventPayload,
  PlayerUpdatePayload,
  QueueContext,
  TrackEndEventPayload,
  TrackExceptionEventPayload,
  TrackStartEventPayload,
  TrackStuckEventPayload,
} from "@/types";

/**
 * Utility class for managing queues
 */
export class QueueManager<Context extends Record<string, unknown> = QueueContext> implements Partial<
  Map<string, Queue<Context>>
> {
  #cache = new Map<string, APIPlayer>();
  #queues = new Map<string, Queue<Context>>();

  #creates = new Map<string, Promise<Queue<Context>>>();
  #destroys = new Map<string, Promise<void>>();

  #syncs = new Map<string, Promise<void>>();
  #relocates = new Map<string, Promise<void>>();

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

  /**
   * Raw lavalink player objects.
   * For reference or advanced usage only, do not `set` or `delete`
   */
  get cache() {
    return this.#cache as ReadonlyMap<string, APIPlayer>;
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
    if (this.#creates.has(options.guildId)) return this.#creates.get(options.guildId)!;

    const resolver = Promise.withResolvers<Queue<Context>>();
    this.#creates.set(options.guildId, resolver.promise);

    await this.#destroys.get(options.guildId);
    try {
      if (!this.player.voices.has(options.guildId)) {
        await this.player.voices.connect(options.guildId, options.voiceId, options);
      }
      const queue = this[QueueCreateSymbol](options);
      resolver.resolve(queue);
    } catch (err) {
      resolver.reject(err);
    } finally {
      this.#creates.delete(options.guildId);
      return resolver.promise;
    }
  }

  /**
   * Destroy a queue
   * @param guildId Id of the guild
   * @param reason Reason for destroying
   */
  async destroy(guildId: string, reason = "destroyed") {
    try {
      await this.#creates.get(guildId);
    } catch {}

    if (this.#destroys.has(guildId)) return this.#destroys.get(guildId)!;

    const queue = this.#queues.get(guildId);
    if (!queue) return;

    const resolver = Promise.withResolvers<void>();
    this.#destroys.set(guildId, resolver.promise);
    try {
      await queue.rest.destroyPlayer(guildId).catch(noop);
      await this.player.voices.disconnect(guildId);
      this.player.voices[VoiceDestroySymbol](guildId);
      this.#cache.delete(guildId);
      this.#queues.delete(guildId);
      this.player.emit("queueDestroy", queue, reason);
    } finally {
      this.#destroys.delete(guildId);
      resolver.resolve();
      return resolver.promise;
    }
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

    const key = `${node}:${target}`;
    if (this.#syncs.has(key)) return this.#syncs.get(key)!;

    const resolver = Promise.withResolvers<void>();
    this.#syncs.set(key, resolver.promise);
    try {
      switch (target) {
        case "local": {
          const players = await _node.rest.fetchPlayers();
          for (const player of players) this[UpdateSymbol](player.guildId, player);
          break;
        }
        case "remote": {
          const queues = this.#queues.values().filter((q) => q.node.name === node);
          for (const queue of queues) await queue.sync("remote").then(setImmediate, noop);
          break;
        }
        default:
          throw new Error("Target must be 'local' or 'remote'");
      }
      resolver.resolve();
    } catch (err) {
      resolver.reject(err);
    } finally {
      this.#syncs.delete(key);
      return resolver.promise;
    }
  }

  /**
   * Relocate all queues of a specific node
   * @param node Name of the node
   */
  async relocate(node: string) {
    if (this.#relocates.has(node)) return this.#relocates.get(node)!;

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

    const isEligible = (q: Queue) =>
      q.node.name === node && !q.unusable && !q.voice.reconnecting && !q.voice.changingNode;

    const queues = this.#queues.values().reduce<{ load: number; value: Queue }[]>((t, q) => {
      if (!isEligible(q)) return t;
      const load = this.#cache.get(q.guildId)?.track == null ? 1 : 2;
      totalLoad += load;
      t.push({ load, value: q });
      return t;
    }, []);

    if (queues.length === 0) return;

    const resolver = Promise.withResolvers<void>();
    this.#relocates.set(node, resolver.promise);

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

    this.#relocates.delete(node);

    resolver.resolve();
    return resolver.promise;
  }

  #getLocalTrack(queue: Queue, track: APITrack, replaced = false) {
    if (!replaced && queue.track?.id === track.info.identifier) return queue.track;
    return new Track(track);
  }

  async #onTrackStart(queue: Queue, payload: TrackStartEventPayload) {
    this.player.emit("trackStart", queue, this.#getLocalTrack(queue, payload.track));
  }

  async #onTrackError(queue: Queue, payload: TrackExceptionEventPayload) {
    const track = this.#getLocalTrack(queue, payload.track);
    this.player.emit("trackError", queue, track, payload.exception);
  }

  async #onTrackStuck(queue: Queue, payload: TrackStuckEventPayload) {
    const track = this.#getLocalTrack(queue, payload.track);
    this.player.emit("trackStuck", queue, track, payload.thresholdMs);
  }

  async #onTrackEnd(queue: Queue, payload: TrackEndEventPayload) {
    const track = this.#getLocalTrack(queue, payload.track, payload.reason === TrackEndReason.Replaced);
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
        this.player.emit("trackFinish", queue, track, payload.reason);
        return;
    }
    this.player.emit("trackFinish", queue, track, payload.reason);
    try {
      if (queue.finished) {
        if (queue.hasPrevious && queue.repeatMode === "queue") queue.tracks.push(queue.previousTracks.shift()!);
        else if (queue.autoplay) await queue.addRelated(track);
      }
      if (!queue.finished) {
        await queue.resume();
        return;
      }
      const reason = queue.autoplay ? QueueEndReason.NoRelated : QueueEndReason.Finished;
      this.player.emit("queueFinish", queue, reason);
    } catch (err) {
      this.player.emit("queueFinish", queue, QueueEndReason.RequestFailed, err);
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

  [QueueCreateSymbol](options: CreateQueueOptions<Context>) {
    if (this.#queues.has(options.guildId)) return this.#queues.get(options.guildId)!;
    const queue = new Queue<Context>(this.player, options.guildId, options.context);
    this.#queues.set(options.guildId, queue);
    this.player.emit("queueCreate", queue);
    return queue;
  }

  [QueueDestroySymbol](guildId: string) {
    return this.#destroys.get(guildId);
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
