import { URL } from "node:url";

export function isNumber<T extends number>(input: unknown, type?: "integer" | "natural" | "whole"): input is T {
  if (type === undefined) return Number.isFinite(input);
  switch (type) {
    case "integer":
      return Number.isSafeInteger(input) && !Object.is(input, -0);
    case "natural":
      return Number.isSafeInteger(input) && (input as number) > 0;
    case "whole":
      return Number.isSafeInteger(input) && (input as number) > -1 && !Object.is(input, -0);
    default:
      throw new SyntaxError(`Invalid number check type '${type}'`);
  }
}

export function isString<T extends string>(input: unknown, check?: "url" | "non-empty" | RegExp): input is T {
  if (check === undefined) return typeof input === "string";
  if (typeof input !== "string") return false;
  if (check instanceof RegExp) return check.test(input);
  switch (check) {
    case "url": {
      try {
        return new URL(input).origin !== "null";
      } catch {
        return false;
      }
    }
    case "non-empty":
      return input.trim().length !== 0;
    default:
      throw new SyntaxError(`Invalid string check type '${check}'`);
  }
}

export function isRecord<T extends Record<any, any>>(input: unknown, type?: "non-empty"): input is T {
  if (type === undefined) return input !== null && typeof input === "object" && !Array.isArray(input);
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  switch (type) {
    case "non-empty":
      return Object.keys(input).length !== 0;
    default:
      throw new SyntaxError(`Invalid object check type '${type}'`);
  }
}

export function isArray<T extends any[]>(input: unknown, check?: "string" | "non-empty"): input is T {
  if (check === undefined) return Array.isArray(input);
  if (!Array.isArray(input)) return false;
  switch (check) {
    case "string":
      if (input.length === 0) return false;
      return input.every((i) => typeof i === "string" && i.length !== 0);
    case "non-empty":
      return input.length !== 0;
    default:
      throw new SyntaxError(`Invalid array check type '${check}'`);
  }
}
