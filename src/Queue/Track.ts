import { formatDuration, isNumber, isRecord, isString } from "../Functions";

import type { APITrack, EmptyObject, JsonObject } from "../Typings";

export class Track<UserData extends JsonObject = EmptyObject, PluginInfo extends JsonObject = EmptyObject> {
  /**
   * Id of the track
   */
  id: string;

  /**
   * Title of the track
   */
  title = "Unknown Track";

  /**
   * Author of the track
   */
  author = "Unknown Author";

  /**
   * Whether the track is a stream
   */
  isLive = false;

  /**
   * Whether the track is seekable
   */
  isSeekable = false;

  /**
   * Duration of the track in milliseconds
   */
  duration = 0;

  /**
   * Formatted duration of the track
   */
  formattedDuration = "00:00";

  /**
   * [Uniform Resource Identifier](https://en.wikipedia.org/wiki/Uniform_Resource_Identifier) of the track
   */
  uri: string | null = null;

  /**
   * [International Standard Recording Code](https://en.wikipedia.org/wiki/International_Standard_Recording_Code) of the track
   */
  isrc: string | null = null;

  /**
   * URL of the track
   */
  url: string | null = null;

  /**
   * Artwork URL of the track
   */
  artworkUrl: string | null = null;

  /**
   * User data of the track
   */
  userData = {} as UserData;

  /**
   * Additional info from plugins
   */
  pluginInfo = {} as PluginInfo;

  /**
   * Encoded string representation of the track
   */
  encoded: string;

  /**
   * Name of the source of this track
   */
  sourceName = "unknown";

  constructor(data: APITrack<UserData, PluginInfo>) {
    if (!isRecord(data)) throw new Error("Track data must be an object");
    if (!isRecord(data.info)) throw new Error("Track info is not an object");

    if (isString(data.info.identifier, "non-empty")) this.id = data.info.identifier;
    else throw new Error("Track does not have an identifier");

    if (isString(data.encoded, "non-empty")) this.encoded = data.encoded;
    else throw new Error("Track does not have an encoded data string");

    if (isString(data.info.title, "non-empty")) this.title = data.info.title;
    if (isString(data.info.author, "non-empty")) this.author = data.info.author;

    if (data.info.isStream) this.isLive = true;
    if (data.info.isSeekable) this.isSeekable = true;

    if (this.isLive) {
      this.duration = Number.POSITIVE_INFINITY;
      this.formattedDuration = "Live";
    } else if (isNumber(data.info.length, "natural")) {
      this.duration = data.info.length;
      this.formattedDuration = formatDuration(this.duration);
    }

    if (isString(data.info.uri, "non-empty")) this.uri = data.info.uri;
    if (isString(data.info.isrc, "non-empty")) this.isrc = data.info.isrc;

    if (isString(this.uri, "url")) this.url = this.uri;
    if (isString(data.info.artworkUrl, "url")) this.artworkUrl = data.info.artworkUrl;

    if (isRecord(data.userData, "non-empty")) this.userData = data.userData;
    if (isRecord(data.pluginInfo, "non-empty")) this.pluginInfo = data.pluginInfo;

    if (isString(data.info.sourceName, "non-empty")) this.sourceName = data.info.sourceName;
  }

  toString() {
    return this.title;
  }
}
