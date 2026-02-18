import { URL } from "node:url";

/**
 * Check if input is a finite number
 * @param input value
 * @param check `integer`, `natural`, `whole`
 * @returns `true` if the input passed, `false` otherwise
 */
export const isNumber = <T extends number>(input: unknown, check?: "integer" | "natural" | "whole"): input is T => {
  if (check === undefined) return Number.isFinite(input);
  if (check === "integer") return Number.isSafeInteger(input);
  if (check === "natural") return Number.isSafeInteger(input) && (input as number) > 0;
  if (check === "whole") return Number.isSafeInteger(input) && (input as number) >= 0;
  return false;
};

/**
 * Check if input is a string
 * @param input value
 * @param check {@linkcode RegExp}, `url` ({@linkcode URL.canParse}), `non-empty` (at least one non-whitespace character)
 * @returns `true` if the input passed, `false` otherwise
 */
export const isString = <T extends string>(input: unknown, check?: "url" | "non-empty" | RegExp): input is T => {
  if (typeof input !== "string") return false;
  if (check === undefined) return true;
  if (check === "url") return URL.canParse(input);
  if (check === "non-empty") return input.trim().length > 0;
  if (check instanceof RegExp) return check.test(input);
  return false;
};

/**
 * Check if input is a plain object
 * @param input value
 * @param check `non-empty` (at least one key)
 * @returns `true` if the input passed, `false` otherwise
 */
export const isRecord = <T extends Record<any, any>>(input: unknown, check?: "non-empty"): input is T => {
  if (!input || input.constructor !== Object) return false;
  if (check === undefined) return true;
  if (check === "non-empty") return Object.keys(input).length > 0;
  return false;
};

/**
 * Check if input is an array
 * @param input value
 * @param check `non-empty`, `function` (same as {@linkcode Array.prototype.every})
 * @returns `true` if the input passed, `false` otherwise
 */
export const isArray = <T extends any[]>(
  input: unknown,
  check?: "non-empty" | Parameters<T["every"]>[0]
): input is T => {
  if (!Array.isArray(input)) return false;
  if (check === undefined) return true;
  if (check === "non-empty") return input.length !== 0;
  if (typeof check === "function") return input.every(check);
  return false;
};
