import { formatDuration, isNumber, isRecord, isString } from "../Functions";
import { Track } from "./index";
import type { APIPlaylist, EmptyObject, JsonObject } from "../Typings";

/**
 * A class representing API Playlist
 */
export class Playlist<PluginInfo extends JsonObject = EmptyObject> {
  /**
   * Name of the playlist
   */
  name = "Unknown Playlist";

  /**
   * Index of a track this playlist's source URL pointed to
   */
  selectedTrack = -1;

  /**
   * List of tracks this playlist contains
   */
  tracks: Track[] = [];

  /**
   * Additional info from plugins
   */
  pluginInfo = {} as PluginInfo;

  /**
   * Total duration of this playlist in milliseconds
   */
  duration = 0;

  /**
   * Formatted total duration of this playlist
   */
  formattedDuration = "00:00";

  constructor(data: APIPlaylist<PluginInfo>) {
    if (!isRecord(data)) throw new Error("Playlist data must be an object");
    if (!isRecord(data.info)) throw new Error("Playlist info is not an object");

    if (isString(data.info.name, "non-empty")) this.name = data.info.name;
    if (isNumber(data.info.selectedTrack, "whole")) this.selectedTrack = data.info.selectedTrack;

    for (let i = 0, track: Track; i < data.tracks.length; i++) {
      track = new Track(data.tracks[i]!);
      if (!track.isLive) this.duration += track.duration;
      this.tracks.push(track);
    }

    if (isRecord(data.pluginInfo, "non-empty")) this.pluginInfo = data.pluginInfo;
    if (this.duration > 0) this.formattedDuration = formatDuration(this.duration);
  }

  toString() {
    return this.name;
  }
}
