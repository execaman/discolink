import { URL } from "node:url";
import { validateHeaderValue } from "node:http";
import { HttpStatusCode } from "../Typings";
import { DefaultRestOptions, Routes } from "../Constants";
import { isArray, isNumber, isRecord, isString } from "../Functions";
import type {
  APIPlayer,
  APITrack,
  LavalinkInfo,
  LoadResult,
  NodeStats,
  PlayerUpdateQueryParams,
  PlayerUpdateRequestBody,
  RequestOptions,
  RestError,
  RestResponse,
  RESTOptions,
  RoutePlannerStatus,
  SessionUpdateRequestBody,
  SessionUpdateResponseBody,
} from "../Typings";

export class REST {
  #headers = {
    Accept: "application/json",
  } as {
    Accept: string;
    "User-Agent": string;
    Authorization: string;
  };

  #stackTrace = false;
  #sessionId: string | null = null;

  readonly origin: string;
  readonly version: number;

  readonly timeout: number;
  readonly baseUrl: string;

  constructor(options: RESTOptions) {
    const _options = { ...DefaultRestOptions, ...options };

    validateHeaderValue("User-Agent", _options.userAgent);
    validateHeaderValue("Authorization", _options.password);

    const url = new URL(_options.origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Protocol must be 'http' or 'https'");
    }

    if (!isNumber(_options.version, "natural")) {
      throw new Error("Version must be a natural number");
    }

    if (!isNumber(_options.requestTimeout, "natural")) {
      throw new Error("Request timeout must be a natural number");
    }

    if (_options.sessionId !== undefined) this.sessionId = _options.sessionId;
    if (_options.stackTrace === true) this.#stackTrace = true;

    this.#headers["User-Agent"] = _options.userAgent;
    this.#headers["Authorization"] = _options.password;

    this.origin = url.origin;
    this.version = _options.version;

    this.timeout = _options.requestTimeout;
    this.baseUrl = `${url.origin}/v${_options.version}`;

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      origin: immutable,
      version: immutable,
      timeout: immutable,
      baseUrl: immutable,
    } satisfies { [K in keyof REST]?: PropertyDescriptor });
  }

  get sessionId() {
    return this.#sessionId;
  }

  get userAgent() {
    return this.#headers["User-Agent"];
  }

  set sessionId(id) {
    if (id === null || isString(id, "non-empty")) this.#sessionId = id;
  }

  #error(
    err: RestError | DOMException | Error,
    message: string,
    path: string,
    status = HttpStatusCode.Processing,
    statusText = "Processing"
  ) {
    const data = err as RestError | null;
    const error = new Error(message) as Error & RestError;

    error.name = `Error [${this.constructor.name}]`;
    error.error = data?.error ?? statusText;
    error.path = data?.path ?? path;
    error.status = data?.status ?? status;
    error.timestamp = data?.timestamp ?? Date.now();

    if (data?.trace !== undefined) error.trace = data.trace;
    return error;
  }

  async request<T>(endpoint: string, options?: RequestOptions) {
    if (!endpoint.startsWith("/")) throw new Error("Endpoint must start with '/'");
    if (options?.signal?.aborted) throw new Error("Provided signal already aborted");

    const url = new URL((options?.versioned === false ? this.origin : this.baseUrl) + endpoint);

    if (this.#stackTrace && !url.searchParams.has("trace")) url.searchParams.set("trace", "true");

    if (options?.params !== undefined) {
      const params = options.params;
      const _params = url.searchParams;
      for (const key of Object.keys(params)) _params.set(key, params[key] as string);
    }

    const req = {
      method: options?.method?.toUpperCase() ?? "GET",
      headers: { ...this.#headers, ...options?.headers },
    } as RequestInit & {
      method: string;
      headers: Extract<RequestInit["headers"], Record<string, unknown>>;
    };

    if (options?.data !== undefined && req.method !== "GET" && req.method !== "HEAD") {
      req.body = typeof options.data === "string" ? options.data : JSON.stringify(options.data);
      req.headers["Content-Type"] ??= "application/json";
    }

    const optSignal = options?.signal;
    const timeoutMs = options?.timeout ?? this.timeout;
    const controller = new AbortController();

    req.signal = optSignal ? AbortSignal.any([optSignal, controller.signal]) : controller.signal;

    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, req);
      const body: RestResponse<T> = {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers),
        ok: res.ok,
        redirected: res.redirected,
        url: res.url,
        data: (res.headers.get("content-type")?.includes("application/json") ? await res.json() : res.body) as T,
      };
      if (res.ok) return body;
      throw body;
    } catch (err) {
      const message =
        err.ok === false ? `Request failed with status code ${err.status}`
        : !optSignal?.aborted && controller.signal.aborted ? `timeout of ${timeoutMs}ms exceeded`
        : (err.message ?? "An unexpected error occurred");
      throw this.#error(err, message, endpoint, err.status, err.statusText);
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }

  async get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "data">) {
    return this.request<T>(endpoint, options);
  }

  async post<T>(endpoint: string, options?: Omit<RequestOptions, "method">) {
    return this.request<T>(endpoint, { ...options, method: "POST" });
  }

  async patch<T>(endpoint: string, options?: Omit<RequestOptions, "method">) {
    return this.request<T>(endpoint, { ...options, method: "PATCH" });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, "method">) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  async loadTracks(identifier: string) {
    if (!isString(identifier, "non-empty")) throw new Error("Identifier must be a non-empty string");
    const response = await this.request<LoadResult>(Routes.trackLoading(), { params: { identifier } });
    return response.data;
  }

  async decodeTrack(encodedTrack: string) {
    if (!isString(encodedTrack, "non-empty")) throw new Error("Encoded track must be a non-empty string");
    const response = await this.request<APITrack>(Routes.trackDecoding(), { params: { encodedTrack } });
    return response.data;
  }

  async decodeTracks(tracks: string[]) {
    if (!isArray(tracks, (i) => isString(i, "non-empty"))) throw new Error("Tracks must be non-empty strings");
    const response = await this.request<APITrack[]>(Routes.trackDecoding(true), { method: "POST", data: tracks });
    return response.data;
  }

  async fetchPlayers(sessionId = this.sessionId!) {
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request<APIPlayer[]>(Routes.player(sessionId));
    return response.data;
  }

  async fetchPlayer(guildId: string, sessionId = this.sessionId!) {
    if (!isString(guildId, "non-empty")) throw new Error("Guild Id must be a non-empty string");
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request<APIPlayer>(Routes.player(sessionId, guildId));
    return response.data;
  }

  async updatePlayer(
    guildId: string,
    options: PlayerUpdateRequestBody,
    params?: PlayerUpdateQueryParams,
    sessionId = this.sessionId!
  ) {
    if (!isString(guildId, "non-empty")) throw new Error("Guild Id must be a non-empty string");
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    if (!isRecord(options, "non-empty")) throw new Error("Player update options cannot be empty");
    const response = await this.request<APIPlayer>(Routes.player(sessionId, guildId), {
      method: "PATCH",
      data: options,
      params: { ...params },
    });
    return response.data;
  }

  async destroyPlayer(guildId: string, sessionId = this.sessionId!) {
    if (!isString(guildId, "non-empty")) throw new Error("Guild Id must be a non-empty string");
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request(Routes.player(sessionId, guildId), { method: "DELETE" });
    return response.status === HttpStatusCode.NoContent;
  }

  async updateSession(options: SessionUpdateRequestBody, sessionId = this.sessionId!) {
    if (!isRecord(options, "non-empty")) throw new Error("Session update options cannot be empty");
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request<SessionUpdateResponseBody>(Routes.session(sessionId), {
      method: "PATCH",
      data: options,
    });
    return response.data;
  }

  async fetchInfo() {
    const response = await this.request<LavalinkInfo>(Routes.info());
    return response.data;
  }

  async fetchStats() {
    const response = await this.request<NodeStats>(Routes.stats());
    return response.data;
  }

  async fetchRoutePlannerStatus(): Promise<RoutePlannerStatus> {
    const response = await this.request<RoutePlannerStatus>(Routes.routePlanner());
    if (response.status === HttpStatusCode.NoContent) return { class: null, details: null };
    return response.data;
  }

  async unmarkFailedAddress(address: string) {
    if (!isString(address, "non-empty")) throw new Error("Address must be a non-empty string");
    const response = await this.request(Routes.routePlanner("address"), { method: "POST", data: { address } });
    return response.status === HttpStatusCode.NoContent;
  }

  async unmarkAllFailedAddresses() {
    const response = await this.request(Routes.routePlanner("all"), { method: "POST" });
    return response.status === HttpStatusCode.NoContent;
  }
}
