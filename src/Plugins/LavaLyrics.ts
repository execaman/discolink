import { HttpStatusCode } from "axios";
import { OPType } from "../Typings";
import { Routes } from "../Constants";
import { isString } from "../Functions";

import type { LavaLyricsEvent, LyricsLine, LyricsObject, Plugin } from "../Typings";
import type { Node } from "../Node";
import type { Queue } from "../Queue";
import type { Player } from "../Main";

export class LavaLyrics implements Plugin {
  name = "lavalyrics" as const;
  #player!: Player;

  eventMap!: {
    lyricsFound: [queue: Queue, lyrics: LyricsObject];
    lyricsNotFound: [queue: Queue];
    lyricsLine: [queue: Queue, line: LyricsLine, index: number, skipped: boolean];
  };

  init(player: Player): void {
    this.#player = player;
    player.on("nodeDispatch", this.#onLavaLyrics as any);
  }

  async fetch(track: string, node: string, skipTrackSource = false) {
    if (!isString(track, "non-empty")) throw new Error("Encoded track must be a non-empty string");
    const _node = this.#player.nodes.get(node);
    if (!_node) throw new Error(`Node '${node}' not found`);
    try {
      const response = await _node.rest.request<LyricsObject>("GET", "/lyrics", { params: { track, skipTrackSource } });
      if (response.status === HttpStatusCode.Ok) return response.data;
      return null;
    } catch {
      return null;
    }
  }

  async subscribe(guildId: string, skipTrackSource = false) {
    const queue = this.#player.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    if (!queue.node.ready) throw new Error(`Node '${queue.node.name}' not ready`);
    try {
      const response = await queue.rest.request<LyricsObject>(
        "POST",
        Routes.player(queue.node.sessionId!, guildId) + "/lyrics/subscribe",
        {
          params: { skipTrackSource },
        }
      );
      return response.status === HttpStatusCode.NoContent;
    } catch {
      return false;
    }
  }

  async unsubscribe(guildId: string) {
    const queue = this.#player.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    if (!queue.node.ready) throw new Error(`Node '${queue.node.name}' not ready`);
    try {
      const response = await queue.rest.request<LyricsObject>(
        "DELETE",
        Routes.player(queue.node.sessionId!, guildId) + "/lyrics/subscribe"
      );
      return response.status === HttpStatusCode.NoContent;
    } catch {
      return false;
    }
  }

  async fetchCurrent(guildId: string, skipTrackSource = false) {
    const queue = this.#player.queues.get(guildId);
    if (!queue) throw new Error(`No queue found for guild '${guildId}'`);
    if (queue.finished) return null;
    if (!queue.node.ready) throw new Error(`Node '${queue.node.name}' not ready`);
    const response = await queue.rest.request<LyricsObject>(
      "GET",
      Routes.player(queue.node.sessionId!, guildId) + "/track/lyrics",
      {
        params: { skipTrackSource },
      }
    );
    return response.status === HttpStatusCode.Ok ? response.data : null;
  }

  #onLavaLyrics(this: Player, _node: Node, payload: LavaLyricsEvent) {
    if (payload.op !== OPType.Event) return;
    const queue = this.queues.get(payload.guildId);
    if (!queue) return;
    switch (payload.type) {
      case "LyricsFoundEvent":
        this.emit("lyricsFound", queue, payload.lyrics);
        return;
      case "LyricsLineEvent":
        this.emit("lyricsLine", queue, payload.line, payload.lineIndex, payload.skipped);
        return;
      case "LyricsNotFoundEvent":
        this.emit("lyricsNotFound", queue);
        return;
    }
  }
}
