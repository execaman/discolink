import { Severity } from "../Typings";
import { formatDuration, isArray, isNumber } from "../Functions";
import { Playlist, Track } from "../index";
import { VoiceState } from "../Voice";
import { FilterManager } from "./index";

import type { APIPlayer, EmptyObject, Exception, JsonObject, PlayerUpdateRequestBody, RepeatMode } from "../Typings";
import type { Player } from "../Main";

/**
 * A class representing the Queue of a guild's player
 */
export class Queue<Context extends Record<string, unknown> = EmptyObject> {
  #cache: APIPlayer;
  #player: Player;

  #autoplay = false;
  #repeatMode: RepeatMode = "none";

  #tracks: Track[] = [];
  #previousTracks: Track[] = [];

  /**
   * Additional data specific to this queue
   */
  context = {} as Context;

  /**
   * Voice state representing connection status
   */
  readonly voice: VoiceState;

  /**
   * Manager responsible for handling filters
   */
  readonly filters: FilterManager;

  constructor(player: Player, guildId: string, context?: Context) {
    if (player.voices.has(guildId)) {
      this.voice = player.voices.get(guildId)!;
    } else {
      throw new Error(`No connection found for guild '${guildId}'`);
    }

    if (player.queues.cache.has(guildId)) {
      this.#cache = player.queues.cache.get(guildId)!;
    } else {
      throw new Error(`No player found for guild '${guildId}'`);
    }

    this.#player = player;
    this.filters = new FilterManager(player, guildId);
    if (context !== undefined) this.context = context;

    const immutable: PropertyDescriptor = {
      writable: false,
      configurable: false,
    };

    Object.defineProperties(this, {
      voice: immutable,
      filters: immutable,
    } satisfies { [k in keyof Queue]?: PropertyDescriptor });
  }

  get #data() {
    this.#cache = this.#player.queues.cache.get(this.guildId) ?? this.#cache;
    return this.#cache;
  }

  set #data(data) {
    this.#player.queues.cache.set(this.guildId, data);
    this.#cache = data;
  }

  /**
   * The node managing this player
   */
  get node() {
    return this.voice.node;
  }

  /**
   * The REST instance of the Node
   */
  get rest() {
    return this.voice.node.rest;
  }

  /**
   * Id of the guild
   */
  get guildId() {
    return this.voice.guildId;
  }

  /**
   * Volume of the player
   */
  get volume() {
    return this.#data.volume;
  }

  /**
   * Whether the player is paused
   */
  get paused() {
    return this.#data.paused;
  }

  /**
   * Whether the player is stopped.
   * i.e. the queue has a track but the player doesn't
   */
  get stopped() {
    return this.track !== null && this.#data.track === null;
  }

  /**
   * Whether autoplay is enabled
   */
  get autoplay() {
    return this.#autoplay;
  }

  /**
   * Whether the queue has no current tracks
   */
  get finished() {
    return this.#tracks.length === 0;
  }

  /**
   * Whether this instance of Queue is destroyed
   */
  get destroyed() {
    return this.#player.queues.get(this.guildId) !== this;
  }

  /**
   * Repeat mode of this queue
   */
  get repeatMode() {
    return this.#repeatMode;
  }

  /**
   * Whether this queue is empty (zero previous and current tracks)
   */
  get isEmpty() {
    return this.finished && !this.hasPrevious;
  }

  /**
   * Whether the player is playing
   */
  get isPlaying() {
    return !this.paused && this.#data.track !== null;
  }

  /**
   * Whether the queue has a next track
   */
  get hasNext() {
    return this.#tracks.length > 1;
  }

  /**
   * Whether the queue has a previous track
   */
  get hasPrevious() {
    return this.#previousTracks.length !== 0;
  }

  /**
   * The current playing track of the queue
   */
  get track() {
    return this.#tracks[0] ?? null;
  }

  /**
   * The previous track of the queue
   */
  get previousTrack() {
    return this.#previousTracks[this.#previousTracks.length - 1] ?? null;
  }

  /**
   * Current tracks of the queue (including playing track)
   */
  get tracks() {
    return this.#tracks;
  }

  /**
   * Previous tracks of the queue
   */
  get previousTracks() {
    return this.#previousTracks;
  }

  /**
   * Total current tracks in queue
   */
  get length() {
    return this.#tracks.length;
  }

  /**
   * Total tracks in queue (current + previous)
   */
  get totalLength() {
    return this.length + this.#previousTracks.length;
  }

  /**
   * Total duration of current tracks in queue in milliseconds
   */
  get duration() {
    return this.#tracks.reduce((time, track) => time + (track.isLive ? 0 : track.duration), 0);
  }

  /**
   * Formatted total duration of current tracks in queue
   */
  get formattedDuration() {
    return formatDuration(this.duration);
  }

  /**
   * Position (time) in milliseconds of the current playing track
   */
  get currentTime() {
    if (this.#data.paused) return this.#cache.state.position;
    if (this.#cache.state.position === 0) return 0;
    return this.#cache.state.position + (Date.now() - this.#cache.state.time);
  }

  /**
   * Formatted position (time) of the current playing track
   */
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

  /**
   * Searches for results based on query
   * @param query Query or URL
   * @param prefix Term to prefix query with
   */
  async search(query: string, prefix = this.#player.options.queryPrefix) {
    return this.#player.search(query, { prefix, node: this.node.name });
  }

  /**
   * Adds items from source to queue
   * @param source Track, list of Tracks, or Playlist
   * @param userData User data to merge (shallow)
   */
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

  /**
   * Adds related tracks to queue
   * @param refTrack Track to use as reference
   */
  async addRelated(refTrack?: Track) {
    refTrack ??= this.track ?? this.previousTrack!;
    if (!refTrack) throw new Error("The queue is empty and there is no track to refer");
    const relatedTracks = await this.#player.options.fetchRelatedTracks(this, refTrack);
    this.add(relatedTracks);
    return relatedTracks;
  }

  /**
   * Remove a track from the queue
   * @param index Position (integer) of the track in queue
   */
  remove(index: number): Track | undefined;
  /**
   * Removes specified tracks from queue
   * @param indices Indices (integers) of tracks in queue
   */
  remove(indices: number[]): Track[];
  remove(input: number | number[]) {
    if (isNumber(input, "integer")) {
      if (input === 0) return;
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
        if (index === 0) continue;
        if (index < 0) tracks.push(...this.#previousTracks.splice(index, 1));
        else if (index < this.#tracks.length) (tracks.push(...this.#tracks.splice(index, 1)), deletions++);
      }
      return tracks;
    }
    throw new Error("Input must be a index or array of indices");
  }

  /**
   * Jumps to a track in queue.
   * Unlike `seek 0`, `jump 0` re-plays the current track and hence, re-emits events
   * @param index Index (integer) of the track to jump to
   */
  async jump(index: number) {
    if (this.isEmpty) throw this.#error("The queue is empty at the moment");
    if (!isNumber(index, "integer")) throw this.#error("Index must be a integer");
    const track = index < 0 ? this.#previousTracks[this.#previousTracks.length + index] : this.#tracks[index];
    if (!track) throw this.#error("Specified index is out of range");
    if (index < 0) this.#tracks.unshift(...this.#previousTracks.splice(index));
    else this.#previousTracks.push(...this.#tracks.splice(0, index));
    this.#data = await this.rest.updatePlayer(this.guildId, {
      paused: false,
      track: { encoded: track.encoded, userData: track.userData },
    });
    return track;
  }

  /**
   * Pauses the player
   */
  async pause() {
    this.#data = await this.rest.updatePlayer(this.guildId, { paused: true });
    return this.#cache.paused;
  }

  /**
   * Resumes the player
   */
  async resume() {
    if (this.stopped) await this.jump(0);
    else this.#data = await this.rest.updatePlayer(this.guildId, { paused: false });
    return !this.#cache.paused;
  }

  /**
   * Seeks to a position in current playing track
   * @param ms Position (time) in milliseconds to seek to
   */
  async seek(ms: number) {
    if (this.track === null) throw this.#error("No track's playing at the moment");
    if (!this.track.isSeekable) throw this.#error("Current track is not seekable");
    if (!isNumber(ms, "whole")) throw this.#error("Seek time must be a whole number");
    if (ms > this.track.duration) throw this.#error("Specified time to seek is out of range");
    const _body: PlayerUpdateRequestBody = { paused: false, position: ms };
    if (this.#data.track?.info.identifier !== this.track.id) {
      _body.track = { encoded: this.track.encoded, userData: this.track.userData };
    }
    this.#data = await this.rest.updatePlayer(this.guildId, _body);
    return this.#cache.state.position;
  }

  /**
   * Plays the next track in queue
   * @returns The next track if available, `null` otherwise
   */
  async next() {
    if (this.hasNext) return this.jump(1);
    if (this.hasPrevious && this.#repeatMode === "queue") {
      this.#tracks.push(this.#previousTracks.shift()!);
      return this.jump(this.hasNext ? 1 : 0);
    }
    if (!this.isEmpty && this.#autoplay) {
      const related = await this.addRelated();
      if (related.length > 0) return this.jump(this.length - related.length);
    }
    if (!this.finished) {
      this.#previousTracks.push(this.#tracks.shift()!);
      await this.stop();
    }
    return null;
  }

  /**
   * Plays the previous track in queue
   * @returns The previous track if available, `null` otherwise
   */
  async previous() {
    if (this.hasPrevious) return this.jump(-1);
    return null;
  }

  /**
   * Shuffles tracks in queue
   * @param includePrevious Whether to pull previous tracks to current
   */
  shuffle(includePrevious = false) {
    if (includePrevious === true) this.#tracks.push(...this.#previousTracks.splice(0));
    if (this.#tracks.length < 3) return this;
    for (let arr = this.#tracks, i = arr.length - 1, j: number; i > 1; --i) {
      j = Math.floor(Math.random() * i) + 1;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return this;
  }

  /**
   * Sets the volume of the player
   * @param volume Volume to set
   */
  async setVolume(volume: number) {
    if (!isNumber(volume, "whole")) throw this.#error("Volume must be a whole number");
    if (volume > 1000) throw this.#error("Volume cannot be more than 1000");
    this.#data = await this.rest.updatePlayer(this.guildId, { volume });
    return this.#cache.volume;
  }

  /**
   * Enables or disables autoplay
   * @param autoplay Whether to enable autoplay. Default: `false`
   */
  setAutoplay(autoplay = false) {
    if (typeof autoplay === "boolean") this.#autoplay = autoplay;
    else throw this.#error("Autoplay must be a boolean value");
    return this.#autoplay;
  }

  /**
   * Sets the repeat mode of the queue
   * @param repeatMode Repeat mode to set. Default: `none`
   */
  setRepeatMode(repeatMode: RepeatMode = "none") {
    if (repeatMode === "track" || repeatMode === "queue" || repeatMode === "none") this.#repeatMode = repeatMode;
    else throw this.#error("Repeat mode can only be set to track, queue, or none");
    return this.#repeatMode;
  }

  /**
   * Stops the player
   */
  async stop() {
    this.#data = await this.rest.updatePlayer(this.guildId, { track: { encoded: null } });
  }

  /**
   * Destroys this instance of Queue, removing it from its manager
   * @param reason Reason for destroying
   */
  async destroy(reason?: string) {
    return this.#player.queues.destroy(this.guildId, reason);
  }
}
