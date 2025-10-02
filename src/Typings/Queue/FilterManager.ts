import type { EmptyObject, JsonObject } from "../Utility";
import type { Filters } from "../API";

/**
 * Yields a union type of filter names (plugins included)
 */
export type FilterNames<PluginFilters extends JsonObject = EmptyObject> = Extract<
  keyof Omit<Filters, "pluginFilters"> | keyof PluginFilters,
  string
>;

/**
 * Yields the value of a filter by name
 */
export type FilterValue<Name extends string, PluginFilters extends JsonObject = EmptyObject> =
  Name extends keyof PluginFilters ? Required<PluginFilters>[Name]
  : Name extends keyof Omit<Filters, "pluginFilters"> ? Required<Filters>[Name]
  : never;
