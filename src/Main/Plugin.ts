import type { Player } from "./index";

export abstract class PlayerPlugin<EventMap extends Record<string, unknown[]> = {}> {
  declare protected _: EventMap;
  abstract readonly name: string;
  abstract init(player: Player): void;
}
