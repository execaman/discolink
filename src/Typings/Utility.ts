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
