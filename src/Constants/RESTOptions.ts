declare const $clientName: string;
declare const $clientVersion: string;
declare const $clientRepository: string;

import type { RESTOptions } from "../Typings";

/**
 * These options are writable but neither extendable, nor configurable
 */
export const DefaultRestOptions = Object.seal({
  version: 4,
  userAgent: $clientName + "/" + $clientVersion + " (" + $clientRepository + ")",
  stackTrace: false,
  retryLimit: 0,
  requestTimeout: 15_000,
} as const satisfies Partial<RESTOptions>);
