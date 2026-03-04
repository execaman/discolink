import { Track } from "../src/Queue/Track";
import type { APITrack } from "../src/Typings";

describe("Track", () => {
  const info = {
    identifier: "id",
    isSeekable: false,
    author: "author",
    length: 0,
    isStream: false,
    position: 0,
    title: "title",
    uri: null,
    artworkUrl: null,
    isrc: null,
    sourceName: "source",
  } satisfies APITrack["info"];

  describe("constructor", () => {
    it("throws for invalid data", () => {
      expect(() => new Track({} as APITrack)).toThrow();
      expect(() => new Track(null as unknown as APITrack)).toThrow();
      expect(() => new Track({ info } as APITrack)).toThrow();
      expect(() => new Track({ info: {}, encoded: "data" } as APITrack)).toThrow();
    });

    it("constructs for basic data", () => {
      const t = new Track({ info: { identifier: "id" }, encoded: "data" } as APITrack);
      expect(t.id).toBe("id");
      expect(t.encoded).toBe("data");
    });
  });

  describe("property", () => {
    it("is defined with defaults for basic data", () => {
      const t = new Track({ info: { identifier: "id" }, encoded: "data" } as APITrack);
      expect(t.id).toBe("id");
      expect(t.encoded).toBe("data");
      expect(t.author).toBe("Unknown Author");
      expect(t.duration).toBe(0);
      expect(t.formattedDuration).toBe("00:00");
      expect(t.isLive).toBe(false);
      expect(t.isSeekable).toBe(false);
      expect(t.pluginInfo).toEqual({});
      expect(t.sourceName).toBe("unknown");
      expect(t.title).toBe("Unknown Track");
      expect(t.userData).toEqual({});
    });

    it("is defined with values for complete data", () => {
      const t = new Track({
        info: {
          ...info,
          isStream: true,
          length: 12345,
          uri: "http://example.com/audio.mp3",
          artworkUrl: "http://example.com/artwork.png",
          isrc: "isrc",
          sourceName: "example",
        },
        encoded: "data",
        userData: { id: "id" },
        pluginInfo: { uri: "uri" },
      });

      expect(t.artworkUrl).toBe("http://example.com/artwork.png");
      expect(t.duration).toBe(Number.POSITIVE_INFINITY);
      expect(t.formattedDuration).toBe("Live");
      expect(t.isLive).toBe(true);
      expect(t.isrc).toBe("isrc");
      expect(t.pluginInfo).toEqual({ uri: "uri" });
      expect(t.sourceName).toBe("example");
      expect(t.uri).toBe("http://example.com/audio.mp3");
      expect(t.url).toBe("http://example.com/audio.mp3");
      expect(t.userData).toEqual({ id: "id" });
    });
  });

  describe("method", () => {
    it("returns title on toString", () => {
      const track = new Track({ info, encoded: "data" } as APITrack);
      expect(track.toString()).toBe("title");
    });
  });
});
