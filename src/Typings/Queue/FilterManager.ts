import type { EmptyObject, JsonObject } from "../Utility";
import type { Filters } from "../API";

export type FilterNames<PluginFilters extends JsonObject = EmptyObject> = Extract<
  keyof Omit<Filters, "pluginFilters"> | keyof PluginFilters,
  string
>;

export type FilterValue<Name extends string, PluginFilters extends JsonObject = EmptyObject> =
  Name extends keyof PluginFilters ? Required<PluginFilters>[Name]
  : Name extends keyof Omit<Filters, "pluginFilters"> ? Required<Filters>[Name]
  : never;
