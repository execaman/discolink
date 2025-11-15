import { HttpStatusCode } from "axios";
import { OPType } from "../Typings";
import { Routes } from "../Constants";
import { isString } from "../Functions";

import type { BaseEventPayload, EmptyObject, JsonObject, PlayerPlugin } from "../Typings";
import type { Node } from "../Node";
import type { Queue } from "../Queue";
import type { Player } from "../Main";

export namespace LavaLyrics {
  export interface Lyrics<PluginInfo extends JsonObject = EmptyObject> {
    sourceName: string;
    provider: string;
    text: string | null;
    lines: LyricsLine[];
    plugin: PluginInfo;
  }

  export interface LyricsLine<PluginInfo extends JsonObject = EmptyObject> {
    timestamp: number;
    duration: number | null;
    line: string;
    plugin: PluginInfo;
  }

  export const enum EventType {
    LyricsFound = "LyricsFoundEvent",
    LyricsNotFound = "LyricsNotFoundEvent",
    LyricsLine = "LyricsLineEvent",
  }

  export interface LyricsFoundEvent extends BaseEventPayload {
    type: EventType.LyricsFound;
    lyrics: Lyrics;
  }

  export interface LyricsNotFoundEvent extends BaseEventPayload {
    type: EventType.LyricsNotFound;
  }

  export interface LyricsLineEvent extends BaseEventPayload {
    type: EventType.LyricsLine;
    lineIndex: number;
    line: LyricsLine;
    skipped: boolean;
  }

  export type Event = LyricsFoundEvent | LyricsNotFoundEvent | LyricsLineEvent;

  export type EventMap = {
    lyricsFound: [queue: Queue, lyrics: Lyrics];
    lyricsNotFound: [queue: Queue];
    lyricsLine: [queue: Queue, line: LyricsLine, index: number, skipped: boolean];
  };

  export interface PluginOptions {
    skipTrackSource?: boolean;
  }

  export class Plugin implements PlayerPlugin {
    name = "lavalyrics" as const;
    eventMap!: EventMap;

    #player!: Player;
    skipTrackSource: boolean;

    constructor(options?: PluginOptions) {
      this.skipTrackSource = options?.skipTrackSource === true;
    }

    init(player: Player): void {
      this.#player = player;
      player.on("nodeDispatch", this.#onLavaLyrics as any);
    }

    async fetch(track: string, node: string, skipTrackSource?: boolean) {
      if (!isString(track, "non-empty")) throw new Error(`Encoded track must be a non-empty string`);
      const _node = this.#player.nodes.get(node);
      if (!_node) throw new Error(`Node '${node}' not found`);
      skipTrackSource ??= this.skipTrackSource;
      const res = await _node.rest.request<Lyrics>("GET", "/lyrics", { params: { track, skipTrackSource } });
      return res.status === HttpStatusCode.Ok ? res.data : null;
    }

    async fetchCurrent(guildId: string, skipTrackSource?: boolean) {
      const queue = this.#player.getQueue(guildId);
      if (!queue) throw new Error(`Queue not found for guild '${guildId}'`);
      if (!queue.isPlaying) throw new Error(`Queue is not playing anything`);
      if (!queue.node.ready) throw new Error(`Queue node '${queue.node.name}' not ready`);
      skipTrackSource ??= this.skipTrackSource;
      const res = await queue.rest.request<Lyrics>(
        "GET",
        Routes.player(queue.node.sessionId!, guildId) + "/track/lyrics",
        { params: { skipTrackSource } }
      );
      return res.status === HttpStatusCode.Ok ? res.data : null;
    }

    async subscribe(guildId: string, skipTrackSource?: boolean) {
      const queue = this.#player.getQueue(guildId);
      if (!queue) throw new Error(`Queue not found for guild '${guildId}'`);
      if (!queue.node.ready) throw new Error(`Queue node '${queue.node.name}' not ready`);
      skipTrackSource ??= this.skipTrackSource;
      const res = await queue.rest.request(
        "POST",
        Routes.player(queue.node.sessionId!, guildId) + "/lyrics/subscribe",
        { params: { skipTrackSource } }
      );
      return res.status === HttpStatusCode.NoContent;
    }

    async unsubscribe(guildId: string) {
      const queue = this.#player.getQueue(guildId);
      if (!queue) throw new Error(`Queue not found for guild '${guildId}'`);
      if (!queue.node.ready) throw new Error(`Queue node '${queue.node.name}' not ready`);
      const res = await queue.rest.request(
        "DELETE",
        Routes.player(queue.node.sessionId!, guildId) + "/lyrics/subscribe"
      );
      return res.status === HttpStatusCode.NoContent;
    }

    #onLavaLyrics(this: Player<{}, Plugin[]>, _node: Node, payload: Event) {
      if (payload.op !== OPType.Event) return;
      const queue = this.getQueue(payload.guildId);
      if (!queue) return;
      switch (payload.type) {
        case EventType.LyricsFound:
          this.emit("lyricsFound", queue, payload.lyrics);
          return;
        case EventType.LyricsLine:
          this.emit("lyricsLine", queue, payload.line, payload.lineIndex, payload.skipped);
          return;
        case EventType.LyricsNotFound:
          this.emit("lyricsNotFound", queue);
          return;
      }
    }
  }
}
