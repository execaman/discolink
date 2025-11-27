import { PlayerSymbol } from "../Constants/Symbols";
import type { Player } from "../Main";

interface RegionPingRecord {
  pings: number[];
  lastPingTime: number;
}

/**
 * A class representing a common region of voice servers for measuring average latencies of nodes that perform in it
 */
export class VoiceRegion {
  [PlayerSymbol]: Player;
  #records = new Map<string, RegionPingRecord>();

  readonly id: string;

  constructor(player: Player, regionId: string) {
    this[PlayerSymbol] = player;
    this.id = regionId;

    Object.defineProperty(this, "id" satisfies keyof VoiceRegion, {
      writable: false,
      configurable: false,
    });
  }

  /**
   * Names of nodes that have participated in this region
   */
  get nodes() {
    return this.#records.keys().toArray();
  }

  /**
   * Deletes and stops tracking a node's ping
   * @param name Name of the node
   */
  forgetNode(name: string) {
    this.#records.delete(name);
  }

  /**
   * A player state update listener. Not for general use
   * @param name Name of the node
   * @param ping Ping from lavalink
   * @param time Time from lavalink
   */
  onPingUpdate(name: string, ping: number, time: number) {
    if (!this[PlayerSymbol].nodes.state(name, "ready")) return;
    if (ping <= 0 || time <= 0) return;
    const node = this.#records.get(name);
    if (!node) {
      this.#records.set(name, { pings: [ping], lastPingTime: time });
      return;
    }
    if (time - node.lastPingTime < 12_000) return;
    node.lastPingTime = time;
    node.pings.push(ping);
    if (node.pings.length > 5) node.pings.shift();
  }

  /**
   * Returns the average ping of a node in this region
   * @param name Name of the node
   */
  getAveragePing(name: string) {
    const pings = this.#records.get(name)?.pings;
    return !pings?.length ? 0 : pings.reduce((t, c) => t + c, 0) / pings.length;
  }

  /**
   * @param exclusions List of names of nodes to exclude
   * @returns Node with the least average ping, `undefined` if none available
   */
  getRelevantNode(...exclusions: string[]) {
    return this[PlayerSymbol].nodes
      .relevant()
      .filter((n) => !exclusions.includes(n.name))
      .sort((a, b) => {
        if (!this.#records.has(a.name)) return -1;
        if (!this.#records.has(b.name)) return 1;
        return this.getAveragePing(a.name) - this.getAveragePing(b.name);
      })[0];
  }
}
