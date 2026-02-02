import type { MessagePayload } from "../API";
import type { RESTOptions } from "./REST";

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
 */
export const enum CloseCodes {
  /**
   * The connection successfully completed the purpose for which it was created.
   */
  Normal = 1000,

  /**
   * The endpoint is going away, either because of a server failure or
   * the browser navigating away from the page that opened the connection.
   */
  GoingAway,

  /**
   * The endpoint is terminating the connection due to a protocol error.
   */
  ProtocolError,

  /**
   * The connection is being terminated because the endpoint received data of a type it cannot accept.
   * (For example, a text-only endpoint received binary data.)
   */
  UnsupportedData,

  /**
   * Reserved. A meaning might be defined in the future.
   */
  Reserved,

  /**
   * Reserved. Indicates that no status code was provided even though one was expected.
   */
  NoStatusReceived,

  /**
   * Reserved. Indicates that a connection was closed abnormally (that is, with no close frame being sent) when a status code is expected.
   */
  Abnormal,

  /**
   * The endpoint is terminating the connection because a message was received that contained inconsistent data (e.g., non-UTF-8 data within a text message).
   */
  InvalidFramePayloadData,

  /**
   * The endpoint is terminating the connection because it received a message that violates its policy. This is a generic status code, used when codes 1003 and 1009 are not suitable.
   */
  PolicyViolation,

  /**
   * The endpoint is terminating the connection because a data frame was received that is too large.
   */
  MessageTooBig,

  /**
   * The client is terminating the connection because it expected the server to negotiate one or more extension, but the server didn't.
   */
  MandatoryExtension,

  /**
   * The server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.
   */
  InternalError,

  /**
   * The server is terminating the connection because it is restarting.
   */
  ServiceRestart,

  /**
   * The server is terminating the connection due to a temporary condition, e.g., it is overloaded and is casting off some of its clients.
   */
  TryAgainLater,

  /**
   * The server was acting as a gateway or proxy and received an invalid response from the upstream server. This is similar to 502 HTTP Status Code.
   */
  BadGateway,

  /**
   * Reserved. Indicates that the connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).
   */
  TLSHandshake,
}

export interface NodeEventMap {
  connect: [reconnects: number, name: string];
  ready: [resumed: boolean, sessionId: string, name: string];
  dispatch: [payload: MessagePayload, name: string];
  error: [error: Error, name: string];
  close: [code: number, reason: string, name: string];
  disconnect: [code: number, reason: string, byLocal: boolean, name: string];
}

/**
 * States of a node
 */
export type NodeState = "connecting" | "connected" | "ready" | "reconnecting" | "disconnected";

/**
 * Options for creating a node
 */
export interface NodeOptions extends RESTOptions {
  /**
   * Name of the node
   */
  name: string;

  /**
   * User Id of the bot
   */
  clientId: string;

  /**
   * Interval at which this node dispatches it's stats.
   * Default: `60_000`
   */
  statsInterval?: number;

  /**
   * An assumption of this node's highest possible latency.
   * Default: `2_000`
   */
  highestLatency?: number;

  /**
   * Number of milliseconds to wait between each reconnect.
   * Default: `10_000`
   */
  reconnectDelay?: number;

  /**
   * Number of reconnects to attempt for unexpected disconnects.
   * Negative for no limit, zero for no attempts.
   * Default: `3`
   */
  reconnectLimit?: number;

  /**
   * Number of milliseconds to allow for initial handshake.
   * Default: `5_000`
   */
  handshakeTimeout?: number;
}
