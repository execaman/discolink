import { LookupSymbol } from "../Constants/Symbols";
import type { APIPlayer, FilterNames, FilterValue, JsonObject, Filters, CommonPluginFilters } from "../Typings";
import type { VoiceState } from "../Voice";
import type { Player } from "../Main";

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

  get<Name extends FilterNames<PluginFilters>>(name: Name) {
    return (this.#player.filters[name as keyof Filters]
      ?? (this.#player.filters as Filters<PluginFilters>).pluginFilters?.[name as keyof PluginFilters]
      ?? null) as FilterValue<Name, PluginFilters> | null;
  }

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

  has<Name extends FilterNames<PluginFilters>>(name: Name) {
    return (
      Object.hasOwn(this.#player.filters, name)
      || (this.#player.filters.pluginFilters !== undefined && Object.hasOwn(this.#player.filters.pluginFilters, name))
    );
  }

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

  async clear(type?: "native" | "plugin") {
    if (type === "plugin") return this.remove("pluginFilters");
    if (type === "native" && this.#player.filters.pluginFilters !== undefined) {
      return this.override({ pluginFilters: this.#player.filters.pluginFilters as PluginFilters });
    }
    return this.override({});
  }

  async merge(filters: Filters<PluginFilters>) {
    return this.override({ ...(this.#player.filters as Filters<PluginFilters>), ...filters });
  }

  async override(filters: Filters<PluginFilters>) {
    const player = await this.#voice.node.rest.updatePlayer(this.#voice.guildId, { filters });
    Object.assign(this.#player, player);
    return player.filters as Filters<PluginFilters>;
  }
}
