import { formatDuration, isNumber, isRecord, isString } from "../Functions";

import type { APITrack, EmptyObject, JsonObject } from "../Typings";

export class Track<UserData extends JsonObject = EmptyObject, PluginInfo extends JsonObject = EmptyObject> {
  id: string;

  title = "Unknown Track";
  author = "Unknown Author";

  isLive = false;
  isSeekable = false;

  duration = 0;
  formattedDuration = "00:00";

  uri: string | null = null;
  isrc: string | null = null;

  url: string | null = null;
  artworkUrl: string | null = null;

  userData = {} as UserData;
  pluginInfo = {} as PluginInfo;

  encoded: string;
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
