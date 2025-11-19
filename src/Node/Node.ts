declare const $clientName: string;
declare const $clientVersion: string;

import { EventEmitter, once } from "node:events";
import { clearImmediate, clearTimeout, setImmediate, setTimeout } from "node:timers";
import { WebSocket } from "ws";
import { CloseCodes, OPType } from "../Typings";
import { DefaultNodeOptions, DefaultRestOptions, Routes, SnowflakeRegex } from "../Constants";
import { isNumber, isString, noop } from "../Functions";
import { REST } from "./index";

import type { ClientOptions } from "ws";
import type { ClientHeaders, MessagePayload, NodeEventMap, NodeOptions, NodeState, StatsPayload } from "../Typings";

/**
 * A class representing a lavalink server
 */
export class Node extends EventEmitter<NodeEventMap> {
  #socketConfig = {
    headers: {
      "Client-Name": $clientName + "/" + $clientVersion,
    },
    perMessageDeflate: false,
  } as unknown as {
    handshakeTimeout: number;
    headers: ClientOptions["headers"] & ClientHeaders;
    perMessageDeflate: boolean;
  };

  #connectPromise: Promise<boolean> | null = null;
  #disconnectPromise: Promise<void> | null = null;

  #pingTimer: NodeJS.Timeout | null = null;
  #reconnectTimer: NodeJS.Timeout | null = null;

  #stats: StatsPayload | null = null;
  #socket: WebSocket | null = null;

  #ping: number | null = null;
  #lastPingTime: number | null = null;

  #manualDisconnect = false;

  #reconnectInit = false;
  #reconnectAttempts = 0;

  #sessionId: string | null = null;
  #socketURL: string;

  #statsInterval: number;
  #highestLatency: number;

  #reconnectDelay: number;
  #reconnectLimit: number;

  readonly name: string;
  readonly rest: REST;

  constructor(options: NodeOptions) {
    super({ captureRejections: false });
    const _options = { ...DefaultNodeOptions, ...DefaultRestOptions, ...options };

    if (!isString(_options.name, "non-empty")) {
      throw new Error("Name must be a non-empty string");
    }

    if (!isString(_options.clientId, SnowflakeRegex)) {
      throw new Error("Client Id is not a valid Discord Id");
    }

    if (!isNumber(_options.statsInterval, "natural")) {
      throw new Error("Stats interval must be a natural number");
    }

    if (!isNumber(_options.highestLatency, "natural")) {
      throw new Error("Highest latency must be a natural number");
    }

    if (!isNumber(_options.reconnectDelay, "natural")) {
      throw new Error("Reconnect delay must be a natural number");
    }

    if (!isNumber(_options.reconnectLimit, "natural")) {
      throw new Error("Reconnect limit must be a natural number");
    }

    if (!isNumber(_options.handshakeTimeout, "natural")) {
      throw new Error("Handshake timeout must be a natural number");
    }

    this.#statsInterval = _options.statsInterval;
    this.#highestLatency = _options.highestLatency;

    this.#reconnectDelay = _options.reconnectDelay;
    this.#reconnectLimit = _options.reconnectLimit;

    this.#socketConfig.handshakeTimeout = _options.handshakeTimeout;

    this.name = _options.name;
    this.rest = new REST(_options);

    this.#socketURL = `${this.rest.origin.replace("http", "ws")}/v${this.rest.version}${Routes.websocket()}`;

    this.#socketConfig.headers["User-Id"] = _options.clientId;
    this.#socketConfig.headers["User-Agent"] = _options.userAgent;
    this.#socketConfig.headers["Authorization"] = _options.password;

    if (this.rest.sessionId !== null) this.#socketConfig.headers["Session-Id"] = this.rest.sessionId;

    Object.defineProperty(this.rest, "sessionId" satisfies keyof REST, {
      get: (): REST["sessionId"] => this.#sessionId,
      set: noop,
    });

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      name: immutable,
      rest: immutable,
    } satisfies { [k in Exclude<keyof Node, "toString">]?: PropertyDescriptor });
  }

  /**
   * Id of the bot
   */
  get clientId() {
    return this.#socketConfig.headers["User-Id"];
  }

  /**
   * Id of the session
   */
  get sessionId() {
    return this.#sessionId;
  }

  /**
   * Round-trip time
   */
  get ping() {
    return this.#ping;
  }

  /**
   * Stats from lavalink
   */
  get stats() {
    return this.#stats;
  }

  /**
   * Current state of the node
   */
  get state(): NodeState {
    if (this.connecting) return "connecting";
    if (this.connected) return this.ready ? "ready" : "connected";
    if (this.reconnecting) return "reconnecting";
    return "disconnected";
  }

  /**
   * The node is connecting
   */
  get connecting() {
    return this.#socket !== null && this.#socket.readyState === this.#socket.CONNECTING;
  }

  /**
   * The node is connected
   */
  get connected() {
    return this.#socket !== null && this.#socket.readyState === this.#socket.OPEN;
  }

  /**
   * The node has connected and received the ready payload
   */
  get ready() {
    return this.#sessionId !== null && this.connected;
  }

  /**
   * The node is reconnecting
   */
  get reconnecting() {
    return this.#socket === null && this.#reconnectTimer !== null;
  }

  /**
   * The node is disconnected (no connection, no reconnects)
   */
  get disconnected() {
    return this.#socket === null && !this.reconnecting;
  }

  /**
   * Number of reconnects attempted
   */
  get reconnectAttempts() {
    return this.#reconnectAttempts;
  }

  /**
   * Initial handshake timeout in milliseconds
   */
  get handshakeTimeout() {
    return this.#socketConfig.handshakeTimeout;
  }

  set handshakeTimeout(ms) {
    if (isNumber(ms, "natural")) this.#socketConfig.handshakeTimeout = ms;
  }

  #error(err: Error | AggregateError) {
    const data = "errors" in err ? err.errors[err.errors.length - 1] : err;
    const error = data instanceof Error ? data : new Error(`${data.message ?? data}`);
    error.name = `Error [${this.constructor.name}]`;
    return error;
  }

  #cleanup() {
    this.#socket?.removeAllListeners();
    if (this.#pingTimer !== null) clearTimeout(this.#pingTimer);
    this.#socket = this.#pingTimer = this.#stats = null;
    this.#sessionId = this.#lastPingTime = this.#ping = null;
  }

  #reconnect() {
    this.#reconnectInit = false;
    this.#reconnectTimer?.refresh();
    this.#reconnectTimer ??= setTimeout(() => {
      this.#reconnectInit = true;
      this.connect();
    }, this.#reconnectDelay);
  }

  #stopReconnecting(keepCount = false) {
    if (this.#reconnectTimer === null) return;
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
    this.#reconnectInit = false;
    if (!keepCount) this.#reconnectAttempts = 0;
  }

  #keepAliveAndPing() {
    this.#pingTimer?.refresh();
    this.#pingTimer ??= setTimeout(() => {
      this.#socket?.terminate();
      this.#cleanup();
      this.rest.dropSessionRequests(`Connection to node '${this.name}' was zombie`);
      this.#reconnect();
    }, this.#statsInterval + this.#highestLatency).unref();
    this.#lastPingTime = Date.now();
    this.#socket?.ping();
  }

  #parseMessageData(data: string) {
    try {
      return JSON.parse(data) as MessagePayload;
    } catch {
      return null;
    }
  }

  /**
   * Connects for a session with lavalink
   * @returns `true` if the initial handshake succeeded, `false` otherwise
   */
  async connect() {
    if (this.#socket !== null) return this.#connectPromise ?? this.connected;
    if (this.reconnecting) {
      this.#reconnectAttempts++;
      if (!this.#reconnectInit) this.#stopReconnecting(true);
    }
    this.#socket = new WebSocket(this.#socketURL, this.#socketConfig);
    this.#socket.once("open", () => {
      this.emit("connect", this.#reconnectAttempts, this.name);
    });
    this.#socket.on("message", (data) => {
      this.#onMessage(data.toString("utf8"));
    });
    this.#socket.on("error", (err) => {
      this.emit("error", this.#error(err), this.name);
    });
    this.#socket.on("close", (code, reason) => {
      this.#onClose(code, reason.toString("utf8"));
    });
    this.#socket.on("pong", () => {
      if (this.#lastPingTime === null) return;
      this.#ping = Math.max(0, Date.now() - this.#lastPingTime);
    });
    const resolver = Promise.withResolvers<boolean>();
    this.#connectPromise = resolver.promise;
    const controller = new AbortController();
    try {
      await Promise.race([
        once(this.#socket, "open", { signal: controller.signal }),
        once(this.#socket, "close", { signal: controller.signal }),
      ]);
      return this.connected;
    } catch {
      this.#cleanup();
      return false;
    } finally {
      controller.abort();
      this.#connectPromise = null;
      resolver.resolve(this.connected);
    }
  }

  /**
   * Closes connection to lavalink and stops reconnecting
   * @param reason Reason for closing (only effective if a connection exists)
   */
  async disconnect(reason = "disconnected") {
    if (this.#disconnectPromise !== null) return this.#disconnectPromise;
    this.#stopReconnecting();
    if (this.#socket === null) return;
    if (this.connecting) {
      this.#manualDisconnect = true;
      this.#socket.terminate();
      return;
    }
    if (!this.connected) return;
    this.#manualDisconnect = true;
    this.#disconnectPromise = once(this.#socket, "close").then(noop, noop);
    this.#socket.close(CloseCodes.Normal, reason);
    await this.#disconnectPromise;
    this.#disconnectPromise = null;
  }

  async #onMessage(data: string) {
    const payload = this.#parseMessageData(data);
    if (payload === null) return;
    if (payload.op === OPType.Stats) {
      this.#stats = payload;
      this.#keepAliveAndPing();
    } else if (payload.op === OPType.Ready) {
      this.#stopReconnecting();
      this.#socketConfig.headers["Session-Id"] = this.#sessionId = payload.sessionId;
      this.emit("ready", payload.resumed, payload.sessionId, this.name);
    }
    this.emit("dispatch", payload, this.name);
  }

  #onClose(code: number, reason: string) {
    this.#cleanup();
    this.rest.dropSessionRequests(`Connection to node '${this.name}' closed`);
    if (this.#manualDisconnect || this.#reconnectAttempts === this.#reconnectLimit) {
      this.#stopReconnecting();
      delete this.#socketConfig.headers["Session-Id"];
      const byLocal = this.#manualDisconnect;
      this.#manualDisconnect = false;
      this.emit("disconnect", code, reason, byLocal, this.name);
      return;
    }
    if (this.#reconnectInit) {
      this.#reconnect();
      this.emit("close", code, reason, this.name);
      return;
    }
    const immediate = setImmediate(() => {
      clearImmediate(immediate);
      this.#reconnectInit = true;
      this.connect();
    });
  }

  override toString() {
    return this.name;
  }
}
