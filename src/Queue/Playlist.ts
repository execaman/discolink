import { formatDuration, isArray, isNumber, isRecord, isString } from "../Functions";
import { Track } from "./index";
import type { APIPlaylist, CommonPluginInfo, JsonObject } from "../Typings";

/**
 * Class representing a Playlist
 */
export class Playlist<PluginInfo extends JsonObject = CommonPluginInfo> {
  /**
   * Name of the playlist
   */
  name = "Unknown Playlist";

  /**
   * Index of the track this playlist's source URL included, `-1` if none
   */
  selectedTrack = -1;

  /**
   * List of tracks
   */
  tracks: Track[] = [];

  /**
   * Additional info from plugins
   */
  pluginInfo = {} as PluginInfo;

  /**
   * Duration in milliseconds (live tracks excluded)
   */
  duration = 0;

  /**
   * Formatted duration (live tracks excluded)
   */
  formattedDuration = "00:00";

  constructor(data: APIPlaylist<PluginInfo>) {
    if (!isRecord(data)) throw new Error("Playlist data must be an object");
    if (!isRecord(data.info)) throw new Error("Playlist info is not an object");
    if (!isArray(data.tracks, "non-empty")) throw new Error("Playlist has no track(s)");

    for (let i = 0, track: Track; i < data.tracks.length; i++) {
      track = new Track(data.tracks[i]!);
      if (!track.isLive) this.duration += track.duration;
      this.tracks.push(track);
    }

    if (isString(data.info.name, "non-empty")) this.name = data.info.name;
    if (isNumber(data.info.selectedTrack, "whole")) this.selectedTrack = data.info.selectedTrack;

    if (isRecord(data.pluginInfo, "non-empty")) this.pluginInfo = data.pluginInfo;
    if (this.duration > 0) this.formattedDuration = formatDuration(this.duration);
  }

  /**
   * @returns Name of the playlist
   */
  toString() {
    return this.name;
  }
}
