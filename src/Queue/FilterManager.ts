import type { APIPlayer, EmptyObject, FilterNames, FilterValue, JsonObject, Filters } from "../Typings";
import type { VoiceState } from "../Voice";
import type { QueueManager } from "./index";
import type { Player } from "../Main";

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

  get data() {
    return this.#data.filters as Filters<PluginFilters>;
  }

  get<Name extends FilterNames<PluginFilters>>(name: Name): FilterValue<Name, PluginFilters> | null {
    return (this.#data.filters as any)[name] ?? (this.#cache.filters.pluginFilters as any)?.[name] ?? null;
  }

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

  has<Name extends FilterNames<PluginFilters>>(name: Name) {
    if (name === "pluginFilters") return false;
    return (
      name in this.#data.filters
      || (this.#cache.filters.pluginFilters !== undefined && name in this.#cache.filters.pluginFilters)
    );
  }

  async merge(filters: Filters<PluginFilters>) {
    return this.override({ ...(this.#data.filters as Filters<PluginFilters>), ...filters });
  }

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

  async clear() {
    return this.override({});
  }

  async override(filters: Filters<PluginFilters>) {
    this.#data = await this.#voice.node.rest.updatePlayer(this.#voice.guildId, { filters });
    return this.#cache.filters as Filters<PluginFilters>;
  }
}
