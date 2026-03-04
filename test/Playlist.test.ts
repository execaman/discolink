import { Playlist } from "../src/Queue/Playlist";
import type { APIPlaylist, APITrack } from "../src/Typings";

describe("Playlist", () => {
  const info = {
    name: "name",
    selectedTrack: 0,
  } satisfies APIPlaylist["info"];

  const track: APITrack = {
    info: {
      identifier: "id",
      isSeekable: true,
      author: "author",
      length: 10_000,
      isStream: false,
      position: 0,
      title: "title",
      uri: null,
      artworkUrl: null,
      isrc: null,
      sourceName: "source",
    },
    encoded: "data",
    userData: { id: "id" },
    pluginInfo: { uri: "uri" },
  };

  describe("constructor", () => {
    it("throws for invalid data", () => {
      expect(() => new Playlist({} as APIPlaylist)).toThrow();
      expect(() => new Playlist(null as unknown as APIPlaylist)).toThrow();
      expect(() => new Playlist({ info } as APIPlaylist)).toThrow();
      expect(() => new Playlist({ tracks: [track] } as APIPlaylist)).toThrow();
    });

    it("constructs for basic data", () => {
      const p = new Playlist({ info, tracks: [track] } as APIPlaylist);
      expect(p.name).toBe("name");
      expect(p.selectedTrack).toBe(0);
      expect(p.tracks.length).toBe(1);
      expect(p.duration).toBe(10_000);
      expect(p.formattedDuration).toBe("00:10");
    });
  });

  describe("property", () => {
    it("is defined with defaults for basic data", () => {
      const p = new Playlist({ info: {}, tracks: [track] } as APIPlaylist);
      expect(p.name).toBe("Unknown Playlist");
      expect(p.selectedTrack).toBe(-1);
      expect(p.tracks.length).toBe(1);
      expect(p.duration).toBe(10_000);
      expect(p.formattedDuration).toBe("00:10");
      expect(p.pluginInfo).toEqual({});
    });

    it("is defined with values for complete data", () => {
      const p = new Playlist({ info, pluginInfo: { uri: "uri" }, tracks: [track, track] });
      expect(p.name).toBe("name");
      expect(p.selectedTrack).toBe(0);
      expect(p.tracks.length).toBe(2);
      expect(p.duration).toBe(20_000);
      expect(p.formattedDuration).toBe("00:20");
      expect(p.pluginInfo).toEqual({ uri: "uri" });
    });
  });

  describe("method", () => {
    it("returns name on toString", () => {
      const playlist = new Playlist({ info, tracks: [track] } as APIPlaylist);
      expect(playlist.toString()).toBe("name");
    });
  });
});
