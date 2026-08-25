import { VoiceCloseCodes } from "@/types";
import { isString, noop } from "@/functions";
import { VoiceRegion, VoiceState } from "@/voice";
import { OnVoiceCloseSymbol, SnowflakeRegex, UpdateSymbol, VoiceRegionIdRegex } from "@/constants";
import { clearTimeout, setTimeout } from "node:timers";

import type { Node } from "@/node";
import type { Player } from "@/main";
import type {
  BotReadyPayload,
  BotVoiceState,
  ConnectOptions,
  CreateQueueOptions,
  DiscordDispatchPayload,
  JoinRequest,
  PlayerUpdateRequestBody,
  VoiceServerUpdatePayload,
  VoiceStateUpdatePayload,
  VoiceUpdatePayloads,
  VoiceUpdateResolver,
  WebSocketClosedEventPayload,
} from "@/types";

/**
 * Utility class for managing voice connections
 */
export class VoiceManager implements Partial<Map<string, VoiceState>> {
  #cache = new Map<string, BotVoiceState>();
  #voices = new Map<string, VoiceState>();

  #joins = new Map<string, JoinRequest>();
  #leaves = new Map<string, PromiseWithResolvers<void>>();

  #destroys = new Map<string, Promise<void>>();
  #resolvers = new Map<string, VoiceUpdateResolver>();

  readonly regions = new Map<string, VoiceRegion>();
  readonly player: Player;

  constructor(player: Player) {
    if (player.voices === undefined) this.player = player;
    else throw new Error("Manager already exists for this Player");

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      regions: immutable,
      player: { ...immutable, enumerable: false },
    } satisfies { [K in keyof VoiceManager]?: PropertyDescriptor });
  }

  get size() {
    return this.#voices.size;
  }

  /**
   * Raw voice state objects.
   * For reference or advanced usage only, do not `set` or `delete`
   */
  get cache() {
    return this.#cache as ReadonlyMap<string, BotVoiceState>;
  }

  get(guildId: string) {
    return this.#voices.get(guildId);
  }

  has(guildId: string) {
    return this.#voices.has(guildId);
  }

  keys() {
    return this.#voices.keys();
  }

  values() {
    return this.#voices.values();
  }

  entries() {
    return this.#voices.entries();
  }

  /**
   * Destroy a voice connection
   * @param guildId Id of the guild
   * @param reason Reason for destroying
   */
  async destroy(guildId: string, reason = "destroyed") {
    if (this.player.queues.has(guildId)) return this.player.queues.destroy(guildId, reason);
    if (this.#destroys.has(guildId)) return this.#destroys.get(guildId)!;

    const voice = this.#voices.get(guildId);
    if (!voice) return;

    const resolver = Promise.withResolvers<void>();
    this.#destroys.set(guildId, resolver.promise);

    if (voice.joined) await voice.disconnect();

    this.#cache.delete(guildId);
    this.#voices.delete(guildId);

    this.player.emit("voiceDestroy", voice, reason);

    resolver.resolve();
    this.#destroys.delete(guildId);
  }

  /**
   * Connect to a voice channel
   * @param guildId Id of the guild
   * @param voiceId Id of the voice channel
   * @param options Options for the queue
   */
  async connect(guildId: string, voiceId: string, options?: ConnectOptions) {
    if (!isString(guildId, SnowflakeRegex)) throw new Error("Guild Id is not a valid Discord Id");
    if (!isString(voiceId, SnowflakeRegex)) throw new Error("Voice Id is not a valid Discord Id");

    if (this.#joins.has(guildId)) {
      const request = this.#joins.get(guildId)!;
      if (request.voiceId === voiceId) return request.promise;
      throw new Error("Another connection to the same guild is in progress");
    }

    const request = Promise.withResolvers<VoiceState>() as JoinRequest;
    request.voiceId = voiceId;

    this.#joins.set(guildId, request);

    let voice = this.#voices.get(guildId);
    try {
      const updates = await this.#awaitVoiceUpdates(guildId, voiceId, options?.timeout);
      if (!voice) voice = await this.#handleNew(updates, options);
      else await this.#handleExisting(voice, updates);
      request.resolve(voice);
      return voice;
    } catch (err) {
      if (!voice) await this.disconnect(guildId);
      request.reject(err);
      throw err;
    } finally {
      this.#joins.delete(guildId);
    }
  }

  /**
   * Disconnect from a voice channel
   * @param guildId Id of the guild
   * @param timeout Timeout for state update in ms
   */
  async disconnect(guildId: string, timeout = this.player.options.voiceTimeout) {
    if (this.#leaves.has(guildId)) return this.#leaves.get(guildId)!.promise;
    if (this.#voices.get(guildId)?.joined === false) return;

    const resolver = Promise.withResolvers<void>();
    this.#leaves.set(guildId, resolver);

    await this.#sendVoiceUpdate(guildId, null);
    const timer = setTimeout(resolver.resolve, timeout);

    await resolver.promise;
    clearTimeout(timer);

    this.#leaves.delete(guildId);
  }

  #getOrCreateRegion(regionId: string) {
    if (this.regions.has(regionId)) return this.regions.get(regionId)!;
    const region = new VoiceRegion(this.player, regionId);
    this.regions.set(regionId, region);
    return region;
  }

  async #updatePlayer(node: Node, guildId: string, options: PlayerUpdateRequestBody) {
    const player = await node.rest.updatePlayer(guildId, options);
    this.player.queues[UpdateSymbol](guildId, player, false);
  }

  async #handleNew({ state, server }: VoiceUpdatePayloads, options?: ConnectOptions) {
    if (!state && !server) throw new Error("No voice updates received");

    if (!state) throw new Error("No voice state received");
    if (!state.channel_id) throw new Error("No channel id received");

    if (!server) throw new Error("No voice server received");
    if (!server.endpoint) throw new Error("No server endpoint received");

    const regionId = server.endpoint.match(VoiceRegionIdRegex)?.[0] ?? "unknown";
    const region = this.#getOrCreateRegion(regionId);

    const node = options?.node === undefined ? region.getRelevantNode() : this.player.nodes.get(options.node);

    if (!node?.ready) {
      if (node !== undefined) throw new Error(`Node '${node.name}' not ready`);
      else if (options?.node === undefined) throw new Error("No nodes available");
      throw new Error(`Node '${options.node}' not found`);
    }

    const config: PlayerUpdateRequestBody = {};

    if (options?.filters !== undefined) config.filters = options.filters;
    if (options?.volume !== undefined) config.volume = options.volume;

    await this.#updatePlayer(node, server.guild_id, {
      ...config,
      voice: {
        channelId: state.channel_id,
        endpoint: server.endpoint,
        sessionId: state.session_id,
        token: server.token,
      },
    });

    this.#cache.set(server.guild_id, {
      channel_id: state.channel_id,
      deaf: state.deaf,
      endpoint: server.endpoint,
      in_channel: true,
      mute: state.mute,
      reconnecting: false,
      region_id: regionId,
      self_deaf: state.self_deaf,
      self_mute: state.self_mute,
      session_id: state.session_id,
      suppress: state.suppress,
      token: server.token,
    });

    const voice = new VoiceState(this.player, node.name, server.guild_id);
    this.#voices.set(server.guild_id, voice);

    this.player.emit("voiceConnect", voice);

    const opts: CreateQueueOptions = { guildId: server.guild_id, voiceId: state.channel_id };
    if (options?.context !== undefined) opts.context = options.context;

    await this.player.queues.create(opts);
    return voice;
  }

  async #handleExisting(voice: VoiceState, { state, server }: VoiceUpdatePayloads) {
    if (!state && !server) return;

    const cache = this.#cache.get(voice.guildId);
    if (!cache) return;

    if (state !== undefined) {
      if (state.channel_id === null) cache.in_channel = false;
      else {
        cache.in_channel = true;
        cache.channel_id = state.channel_id;
      }
      cache.deaf = state.deaf;
      cache.mute = state.mute;
      cache.self_deaf = state.self_deaf;
      cache.self_mute = state.self_mute;
      cache.session_id = state.session_id;
      cache.suppress = state.suppress;
    }

    if (!server) return;
    cache.token = server.token;

    if (!cache.in_channel || !server.endpoint) return;
    cache.endpoint = server.endpoint;

    cache.region_id = server.endpoint.match(VoiceRegionIdRegex)?.[0] ?? "unknown";
    this.#getOrCreateRegion(cache.region_id);

    const connected = voice.connected;

    await this.#updatePlayer(voice.node, voice.guildId, {
      voice: {
        channelId: cache.channel_id,
        endpoint: cache.endpoint,
        sessionId: cache.session_id,
        token: cache.token,
      },
    });
    if (!connected && voice.connected) this.player.emit("voiceConnect", voice);
  }

  async #sendVoiceUpdate(guildId: string, channelId: string | null) {
    return this.player.options.forwardVoiceUpdate(guildId, {
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_deaf: channelId !== null,
        self_mute: false,
      },
    });
  }

  async #awaitVoiceUpdates(guildId: string, voiceId: string, timeout = this.player.options.voiceTimeout) {
    if (this.#resolvers.has(guildId)) return this.#resolvers.get(guildId)!.promise;
    const resolver = Promise.withResolvers<VoiceUpdatePayloads>() as VoiceUpdateResolver;
    resolver.updates = {};
    this.#resolvers.set(guildId, resolver);
    try {
      await this.#sendVoiceUpdate(guildId, voiceId);
      resolver.timeout = setTimeout(resolver.resolve, timeout, resolver.updates);
      await resolver.promise;
      return resolver.updates;
    } catch (err) {
      resolver.reject(err);
      throw err;
    } finally {
      clearTimeout(resolver.timeout);
      this.#resolvers.delete(guildId);
    }
  }

  /**
   * Handle payloads received by your bot
   * @param payload Dispatched payload
   */
  handleDispatch(payload: unknown): Promise<void>;
  async handleDispatch(payload: DiscordDispatchPayload) {
    if (payload.op !== 0) return;
    switch (payload.t) {
      case "VOICE_STATE_UPDATE":
        return this.#onStateUpdate(payload.d);
      case "VOICE_SERVER_UPDATE":
        return this.#onServerUpdate(payload.d);
      case "READY":
        return this.#onClientReady(payload.d);
    }
  }

  async #onClientReady(data: BotReadyPayload["d"]) {
    if (this.player.ready) return;
    if (!this.player.options.autoInit) return;
    return this.player.init(data.user.id);
  }

  async #onStateUpdate(state: VoiceStateUpdatePayload["d"]) {
    if (!state.guild_id || state.user_id !== this.player.clientId) return;
    const resolver = this.#resolvers.get(state.guild_id);
    if (resolver !== undefined) {
      resolver.updates.state = state;
      if (!resolver.updates.server) resolver.timeout.refresh();
      else resolver.resolve(resolver.updates);
      return;
    }
    if (!state.channel_id) this.#leaves.get(state.guild_id)?.resolve();
    const voice = this.#voices.get(state.guild_id);
    if (!voice) return;
    return this.#handleExisting(voice, { state }).catch(noop);
  }

  async #onServerUpdate(server: VoiceServerUpdatePayload["d"]) {
    const resolver = this.#resolvers.get(server.guild_id);
    if (resolver !== undefined) {
      resolver.updates.server = server;
      if (!resolver.updates.state) resolver.timeout.refresh();
      else resolver.resolve(resolver.updates);
      return;
    }
    const voice = this.#voices.get(server.guild_id);
    if (!voice) return;
    return this.#handleExisting(voice, { server }).catch(noop);
  }

  async [OnVoiceCloseSymbol](voice: VoiceState, payload: WebSocketClosedEventPayload) {
    let shouldReconnect = false;
    switch (payload.code) {
      case VoiceCloseCodes.AuthenticationFailed:
      case VoiceCloseCodes.ServerNotFound:
      case VoiceCloseCodes.SessionNoLongerValid:
        if (!this.player.options.voiceReconnect) break;
        shouldReconnect = true;
        this[UpdateSymbol](payload.guildId, { reconnecting: true });
        break;
    }
    this.player.emit("voiceClose", voice, payload.code, payload.reason, payload.byRemote);
    if (!shouldReconnect) return;
    try {
      await voice.reconnect();
      if (voice.connected) return;
      this.player.emit("voiceDisconnect", voice, payload);
    } catch (err) {
      this.player.emit("voiceDisconnect", voice, { ...payload, error: err });
    }
  }

  [UpdateSymbol](guildId: string, payload: Partial<BotVoiceState>, partial = true) {
    const data = this.#cache.get(guildId);
    if (data !== undefined) Object.assign(data, payload);
    else if (!partial) this.#cache.set(guildId, payload as BotVoiceState);
  }

  [Symbol.iterator]() {
    return this.#voices[Symbol.iterator]();
  }
}
