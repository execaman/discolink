import { DefaultNodeOptions } from "../Constants";
import { OnPingUpdateSymbol } from "../Constants/Symbols";
import type { PlayerState } from "../Typings";
import type { Player } from "../Main";

interface VoiceNodePingStats {
  pingCount: number;
  pingTotal: number;
  startTime: number;
}

/**
 * Class representing a voice region and evaluating performing nodes
 */
export class VoiceRegion {
  #stats = new Map<string, VoiceNodePingStats>();

  /**
   * Id of the region
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
   * Whether this region has an entry for all nodes that are ready
   */
  inSync() {
    return !this.player.nodes.values().some((n) => n.ready && !this.#stats.has(n.name));
  }

  /**
   * Delete a node's entry
   * @param name Name of the node
   */
  forgetNode(name: string) {
    return this.#stats.delete(name);
  }

  /**
   * Delete all node entries
   */
  forgetAllNodes() {
    this.#stats.clear();
  }

  /**
   * Get the average ping of a node
   * @param node Name of the node
   */
  getAveragePing(node: string) {
    const stats = this.#stats.get(node);
    if (!stats) return null;
    if (Date.now() - stats.startTime > DefaultNodeOptions.statsInterval) return null;
    return Math.round(stats.pingTotal / stats.pingCount);
  }

  /**
   * Get a node relevant for this region.
   *
   * When in sync, this will return the node with the lowest average ping.
   *
   * When not in sync, this will continue to yield nodes it doesn't have an entry for.
   */
  getRelevantNode() {
    return this.player.nodes.relevant().sort((a, b) => {
      return (this.getAveragePing(a.name) ?? 0) - (this.getAveragePing(b.name) ?? 0);
    })[0];
  }

  [OnPingUpdateSymbol](node: string, state: PlayerState) {
    if (!state.connected) return;
    if (state.ping <= 0 || state.time <= 0) return;
    const stats = this.#stats.get(node);
    if (!stats) {
      this.#stats.set(node, {
        pingCount: 1,
        pingTotal: state.ping,
        startTime: state.time,
      });
      return;
    }
    if (state.time - stats.startTime <= DefaultNodeOptions.statsInterval) {
      stats.pingTotal += state.ping;
      stats.pingCount++;
      return;
    }
    stats.pingCount = 1;
    stats.pingTotal = state.ping;
    stats.startTime = state.time;
  }
}
