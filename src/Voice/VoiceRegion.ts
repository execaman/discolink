import { OnPingUpdateSymbol } from "../Constants/Symbols";
import type { PlayerState } from "../Typings";
import type { Player } from "../Main";

interface VoiceNodePingStats {
  history: number[];
  lastPingTime: number;
}

export class VoiceRegion {
  #pings = new Map<string, VoiceNodePingStats>();

  readonly id: string;
  readonly player: Player;

  constructor(player: Player, regionId: string) {
    if (player.voices.regions.has(regionId)) {
      throw new Error(`An identical voice region already exists`);
    }

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
    return !this.player.nodes.values().some((n) => n.ready && !this.#pings.has(n.name));
  }

  forgetNode(name: string) {
    return this.#pings.delete(name);
  }

  getAveragePing(name: string) {
    const pings = this.#pings.get(name)?.history;
    return !pings?.length ? null : Math.round(pings.reduce((t, c) => t + c, 0) / pings.length);
  }

  getRelevantNode() {
    return this.player.nodes.relevant().sort((a, b) => {
      return (this.getAveragePing(a.name) ?? 0) - (this.getAveragePing(b.name) ?? 0);
    })[0];
  }

  [OnPingUpdateSymbol](name: string, state: PlayerState) {
    if (!state.connected) return;
    if (state.ping <= 0 || state.time <= 0) return;
    const pings = this.#pings.get(name);
    if (!pings) {
      this.#pings.set(name, { history: [state.ping], lastPingTime: state.time });
      return;
    }
    if (state.time - pings.lastPingTime < 12_000) return;
    pings.lastPingTime = state.time;
    pings.history.push(state.ping);
    if (pings.history.length > 5) pings.history.shift();
  }
}
