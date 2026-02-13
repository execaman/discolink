declare const $clientName: string;
declare const $clientVersion: string;

import { EventEmitter, once } from "node:events";
import { clearImmediate, clearTimeout, setImmediate, setTimeout } from "node:timers";
import { WebSocket } from "ws";
import { CloseCodes, OPType } from "../Typings";
import { DefaultNodeOptions, Routes, SnowflakeRegex } from "../Constants";
import { isNumber, isString, noop } from "../Functions";
import { REST } from "./index";
import type { ClientOptions } from "ws";
import type { ClientHeaders, MessagePayload, NodeEventMap, NodeOptions, NodeState, StatsPayload } from "../Typings";

/**
 * A class representing a lavalink node
 */
export class Node extends EventEmitter<NodeEventMap> {
  #socketConfig = {
    headers: {
      "Client-Name": $clientName + "/" + $clientVersion,
    },
    perMessageDeflate: false,
  } as ClientOptions & { headers: ClientHeaders };

  #connectPromise: Promise<boolean> | null = null;
  #disconnectPromise: Promise<void> | null = null;

  #pingTimer: NodeJS.Timeout | null = null;
  #reconnectTimer: NodeJS.Timeout | null = null;

  #ping: number | null = null;
  #lastPingTime: number | null = null;

  #reconnectCycle = true;
  #reconnectAttempts = 0;

  #manualDisconnect = false;

  #socket: WebSocket | null = null;
  #stats: StatsPayload | null = null;

  #socketUrl: string;
  #pingTimeout: number;

  #reconnectDelay: number;
  #reconnectLimit: number;

  readonly name: string;
  readonly rest: REST;

  constructor(options: NodeOptions) {
    super({ captureRejections: false });

    const _options = { ...DefaultNodeOptions, ...options };

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

    if (!isNumber(_options.reconnectLimit, "integer")) {
      throw new Error("Reconnect limit must be an integer");
    }

    if (!isNumber(_options.handshakeTimeout, "natural")) {
      throw new Error("Handshake timeout must be a natural number");
    }

    const rest = new REST(options);

    if (rest.sessionId !== null) {
      this.#socketConfig.headers["Session-Id"] = rest.sessionId;
      rest.sessionId = null;
    }

    this.#socketConfig.headers["User-Id"] = _options.clientId;
    this.#socketConfig.headers["User-Agent"] = rest.userAgent;
    this.#socketConfig.headers["Authorization"] = _options.password;

    this.#socketConfig.handshakeTimeout = _options.handshakeTimeout;

    this.#socketUrl = rest.baseUrl.replace("http", "ws") + Routes.websocket();
    this.#pingTimeout = _options.statsInterval + _options.highestLatency;

    this.#reconnectDelay = _options.reconnectDelay;
    this.#reconnectLimit = _options.reconnectLimit;

    this.name = _options.name;
    this.rest = rest;

    Object.defineProperty(rest, "sessionId" satisfies keyof REST, {
      configurable: false,
      get: (): REST["sessionId"] => this.sessionId,
      set: noop,
    });

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      name: immutable,
      rest: immutable,
    } satisfies { [K in Exclude<keyof Node, "toString">]?: PropertyDescriptor });
  }

  get clientId() {
    return this.#socketConfig.headers["User-Id"];
  }

  get sessionId() {
    return this.#socketConfig.headers["Session-Id"] ?? null;
  }

  get ping() {
    return this.#ping;
  }

  get stats() {
    return this.#stats;
  }

  get state(): NodeState {
    if (this.connecting) return "connecting";
    if (this.connected) return this.ready ? "ready" : "connected";
    return this.reconnecting ? "reconnecting" : "disconnected";
  }

  get connecting() {
    return this.#socket?.readyState === WebSocket.CONNECTING;
  }

  get connected() {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  get ready() {
    return this.connected && this.sessionId !== null;
  }

  get reconnecting() {
    return this.#socket === null && this.#reconnectTimer !== null;
  }

  get disconnected() {
    return this.#socket === null && !this.reconnecting;
  }

  get reconnectLimit() {
    return this.#reconnectLimit;
  }

  get reconnectAttempts() {
    return this.#reconnectAttempts;
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
    this.#lastPingTime = this.#ping = null;
  }

  #reconnect() {
    this.#reconnectCycle = false;
    this.#reconnectTimer?.refresh();
    this.#reconnectTimer ??= setTimeout(() => {
      this.#reconnectCycle = true;
      this.connect();
    }, this.#reconnectDelay).unref();
  }

  #stopReconnecting(resetCount = true, reconnectCycle = false) {
    this.#reconnectCycle = reconnectCycle;
    if (resetCount) this.#reconnectAttempts = 0;
    if (this.#reconnectTimer !== null) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }

  #keepAliveAndPing() {
    this.#pingTimer?.refresh();
    this.#pingTimer ??= setTimeout(() => {
      this.#socket?.terminate();
      this.#cleanup();
      this.#reconnect();
    }, this.#pingTimeout).unref();
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

  async connect() {
    if (this.#socket !== null) return this.#connectPromise ?? this.connected;
    if (this.reconnecting) {
      this.#reconnectAttempts++;
      if (!this.#reconnectCycle) this.#stopReconnecting(false, true);
    }
    this.#socket = new WebSocket(this.#socketUrl, this.#socketConfig);
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
    } catch {
      this.#cleanup();
    } finally {
      controller.abort();
      const connected = this.connected;
      resolver.resolve(connected);
      this.#connectPromise = null;
      return connected;
    }
  }

  async disconnect(code: number = CloseCodes.Normal, reason = "disconnected") {
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
    this.#socket.close(code, reason);
    await this.#disconnectPromise;
    this.#disconnectPromise = null;
  }

  async #onMessage(data: string) {
    const payload = this.#parseMessageData(data);
    if (payload === null) return this.disconnect(CloseCodes.UnsupportedData, "expected json payload");
    if (payload.op === OPType.Stats) {
      this.#stats = payload;
      this.#keepAliveAndPing();
    } else if (payload.op === OPType.Ready) {
      this.#stopReconnecting();
      this.#socketConfig.headers["Session-Id"] = payload.sessionId;
      this.emit("ready", payload.resumed, payload.sessionId, this.name);
    }
    this.emit("dispatch", payload, this.name);
  }

  #onClose(code: number, reason: string) {
    this.#cleanup();
    if (this.#manualDisconnect || this.#reconnectAttempts === this.#reconnectLimit) {
      this.#stopReconnecting();
      delete this.#socketConfig.headers["Session-Id"];
      const byLocal = this.#manualDisconnect;
      this.#manualDisconnect = false;
      this.emit("disconnect", code, reason, byLocal, this.name);
      return;
    }
    if (this.#reconnectCycle) {
      this.#reconnect();
      this.emit("close", code, reason, this.name);
      return;
    }
    const immediate = setImmediate(() => {
      clearImmediate(immediate);
      this.#reconnectCycle = true;
      this.connect();
    });
  }

  override toString() {
    return this.name;
  }
}
