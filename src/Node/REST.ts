import { URL } from "node:url";
import { validateHeaderValue } from "node:http";
import Axios from "axios";
import { DefaultRestOptions, Routes } from "../Constants";
import { isArray, isNumber, isRecord, isString } from "../Functions";
import type { AxiosError, AxiosRequestConfig, AxiosResponse, Method } from "axios";
import type {
  APIPlayer,
  APITrack,
  EmptyObject,
  JsonLike,
  JsonObject,
  LavalinkInfo,
  LoadResult,
  NodeStats,
  PlayerUpdateQueryParams,
  PlayerUpdateRequestBody,
  RequestOptions,
  RestError,
  RESTOptions,
  RoutePlannerStatus,
  SessionUpdateRequestBody,
  SessionUpdateResponseBody,
} from "../Typings";

export class REST {
  #axios = Axios.create({
    transitional: {
      silentJSONParsing: false,
    },
  });

  #sessionId: string | null = null;

  readonly origin: string;
  readonly version: number;

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

    if (_options.sessionId !== undefined) {
      this.sessionId = _options.sessionId;
    }

    if (_options.stackTrace === true) {
      this.#axios.defaults.params = { trace: true };
    }

    this.#axios.defaults.timeout = _options.requestTimeout;
    this.#axios.defaults.baseURL = `${url.origin}/v${_options.version}`;

    this.#axios.defaults.headers.common["User-Agent"] = _options.userAgent;
    this.#axios.defaults.headers.common["Authorization"] = _options.password;

    this.origin = url.origin;
    this.version = _options.version;

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      origin: immutable,
      version: immutable,
    } satisfies { [K in keyof REST]?: PropertyDescriptor });
  }

  get baseUrl() {
    return this.#axios.defaults.baseURL!;
  }

  get timeout() {
    return this.#axios.defaults.timeout!;
  }

  get sessionId() {
    return this.#sessionId;
  }

  get userAgent() {
    return this.#axios.defaults.headers.common["User-Agent"] as string;
  }

  set sessionId(id) {
    if (id === null || isString(id, "non-empty")) this.#sessionId = id;
  }

  #error(err: AxiosError<RestError> | AggregateError, path: string) {
    const res = (err as AxiosError<RestError>).response;
    const data = "errors" in err ? err.errors[err.errors.length - 1] : err;
    const error = new Error(res?.data.message ?? data.message) as Error & RestError;

    error.name = `Error [${this.constructor.name}]`;
    error.error = res?.data.error ?? res?.statusText ?? "Processing";
    error.path = res?.data.path ?? path;
    error.status = res?.data.status ?? res?.status ?? Axios.HttpStatusCode.Processing;
    error.timestamp = res?.data.timestamp ?? Date.now();

    if (res?.data.trace !== undefined) {
      error.trace = res.data.trace;
    }
    return error;
  }

  async request<T, Data extends JsonLike = EmptyObject, Params extends JsonObject = EmptyObject>(
    method: Method,
    endpoint: string,
    options?: RequestOptions<Data, Params>
  ) {
    if (!isString(method, "non-empty")) throw new Error("Method must be a non-empty string");
    if (!isString(endpoint, "non-empty")) throw new Error("Endpoint must be a non-empty string");
    if (!endpoint.startsWith("/")) throw new Error("Endpoint must start with '/'");

    const config: AxiosRequestConfig = {
      method,
      url: options?.versioned === false ? this.origin + endpoint : endpoint,
    };

    if (options?.data !== undefined) {
      config.data = options.data;
      config.headers = { "Content-Type": "application/json" };
    }

    if (options?.params !== undefined) config.params = options.params;
    if (options?.signal !== undefined) config.signal = options.signal;
    if (options?.timeout !== undefined) config.timeout = options.timeout;

    try {
      return await this.#axios.request<T, AxiosResponse<T, Data>>(config);
    } catch (err) {
      throw this.#error(err, endpoint);
    }
  }

  async get<T, Params extends JsonObject = EmptyObject>(
    endpoint: string,
    options?: Omit<RequestOptions<never, Params>, "data">
  ) {
    return this.request<T, never, Params>("GET", endpoint, options);
  }

  async post<T, Data extends JsonLike, Params extends JsonObject = EmptyObject>(
    endpoint: string,
    options?: RequestOptions<Data, Params>
  ) {
    return this.request<T, Data, Params>("POST", endpoint, options);
  }

  async patch<T, Data extends JsonLike, Params extends JsonObject = EmptyObject>(
    endpoint: string,
    options?: RequestOptions<Data, Params>
  ) {
    return this.request<T, Data, Params>("PATCH", endpoint, options);
  }

  async delete<T, Params extends JsonObject = EmptyObject>(
    endpoint: string,
    options?: Omit<RequestOptions<never, Params>, "data">
  ) {
    return this.request<T, never, Params>("DELETE", endpoint, options);
  }

  async loadTracks(identifier: string) {
    if (!isString(identifier, "non-empty")) throw new Error("Identifier must be a non-empty string");
    const response = await this.request<LoadResult>("GET", Routes.trackLoading(), { params: { identifier } });
    return response.data;
  }

  async decodeTrack(encodedTrack: string) {
    if (!isString(encodedTrack, "non-empty")) throw new Error("Encoded track must be a non-empty string");
    const response = await this.request<APITrack>("GET", Routes.trackDecoding(), { params: { encodedTrack } });
    return response.data;
  }

  async decodeTracks(tracks: string[]) {
    if (!isArray(tracks, (i) => isString(i, "non-empty"))) throw new Error("Tracks must be non-empty strings");
    const response = await this.request<APITrack[]>("POST", Routes.trackDecoding(true), { data: tracks });
    return response.data;
  }

  async fetchPlayers(sessionId = this.sessionId!) {
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request<APIPlayer[]>("GET", Routes.player(sessionId));
    return response.data;
  }

  async fetchPlayer(guildId: string, sessionId = this.sessionId!) {
    if (!isString(guildId, "non-empty")) throw new Error("Guild Id must be a non-empty string");
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request<APIPlayer>("GET", Routes.player(sessionId, guildId));
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
    const response = await this.request<APIPlayer>("PATCH", Routes.player(sessionId, guildId), {
      data: options,
      params: { ...params },
    });
    return response.data;
  }

  async destroyPlayer(guildId: string, sessionId = this.sessionId!) {
    if (!isString(guildId, "non-empty")) throw new Error("Guild Id must be a non-empty string");
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request("DELETE", Routes.player(sessionId, guildId));
    return response.status === Axios.HttpStatusCode.NoContent;
  }

  async updateSession(options: SessionUpdateRequestBody, sessionId = this.sessionId!) {
    if (!isRecord(options, "non-empty")) throw new Error("Session update options cannot be empty");
    if (!isString(sessionId, "non-empty")) throw new Error("Session Id neither set nor provided");
    const response = await this.request<SessionUpdateResponseBody>("PATCH", Routes.session(sessionId), {
      data: options,
    });
    return response.data;
  }

  async fetchInfo() {
    const response = await this.request<LavalinkInfo>("GET", Routes.info());
    return response.data;
  }

  async fetchStats() {
    const response = await this.request<NodeStats>("GET", Routes.stats());
    return response.data;
  }

  async fetchRoutePlannerStatus(): Promise<RoutePlannerStatus> {
    const response = await this.request<RoutePlannerStatus>("GET", Routes.routePlanner());
    if (response.status === Axios.HttpStatusCode.NoContent) return { class: null, details: null };
    return response.data;
  }

  async unmarkFailedAddress(address: string) {
    if (!isString(address, "non-empty")) throw new Error("Address must be a non-empty string");
    const response = await this.request("POST", Routes.routePlanner("address"), { data: { address } });
    return response.status === Axios.HttpStatusCode.NoContent;
  }

  async unmarkAllFailedAddresses() {
    const response = await this.request("POST", Routes.routePlanner("all"));
    return response.status === Axios.HttpStatusCode.NoContent;
  }
}
