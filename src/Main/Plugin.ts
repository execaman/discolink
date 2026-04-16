import type { Player } from "./index";

/**
 * Abstract class for implementing custom plugins
 */
export abstract class PlayerPlugin<EventMap extends Record<string, unknown[]> = {}> {
  declare protected _: EventMap;
  abstract readonly name: string;
  abstract init(player: Player): void;
}
