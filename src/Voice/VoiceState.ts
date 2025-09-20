import { noop } from "../Functions";

import type { PlayerUpdateRequestBody, VoiceStateInfo } from "../Typings";
import type { Node } from "../Node";
import type { Player } from "../Main";

export class VoiceState {
  #cache: VoiceStateInfo;
  #player: Player;

  #node: Node;

  #reconnecting = false;
  #changePromise: Promise<void> | null = null;

  constructor(player: Player, node: string, guildId: string) {
    const _node = player.nodes.get(node);

    if (!_node) throw new Error(`Node '${node}' not found`);
    if (!_node.ready) throw new Error(`Node '${node}' not ready`);

    const info = player.voices.cache.get(guildId);
    if (!info) throw new Error(`No connection found for guild '${guildId}'`);

    this.#node = _node;
    this.#cache = info;
    this.#player = player;
  }

  get #info() {
    this.#cache = this.#player.voices.cache.get(this.guildId) ?? this.#cache;
    return this.#cache;
  }

  get node() {
    return this.#node;
  }

  get valid() {
    return this.#node.sessionId === this.#info.node_session_id;
  }

  get guildId() {
    return this.#cache.guild_id;
  }

  get channelId() {
    return this.#info.channel_id;
  }

  get regionId() {
    return this.#info.region_id;
  }

  get sessionId() {
    return this.#info.session_id;
  }

  get token() {
    return this.#info.token;
  }

  get endpoint() {
    return this.#info.endpoint;
  }

  get ping() {
    return this.#info.ping;
  }

  get connected() {
    return this.valid && this.#info.connected;
  }

  get destroyed() {
    return this.#player.voices.get(this.guildId) !== this;
  }

  get selfDeaf() {
    return this.#info.self_deaf;
  }

  get selfMute() {
    return this.#info.self_mute;
  }

  get serverDeaf() {
    return this.#info.deaf;
  }

  get serverMute() {
    return this.#info.mute;
  }

  get muted() {
    return this.selfMute || this.#cache.mute || this.#cache.suppress;
  }

  get deafened() {
    return this.selfDeaf || this.#cache.deaf;
  }

  get suppressed() {
    return this.#info.suppress;
  }

  get changingNode() {
    return this.#changePromise !== null;
  }

  get reconnecting() {
    return this.#reconnecting;
  }

  set reconnecting(value) {
    if (typeof value === "boolean") this.#reconnecting = value;
  }

  async destroy(reason?: string) {
    return this.#player.voices.destroy(this.guildId, reason);
  }

  async connect(channelId = this.#info.channel_id) {
    return this.#player.voices.connect(this.guildId, channelId);
  }

  async reconnect() {
    await this.disconnect();
    return this.connect();
  }

  async disconnect() {
    return this.#player.voices.disconnect(this.guildId);
  }

  async changeNode(name: string) {
    const node = this.#player.nodes.get(name);

    if (!node) throw new Error(`Node '${name}' not found`);
    if (!node.ready) throw new Error(`Node '${name}' not ready`);

    if (this.#changePromise !== null) return this.#changePromise;
    if (name === this.#node.name) throw new Error(`Already on node '${name}'`);

    const queue = this.#player.queues.get(this.guildId);
    if (!queue) throw new Error(`No queue found for guild '${this.guildId}'`);

    const resolver = Promise.withResolvers<void>();
    this.#changePromise = resolver.promise;

    const request: PlayerUpdateRequestBody = {
      filters: queue.filters.data,
      paused: queue.paused,
      voice: { endpoint: this.#info.endpoint, sessionId: this.#cache.session_id, token: this.#cache.token },
      volume: queue.volume,
    };
    const wasPlaying = queue.isPlaying && queue.track !== null;

    if (wasPlaying && this.#player.nodes.info.get(node.name)?.sourceManagers.includes(queue.track.sourceName)) {
      request.track = { encoded: queue.track.encoded, userData: queue.track.userData };
      request.position = queue.currentTime;
    }
    if (this.valid) await this.#node.rest.destroyPlayer(this.guildId).catch(noop);

    const previousNode = this.#node;
    this.#node = node;
    try {
      const player = await node.rest.updatePlayer(this.guildId, request);
      this.#player.queues.cache.set(this.guildId, player);
      this.#info.node_session_id = node.sessionId!;
      this.#player.emit("voiceChange", this, previousNode, wasPlaying);
      resolver.resolve();
    } catch (err) {
      resolver.reject(err);
      throw err;
    } finally {
      this.#changePromise = null;
    }
  }
}
