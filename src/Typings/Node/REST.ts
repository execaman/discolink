import type { JsonLike } from "../Utility";

/**
 * Options to create a instance of REST
 */
export interface RESTOptions {
  /**
   * URL of your lavalink server
   */
  origin: string;

  /**
   * Password of your lavalink server
   */
  password: string;

  /**
   * The semver major of your lavalink server.
   * Default: `4`
   */
  version?: number;

  /**
   * The value to set the `User-Agent` header to.
   * Default: `$client/$version ($repository)`
   */
  userAgent?: string;

  /**
   * Id of the lavalink session you want to interact with (if any)
   */
  sessionId?: string;

  /**
   * Whether to include stack trace from lavalink server on error.
   * Default: `false`
   */
  stackTrace?: boolean;

  /**
   * Number of milliseconds to allow per request.
   * Default: `10_000`
   */
  requestTimeout?: number;
}

/**
 * Options for customizing a request
 */
export interface RequestOptions {
  /**
   * The http method
   */
  method?: string;

  /**
   * The query params to `set` (not `append`)
   */
  params?: Record<string, Exclude<JsonLike, object>>;

  /**
   * The headers to send
   */
  headers?: Record<string, Exclude<JsonLike, object>>;

  /**
   * The json data to attach
   */
  data?: unknown;

  /**
   * The abort signal
   */
  signal?: AbortSignal;

  /**
   * The timeout for this request
   */
  timeout?: number;

  /**
   * Whether the base url should be versioned.
   * Default: `true`
   */
  versioned?: boolean;
}

export interface RestResponse<Data> extends Pick<Response, "status" | "statusText" | "ok" | "redirected" | "url"> {
  headers: Record<string, string>;
  data: Data;
}

export const enum HttpStatusCode {
  /**
   * @deprecated
   */
  Processing = 102,
  Ok = 200,
  NoContent = 204,
  BadRequest = 400,
  Unauthorized,
  Forbidden = 403,
  NotFound,
  MethodNotAllowed,
  TooManyRequests = 429,
  InternalServerError = 500,
  BadGateway = 502,
  ServiceUnavailable,
  GatewayTimeout,
}
