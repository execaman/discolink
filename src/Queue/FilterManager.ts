import type { APIPlayer, EmptyObject, FilterNames, FilterValue, JsonObject, Filters } from "../Typings";
import type { VoiceState } from "../Voice";
import type { QueueManager } from "./index";
import type { Player } from "../Main";

/**
 * A helper class for Queue to simplify filter management
 */
export class FilterManager<PluginFilters extends JsonObject = EmptyObject> {
  #manager: QueueManager;
  #cache: APIPlayer;
  #voice: VoiceState;

  constructor(player: Player, guildId: string) {
    const cache = player.queues.cache.get(guildId);
    if (!cache) throw new Error(`No player found for guild '${guildId}'`);
    const voice = player.voices.get(guildId);
    if (!voice) throw new Error(`No connection found for guild '${guildId}'`);
    this.#manager = player.queues;
    this.#cache = cache;
    this.#voice = voice;
  }

  get #data() {
    this.#cache = this.#manager.cache.get(this.#voice.guildId) ?? this.#cache;
    return this.#cache;
  }

  set #data(data) {
    this.#manager.cache.set(this.#voice.guildId, data);
    this.#cache = data;
  }

  /**
   * Raw filters object
   */
  get data() {
    return this.#data.filters as Filters<PluginFilters>;
  }

  /**
   * Gets the value of a filter
   * @param name Name of the filter
   * @returns Value of that filter if active, `null` otherwise
   */
  get<Name extends FilterNames<PluginFilters>>(name: Name): FilterValue<Name, PluginFilters> | null {
    if (name === "pluginFilters") return null;
    return (this.#data.filters as any)[name] ?? (this.#cache.filters.pluginFilters as any)?.[name] ?? null;
  }

  /**
   * Sets the value of a filter
   * @param name Name of the filter
   * @param value Value of the filter
   * @param isPlugin Whether this filer belongs to a plugin
   */
  async set<Name extends FilterNames<PluginFilters>, Value extends FilterValue<Name, PluginFilters>>(
    name: Name,
    value: Value,
    isPlugin = false
  ): Promise<Value | null> {
    if (name === "pluginFilters") return null;
    if (!isPlugin) (this.#data.filters as any)[name] = value;
    else {
      this.#cache.filters.pluginFilters ??= {};
      (this.#cache.filters.pluginFilters as any)[name] = value;
    }
    await this.override(this.#cache.filters as Filters<PluginFilters>);
    return (isPlugin ? (this.#cache.filters.pluginFilters as any)?.[name] : (this.#cache.filters as any)[name]) ?? null;
  }

  /**
   * Returns a boolean saying whether a filter is active
   * @param name Name of the filter
   */
  has<Name extends FilterNames<PluginFilters>>(name: Name) {
    if (name === "pluginFilters") return false;
    return (
      name in this.#data.filters
      || (this.#cache.filters.pluginFilters !== undefined && name in this.#cache.filters.pluginFilters)
    );
  }

  /**
   * Updates the filters by shallow merging current and provided filters object
   * @param filters Raw filters object
   */
  async merge(filters: Filters<PluginFilters>) {
    return this.override({ ...(this.#data.filters as Filters<PluginFilters>), ...filters });
  }

  /**
   * Removes filters by name
   * @param names List of filter names
   */
  async remove<Name extends FilterNames<PluginFilters>>(...names: Name[]) {
    if (names.length === 0) return this.#data.filters as Filters<PluginFilters>;
    for (const filter in this.#data.filters) {
      if (names.includes(filter as any)) delete (this.#cache.filters as any)[filter];
    }
    for (const filter in this.#cache.filters.pluginFilters) {
      if (names.includes(filter as any)) delete (this.#cache.filters.pluginFilters as any)?.[filter];
    }
    return this.override(this.#cache.filters as Filters<PluginFilters>);
  }

  /**
   * Removes all filters
   */
  async clear() {
    return this.override({});
  }

  /**
   * Updates the filters as provided
   * @param filters Raw filters object
   */
  async override(filters: Filters<PluginFilters>) {
    this.#data = await this.#voice.node.rest.updatePlayer(this.#voice.guildId, { filters });
    return this.#cache.filters as Filters<PluginFilters>;
  }
}
