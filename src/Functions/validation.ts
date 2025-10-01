import { URL } from "node:url";

export function isNumber<T extends number>(input: unknown, check?: "integer" | "natural" | "whole"): input is T {
  if (check === undefined) return Number.isFinite(input);
  if (!Number.isSafeInteger(input)) return false;
  if (check === "natural") return (input as number) > 0;
  if (Object.is(input, -0)) return false;
  if (check === "integer") return true;
  if (check === "whole") return (input as number) >= 0;
  return false;
}

export function isString<T extends string>(input: unknown, check?: "url" | "non-empty" | RegExp): input is T {
  if (check === undefined) return typeof input === "string";
  if (typeof input !== "string") return false;
  if (check === "non-empty") return input.trim().length > 0;
  if (check === "url") {
    try {
      return new URL(input).origin !== "null";
    } catch {
      return false;
    }
  }
  if (check instanceof RegExp) return check.test(input);
  return false;
}

export function isRecord<T extends Record<any, any>>(input: unknown, check?: "non-empty"): input is T {
  if (check === undefined) return input !== null && typeof input === "object" && !Array.isArray(input);
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  if (check === "non-empty") return Object.keys(input).length > 0;
  return false;
}

export function isArray<T extends any[]>(input: unknown, check?: "string" | "non-empty"): input is T {
  if (check === undefined) return Array.isArray(input);
  if (!Array.isArray(input) || input.length === 0) return false;
  if (check === "non-empty") return true;
  if (check === "string") return input.every((i) => typeof i === "string" && i.length !== 0);
  return false;
}
