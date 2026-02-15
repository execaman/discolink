import { LookupSymbol } from "../Constants/Symbols";
import { noop } from "../Functions";
import type { APIPlayer, BotVoiceState, PlayerUpdateRequestBody } from "../Typings";
import type { Node } from "../Node";
import type { Player } from "../Main";

export class VoiceState {
  #changePromise: Promise<void> | null = null;
  #node: Node;

  #state: BotVoiceState;
  #player: APIPlayer;

  readonly guildId: string;
  readonly player: Player;

  constructor(player: Player, node: string, guildId: string) {
    if (player.voices.has(guildId)) throw new Error(`An identical voice state already exists`);

    const _node = player.nodes.get(node);

    if (!_node) throw new Error(`Node '${node}' not found`);
    if (!_node.ready) throw new Error(`Node '${node}' not ready`);

    const state = player.voices[LookupSymbol](guildId);
    if (!state) throw new Error(`No connection found for guild '${guildId}'`);

    const _player = player.queues[LookupSymbol](guildId);
    if (!_player) throw new Error(`No player found for guild '${guildId}'`);

    this.#node = _node;

    this.#state = state;
    this.#player = _player;

    this.guildId = guildId;
    this.player = player;

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      guildId: immutable,
      player: { ...immutable, enumerable: false },
    } satisfies { [K in keyof VoiceState]?: PropertyDescriptor });
  }

  get node() {
    return this.#node;
  }

  get ping() {
    return this.#player.state.ping;
  }

  get regionId() {
    return this.#state.region_id;
  }

  get channelId() {
    return this.#state.channel_id;
  }

  get selfDeaf() {
    return this.#state.self_deaf;
  }

  get selfMute() {
    return this.#state.self_mute;
  }

  get serverDeaf() {
    return this.#state.deaf;
  }

  get serverMute() {
    return this.#state.mute;
  }

  get suppressed() {
    return this.#state.suppress;
  }

  get destroyed() {
    return this.player.voices.get(this.guildId) !== this;
  }

  get connected() {
    if (!this.#player.state.connected) return false;
    return this.#state.connected && this.#state.node_session_id === this.#node.sessionId;
  }

  get reconnecting() {
    return this.#state.reconnecting;
  }

  get disconnected() {
    return !this.connected && !this.reconnecting;
  }

  get changingNode() {
    return this.#changePromise !== null;
  }

  async destroy(reason?: string) {
    return this.player.voices.destroy(this.guildId, reason);
  }

  async connect(channelId = this.#state.channel_id) {
    return this.player.voices.connect(this.guildId, channelId);
  }

  async disconnect() {
    return this.player.voices.disconnect(this.guildId);
  }

  async changeNode(name: string) {
    const node = this.player.nodes.get(name);

    if (!node) throw new Error(`Node '${name}' not found`);
    if (!node.ready) throw new Error(`Node '${name}' not ready`);

    if (this.#changePromise !== null) return this.#changePromise;
    if (name === this.#node.name) throw new Error(`Already on node '${name}'`);

    const resolver = Promise.withResolvers<void>();
    this.#changePromise = resolver.promise;

    const request: PlayerUpdateRequestBody = {
      voice: {
        endpoint: this.#state.endpoint,
        sessionId: this.#state.session_id,
        token: this.#state.token,
      },
      filters: this.#player.filters,
      paused: this.#player.paused,
      volume: this.#player.volume,
    };

    const track = this.#player.track;
    const wasPlaying = !this.#player.paused && track !== null;

    if (wasPlaying && this.player.nodes.supports("source", track.info.sourceName, node.name)) {
      request.track = { encoded: track.encoded, userData: track.userData };
      request.position = this.#player.state.position;
    }

    await this.#node.rest.destroyPlayer(this.guildId).catch(noop);

    const previousNode = this.#node;
    this.#node = node;

    try {
      const player = await node.rest.updatePlayer(this.guildId, request);
      this.#state.node_session_id = node.sessionId!;
      Object.assign(this.#player, player);
      this.player.emit("voiceChange", this, previousNode, wasPlaying);
      resolver.resolve();
    } catch (err) {
      resolver.reject(err);
      throw err;
    } finally {
      this.#changePromise = null;
    }
  }
}
