import type { EmptyObject, JsonObject } from "../Utility";
import type { Filters } from "../API";

/**
 * Yields a union type of filter names (plugins included)
 */
export type FilterNames<PluginFilters extends JsonObject = EmptyObject> = keyof Filters | keyof PluginFilters;

/**
 * Yields the value of a filter by name
 */
export type FilterValue<Name extends FilterNames<PluginFilters>, PluginFilters extends JsonObject = EmptyObject> =
  Name extends keyof PluginFilters ? Required<PluginFilters>[Name]
  : Name extends keyof Filters ? Required<Filters>[Name]
  : never;
