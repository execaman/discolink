import type { EmptyObject, JsonObject } from "../Utility";
import type { BaseEventPayload } from "../API";

export interface LyricsObject<PluginData extends JsonObject = EmptyObject> {
  /**
   * The name of the source where the lyrics were fetched from
   */
  sourceName: string;

  /**
   * The name of the provider the lyrics was fetched from on the source
   */
  provider: string;

  /**
   * The lyrics text
   */
  text: string | null;

  /**
   * The lyrics lines
   */
  lines: LyricsLine[];

  /**
   * Additional plugin specific data
   */
  plugin: PluginData;
}

export interface LyricsLine<PluginData extends JsonObject = EmptyObject> {
  /**
   * The timestamp of the line in milliseconds
   */
  timestamp: number;

  /**
   * The duration of the line in milliseconds
   */
  duration: number | null;

  /**
   * The lyrics line
   */
  line: string;

  /**
   * Additional plugin specific data
   */
  plugin: PluginData;
}

export interface LyricsFoundEvent extends Omit<BaseEventPayload, "type"> {
  type: "LyricsFoundEvent";
  lyrics: LyricsObject;
}

export interface LyricsNotFoundEvent extends Omit<BaseEventPayload, "type"> {
  type: "LyricsNotFoundEvent";
}

export interface LyricsLineEvent extends Omit<BaseEventPayload, "type"> {
  type: "LyricsLineEvent";
  lineIndex: number;
  line: LyricsLine;
  skipped: boolean;
}

export type LavaLyricsEvent = LyricsFoundEvent | LyricsNotFoundEvent | LyricsLineEvent;
