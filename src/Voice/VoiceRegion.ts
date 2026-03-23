import { OnPingUpdateSymbol } from "../Constants/Symbols";
import type { PlayerState } from "../Typings";
import type { Player } from "../Main";

interface VoiceNodePingStats {
  pingCount: number;
  pingTotal: number;
  startTime: number;
}

export class VoiceRegion {
  #stats = new Map<string, VoiceNodePingStats>();

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

  inSync() {
    return !this.player.nodes.values().some((n) => n.ready && !this.#stats.has(n.name));
  }

  forgetNode(name: string) {
    return this.#stats.delete(name);
  }

  forgetAllNodes() {
    this.#stats.clear();
  }

  getAveragePing(node: string) {
    const stats = this.#stats.get(node);
    if (!stats) return null;
    if (Date.now() - stats.startTime > 60_000) return null;
    return Math.round(stats.pingTotal / stats.pingCount);
  }

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
    if (state.time - stats.startTime <= 60_000) {
      stats.pingTotal += state.ping;
      stats.pingCount++;
      return;
    }
    stats.pingCount = 1;
    stats.pingTotal = state.ping;
    stats.startTime = state.time;
  }
}
