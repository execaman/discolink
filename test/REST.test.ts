declare const $clientName: string;
declare const $clientVersion: string;
declare const $clientRepository: string;

import { REST } from "../src/Node/REST";
import type { RequestOptions, RESTOptions, RestResponse } from "../src/Typings";

describe("REST", () => {
  const options = {
    origin: "http://localhost:2333",
    password: "youshallnotpass",
  } satisfies RESTOptions;

  describe("constructor", () => {
    it("throws for invalid inputs", () => {
      expect(() => new REST({ ...options, origin: "ftp://example.com" })).toThrow();
      expect(() => new REST({ ...options, version: 0 })).toThrow();
      expect(() => new REST({ ...options, password: "12\n34" })).toThrow();
      expect(() => new REST({ ...options, userAgent: "bot/1.0.0\r\n" })).toThrow();
      expect(() => new REST({ ...options, requestTimeout: 0 })).toThrow();
    });

    it("constructs for proper input", () => {
      const r = new REST({ ...options, sessionId: "123", userAgent: "bot/1.0.0" });
      expect(r.origin).toBe(options.origin);
      expect(r.version).toBeGreaterThan(0);
      expect(r.baseUrl).toBe(options.origin + "/v" + r.version);
      expect(r.timeout).toBeGreaterThan(0);
      expect(r.sessionId).toBe("123");
      expect(r.userAgent).toBe("bot/1.0.0");
    });
  });

  describe("property", () => {
    it("has essential fields defined", () => {
      const r = new REST(options);
      expect(r.version).toBeGreaterThan(0);
      expect(r.timeout).toBeGreaterThan(0);
      expect(r.sessionId).toBeNull();
      expect(r.userAgent).toBe($clientName + "/" + $clientVersion + " (" + $clientRepository + ")");
    });

    it("behaves as expected for accessors", () => {
      const r = new REST(options);
      r.sessionId = "123";
      expect(r.sessionId).toBe("123");
      r.sessionId = 123 as any;
      r.sessionId = " ";
      expect(r.sessionId).toBe("123");
      r.sessionId = null;
      expect(r.sessionId).toBeNull();
    });
  });

  describe("method", () => {
    const req = jest.fn();

    const mockResponse = (res: Partial<Omit<Response, "headers"> & RestResponse<any>>) => {
      req.mockImplementationOnce(async (url: URL) => ({
        status: 200,
        statusText: "OK",
        ok: true,
        redirected: false,
        url: url.href,
        json: async () => res.data,
        body: null,
        ...res,
        headers: new Headers(res.headers ?? { "content-type": "application/json" }),
      }));
    };

    global.fetch = req;

    test("request() - endpoint", async () => {
      const r = new REST({ ...options, stackTrace: true });

      await expect(r.request("")).rejects.toThrow();

      mockResponse({ data: [] });
      await expect(r.request("/")).resolves.toMatchObject({ data: [] });

      const [url, init] = req.mock.lastCall as [URL, RequestInit];

      expect(url).toBeInstanceOf(URL);
      expect(url.href.startsWith(r.baseUrl)).toBe(true);
      expect(Object.fromEntries(url.searchParams)).toEqual({ trace: "true" });

      expect(init.method).toBe("GET");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.headers).toMatchObject({ Authorization: options.password });
    });

    test("request() - options", async () => {
      const r = new REST({ ...options, stackTrace: false });
      const ctrl = new AbortController();

      const opts = {
        signal: ctrl.signal,
        params: { a: "b" },
        headers: { Authorization: "youshallnotpass" },
        data: { c: "d" },
        versioned: false,
      } satisfies RequestOptions;

      mockResponse({ data: [] });
      await expect(r.request("/", opts)).resolves.toMatchObject({ data: [] });

      let [url, init] = req.mock.lastCall as [URL, RequestInit];

      expect(url.href.startsWith(r.origin)).toBe(true);
      expect(url.href.startsWith(r.baseUrl)).toBe(false);
      expect(Object.fromEntries(url.searchParams)).toEqual(opts.params);

      expect(init.body).toBeUndefined();
      expect(init.signal).not.toBe(opts.signal);
      expect(init.headers).toMatchObject(opts.headers);

      ctrl.abort();
      await expect(r.request("/", { signal: ctrl.signal })).rejects.toThrow();

      delete (opts as RequestOptions).signal;

      mockResponse({});
      await expect(r.request("/", { ...opts, method: "HEAD" })).resolves.toMatchObject({ data: undefined });

      init = req.mock.lastCall[1];
      expect(init.body).toBeUndefined();

      mockResponse({ data: [] });
      await expect(r.request("/", { ...opts, method: "POST" })).resolves.toMatchObject({ data: [] });

      init = req.mock.lastCall[1];

      expect(init.body).toBe(JSON.stringify(opts.data));
      expect(init.headers).toMatchObject({ "Content-Type": "application/json" });

      mockResponse({ data: [] });
      await expect(r.request("/", { method: "POST", data: "data" })).resolves.toMatchObject({ data: [] });

      init = req.mock.lastCall[1];
      expect(init.body).toBe("data");

      mockResponse({ headers: { "content-type": "text/plain" } });
      await expect(r.request("/", opts)).resolves.toMatchObject({ data: null });
    });

    test("request() - signal & timeout", async () => {
      const r = new REST({ ...options, requestTimeout: 1 });

      req.mockImplementation((_url: URL, init: RequestInit) => {
        return new Promise((_res, rej) => {
          init.signal!.addEventListener("abort", () => rej(init.signal!.reason));
        });
      });

      await expect(r.request("/")).rejects.toMatchObject({ message: expect.stringContaining("timeout") });

      const ctrl = new AbortController();
      const p = expect(r.request("/", { signal: ctrl.signal })).rejects.toMatchObject({
        message: expect.stringContaining("aborted"),
      });

      ctrl.abort();
      await p;

      req.mockReset();
    });

    test("request() - error formatting", async () => {
      const r = new REST(options);

      mockResponse({ status: 500, ok: false });
      await expect(r.request("/")).rejects.toMatchObject({ message: expect.stringMatching(/failed|500/i) });

      req.mockRejectedValueOnce("some-non-standard-error");
      await expect(r.request("/")).rejects.toMatchObject({ message: expect.stringContaining("unexpected") });

      mockResponse({ ok: false, data: { trace: "ln1,col1" } });
      await expect(r.request("/")).rejects.toMatchObject({ trace: "ln1,col1" });
    });

    test("common http methods", async () => {
      const r = new REST(options);

      mockResponse({ data: ["GET"] });
      await expect(r.get("/")).resolves.toMatchObject({ data: ["GET"] });

      mockResponse({ data: ["POST"] });
      await expect(r.post("/")).resolves.toMatchObject({ data: ["POST"] });

      mockResponse({ data: ["PATCH"] });
      await expect(r.patch("/")).resolves.toMatchObject({ data: ["PATCH"] });

      mockResponse({ data: ["DELETE"] });
      await expect(r.delete("/")).resolves.toMatchObject({ data: ["DELETE"] });
    });

    test("convenience methods", async () => {
      const r = new REST(options);

      await expect(r.loadTracks("")).rejects.toThrow();

      await expect(r.decodeTrack("")).rejects.toThrow();
      await expect(r.decodeTracks([""])).rejects.toThrow();

      await expect(r.fetchPlayers()).rejects.toThrow();

      await expect(r.fetchPlayer("")).rejects.toThrow();
      await expect(r.fetchPlayer("123")).rejects.toThrow();

      await expect(r.updatePlayer("", { paused: true })).rejects.toThrow();
      await expect(r.updatePlayer("123", {}, {}, "123")).rejects.toThrow();
      await expect(r.updatePlayer("123", { paused: true })).rejects.toThrow();

      await expect(r.destroyPlayer("")).rejects.toThrow();
      await expect(r.destroyPlayer("123")).rejects.toThrow();

      await expect(r.updateSession({})).rejects.toThrow();
      await expect(r.updateSession({ timeout: 60 })).rejects.toThrow();

      await expect(r.unmarkFailedAddress("")).rejects.toThrow();

      r.sessionId = "123";

      mockResponse({ data: { loadType: "type", data: [] } });
      await expect(r.loadTracks("query")).resolves.toMatchObject({ loadType: "type", data: [] });

      mockResponse({ data: { id: "id" } });
      await expect(r.decodeTrack("track")).resolves.toMatchObject({ id: "id" });

      mockResponse({ data: [{ id: "id" }] });
      await expect(r.decodeTracks(["tracks"])).resolves.toMatchObject([{ id: "id" }]);

      mockResponse({ data: [{ guildId: "123" }] });
      await expect(r.fetchPlayers("123")).resolves.toMatchObject([{ guildId: "123" }]);

      mockResponse({ data: { guildId: "123" } });
      await expect(r.fetchPlayer("123")).resolves.toMatchObject({ guildId: "123" });

      mockResponse({ data: { guildId: "123", paused: true } });
      await expect(r.updatePlayer("123", { paused: true })).resolves.toMatchObject({ guildId: "123", paused: true });

      mockResponse({ status: 204 });
      await expect(r.destroyPlayer("123")).resolves.toBe(true);

      mockResponse({ data: { resuming: true, timeout: 60 } });
      await expect(r.updateSession({ timeout: 60 })).resolves.toMatchObject({ resuming: true, timeout: 60 });

      mockResponse({ data: { version: {} } });
      await expect(r.fetchInfo()).resolves.toMatchObject({ version: {} });

      mockResponse({ data: { uptime: 123 } });
      await expect(r.fetchStats()).resolves.toMatchObject({ uptime: 123 });

      mockResponse({ data: { class: "kind", details: "info" } });
      await expect(r.fetchRoutePlannerStatus()).resolves.toMatchObject({ class: "kind", details: "info" });

      mockResponse({ status: 204 });
      await expect(r.fetchRoutePlannerStatus()).resolves.toMatchObject({ class: null, details: null });

      mockResponse({ status: 204 });
      await expect(r.unmarkFailedAddress("1.1.1.1")).resolves.toBe(true);

      mockResponse({ status: 204 });
      await expect(r.unmarkAllFailedAddresses()).resolves.toBe(true);
    });
  });
});
