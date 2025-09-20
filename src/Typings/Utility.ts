export type EmptyObject = Record<never, never>;

export type JsonLike = string | number | null | boolean | JsonArray | JsonObject;

export type JsonArray = JsonLike[];

export type JsonObject = { [k: string]: JsonLike };

export type RequiredProp<T, P extends keyof T> = Omit<T, P> & Required<Pick<T, P>>;

export type NonNullableProp<T, P extends keyof T> = {
  [K in keyof T]: K extends P ? NonNullable<T[K]> : T[K];
};
