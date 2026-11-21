import { OnPingUpdateSymbol } from "@/constants";

import type { Player } from "@/main";
import type { PlayerState, VoiceNodePingStats } from "@/types";

/**
 * Class representing a voice region, monitoring node ping
 */
export class VoiceRegion {
  #stats = new Map<string, VoiceNodePingStats>();

  /**
   * Id of this region
   */
  readonly id: string;
  readonly player: Player;

  constructor(player: Player, regionId: string) {
    if (player.voices.regions.has(regionId)) throw new Error(`An identical voice region already exists`);

    this.id = regionId;
    this.player = player;

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      id: immutable,
      player: { ...immutable, enumerable: false },
    } satisfies { [K in keyof VoiceRegion]?: PropertyDescriptor });
  }

  /**
   * Size (in ms) of the time window used by this region
   */
  get windowSize() {
    return this.player.options.regionWindow;
  }

  /**
   * Whether this region has data for all nodes that are ready
   */
  inSync() {
    return !this.player.nodes.values().some((n) => n.ready && !this.#stats.has(n.name));
  }

  /**
   * Whether this region has data for a node
   * @param name Name of the node
   */
  hasNode(name: string) {
    return this.#stats.has(name);
  }

  /**
   * Delete data for a node
   * @param name Name of the node
   */
  forgetNode(name: string) {
    return this.#stats.delete(name);
  }

  /**
   * Delete data for all nodes
   */
  forgetAllNodes() {
    this.#stats.clear();
  }

  /**
   * Get the median ping of a node.
   * Returns `-1` when data is insufficient.
   * @param node Name of the node
   */
  getMedianPing(node: string) {
    const stats = this.#stats.get(node);
    if (!stats || stats.samples.length === 0) return -1;
    const sorted = stats.samples.sort((a, b) => a - b);
    const index = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[index]!;
    return Math.round((sorted[index - 1]! + sorted[index]!) / 2);
  }

  /**
   * Get the average ping of a node.
   * Returns `-1` when data is insufficient.
   * @param node Name of the node
   */
  getAveragePing(node: string) {
    const stats = this.#stats.get(node);
    if (!stats || stats.samples.length === 0) return -1;
    return Math.round(stats.samples.reduce((t, c) => t + c, 0) / stats.samples.length);
  }

  #nodePos(name: string, penalty: number, now: number) {
    const stats = this.#stats.get(name);
    if (!stats) return Number.NEGATIVE_INFINITY;

    if (now - stats.lastProbe > this.#stats.size * this.windowSize) return -1;
    if (stats.samples.length === 0) return Number.POSITIVE_INFINITY;

    const median = this.getMedianPing(name);
    if (stats.samples.length < 4) return median;

    const index = Math.floor(0.95 * stats.samples.length);
    return median + (stats.samples[index]! - median) * penalty;
  }

  /**
   * Get a node with the lowest ping in this region.
   *
   * If data is insufficient, this will return a node based on its metrics.
   * @param exclude Nodes to exclude
   */
  getRelevantNode(...exclude: string[]) {
    const now = Date.now();
    const nodes = this.player.nodes.relevant().filter((n) => !exclude.includes(n.name));
    const penalty = Math.min(1, Math.max(0, this.player.options.voicePenalty));
    return nodes.sort((a, b) => this.#nodePos(a.name, penalty, now) - this.#nodePos(b.name, penalty, now))[0];
  }

  [OnPingUpdateSymbol](node: string, state: PlayerState) {
    const stats = this.#stats.get(node);
    if (!stats) {
      this.#stats.set(node, { samples: [], startTime: state.time, lastProbe: state.time });
      return;
    }
    if (!state.connected || state.ping < 0) return;
    if (state.time - stats.startTime < this.windowSize) {
      stats.samples.push(state.ping);
      stats.lastProbe = state.time;
      return;
    }
    stats.samples = [state.ping];
    stats.startTime = state.time;
    stats.lastProbe = state.time;
  }
}
