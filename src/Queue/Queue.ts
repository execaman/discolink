import { Severity } from "../Typings";
import { LookupSymbol, UpdateSymbol } from "../Constants/Symbols";
import { formatDuration, isArray, isNumber } from "../Functions";
import { Playlist, Track } from "../index";
import { VoiceState } from "../Voice";
import { FilterManager } from "./index";
import type {
  APIPlayer,
  Exception,
  JsonObject,
  PlayerUpdateQueryParams,
  PlayerUpdateRequestBody,
  QueueContext,
  RepeatMode,
} from "../Typings";
import type { Player } from "../Main";

export class Queue<Context extends Record<string, unknown> = QueueContext> {
  #player: APIPlayer;

  #autoplay = false;
  #repeatMode: RepeatMode = "none";

  #tracks: Track[] = [];
  #previousTracks: Track[] = [];

  context = {} as Context;

  readonly voice: VoiceState;
  readonly filters: FilterManager;
  readonly player: Player;

  constructor(player: Player, guildId: string, context?: Context) {
    if (player.queues.has(guildId)) throw new Error("An identical queue already exists");

    const _player = player.queues[LookupSymbol](guildId);
    if (!_player) throw new Error(`No player found for guild '${guildId}'`);

    const voice = player.voices.get(guildId);
    if (!voice) throw new Error(`No connection found for guild '${guildId}'`);

    this.#player = _player;
    if (context !== undefined) this.context = context;

    this.voice = voice;
    this.filters = new FilterManager(player, guildId);
    this.player = player;

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      voice: immutable,
      filters: immutable,
      player: { ...immutable, enumerable: false },
    } satisfies { [k in keyof Queue]?: PropertyDescriptor });
  }

  get node() {
    return this.voice.node;
  }

  get rest() {
    return this.voice.node.rest;
  }

  get guildId() {
    return this.voice.guildId;
  }

  get volume() {
    return this.#player.volume;
  }

  get paused() {
    return this.#player.paused;
  }

  get stopped() {
    return this.track !== null && this.#player.track === null;
  }

  get empty() {
    return this.finished && !this.hasPrevious;
  }

  get playing() {
    return !this.paused && this.track !== null && this.#player.track !== null;
  }

  get autoplay() {
    return this.#autoplay;
  }

  get finished() {
    return this.#tracks.length === 0;
  }

  get destroyed() {
    return this.player.queues.get(this.guildId) !== this;
  }

  get repeatMode() {
    return this.#repeatMode;
  }

  get hasNext() {
    return this.#tracks.length > 1;
  }

  get hasPrevious() {
    return this.#previousTracks.length !== 0;
  }

  get track() {
    return this.#tracks[0] ?? null;
  }

  get previousTrack() {
    return this.#previousTracks[this.#previousTracks.length - 1] ?? null;
  }

  get tracks() {
    return this.#tracks;
  }

  get previousTracks() {
    return this.#previousTracks;
  }

  get length() {
    return this.#tracks.length;
  }

  get totalLength() {
    return this.length + this.#previousTracks.length;
  }

  get duration() {
    return this.#tracks.reduce((time, track) => time + (track.isLive ? 0 : track.duration), 0);
  }

  get formattedDuration() {
    return formatDuration(this.duration);
  }

  get currentTime() {
    if (this.#player.paused || !this.#player.state.connected) return this.#player.state.position;
    if (this.#player.state.position === 0) return 0;
    return this.#player.state.position + (Date.now() - this.#player.state.time);
  }

  get formattedCurrentTime() {
    return formatDuration(this.currentTime);
  }

  #error(data: string | Exception) {
    const explicit = typeof data === "string";
    const message = explicit ? data : (data.message ?? data.cause);
    const error = new Error(message) as Error & Exception;
    error.name = `Error [${this.constructor.name}]`;
    error.cause = message;
    error.severity = explicit ? Severity.Common : data.severity;
    return error;
  }

  async #update(data: PlayerUpdateRequestBody, params?: PlayerUpdateQueryParams) {
    const player = await this.rest.updatePlayer(this.guildId, data, params);
    Object.assign(this.#player, player);
  }

  async sync(target: "local" | "remote" = "local") {
    if (target === "local") {
      const player = await this.rest.fetchPlayer(this.guildId);
      Object.assign(this.#player, player);
      return;
    }
    if (target !== "remote") throw new Error("Target must be 'local' or 'remote'");
    const voice = this.player.voices[LookupSymbol](this.guildId);
    if (!voice) return;
    const player = this.#player;
    const request: PlayerUpdateRequestBody = {
      voice: {
        endpoint: voice.endpoint,
        sessionId: voice.session_id,
        token: voice.token,
      },
      filters: player.filters,
      paused: player.paused,
      volume: player.volume,
    };
    if (player.track !== null) {
      request.track = { encoded: player.track.encoded, userData: player.track.userData };
      request.position = player.state.position;
    }
    await this.#update(request);
    this.player.voices[UpdateSymbol](this.guildId, { node_session_id: this.node.sessionId! });
  }

  async search(query: string, prefix = this.player.options.queryPrefix) {
    return this.player.search(query, { prefix, node: this.node.name });
  }

  add(source: Track | Track[] | Playlist, userData?: JsonObject) {
    if (source instanceof Track) {
      Object.assign(source.userData, userData);
      this.#tracks.push(source);
    } else if (source instanceof Playlist) {
      for (const track of source.tracks) {
        Object.assign(track.userData, userData);
        this.#tracks.push(track);
      }
    } else if (isArray(source, (t) => t instanceof Track)) {
      for (const track of source) {
        Object.assign(track.userData, userData);
        this.#tracks.push(track);
      }
    } else throw new Error("Source must be a track, playlist, or array of tracks");
    return this;
  }

  async addRelated(refTrack?: Track) {
    refTrack ??= this.track ?? this.previousTrack!;
    if (!refTrack) throw new Error("The queue is empty and there is no track to refer");
    const relatedTracks = await this.player.options.fetchRelatedTracks(this, refTrack);
    this.add(relatedTracks);
    return relatedTracks;
  }

  remove(index: number): Track | undefined;
  remove(indices: number[]): Track[];
  remove(input: number | number[]) {
    if (isNumber(input, "integer")) {
      if (input === 0 && !this.stopped) return;
      if (input < 0) return this.#previousTracks.splice(input, 1)[0];
      return this.#tracks.splice(input, 1)[0];
    }
    if (isArray(input, (i) => isNumber(i, "integer"))) {
      if (input.length === 0) return [];
      const tracks: Track[] = [];
      for (
        let indices = input.toSorted((a, b) => a - b), index = indices[0]!, deletions = 0, i = 0;
        i < indices.length;
        index = indices[++i]! - deletions
      ) {
        if (index === 0 && !this.stopped) continue;
        if (index < 0) tracks.push(...this.#previousTracks.splice(index, 1));
        else if (index < this.#tracks.length) (tracks.push(...this.#tracks.splice(index, 1)), deletions++);
      }
      return tracks;
    }
    throw new Error("Input must be a index or array of indices");
  }

  async jump(index: number) {
    if (this.empty) throw this.#error("The queue is empty at the moment");
    if (!isNumber(index, "integer")) throw this.#error("Index must be a integer");
    const track = index < 0 ? this.#previousTracks[this.#previousTracks.length + index] : this.#tracks[index];
    if (!track) throw this.#error("Specified index is out of range");
    if (index < 0) this.#tracks.unshift(...this.#previousTracks.splice(index));
    else this.#previousTracks.push(...this.#tracks.splice(0, index));
    await this.#update({
      paused: false,
      track: { encoded: track.encoded, userData: track.userData },
    });
    return track;
  }

  async pause() {
    await this.#update({ paused: true });
    return this.#player.paused;
  }

  async resume() {
    if (this.stopped) await this.jump(0);
    else await this.#update({ paused: false });
    return !this.#player.paused;
  }

  async seek(ms: number) {
    if (this.track === null) throw this.#error("No track's playing at the moment");
    if (!this.track.isSeekable) throw this.#error("Current track is not seekable");
    if (!isNumber(ms, "whole")) throw this.#error("Seek time must be a whole number");
    if (ms > this.track.duration) throw this.#error("Specified time to seek is out of range");
    const _body: PlayerUpdateRequestBody = { paused: false, position: ms };
    if (this.#player.track?.info.identifier !== this.track.id) {
      _body.track = { encoded: this.track.encoded, userData: this.track.userData };
    }
    await this.#update(_body);
    return this.#player.state.position;
  }

  async next() {
    if (this.hasNext) return this.jump(1);
    if (this.hasPrevious && this.#repeatMode === "queue") {
      this.#tracks.push(this.#previousTracks.shift()!);
      return this.jump(this.hasNext ? 1 : 0);
    }
    if (!this.empty && this.#autoplay) {
      const related = await this.addRelated();
      if (related.length > 0) return this.jump(this.length - related.length);
    }
    if (!this.finished) {
      this.#previousTracks.push(this.#tracks.shift()!);
      await this.stop();
    }
    return null;
  }

  async previous() {
    if (this.hasPrevious) return this.jump(-1);
    return null;
  }

  shuffle(includePrevious = false) {
    if (includePrevious === true) this.#tracks.push(...this.#previousTracks.splice(0));
    if (this.#tracks.length < 3) return this;
    for (let arr = this.#tracks, i = arr.length - 1, j: number; i > 1; --i) {
      j = Math.floor(Math.random() * i) + 1;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return this;
  }

  async setVolume(volume: number) {
    if (!isNumber(volume, "whole")) throw this.#error("Volume must be a whole number");
    if (volume > 1000) throw this.#error("Volume cannot be more than 1000");
    await this.#update({ volume });
    return this.#player.volume;
  }

  setAutoplay(autoplay = false) {
    if (typeof autoplay === "boolean") this.#autoplay = autoplay;
    else throw this.#error("Autoplay must be a boolean value");
    return this.#autoplay;
  }

  setRepeatMode(repeatMode: RepeatMode = "none") {
    if (repeatMode === "track" || repeatMode === "queue" || repeatMode === "none") this.#repeatMode = repeatMode;
    else throw this.#error("Repeat mode can only be set to track, queue, or none");
    return this.#repeatMode;
  }

  async stop() {
    return this.#update({ track: { encoded: null } });
  }

  async destroy(reason?: string) {
    return this.player.queues.destroy(this.guildId, reason);
  }
}
