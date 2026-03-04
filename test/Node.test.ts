import { setImmediate, setTimeout } from "node:timers/promises";
import { OPType } from "../src/Typings";
import type { NodeOptions, ReadyPayload, StatsPayload } from "../src/Typings";

let ws: InstanceType<typeof MockWebSocket>;

const MockWebSocket = await vi.hoisted(async () => {
  const { EventEmitter } = await import("node:events");
  return class MockWebSocket extends EventEmitter {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;

    constructor() {
      super();
      ws = this;
    }

    open() {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open");
    }

    message(data: string) {
      this.emit("message", Buffer.from(data));
    }

    error() {
      this.emit("error", new Error("mock_ws_err"));
    }

    close(code = 1006, reason = "") {
      this.readyState = MockWebSocket.CLOSED;
      this.emit("close", code, Buffer.from(reason));
    }

    ping() {
      this.emit("pong");
    }

    terminate() {
      const connecting = this.readyState === MockWebSocket.CONNECTING;
      this.readyState = MockWebSocket.CLOSED;
      if (connecting) this.emit("close", 1006, Buffer.from(""));
    }
  };
});

vi.mock("ws", () => ({ WebSocket: MockWebSocket }));

import { Node, REST } from "../src/Node";

describe("Node", () => {
  const options = {
    name: "local",
    clientId: "0123456789123456789",
    origin: "http://localhost:2333",
    password: "youshallnotpass",
  } satisfies NodeOptions;

  describe("constructor", () => {
    it("throws for invalid inputs", () => {
      expect(() => new Node({ ...options, name: "" })).toThrow();
      expect(() => new Node({ ...options, clientId: "123" })).toThrow();
      expect(() => new Node({ ...options, statsInterval: 0 })).toThrow();
      expect(() => new Node({ ...options, highestLatency: 0 })).toThrow();
      expect(() => new Node({ ...options, reconnectDelay: 0 })).toThrow();
      expect(() => new Node({ ...options, reconnectLimit: Infinity })).toThrow();
      expect(() => new Node({ ...options, handshakeTimeout: 0 })).toThrow();
    });

    it("constructs for proper input", () => {
      const n = new Node({ ...options, sessionId: "123", reconnectLimit: 1 });
      expect(n.name).toBe(options.name);
      expect(n.rest).toBeInstanceOf(REST);
      expect(n.clientId).toBe(options.clientId);
      expect(n.sessionId).toBe("123");
      expect(n.reconnectLimit).toBe(1);
    });
  });

  describe("property", () => {
    it("has essential fields defined", () => {
      const n = new Node(options);
      expect(n.ping).toBeNull();
      expect(n.reconnectAttempts).toBe(0);
      expect(n.reconnectLimit).toBeGreaterThan(0);
      expect(n.sessionId).toBeNull();
      expect(n.state).toBe("disconnected");
      expect(n.stats).toBeNull();
    });

    it("behaves as expected for accessors", () => {
      const n = new Node({ ...options, sessionId: "123" });
      expect(n.sessionId).toBe("123");
      expect(n.rest.sessionId).toBe("123");
      n.rest.sessionId = "456";
      n.rest.sessionId = null;
      expect(n.rest.sessionId).toBe("123");
    });
  });

  describe("method", () => {
    it("returns name on toString", () => {
      const n = new Node(options);
      expect(n.toString()).toBe(options.name);
    });
  });

  describe("behavior", () => {
    const payloads = {
      stats: { op: OPType.Stats, uptime: 123 } satisfies Partial<StatsPayload>,
      ready: { op: OPType.Ready, sessionId: "123" } satisfies Partial<ReadyPayload>,
    };

    test("connection state and lifecycle", async () => {
      const n = new Node({ ...options, reconnectDelay: 1, reconnectLimit: 1 });
      n.on("error", () => {});

      n.connect();

      expect(n.connecting).toBe(true);
      expect(n.state).toBe("connecting");

      let p = n.connect();

      ws.error();
      ws.close();

      await expect(p).resolves.toBe(false);

      expect(n.reconnecting).toBe(true);
      expect(n.state).toBe("reconnecting");

      expect(n.reconnectAttempts).toBe(0);

      await setTimeout(1);

      expect(n.reconnectAttempts).toBe(1);

      expect(n.connecting).toBe(true);
      expect(n.state).toBe("connecting");

      p = n.connect();

      ws.open();

      await expect(p).resolves.toBe(true);

      expect(n.connected).toBe(true);
      expect(n.state).toBe("connected");

      ws.message(JSON.stringify(payloads.ready));

      expect(n.ready).toBe(true);
      expect(n.state).toBe("ready");

      ws.message(JSON.stringify(payloads.stats));

      expect(n.ping).toBeGreaterThanOrEqual(0);
      expect(n.stats).toMatchObject(payloads.stats);

      ws.close();

      expect(n.disconnected).toBe(true);
      expect(n.state).toBe("disconnected");

      await setImmediate();

      expect(n.connecting).toBe(true);
      expect(n.state).toBe("connecting");

      ws.close();

      expect(n.reconnecting).toBe(true);
      expect(n.state).toBe("reconnecting");

      expect(n.reconnectAttempts).toBe(0);

      await setTimeout(1);

      expect(n.reconnectAttempts).toBe(1);

      expect(n.connecting).toBe(true);
      expect(n.state).toBe("connecting");

      ws.close();

      expect(n.disconnected).toBe(true);
      expect(n.state).toBe("disconnected");
    });

    test("reconnect on zombie connection", async () => {
      const n = new Node({ ...options, statsInterval: 1, highestLatency: 1 });

      n.connect();
      expect(n.state).toBe("connecting");

      ws.open();
      expect(n.state).toBe("connected");

      ws.message(JSON.stringify(payloads.ready));
      expect(n.state).toBe("ready");

      ws.message(JSON.stringify(payloads.stats));

      await setTimeout(2);
      expect(n.state).toBe("reconnecting");

      await n.disconnect();
      expect(n.state).toBe("disconnected");
    });

    test("disconnect always halts the node", async () => {
      const n = new Node({ ...options, reconnectDelay: 1, reconnectLimit: 1 });

      await expect(n.disconnect()).resolves.toBeUndefined();
      expect(n.state).toBe("disconnected");

      n.connect();
      expect(n.state).toBe("connecting");

      await n.disconnect();
      expect(n.state).toBe("disconnected");

      n.connect();
      expect(n.state).toBe("connecting");

      ws.open();
      expect(n.state).toBe("connected");

      ws.message(JSON.stringify(payloads.ready));
      expect(n.state).toBe("ready");

      await n.disconnect();
      expect(n.state).toBe("disconnected");
    });

    test("disconnect on unexpected payload", async () => {
      const n = new Node(options);

      n.connect();
      expect(n.state).toBe("connecting");

      ws.open();
      expect(n.state).toBe("connected");

      ws.message("enough with the tests!");
      expect(n.state).toBe("disconnected");
    });

    test("skip reconnect delay on explicit connect", async () => {
      const n = new Node(options);

      n.connect();
      expect(n.state).toBe("connecting");

      ws.open();
      expect(n.state).toBe("connected");

      ws.close();
      expect(n.state).toBe("reconnecting");

      n.connect();
      expect(n.state).toBe("connecting");

      await n.disconnect();
      expect(n.state).toBe("disconnected");
    });
  });
});
