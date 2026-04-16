import { LookupSymbol } from "../Constants/Symbols";
import type { APIPlayer, FilterNames, FilterValue, JsonObject, Filters, CommonPluginFilters } from "../Typings";
import type { VoiceState } from "../Voice";
import type { Player } from "../Main";

/**
 * Utility class for managing filters
 */
export class FilterManager<PluginFilters extends JsonObject = CommonPluginFilters> {
  #player: APIPlayer;
  #voice: VoiceState;

  constructor(player: Player, guildId: string) {
    if (player.queues.has(guildId)) throw new Error(`A Queue already exists with its own FilterManager`);

    const _player = player.queues[LookupSymbol](guildId);
    if (!_player) throw new Error(`No player found for guild '${guildId}'`);

    const voice = player.voices.get(guildId);
    if (!voice) throw new Error(`No connection found for guild '${guildId}'`);

    this.#player = _player;
    this.#voice = voice;
  }

  /**
   * Get the value of a filter
   * @param name Name of the filter
   */
  get<Name extends FilterNames<PluginFilters>>(name: Name) {
    return (this.#player.filters[name as keyof Filters]
      ?? (this.#player.filters as Filters<PluginFilters>).pluginFilters?.[name as keyof PluginFilters]
      ?? null) as FilterValue<Name, PluginFilters> | null;
  }

  /**
   * Set the value of a filter
   * @param name Name of the filter
   * @param value Value for the filter
   * @param isPlugin Whether the filter comes from a plugin
   */
  async set<Name extends FilterNames<PluginFilters>, Value extends FilterValue<Name, PluginFilters>>(
    name: Name,
    value: Value,
    isPlugin = false
  ) {
    if (isPlugin) {
      (this.#player.filters as Filters<PluginFilters>).pluginFilters ??= {} as PluginFilters;
      (this.#player.filters as Filters<PluginFilters>).pluginFilters![name] = value as PluginFilters[Name];
    } else {
      this.#player.filters[name as keyof Filters] = value as any;
    }
    await this.override(this.#player.filters as Filters<PluginFilters>);
    return this.get(name);
  }

  /**
   * Check if a filter is active
   * @param name Name of the filter
   */
  has<Name extends FilterNames<PluginFilters>>(name: Name) {
    return (
      Object.hasOwn(this.#player.filters, name)
      || (this.#player.filters.pluginFilters !== undefined && Object.hasOwn(this.#player.filters.pluginFilters, name))
    );
  }

  /**
   * Remove filter(s)
   * @param names Name(s) of filter(s) to remove
   */
  async remove<Name extends FilterNames<PluginFilters>>(...names: Name[]) {
    if (names.length === 0) return this.#player.filters as Filters<PluginFilters>;
    for (const filter in this.#player.filters) {
      if (names.includes(filter as Name)) delete this.#player.filters[filter as keyof Filters];
    }
    for (const filter in this.#player.filters.pluginFilters) {
      if (!names.includes(filter as Name)) continue;
      delete (this.#player.filters as Filters<PluginFilters>).pluginFilters![filter as keyof PluginFilters];
    }
    return this.override(this.#player.filters as Filters<PluginFilters>);
  }

  /**
   * Clear filters by type (all if none specified)
   * @param type Type of filters to clear (`native` for built-in, `plugin` for plugins)
   */
  async clear(type?: "native" | "plugin") {
    if (type === "plugin") return this.remove("pluginFilters");
    if (type === "native" && this.#player.filters.pluginFilters !== undefined) {
      return this.override({ pluginFilters: this.#player.filters.pluginFilters as PluginFilters });
    }
    return this.override({});
  }

  /**
   * Shallow merge an object of filters
   * @param filters Object of filters
   */
  async merge(filters: Filters<PluginFilters>) {
    return this.override({ ...(this.#player.filters as Filters<PluginFilters>), ...filters });
  }

  /**
   * Set an object of filters
   * @param filters Object of filters
   */
  async override(filters: Filters<PluginFilters>) {
    const player = await this.#voice.node.rest.updatePlayer(this.#voice.guildId, { filters });
    Object.assign(this.#player, player);
    return player.filters as Filters<PluginFilters>;
  }
}
