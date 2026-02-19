import type { PlayerPlugin } from "../Main";

/**
 * Represents an empty object
 */
export type EmptyObject = Record<never, never>;

/**
 * Represents JSON serializable data
 */
export type JsonLike = string | number | null | boolean | JsonArray | JsonObject;

/**
 * Represents JSON serializable array
 */
export type JsonArray = JsonLike[];

/**
 * Represents JSON serializable object
 */
export type JsonObject = { [x: string]: JsonLike };

/**
 * Makes select properties required
 */
export type RequiredProp<T, P extends keyof T> = Omit<T, P> & Required<Pick<T, P>>;

/**
 * Makes select properties non-nullable
 */
export type NonNullableProp<T, P extends keyof T> = {
  [K in keyof T]: K extends P ? NonNullable<T[K]> : T[K];
};

/**
 * Merges a union type into one
 */
export type MergeUnionType<U> = (U extends any ? (i: U) => void : never) extends (i: infer I) => void ? I : never;

/**
 * Extracts the event map of a plugin
 */
export type PluginEventMap<Plugin> = Plugin extends PlayerPlugin<infer EventMap> ? EventMap : {};

/**
 * Queue context, extend via module declaration
 */
export interface QueueContext extends Record<string & {}, unknown> {}

/**
 * Basic user data, extend via module declaration
 */
export interface CommonUserData extends Record<string & {}, JsonLike> {}

/**
 * Common info provided by plugins, extend via module declaration
 */
export interface CommonPluginInfo extends Record<string & {}, JsonLike> {}

/**
 * Common plugin filters, extend via module declaration
 */
export interface CommonPluginFilters extends Record<string & {}, JsonLike> {}
