import { setTimeout } from "node:timers/promises";
import { VoiceCloseCodes } from "../Typings";
import { SnowflakeRegex, VoiceRegionIdRegex } from "../Constants";
import { LookupSymbol, OnVoiceCloseSymbol, UpdateSymbol } from "../Constants/Symbols";
import { isString, noop } from "../Functions";
import { VoiceRegion, VoiceState } from "./index";
import { Queue } from "../Queue";
import type {
  BotReadyPayload,
  BotVoiceState,
  ConnectOptions,
  CreateQueueOptions,
  DiscordDispatchPayload,
  VoiceServerUpdatePayload,
  VoiceStateUpdatePayload,
  WebSocketClosedEventPayload,
} from "../Typings";
import type { Player } from "../Main";

interface JoinRequest
  extends PromiseWithResolvers<VoiceState>, Pick<CreateQueueOptions, "context" | "node" | "voiceId"> {
  config?: Pick<CreateQueueOptions, "filters" | "volume">;
}

export class VoiceManager implements Partial<Map<string, VoiceState>> {
  #cache = new Map<string, BotVoiceState>();
  #voices = new Map<string, VoiceState>();

  #joins = new Map<string, JoinRequest>();
  #destroys = new Map<string, Promise<void>>();

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

  async destroy(guildId: string, reason = "destroyed") {
    if (this.player.queues.has(guildId)) return this.player.queues.destroy(guildId, reason);
    if (this.#destroys.has(guildId)) return this.#destroys.get(guildId)!;

    const voice = this.#voices.get(guildId);
    if (!voice) return;

    const resolver = Promise.withResolvers<void>();
    this.#destroys.set(guildId, resolver.promise);

    if (this[LookupSymbol](guildId)?.connected) await voice.disconnect().catch(noop);

    this.#cache.delete(guildId);
    this.#voices.delete(guildId);

    this.player.emit("voiceDestroy", voice, reason);

    resolver.resolve();
    this.#destroys.delete(guildId);
  }

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

    if (joined && voice.connected) return voice;

    const request = Promise.withResolvers<VoiceState>() as JoinRequest;
    request.voiceId = voiceId;

    if (!voice && options !== undefined) {
      if (options.node !== undefined) {
        if (this.player.nodes.state(options.node, "ready")) request.node = options.node;
        else throw new Error(`Node '${options.node}' not ready`);
      }
      if (options.filters !== undefined) request.config = { filters: options.filters };

      if (options.volume !== undefined) {
        request.config ??= {};
        request.config.volume = options.volume;
      }
      if (options.context !== undefined) request.context = options.context;
    }

    this.#joins.set(guildId, request);

    const controller = new AbortController();

    try {
      if (joined) {
        this[UpdateSymbol](guildId, { reconnecting: true });
        await this.#sendVoiceUpdate(guildId, null);
      }
      await this.#sendVoiceUpdate(guildId, voiceId);
      const state = await Promise.race([request.promise, setTimeout(30_000, null, { signal: controller.signal })]);
      if (state === null) throw new Error(`Connection timed out - Guild[${guildId}] Voice[${voiceId}]`);
      return state;
    } catch (err) {
      if (!voice) this.#cache.delete(guildId);
      await this.#sendVoiceUpdate(guildId, null).catch(noop);
      request.reject(err);
      throw err;
    } finally {
      controller.abort();
      if (joined) this[UpdateSymbol](guildId, { reconnecting: false });
      this.#joins.delete(guildId);
    }
  }

  async disconnect(guildId: string) {
    if (this.#voices.has(guildId)) return this.#sendVoiceUpdate(guildId, null);
    throw new Error(`No connection found for guild '${guildId}'`);
  }

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

  #getVoiceRegion(id: string) {
    if (this.regions.has(id)) return this.regions.get(id)!;
    const region = new VoiceRegion(this.player, id);
    this.regions.set(id, region);
    return region;
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

  async #onClientReady(data: BotReadyPayload["d"]) {
    if (this.player.ready) return;
    if (!this.player.options.autoInit) return;
    return this.player.init(data.user.id);
  }

  async #onStateUpdate(data: VoiceStateUpdatePayload["d"]) {
    if (!data.guild_id || data.user_id !== this.player.clientId) return;

    const state = this.#cache.get(data.guild_id);

    if (state !== undefined) {
      if (data.channel_id === null) state.connected = false;
      else state.channel_id = data.channel_id;
      state.deaf = data.deaf;
      state.mute = data.mute;
      state.self_deaf = data.self_deaf;
      state.self_mute = data.self_mute;
      state.session_id = data.session_id;
      state.suppress = data.suppress;
      return;
    }

    if (data.channel_id === null || !this.#joins.has(data.guild_id)) return;

    this.#cache.set(data.guild_id, {
      channel_id: data.channel_id,
      connected: false,
      deaf: data.deaf,
      endpoint: "",
      mute: data.mute,
      node_session_id: "",
      reconnecting: false,
      region_id: "unknown",
      self_deaf: data.self_deaf,
      self_mute: data.self_mute,
      session_id: data.session_id,
      suppress: data.suppress,
      token: "",
    });
  }

  async #onServerUpdate(data: VoiceServerUpdatePayload["d"]) {
    const state = this.#cache.get(data.guild_id);
    const request = this.#joins.get(data.guild_id);

    if (!state) {
      request?.reject(new Error("No voice state received"));
      return;
    }

    if (data.endpoint === null) {
      state.connected = false;
      return;
    }

    state.token = data.token;
    state.endpoint = data.endpoint;
    state.region_id = data.endpoint.match(VoiceRegionIdRegex)?.[0] ?? "unknown";

    const region = this.#getVoiceRegion(state.region_id);

    let voice = this.#voices.get(data.guild_id);
    let node = voice?.node;

    if (node === undefined) {
      if (request?.node === undefined) node = region.getRelevantNode();
      else node = this.player.nodes.get(request.node);
    }

    if (!node?.ready) {
      if (node !== undefined) request?.reject(new Error(`Node '${node.name}' not ready`));
      else if (request?.node === undefined) request?.reject(new Error("No nodes available"));
      else request.reject(new Error(`Node '${request.node}' not found`));
      return;
    }

    try {
      const player = await node.rest.updatePlayer(data.guild_id, {
        ...request?.config,
        voice: {
          channelId: state.channel_id,
          endpoint: data.endpoint,
          sessionId: state.session_id,
          token: data.token,
        },
      });

      state.connected = true;
      state.node_session_id = node.sessionId!;

      this.player.queues[UpdateSymbol](data.guild_id, player, false);

      if (!voice) {
        voice = new VoiceState(this.player, node.name, data.guild_id);
        this.#voices.set(data.guild_id, voice);
      }

      this.player.emit("voiceConnect", voice);

      if (!this.player.queues.has(data.guild_id)) {
        const options: CreateQueueOptions = { guildId: data.guild_id, voiceId: state.channel_id };
        if (request?.context !== undefined) options.context = request.context;
        await this.player.queues.create(options);
      }

      request?.resolve(voice);
    } catch (err) {
      request?.reject(err);
    }
  }

  async [OnVoiceCloseSymbol](voice: Queue["voice"], payload: WebSocketClosedEventPayload) {
    const player = this.player.queues[LookupSymbol](payload.guildId);

    if (player !== undefined) player.state.connected = false;

    switch (payload.code) {
      case VoiceCloseCodes.AuthenticationFailed:
      case VoiceCloseCodes.ServerNotFound:
      case VoiceCloseCodes.SessionNoLongerValid:
        this[UpdateSymbol](payload.guildId, { reconnecting: true });
        break;
    }
    this.player.emit("voiceClose", voice, payload.code, payload.reason, payload.byRemote);

    if (!voice.reconnecting) return;
    try {
      await voice.connect();
      if (voice.connected) return;
      return this.destroy(voice.guildId, payload.reason);
    } catch (err) {
      return this.destroy(voice.guildId, err.message);
    } finally {
      this[UpdateSymbol](payload.guildId, { reconnecting: false });
    }
  }

  [LookupSymbol](guildId: string) {
    return this.#cache.get(guildId);
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
