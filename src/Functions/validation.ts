import { URL } from "node:url";
import { isRegExp } from "node:util/types";

/**
 * Checks if input is a number
 * @param input Any value
 * @param check Additional check to perform
 * @returns `true` if the input passed, `false` otherwise
 */
export function isNumber<T extends number>(input: unknown, check?: "integer" | "natural" | "whole"): input is T {
  if (check === undefined) return Number.isFinite(input);
  if (!Number.isSafeInteger(input)) return false;
  if (check === "natural") return (input as number) > 0;
  if (Object.is(input, -0)) return false;
  if (check === "integer") return true;
  if (check === "whole") return (input as number) >= 0;
  return false;
}

/**
 * Checks if input is a string
 * @param input Any value
 * @param check Additional check to perform
 * @returns `true` if the input passed, `false` otherwise
 */
export function isString<T extends string>(input: unknown, check?: "url" | "non-empty" | RegExp): input is T {
  if (check === undefined) return typeof input === "string";
  if (typeof input !== "string") return false;
  if (check === "non-empty") return input.trim().length > 0;
  if (check === "url") {
    try {
      const url = new URL(input);
      return url.origin !== "null" && url.protocol.startsWith("http");
    } catch {
      return false;
    }
  }
  if (isRegExp(check)) return check.test(input);
  return false;
}

/**
 * Checks if input is a record
 * @param input Any value
 * @param check Additional check to perform
 * @returns `true` if the input passed, `false` otherwise
 */
export function isRecord<T extends Record<any, any>>(input: unknown, check?: "non-empty"): input is T {
  if (check === undefined) return input !== null && typeof input === "object" && !Array.isArray(input);
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  if (check === "non-empty") return Object.keys(input).length > 0;
  return false;
}

/**
 * Checks if input is an array
 * @param input Any value
 * @param check Additional check to perform
 * @returns `true` if the input passed, `false` otherwise
 */
export function isArray<T extends any[]>(input: unknown, check?: "non-empty" | Parameters<T["every"]>[0]): input is T {
  if (check === undefined) return Array.isArray(input);
  if (!Array.isArray(input) || input.length === 0) return false;
  return check === "non-empty" || input.every(check);
}
