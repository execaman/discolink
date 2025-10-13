import { VoiceCloseCodes, EventType, TrackEndReason } from "../Typings";
import { isRecord, noop } from "../Functions";
import { Queue, Track } from "./index";

import type {
  APIPlayer,
  PlayerUpdatePayload,
  EventPayload,
  TrackEndEventPayload,
  WebSocketClosedEventPayload,
  CreateQueueOptions,
  EmptyObject,
} from "../Typings";
import type { Player } from "../Main";

/**
 * A manager class handling queues with useful members
 */
export class QueueManager<Context extends Record<string, unknown> = EmptyObject>
  implements Partial<Map<string, Queue<Context>>>
{
  #player: Player;
  #queues = new Map<string, Queue<Context>>();

  #cache = new Map<string, APIPlayer>();
  #destroys = new Map<string, Promise<void>>();

  #relocations = new Map<string, Promise<void>>();

  constructor(player: Player) {
    this.#player = player;
  }

  get size() {
    return this.#queues.size;
  }

  /**
   * A map holding this manager's intrinsic data
   */
  get cache() {
    return this.#cache;
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
   * Creates a queue from options
   * @param options Options to create from
   */
  async create(options: CreateQueueOptions<Context>) {
    if (!isRecord(options)) throw new Error("Queue create options must be an object");
    if (this.#queues.has(options.guildId)) return this.#queues.get(options.guildId)!;
    if (!this.#player.voices.has(options.guildId)) {
      await this.#player.voices.connect(options.guildId, options.voiceId, options);
      return this.#queues.get(options.guildId)!;
    }
    const queue = new Queue<Context>(this.#player, options.guildId, options.context);
    this.#queues.set(options.guildId, queue);
    this.#player.emit("queueCreate", queue);
    return queue;
  }

  /**
   * Destroys the queue of a guild
   * @param guildId Id of the guild
   * @param reason Reason for destroying
   */
  async destroy(guildId: string, reason = "destroyed") {
    if (this.#destroys.has(guildId)) return this.#destroys.get(guildId)!;
    const queue = this.#queues.get(guildId);
    if (!queue) return;
    const resolver = Promise.withResolvers<void>();
    this.#destroys.set(guildId, resolver.promise);
    if (queue.voice.valid) await queue.rest.destroyPlayer(guildId).catch(noop);
    this.#cache.delete(guildId);
    this.#queues.delete(guildId);
    this.#player.emit("queueDestroy", queue, reason);
    await this.#player.voices.destroy(guildId, reason);
    this.#destroys.delete(guildId);
    resolver.resolve();
  }

  /**
   * Relocates queues of a node to other nodes.
   * If no other nodes are available, invalid queues are destroyed
   * @param node Name of the target node
   * @summary Invalid queues are those with a different session id than what they were last updated with.
   * e.g. reconnected but non-resumed node, prolonged absence of a voice connection, etc.
   */
  async relocate(node: string) {
    if (this.#relocations.has(node)) return this.#relocations.get(node)!;

    const queues = this.#queues
      .values()
      .filter((q) => q.node.name === node && !q.voice.changingNode)
      .toArray()
      .sort((a, b) => {
        if (a.isPlaying && !b.isPlaying) return -1;
        if (b.isPlaying && !a.isPlaying) return 1;
        return 0;
      });
    if (queues.length === 0) return;

    const nodes = this.#player.nodes.relevant({ memory: 0.6, workload: 0.4 }).reduce<string[]>((t, n) => {
      if (n.name !== node) t.push(n.name);
      return t;
    }, []);

    const resolver = Promise.withResolvers<void>();
    this.#relocations.set(node, resolver.promise);

    if (nodes.length === 0) {
      for (const queue of queues) if (!queue.voice.valid) await queue.destroy("Session invalid, nowhere to relocate");
      this.#relocations.delete(node);
      const err = new Error("No other nodes available");
      resolver.reject(err);
      throw err;
    }

    const chunkSize = Math.floor(queues.length / nodes.length);
    const remaining = queues.length % nodes.length;
    const chunks = new Map<string, Queue[]>();

    if (remaining !== 0) chunks.set(nodes.shift()!, queues.splice(0, chunkSize + remaining));
    while (nodes.length !== 0) chunks.set(nodes.shift()!, queues.splice(0, chunkSize));

    for (const [name, queues] of chunks) {
      for (const queue of queues) {
        if (queue.voice.changingNode || name === queue.node.name) continue;
        try {
          await queue.voice.changeNode(name);
        } catch (err) {
          await this.destroy(queue.guildId, `${err.message ?? err}`);
        }
      }
    }

    this.#relocations.delete(node);
    resolver.resolve();
  }

  /**
   * A player state update listener. Not for general use
   * @param payload Player update payload
   */
  onStateUpdate(payload: PlayerUpdatePayload) {
    const state = payload.state;
    const cache = this.#cache.get(payload.guildId);
    if (cache !== undefined) cache.state = state;
    const voice = this.#player.voices.cache.get(payload.guildId);
    if (voice !== undefined) {
      voice.connected = state.connected;
      voice.ping = state.ping;
    }
    const queue = this.#queues.get(payload.guildId);
    if (!queue) return;
    this.#player.voices.regions.get(queue.voice.regionId)?.onPingUpdate(queue.node.name, state.ping, state.time);
    this.#player.emit("queueUpdate", queue, state);
  }

  /**
   * A player event update listener. Not for general use
   * @param payload Player event payload
   */
  async onEventUpdate(payload: EventPayload) {
    const cache = this.#cache.get(payload.guildId);
    if (!cache) return;
    const queue = this.#queues.get(payload.guildId);
    if (!queue) return;
    switch (payload.type) {
      case EventType.TrackStart: {
        cache.track ??= payload.track;
        this.#player.emit("trackStart", queue, new Track(payload.track));
        return;
      }
      case EventType.TrackEnd: {
        cache.track = null;
        return this.#onTrackEnd(payload, queue);
      }
      case EventType.TrackException: {
        cache.track = null;
        this.#player.emit("trackError", queue, new Track(payload.track), payload.exception);
        return;
      }
      case EventType.TrackStuck: {
        cache.track ??= payload.track;
        this.#player.emit("trackStuck", queue, new Track(payload.track), payload.thresholdMs);
        return;
      }
      case EventType.WebSocketClosed:
        return this.#onVoiceClosed(payload, queue.voice);
    }
  }

  async #onTrackEnd(payload: TrackEndEventPayload, queue: Queue) {
    const track = new Track(payload.track);
    switch (payload.reason) {
      case TrackEndReason.Cleanup:
        if (payload.track.info.identifier !== queue.track?.id) break;
        queue.previousTracks.push(queue.tracks.shift()!);
        break;
      case TrackEndReason.Finished:
        if (payload.track.info.identifier !== queue.track?.id) break;
        if (queue.repeatMode !== "track") queue.previousTracks.push(queue.tracks.shift()!);
        break;
      default:
        this.#player.emit("trackFinish", queue, track, payload.reason);
        return;
    }
    this.#player.emit("trackFinish", queue, track, payload.reason);
    try {
      if (queue.finished) {
        if (queue.hasPrevious && queue.repeatMode === "queue") queue.tracks.push(queue.previousTracks.shift()!);
        else if (queue.autoplay) await queue.addRelated(track);
      }
      if (queue.finished) this.#player.emit("queueFinish", queue);
      else await queue.resume();
    } catch (err) {
      return this.destroy(queue.guildId, `${err.message ?? err}`);
    }
  }

  async #onVoiceClosed(payload: WebSocketClosedEventPayload, voice: Queue["voice"]) {
    let shouldReconnect: boolean;
    switch (payload.code) {
      case VoiceCloseCodes.AlreadyAuthenticated:
      case VoiceCloseCodes.BadRequest:
      case VoiceCloseCodes.FailedToDecodePayload:
      case VoiceCloseCodes.NotAuthenticated:
      case VoiceCloseCodes.UnknownEncryptionMode:
      case VoiceCloseCodes.UnknownOpcode:
      case VoiceCloseCodes.UnknownProtocol:
        shouldReconnect = false;
        break;
      case VoiceCloseCodes.AuthenticationFailed:
      case VoiceCloseCodes.ServerNotFound:
      case VoiceCloseCodes.SessionNoLongerValid:
      case VoiceCloseCodes.SessionTimeout:
      case VoiceCloseCodes.VoiceServerCrashed:
        shouldReconnect = true;
        break;
      case VoiceCloseCodes.Disconnected:
      case VoiceCloseCodes.DisconnectedCallTerminated:
      case VoiceCloseCodes.DisconnectedRateLimited:
      default:
        this.#player.emit("voiceClose", voice, payload.code, payload.reason, payload.byRemote);
        return;
    }
    voice.reconnecting = shouldReconnect;
    this.#player.emit("voiceClose", voice, payload.code, payload.reason, payload.byRemote);
    try {
      if (shouldReconnect) {
        await voice.reconnect();
        if (voice.connected) return;
      }
      throw new Error(payload.reason);
    } catch (err) {
      return this.destroy(voice.guildId, err.message);
    } finally {
      voice.reconnecting = false;
    }
  }

  [Symbol.iterator]() {
    return this.#queues[Symbol.iterator]();
  }
}
