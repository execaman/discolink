import { OPType } from "../Typings";
import { noop } from "../Functions";
import { Node } from "../index";

import type { CreateNodeOptions, LavalinkInfo, NodeMetrics, NodeEventMap, NodeState, StatsPayload } from "../Typings";
import type { Player } from "../Main";

export class NodeManager implements Partial<Map<string, Node>> {
  #player: Player;

  #nodes = new Map<string, Node>();
  #cache = new Map<string, NodeMetrics>();

  readonly info = new Map<string, LavalinkInfo>();

  constructor(player: Player) {
    this.#player = player;

    Object.defineProperty(this, "info" satisfies keyof NodeManager, {
      writable: false,
      configurable: false,
    });
  }

  get size() {
    return this.#nodes.size;
  }

  get cache() {
    return this.#cache;
  }

  get ready() {
    return this.#nodes.values().some((n) => n.ready);
  }

  get(name: string) {
    return this.#nodes.get(name);
  }

  has(name: string) {
    return this.#nodes.has(name);
  }

  keys() {
    return this.#nodes.keys();
  }

  values() {
    return this.#nodes.values();
  }

  entries() {
    return this.#nodes.entries();
  }

  state(name: string): NodeState;
  state(name: string, equals: NodeState): boolean;
  state(name: string, equals?: NodeState) {
    const node = this.#nodes.get(name);
    if (!node) throw new Error(`Node '${name}' not found`);
    return equals === undefined ? node.state : node.state === equals;
  }

  create(options: CreateNodeOptions) {
    if (this.#player.clientId === null) throw new Error("Player has not been initialized");
    if (this.#nodes.has(options.name)) throw new Error(`Node '${options.name}' already exists`);
    const node = new Node({ ...options, clientId: this.#player.clientId });
    node.setMaxListeners(1);
    this.#attachEvents(node);
    this.#nodes.set(node.name, node);
    return node;
  }

  delete(name: string) {
    const node = this.#nodes.get(name);
    if (!node) return false;
    if (!node.disconnected) throw new Error(`Node '${name}' not disconnected`);
    this.#detachEvents(node);
    this.info.delete(name);
    this.#cache.delete(name);
    this.#nodes.delete(name);
    return true;
  }

  relevant(weights: Partial<NodeMetrics> = { memory: 0.3, workload: 0.2, streaming: 0.5 }) {
    weights.memory = Math.min(1, Math.max(0, weights.memory ?? 0));
    weights.workload = Math.min(1, Math.max(0, weights.workload ?? 0));
    weights.streaming = Math.min(1, Math.max(0, weights.streaming ?? 0));

    const nodes = this.#nodes.values().reduce<Node[]>((list, node) => {
      if (node.ready) list.push(node);
      return list;
    }, []);

    return nodes.sort((a, b) => {
      const metricA = this.#cache.get(a.name);
      const metricB = this.#cache.get(b.name);

      if (metricA && !metricB) return 1;
      if (metricB && !metricA) return -1;
      if (!metricA || !metricB) return 0;

      if (metricA.streaming !== -1 && metricB.streaming === -1) return 1;
      if (metricB.streaming !== -1 && metricA.streaming === -1) return -1;

      return (
        (metricB.memory - metricA.memory) * weights.memory!
        + (metricB.workload - metricA.workload) * weights.workload!
        + (metricB.streaming - metricA.streaming) * weights.streaming!
      );
    });
  }

  connect(): Promise<void>;
  connect(name: string): Promise<boolean>;
  async connect(name?: string): Promise<void | boolean> {
    if (typeof name === "string") {
      const node = this.#nodes.get(name);
      if (!node) throw new Error(`Node '${name}' not found`);
      return node.connect();
    }
    for (const node of this.#nodes.values()) await node.connect();
  }

  async disconnect(name?: string) {
    if (typeof name === "string") {
      const node = this.#nodes.get(name);
      if (!node) throw new Error(`Node '${name}' not found`);
      return node.disconnect();
    }
    for (const node of this.#nodes.values()) await node.disconnect();
  }

  async fetchInfo(name: string, force?: boolean) {
    if (!this.#nodes.has(name)) throw new Error(`Node '${name}' not found`);
    if (force !== true && this.info.has(name)) return this.info.get(name)!;
    const info = await this.#nodes.get(name)!.rest.fetchInfo();
    this.info.set(name, info);
    return info;
  }

  #memory(mem: StatsPayload["memory"]) {
    const available = mem.free / mem.reservable;
    const allocable = (mem.reservable - mem.allocated) / mem.reservable;
    return Math.min(1, available * 0.7 + allocable * 0.3);
  }

  #workload(cpu: StatsPayload["cpu"]) {
    if (cpu.systemLoad === 0 || cpu.lavalinkLoad === 0) return 0;
    return 1 - Math.min(1, cpu.systemLoad * 0.7 + cpu.lavalinkLoad * 0.3);
  }

  #streaming(frames: StatsPayload["frameStats"]) {
    if (frames === null) return -1;
    const expected = frames.sent + frames.nulled + frames.deficit;
    const passRate = frames.sent / expected;
    const lossRate = frames.nulled / expected;
    const failRate = Math.max(0, frames.deficit) / expected;
    return Math.min(1, passRate - (failRate * 0.7 + lossRate * 0.3));
  }

  #updateMetrics(name: string, stats: StatsPayload) {
    const metrics = this.#cache.get(name);
    if (!metrics) {
      this.#cache.set(name, {
        memory: this.#memory(stats.memory),
        workload: this.#workload(stats.cpu),
        streaming: this.#streaming(stats.frameStats),
      });
      return;
    }
    metrics.memory = this.#memory(stats.memory);
    metrics.workload = this.#workload(stats.cpu);
    metrics.streaming = this.#streaming(stats.frameStats);
  }

  #onConnect: (...args: NodeEventMap["connect"]) => void = (reconnects, nodeName) => {
    this.#player.emit("nodeConnect", this.#nodes.get(nodeName)!, reconnects);
  };

  #onReady: (...args: NodeEventMap["ready"]) => void = (resumed, sessionId, nodeName) => {
    this.#player.emit("nodeReady", this.#nodes.get(nodeName)!, resumed, sessionId);
    this.fetchInfo(nodeName).catch(noop);
  };

  #onDispatch: (...args: NodeEventMap["dispatch"]) => void = (payload, nodeName) => {
    switch (payload.op) {
      case OPType.PlayerUpdate: {
        this.#player.queues.onStateUpdate(payload);
        break;
      }
      case OPType.Stats: {
        this.#updateMetrics(nodeName, payload);
        break;
      }
      case OPType.Event: {
        this.#player.queues.onEventUpdate(payload);
        break;
      }
    }
    this.#player.emit("nodeDispatch", this.#nodes.get(nodeName)!, payload);
  };

  #onError: (...args: NodeEventMap["error"]) => void = (err, nodeName) => {
    this.#player.emit("nodeError", this.#nodes.get(nodeName)!, err);
  };

  #onClose: (...args: NodeEventMap["close"]) => void = (code, reason, nodeName) => {
    this.#cache.delete(nodeName);
    this.#player.emit("nodeClose", this.#nodes.get(nodeName)!, code, reason);
    if (this.#player.options.relocateQueues) this.#player.queues.relocate(nodeName).catch(noop);
  };

  #onDisconnect: (...args: NodeEventMap["disconnect"]) => void = (code, reason, byLocal, nodeName) => {
    this.#cache.delete(nodeName);
    this.#player.voices.regions.forEach((r) => r.forgetNode(nodeName));
    this.#player.emit("nodeDisconnect", this.#nodes.get(nodeName)!, code, reason, byLocal);
    if (this.#player.options.relocateQueues) this.#player.queues.relocate(nodeName).catch(noop);
  };

  #attachEvents(node: Node) {
    node.on("connect", this.#onConnect);
    node.on("ready", this.#onReady);
    node.on("dispatch", this.#onDispatch);
    node.on("error", this.#onError);
    node.on("close", this.#onClose);
    node.on("disconnect", this.#onDisconnect);
  }

  #detachEvents(node: Node) {
    node.removeListener("connect", this.#onConnect);
    node.removeListener("ready", this.#onReady);
    node.removeListener("dispatch", this.#onDispatch);
    node.removeListener("error", this.#onError);
    node.removeListener("close", this.#onClose);
    node.removeListener("disconnect", this.#onDisconnect);
  }

  [Symbol.iterator]() {
    return this.#nodes[Symbol.iterator]();
  }
}
