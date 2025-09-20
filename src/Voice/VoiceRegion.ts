import type { Player } from "../Main";

interface RegionPingRecord {
  pings: number[];
  lastPingTime: number;
}

export class VoiceRegion {
  #player: Player;
  #records = new Map<string, RegionPingRecord>();

  readonly id: string;

  constructor(player: Player, regionId: string) {
    this.#player = player;
    this.id = regionId;

    Object.defineProperty(this, "id" satisfies keyof VoiceRegion, {
      writable: false,
      configurable: false,
    });
  }

  get nodes() {
    return this.#records.keys().toArray();
  }

  forgetNode(name: string) {
    this.#records.delete(name);
  }

  onPingUpdate(name: string, ping: number, time: number) {
    if (!this.#player.nodes.state(name, "ready")) return;
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

  getAveragePing(name: string) {
    const pings = this.#records.get(name)?.pings;
    return !pings?.length ? 0 : pings.reduce((t, c) => t + c, 0) / pings.length;
  }

  getRelevantNode(...exclusions: string[]) {
    return this.#player.nodes
      .relevant()
      .filter((n) => !exclusions.includes(n.name))
      .sort((a, b) => {
        if (!this.#records.has(a.name)) return -1;
        if (!this.#records.has(b.name)) return 1;
        return this.getAveragePing(a.name) - this.getAveragePing(b.name);
      })[0];
  }
}
