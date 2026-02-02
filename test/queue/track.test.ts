import { Track } from "../../src/Queue/Track";

describe("Track", () => {
  it("must throw on missing identifier", () => {
    expect(() => {
      new Track({ encoded: "abc", info: {} } as any);
    }).toThrow();
  });

  it("must throw on missing encoded value", () => {
    expect(() => {
      new Track({ info: { identifier: "xyz" } } as any);
    }).toThrow();
  });

  it("must NOT throw for partial info (id, encoded, stream)", () => {
    new Track({ encoded: "abc", info: { identifier: "xyz", isStream: true } } as any);
  });

  it("must NOT throw for complete info", () => {
    new Track({
      encoded: "encoded",
      info: {
        artworkUrl: null,
        author: "author",
        identifier: "identifier",
        isrc: null,
        isSeekable: true,
        isStream: false,
        length: 188000,
        position: 0,
        sourceName: "unknown",
        title: "title",
        uri: null,
      },
      pluginInfo: {},
      userData: {},
    });
  });

  it("must return title for toString()", () => {
    expect(`${new Track({ encoded: "abc", info: { title: "hello", identifier: "xyz" } } as any)}`).toBe("hello");
  });

  it("must have all fields defined", () => {
    const track = new Track({ encoded: "abc", info: { identifier: "xyz" } } as any);
    for (const key of Object.keys(track)) expect(track[key as keyof Track]).toBeDefined();
  });
});
