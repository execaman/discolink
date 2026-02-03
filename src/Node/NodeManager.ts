import { OPType } from "../Typings";
import { OnEventUpdateSymbol, OnStateUpdateSymbol } from "../Constants/Symbols";
import { noop } from "../Functions";
import { Node } from "../index";
import type {
  CreateNodeOptions,
  FeatureTypes,
  LavalinkInfo,
  NodeMetrics,
  NodeEventMap,
  NodeState,
  StatsPayload,
} from "../Typings";
import type { Player } from "../Main";

export class NodeManager implements Partial<Map<string, Node>> {
  #nodes = new Map<string, Node>();

  readonly info = new Map<string, LavalinkInfo>();
  readonly metrics = new Map<string, NodeMetrics>();

  readonly player: Player;

  constructor(player: Player) {
    if (player.nodes === undefined) this.player = player;
    else throw new Error("Manager already exists for this Player");

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      info: immutable,
      metrics: immutable,
      player: { ...immutable, enumerable: false },
    } satisfies { [K in keyof NodeManager]?: PropertyDescriptor });
  }

  get size() {
    return this.#nodes.size;
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
    if (this.player.clientId === null) throw new Error("Player has not been initialized");
    if (this.#nodes.has(options.name)) throw new Error(`Node '${options.name}' already exists`);
    const node = new Node({ ...options, clientId: this.player.clientId });
    node.setMaxListeners(1);
    this.#attachListeners(node);
    this.#nodes.set(node.name, node);
    return node;
  }

  delete(name: string) {
    const node = this.#nodes.get(name);
    if (!node) return false;
    if (!node.disconnected) throw new Error(`Node '${name}' not disconnected`);
    this.#detachListeners(node);
    this.player.voices.regions.forEach((r) => r.forgetNode(name));
    this.info.delete(name);
    this.metrics.delete(name);
    this.#nodes.delete(name);
    return true;
  }

  supports(feat: FeatureTypes, name: string): Node[];
  supports(feat: FeatureTypes, name: string, node: string): boolean;
  supports(feat: FeatureTypes, name: string, node?: string) {
    if (node !== undefined) return this.#hasSupportFor(feat, name, node);
    return this.#nodes.values().reduce<Node[]>((nodes, node) => {
      if (this.#hasSupportFor(feat, name, node.name)) nodes.push(node);
      return nodes;
    }, []);
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
      const metricA = this.metrics.get(a.name);
      const metricB = this.metrics.get(b.name);

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
    if (name !== undefined) {
      const node = this.#nodes.get(name);
      if (!node) throw new Error(`Node '${name}' not found`);
      return node.connect();
    }
    for (const node of this.#nodes.values()) await node.connect();
  }

  async disconnect(name?: string) {
    if (name !== undefined) {
      const node = this.#nodes.get(name);
      if (!node) throw new Error(`Node '${name}' not found`);
      return node.disconnect();
    }
    for (const node of this.#nodes.values()) await node.disconnect();
  }

  async fetchInfo(name: string) {
    if (this.info.has(name)) return this.info.get(name)!;
    const node = this.#nodes.get(name);
    if (!node) throw new Error(`Node '${name}' not found`);
    const info = await node.rest.fetchInfo();
    this.info.set(name, info);
    return info;
  }

  #hasSupportFor(feat: FeatureTypes, name: string, node: string) {
    const info = this.info.get(node);
    if (!info) return false;
    switch (feat) {
      case "filter":
        return info.filters.includes(name);
      case "source":
        return info.sourceManagers.includes(name);
      case "plugin":
        return info.plugins.some((p) => p.name === name);
      default:
        return false;
    }
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
    return Math.min(1, Math.max(0, passRate - (failRate * 0.7 + lossRate * 0.3)));
  }

  #updateMetrics(name: string, stats: StatsPayload) {
    const metrics = this.metrics.get(name);
    if (!metrics) {
      this.metrics.set(name, {
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

  #onConnect: (...args: NodeEventMap["connect"]) => void = (reconnects, name) => {
    const node = this.#nodes.get(name);
    if (!node) return;
    this.player.emit("nodeConnect", node, reconnects);
  };

  #onReady: (...args: NodeEventMap["ready"]) => void = (resumed, sessionId, name) => {
    const node = this.#nodes.get(name);
    if (!node) return;
    this.player.emit("nodeReady", node, resumed, sessionId);
    if (!this.info.has(name)) this.fetchInfo(name).catch(noop);
  };

  #onDispatch: (...args: NodeEventMap["dispatch"]) => void = (payload, name) => {
    const node = this.#nodes.get(name);
    if (!node) return;
    switch (payload.op) {
      case OPType.Event:
        this.player.queues[OnEventUpdateSymbol](payload);
        break;
      case OPType.PlayerUpdate:
        this.player.queues[OnStateUpdateSymbol](payload);
        break;
      case OPType.Stats:
        this.#updateMetrics(name, payload);
        break;
    }
    this.player.emit("nodeDispatch", node, payload);
  };

  #onError: (...args: NodeEventMap["error"]) => void = (err, name) => {
    const node = this.#nodes.get(name);
    if (!node) return;
    this.player.emit("nodeError", node, err);
  };

  #onClose: (...args: NodeEventMap["close"]) => void = (code, reason, name) => {
    const node = this.#nodes.get(name);
    if (!node) return;
    this.metrics.delete(name);
    this.player.emit("nodeClose", node, code, reason);
  };

  #onDisconnect: (...args: NodeEventMap["disconnect"]) => void = (code, reason, byLocal, name) => {
    const node = this.#nodes.get(name);
    if (!node) return;
    this.metrics.delete(name);
    this.player.emit("nodeDisconnect", node, code, reason, byLocal);
  };

  #attachListeners(node: Node) {
    node.on("connect", this.#onConnect);
    node.on("ready", this.#onReady);
    node.on("dispatch", this.#onDispatch);
    node.on("error", this.#onError);
    node.on("close", this.#onClose);
    node.on("disconnect", this.#onDisconnect);
  }

  #detachListeners(node: Node) {
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
