import { EventType, TrackEndReason } from "../Typings";
import {
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
  EmptyObject,
  TrackStartEventPayload,
  TrackExceptionEventPayload,
  TrackStuckEventPayload,
} from "../Typings";
import type { Player } from "../Main";

export class QueueManager<Context extends Record<string, unknown> = EmptyObject> implements Partial<
  Map<string, Queue<Context>>
> {
  #cache = new Map<string, APIPlayer>();

  #queues = new Map<string, Queue<Context>>();
  #destroys = new Map<string, Promise<void>>();

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

  async create(options: CreateQueueOptions<Context>) {
    if (!isRecord(options)) throw new Error("Queue create options must be an object");
    if (this.#queues.has(options.guildId)) return this.#queues.get(options.guildId)!;
    if (!this.player.voices.has(options.guildId)) {
      await this.player.voices.connect(options.guildId, options.voiceId, options);
      return this.#queues.get(options.guildId)!;
    }
    const queue = new Queue<Context>(this.player, options.guildId, options.context);
    this.#queues.set(options.guildId, queue);
    this.player.emit("queueCreate", queue);
    return queue;
  }

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

  async #onTrackStart(queue: Queue, payload: TrackStartEventPayload) {
    this.player.emit("trackStart", queue, new Track(payload.track));
  }

  async #onTrackError(queue: Queue, payload: TrackExceptionEventPayload) {
    this.player.emit("trackError", queue, new Track(payload.track), payload.exception);
  }

  async #onTrackStuck(queue: Queue, payload: TrackStuckEventPayload) {
    this.player.emit("trackStuck", queue, new Track(payload.track), payload.thresholdMs);
  }

  async #onTrackEnd(queue: Queue, payload: TrackEndEventPayload) {
    const track = new Track(payload.track);
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
      if (queue.finished) this.player.emit("queueFinish", queue);
      else await queue.resume();
    } catch (err) {
      return this.destroy(queue.guildId, `${err.message ?? err}`);
    }
  }

  [OnStateUpdateSymbol](payload: PlayerUpdatePayload) {
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
