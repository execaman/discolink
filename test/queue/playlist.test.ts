import { Playlist } from "../../src/Queue/Playlist";

const track = {
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
};

describe("Playlist", () => {
  it("must NOT throw for partial info (name, tracks)", () => {
    new Playlist({ info: { name: "hello" }, tracks: [track] } as any);
  });

  it("must NOT throw for complete info", () => {
    new Playlist({
      info: {
        name: "playlist",
        selectedTrack: -1,
      },
      pluginInfo: {},
      tracks: [track],
    });
  });

  it("must return name for toString()", () => {
    expect(`${new Playlist({ info: { name: "hello" }, tracks: [track] } as any)}`).toBe("hello");
  });

  it("must have all fields defined", () => {
    const playlist = new Playlist({ info: {}, tracks: [track] } as any);
    for (const key of Object.keys(playlist)) expect(playlist[key as keyof Playlist]).toBeDefined();
  });
});
