import { setTimeout } from "node:timers/promises";
import { SnowflakeRegex, VoiceRegionIdRegex } from "../Constants";
import { isString, noop } from "../Functions";
import { VoiceRegion, VoiceState } from "./index";
import type {
  ChannelDeletePayload,
  ClientReadyPayload,
  ConnectOptions,
  CreateQueueOptions,
  DiscordDispatchPayload,
  GuildDeletePayload,
  PlayerDestroyReasons,
  VoiceServerUpdatePayload,
  VoiceStateInfo,
  VoiceStateUpdatePayload,
} from "../Typings";
import type { Player } from "../Main";
import { PlayerSymbol } from "../Constants/Symbols";

interface JoinRequest
  extends PromiseWithResolvers<VoiceState>,
    Pick<CreateQueueOptions, "context" | "node" | "voiceId"> {
  config?: Pick<CreateQueueOptions, "filters" | "volume">;
}

/**
 * A manager class handling voice connections with useful members
 */
export class VoiceManager implements Partial<Map<string, VoiceState>> {
  [PlayerSymbol]: Player;
  #voices = new Map<string, VoiceState>();

  #joins = new Map<string, JoinRequest>();
  #destroys = new Map<string, Promise<void>>();

  #cache = new Map<string, VoiceStateInfo>();

  /**
   * Voice region classes mapped by their Id
   */
  readonly regions = new Map<string, VoiceRegion>();

  constructor(player: Player) {
    this[PlayerSymbol] = player;

    Object.defineProperty(this, "regions" satisfies keyof VoiceManager, {
      writable: false,
      configurable: false,
    });
  }

  get size() {
    return this.#voices.size;
  }

  /**
   * A map holding this manager's intrinsic data
   */
  get cache() {
    return this.#cache;
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
   * Disconnects and destroys the state of a voice connection
   * @param guildId Id of the guild
   * @param reason Reason for destroying
   */
  async destroy(guildId: string, reason = "destroyed") {
    if (this[PlayerSymbol].queues.has(guildId)) return this[PlayerSymbol].queues.destroy(guildId, reason);
    if (this.#destroys.has(guildId)) return this.#destroys.get(guildId)!;
    const voice = this.#voices.get(guildId);
    if (!voice) return;
    const resolver = Promise.withResolvers<void>();
    this.#destroys.set(guildId, resolver.promise);
    await voice.disconnect().catch(noop);
    this.#voices.delete(guildId);
    this[PlayerSymbol].emit("voiceDestroy", voice, reason);
    this.#destroys.delete(guildId);
    resolver.resolve();
  }

  /**
   * Connects to a voice channel and returns its state
   * @param guildId Id of the guild
   * @param voiceId Id of the voice channel
   * @param options Options for customization
   */
  async connect(guildId: string, voiceId: string, options?: ConnectOptions) {
    if (!isString(guildId, SnowflakeRegex)) throw new Error("Guild Id is not a valid Discord Id");
    if (!isString(voiceId, SnowflakeRegex)) throw new Error("Voice Id is not a valid Discord Id");

    if (this.#joins.has(guildId)) {
      const request = this.#joins.get(guildId)!;
      if (request.voiceId === voiceId) return request.promise;
      throw new Error("Another connection to the same guild is in progress");
    }

    const voice = this.#voices.get(guildId);
    const joined = voice?.channelId === voiceId;

    if (joined && voice.connected && this.#cache.has(guildId)) return voice;

    if (options?.node !== undefined && !this[PlayerSymbol].nodes.state(options.node, "ready")) {
      throw new Error(`Node '${options.node}' not ready`);
    }

    const request = Promise.withResolvers<VoiceState>() as JoinRequest;

    request.voiceId = voiceId;
    if (options?.node !== undefined) request.node = options.node;

    if (options?.context !== undefined) request.context = options.context;
    if (options?.filters !== undefined) request.config = { filters: options.filters };

    if (options?.volume !== undefined) {
      request.config ??= {};
      request.config.volume = options.volume;
    }

    this.#joins.set(guildId, request);

    try {
      if (joined) {
        voice.reconnecting = true;
        await this.#sendVoiceUpdate(guildId, null);
      }
      await this.#sendVoiceUpdate(guildId, voiceId);
    } catch (err) {
      if (joined) voice.reconnecting = false;
      request.reject(err);
      this.#joins.delete(guildId);
      throw err;
    }

    const controller = new AbortController();

    try {
      const state = await Promise.race([request.promise, setTimeout(30_000, null, { signal: controller.signal })]);
      if (state === null) throw new Error(`Connection timed out - Guild[${guildId}] Voice[${voiceId}]`);
      return state;
    } catch (err) {
      this.#cache.delete(guildId);
      await this.#sendVoiceUpdate(guildId, null);
      request.reject(err);
      throw err;
    } finally {
      controller.abort();
      if (joined) voice.reconnecting = false;
      this.#joins.delete(guildId);
    }
  }

  /**
   * Disconnects the voice connection of a guild
   * @param guildId Id of the guild
   */
  async disconnect(guildId: string) {
    if (!this.#voices.has(guildId)) throw new Error(`No connection found for guild '${guildId}'`);
    this.#cache.delete(guildId);
    return this.#sendVoiceUpdate(guildId, null);
  }

  #getVoiceRegion(id: string) {
    if (this.regions.has(id)) return this.regions.get(id)!;
    const region = new VoiceRegion(this[PlayerSymbol], id);
    this.regions.set(id, region);
    return region;
  }

  async #sendVoiceUpdate(guildId: string, channelId: string | null) {
    return this[PlayerSymbol].options.forwardVoiceUpdate(guildId, {
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_deaf: channelId !== null,
        self_mute: false,
      },
    });
  }

  /**
   * Handles payloads dispatched by Discord to the bot
   * @param payload 'Dispatch' payload received from Discord
   */
  handleDispatch(payload: unknown): void;
  handleDispatch(payload: DiscordDispatchPayload) {
    if (payload.op !== 0) return;
    switch (payload.t) {
      case "VOICE_STATE_UPDATE":
        this.#onStateUpdate(payload.d);
        return;
      case "VOICE_SERVER_UPDATE":
        this.#onServerUpdate(payload.d);
        return;
      case "GUILD_DELETE":
        this.#onGuildDelete(payload.d);
        return;
      case "CHANNEL_DELETE":
        this.#onChannelDelete(payload.d);
        return;
      case "READY":
        this.#onClientReady(payload.d);
        return;
    }
  }

  async #onClientReady(data: ClientReadyPayload["d"]) {
    if (this[PlayerSymbol].initialized) return;
    return this[PlayerSymbol].init(data.user.id);
  }

  async #onGuildDelete(data: GuildDeletePayload["d"]) {
    if (data.unavailable) return;
    return this.destroy(data.id, "guildDeleted" satisfies PlayerDestroyReasons);
  }

  async #onChannelDelete(data: ChannelDeletePayload["d"]) {
    if (!data.guild_id) return;
    const voice = this.#voices.get(data.guild_id);
    if (voice?.channelId !== data.id) return;
    return voice.destroy("channelDeleted" satisfies PlayerDestroyReasons);
  }

  #onStateUpdate(data: VoiceStateUpdatePayload["d"]) {
    if (!data.guild_id || data.user_id !== this[PlayerSymbol].clientId) return;
    if (data.channel_id === null) {
      this.#cache.delete(data.guild_id);
      return;
    }
    if (!this.#voices.has(data.guild_id) && !this.#joins.has(data.guild_id)) return;
    const state = this.#cache.get(data.guild_id);
    if (!state) {
      this.#cache.set(data.guild_id, {
        channel_id: data.channel_id,
        connected: false,
        deaf: data.deaf,
        endpoint: "",
        guild_id: data.guild_id,
        mute: data.mute,
        node_session_id: "",
        ping: -1,
        region_id: "unknown",
        self_deaf: data.self_deaf,
        self_mute: data.self_mute,
        session_id: data.session_id,
        suppress: data.suppress,
        token: "",
      });
      return;
    }
    state.channel_id = data.channel_id;
    state.deaf = data.deaf;
    state.mute = data.mute;
    state.self_deaf = data.self_deaf;
    state.self_mute = data.self_mute;
    state.session_id = data.session_id;
    state.suppress = data.suppress;
  }

  async #onServerUpdate(data: VoiceServerUpdatePayload["d"]) {
    if (data.endpoint === null) return;

    const state = this.#cache.get(data.guild_id);
    const request = this.#joins.get(data.guild_id);
    if (!state) return request?.reject(new Error("No voice state received"));

    state.token = data.token;
    state.endpoint = data.endpoint;
    state.region_id = data.endpoint.match(VoiceRegionIdRegex)?.[0] ?? "unknown";

    const region = this.#getVoiceRegion(state.region_id);
    const reqNode = request?.node !== undefined;
    let voice = this.#voices.get(data.guild_id);

    const node = voice?.node ?? (reqNode ? this[PlayerSymbol].nodes.get(request.node!) : region.getRelevantNode());
    if (!node?.ready)
      return request?.reject(new Error(reqNode ? `Node '${request.node}' unavailable` : "No nodes available"));

    try {
      const player = await node.rest.updatePlayer(data.guild_id, {
        ...request?.config,
        voice: {
          endpoint: data.endpoint,
          sessionId: state.session_id,
          token: data.token,
        },
      });
      this[PlayerSymbol].queues.cache.set(data.guild_id, player);

      state.node_session_id = node.sessionId!;
      state.connected = player.state.connected;
      state.ping = player.state.ping;

      if (!voice) {
        voice = new VoiceState(this[PlayerSymbol], node.name, data.guild_id);
        this.#voices.set(data.guild_id, voice);
      }
      this[PlayerSymbol].emit("voiceConnect", voice);

      if (!this[PlayerSymbol].queues.has(data.guild_id)) {
        const options: CreateQueueOptions = { guildId: data.guild_id, voiceId: state.channel_id };
        if (request?.context !== undefined) options.context = request.context;
        await this[PlayerSymbol].queues.create(options);
      }
      request?.resolve(voice);
    } catch (err) {
      request?.reject(err);
    }
  }

  [Symbol.iterator]() {
    return this.#voices[Symbol.iterator]();
  }
}
