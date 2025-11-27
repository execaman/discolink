import { OPType } from "../Typings";
import { PlayerSymbol } from "../Constants/Symbols";
import { noop } from "../Functions";
import { Node } from "../index";
import type { CreateNodeOptions, LavalinkInfo, NodeMetrics, NodeEventMap, NodeState, StatsPayload } from "../Typings";
import type { Player } from "../Main";

/**
 * A manager class handling nodes with useful members
 */
export class NodeManager implements Partial<Map<string, Node>> {
  [PlayerSymbol]: Player;

  #nodes = new Map<string, Node>();
  #cache = new Map<string, NodeMetrics>();

  /**
   * Lavalink info of nodes mapped by their names
   */
  readonly info = new Map<string, LavalinkInfo>();

  constructor(player: Player) {
    this[PlayerSymbol] = player;

    Object.defineProperty(this, "info" satisfies keyof NodeManager, {
      writable: false,
      configurable: false,
    });
  }

  get size() {
    return this.#nodes.size;
  }

  /**
   * A map holding this manager's intrinsic data
   */
  get cache() {
    return this.#cache;
  }

  /**
   * Whether at least one node is ready
   */
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

  /**
   * Returns the state of a node
   * @param name Name of the node
   */
  state(name: string): NodeState;
  /**
   * Returns a boolean based on state comparison
   * @param name Name of the node
   * @param equals Expected state of the node
   */
  state(name: string, equals: NodeState): boolean;
  state(name: string, equals?: NodeState) {
    const node = this.#nodes.get(name);
    if (!node) throw new Error(`Node '${name}' not found`);
    return equals === undefined ? node.state : node.state === equals;
  }

  /**
   * Creates a node
   * @param options Options to create from
   */
  create(options: CreateNodeOptions) {
    if (this[PlayerSymbol].clientId === null) throw new Error("Player has not been initialized");
    if (this.#nodes.has(options.name)) throw new Error(`Node '${options.name}' already exists`);
    const node = new Node({ ...options, clientId: this[PlayerSymbol].clientId });
    node.setMaxListeners(1);
    this.#attachEvents(node);
    this.#nodes.set(node.name, node);
    return node;
  }

  /**
   * Deletes a disconnected node
   * @param name Name of the node
   */
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

  /**
   * Returns a sorted list of nodes based on weights
   * @param weights Factors to prioritize based on weights (0-1 each)
   */
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

  /**
   * Connect to all nodes
   */
  connect(): Promise<void>;
  /**
   * Connect to a specific node
   * @param name Name of the node
   */
  connect(name: string): Promise<boolean>;
  async connect(name?: string): Promise<void | boolean> {
    if (typeof name === "string") {
      const node = this.#nodes.get(name);
      if (!node) throw new Error(`Node '${name}' not found`);
      return node.connect();
    }
    for (const node of this.#nodes.values()) await node.connect();
  }

  /**
   * Disconnects all nodes or a specific node if a name is provided
   * @param name Name of the node
   */
  async disconnect(name?: string) {
    if (typeof name === "string") {
      const node = this.#nodes.get(name);
      if (!node) throw new Error(`Node '${name}' not found`);
      return node.disconnect();
    }
    for (const node of this.#nodes.values()) await node.disconnect();
  }

  /**
   * Retrieves lavalink info of a node
   * @param name Name of the node
   * @param force Whether to skip cache and make a request
   */
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
    this[PlayerSymbol].emit("nodeConnect", this.#nodes.get(nodeName)!, reconnects);
  };

  #onReady: (...args: NodeEventMap["ready"]) => void = (resumed, sessionId, nodeName) => {
    this[PlayerSymbol].emit("nodeReady", this.#nodes.get(nodeName)!, resumed, sessionId);
    this.fetchInfo(nodeName).catch(noop);
  };

  #onDispatch: (...args: NodeEventMap["dispatch"]) => void = (payload, nodeName) => {
    switch (payload.op) {
      case OPType.PlayerUpdate: {
        this[PlayerSymbol].queues.onStateUpdate(payload);
        break;
      }
      case OPType.Stats: {
        this.#updateMetrics(nodeName, payload);
        break;
      }
      case OPType.Event: {
        this[PlayerSymbol].queues.onEventUpdate(payload);
        break;
      }
    }
    this[PlayerSymbol].emit("nodeDispatch", this.#nodes.get(nodeName)!, payload);
  };

  #onError: (...args: NodeEventMap["error"]) => void = (err, nodeName) => {
    this[PlayerSymbol].emit("nodeError", this.#nodes.get(nodeName)!, err);
  };

  #onClose: (...args: NodeEventMap["close"]) => void = (code, reason, nodeName) => {
    this.#cache.delete(nodeName);
    this[PlayerSymbol].emit("nodeClose", this.#nodes.get(nodeName)!, code, reason);
    if (this[PlayerSymbol].options.relocateQueues) this[PlayerSymbol].queues.relocate(nodeName).catch(noop);
  };

  #onDisconnect: (...args: NodeEventMap["disconnect"]) => void = (code, reason, byLocal, nodeName) => {
    this.#cache.delete(nodeName);
    this[PlayerSymbol].voices.regions.forEach((r) => r.forgetNode(nodeName));
    this[PlayerSymbol].emit("nodeDisconnect", this.#nodes.get(nodeName)!, code, reason, byLocal);
    if (this[PlayerSymbol].options.relocateQueues) this[PlayerSymbol].queues.relocate(nodeName).catch(noop);
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
