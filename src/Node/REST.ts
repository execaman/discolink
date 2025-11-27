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

interface Task extends Pick<PromiseWithResolvers<AxiosResponse>, "reject" | "resolve"> {
  config: AxiosRequestConfig;
  controller?: AbortController;
}

/**
 * A class representing lavalink's REST API
 */
export class REST {
  #axios = Axios.create({
    headers: {
      Accept: "application/json",
    },
    transitional: {
      silentJSONParsing: false,
      clarifyTimeoutError: true,
    },
    responseType: "json",
  });

  #queue: Task[] = [];
  #queueIdling = true;

  #sessionId: string | null = null;
  #retryLimit: number;

  /**
   * Origin of the REST API
   */
  readonly origin: string;

  /**
   * Version of the REST API
   */
  readonly version: number;

  constructor(options: RESTOptions) {
    const _options = { ...DefaultRestOptions, ...options };

    validateHeaderValue("User-Agent", _options.userAgent);
    validateHeaderValue("Authorization", _options.password);

    const url = new URL(_options.origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Protocol must be 'http' or 'https'");
    }

    if (typeof _options.stackTrace !== "boolean") {
      throw new Error("Stack trace option must be a boolean");
    }

    if (!isNumber(_options.version, "natural")) {
      throw new Error("Version must be a natural number");
    }

    if (!isNumber(_options.retryLimit, "whole")) {
      throw new Error("Retry limit must be a whole number");
    }

    if (!isNumber(_options.requestTimeout, "natural")) {
      throw new Error("Request timeout must be a natural number");
    }

    if (_options.sessionId !== undefined && !isString(_options.sessionId, "non-empty")) {
      throw new Error("Session Id must be a non-empty string");
    }

    this.#axios.defaults.timeout = _options.requestTimeout;
    this.#axios.defaults.baseURL = `${url.origin}/v${_options.version}`;

    this.#axios.defaults.headers.common["User-Agent"] = _options.userAgent;
    this.#axios.defaults.headers.common["Authorization"] = _options.password;

    if (_options.stackTrace === true) this.#axios.defaults.params = { trace: true };

    this.origin = url.origin;
    this.version = _options.version;
    this.#retryLimit = _options.retryLimit;

    if (_options.sessionId !== undefined) this.#sessionId = _options.sessionId;

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      origin: immutable,
      version: immutable,
    } satisfies { [k in keyof REST]?: PropertyDescriptor });
  }

  /**
   * Timeout per request in milliseconds
   */
  get timeout() {
    return this.#axios.defaults.timeout!;
  }

  /**
   * Id of a session if set.
   * Setting this has no effect if this instance belongs to a Node
   */
  get sessionId() {
    return this.#sessionId;
  }

  /**
   * Retry limit of timed-out requests
   */
  get retryLimit() {
    return this.#retryLimit;
  }

  set timeout(ms) {
    if (isNumber(ms, "natural")) this.#axios.defaults.timeout = ms;
  }

  set sessionId(id) {
    if (id === null || isString(id, "non-empty")) this.#sessionId = id;
  }

  set retryLimit(count) {
    if (isNumber(count, "whole")) this.#retryLimit = count;
  }

  #error(err: AxiosError<RestError> | AggregateError | { message: string }, path: string) {
    const res = (err as AxiosError<RestError>).response;
    const data = "errors" in err ? err.errors[err.errors.length - 1] : err;
    const error = new Error(res?.data.message ?? data.message) as Error & RestError;
    error.name = `Error [${this.constructor.name}]`;
    error.error = res?.data.error ?? res?.statusText ?? "Processing";
    error.path = res?.data.path ?? path;
    error.status = res?.data.status ?? res?.status ?? Axios.HttpStatusCode.Processing;
    error.timestamp = res?.data.timestamp ?? Date.now();
    if (res?.data.trace !== undefined) error.trace = res.data.trace;
    return error;
  }

  async #makeRequest<T, D>(config: Task["config"], retries = this.#retryLimit): Promise<AxiosResponse<T, D>> {
    try {
      const response = await this.#axios.request(config);
      return response;
    } catch (err) {
      if (config.signal?.aborted) err.message = "reason" in config.signal ? config.signal.reason : err.message;
      else if (err.code === "ETIMEDOUT" && retries !== 0) return this.#makeRequest(config, retries - 1);
      throw this.#error(err, config.url!);
    }
  }

  async #resumeQueue() {
    this.#queueIdling = false;
    while (this.#queue.length !== 0) {
      const task = this.#queue[0]!;
      if (!task.config.signal) {
        task.controller = new AbortController();
        task.config.signal = task.controller.signal;
      }
      try {
        const response = await this.#makeRequest(task.config);
        task.resolve(response);
      } catch (err) {
        task.reject(err);
      }
      task.controller?.abort();
      this.#queue.shift();
    }
    this.#queueIdling = true;
  }

  dropSessionRequests(reason: string) {
    if (this.#queue.length === 0) return;
    const tasks = this.#queue.splice(0);
    tasks.shift()!.controller?.abort(reason);
    if (tasks.length === 0) return;
    const err = { message: reason };
    for (const task of tasks) task.reject(this.#error(err, task.config.url!));
  }

  async request<T, Data extends JsonLike = EmptyObject, Params extends JsonLike = EmptyObject>(
    method: Method,
    endpoint: string,
    options?: RequestOptions<Data, Params>
  ) {
    if (!isString(method, "non-empty")) throw new Error("Method must be a non-empty string");
    if (!isString(endpoint, "non-empty")) throw new Error("Endpoint must be a non-empty string");

    const config: Task["config"] = { method, url: endpoint };

    if (isRecord(options, "non-empty")) {
      if ("data" in options) {
        config.data = options.data;
        config.headers = { "Content-Type": "application/json" };
      }
      if ("params" in options) {
        if (isRecord(options.params, "non-empty")) config.params = options.params;
        else throw new Error("Options.params must be a non-empty object");
      }
      if ("signal" in options) {
        if (options.signal instanceof AbortSignal && !options.signal.aborted) config.signal = options.signal;
        else throw new Error("Options.signal is either not a instance of AbortSignal or is already aborted");
      }
      if ("timeout" in options) {
        if (isNumber(options.timeout, "natural")) config.timeout = options.timeout;
        else throw new Error("Options.timeout must be a natural number");
      }
    }

    if (this.#sessionId === null || !endpoint.includes(this.#sessionId)) {
      return this.#makeRequest<T, Data>(config);
    }

    return new Promise<AxiosResponse<T, Data>>((resolve, reject) => {
      this.#queue.push({ config, reject, resolve });
      if (this.#queueIdling) this.#resumeQueue();
    });
  }

  async get<T, P extends JsonLike>(endpoint: string, options?: Omit<RequestOptions<never, P>, "data">) {
    return this.request<T, never, P>("GET", endpoint, options);
  }

  async post<T, D extends JsonLike, P extends JsonLike>(endpoint: string, options?: RequestOptions<D, P>) {
    return this.request<T, D, P>("POST", endpoint, options);
  }

  async patch<T, D extends JsonLike, P extends JsonLike>(endpoint: string, options?: RequestOptions<D, P>) {
    return this.request<T, D, P>("PATCH", endpoint, options);
  }

  async delete<T, P extends JsonLike>(endpoint: string, options?: Omit<RequestOptions<never, P>, "data">) {
    return this.request<T, never, P>("DELETE", endpoint, options);
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
      params: { noReplace: params?.noReplace === true },
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
