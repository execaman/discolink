import type { EmptyObject, JsonLike, JsonObject } from "../Utility";

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
export interface RequestOptions<Data extends JsonLike = EmptyObject, Params extends JsonObject = EmptyObject> {
  /**
   * The data to attach in request body
   */
  data?: Data;

  /**
   * The query params to append to the endpoint
   */
  params?: Params;

  /**
   * The abort signal for this request
   */
  signal?: AbortSignal;

  /**
   * The timeout for this request
   */
  timeout?: number;

  /**
   * Whether this request should be versioned.
   * Default: `true`
   */
  versioned?: boolean;
}
