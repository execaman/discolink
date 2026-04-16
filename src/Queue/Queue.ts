import { Severity } from "../Typings";
import { LastTrackSymbol, LookupSymbol, UpdateSymbol } from "../Constants/Symbols";
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

/**
 * Class representing a guild's queue while wrapping it's lavalink player.
 *
 * @remarks Simple interpretation: join of two arrays, negative for previous, zero for current, positive for next
 */
export class Queue<Context extends Record<string, unknown> = QueueContext> {
  #player: APIPlayer;

  #autoplay = false;
  #repeatMode: RepeatMode = "none";

  #tracks: Track[] = [];
  #previousTracks: Track[] = [];

  /**
   * Context of the queue
   */
  context = {} as Context;

  readonly voice: VoiceState;
  readonly filters: FilterManager;
  readonly player: Player;

  [LastTrackSymbol]: Track | null = null;

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
      [LastTrackSymbol]: { configurable: false, enumerable: false },
    } satisfies { [k in keyof Queue]?: PropertyDescriptor });
  }

  /**
   * Node of this queue
   */
  get node() {
    return this.voice.node;
  }

  /**
   * Alias for `node.rest`
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
   * Volume of the lavalink player
   */
  get volume() {
    return this.#player.volume;
  }

  /**
   * Whether the lavalink player is paused
   */
  get paused() {
    return this.#player.paused;
  }

  /**
   * Whether the queue has a track but the lavalink player doesn't
   */
  get stopped() {
    return this.track !== null && this.#player.track === null;
  }

  /**
   * Whether the queue is truly empty (no previous, current, or next tracks)
   */
  get empty() {
    return this.finished && !this.hasPrevious;
  }

  /**
   * Whether a track is present and also playing in the lavalink player
   */
  get playing() {
    return !this.paused && this.track !== null && this.#player.track !== null;
  }

  /**
   * Whether autoplay is enabled
   */
  get autoplay() {
    return this.#autoplay;
  }

  /**
   * Whether the queue has no current or next tracks
   */
  get finished() {
    return this.#tracks.length === 0;
  }

  /**
   * Whether this queue instance is destroyed
   */
  get destroyed() {
    return this.player.queues.get(this.guildId) !== this;
  }

  /**
   * The repeat mode of this queue
   */
  get repeatMode() {
    return this.#repeatMode;
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
   * The current track
   */
  get track() {
    return this.#tracks[0] ?? null;
  }

  /**
   * The previous track
   */
  get previousTrack() {
    return this.#previousTracks[this.#previousTracks.length - 1] ?? null;
  }

  /**
   * Current and next tracks
   */
  get tracks() {
    return this.#tracks;
  }

  /**
   * Previous tracks
   */
  get previousTracks() {
    return this.#previousTracks;
  }

  /**
   * Number of current and next tracks
   */
  get length() {
    return this.#tracks.length;
  }

  /**
   * Number of previous, current, and next tracks
   */
  get totalLength() {
    return this.length + this.#previousTracks.length;
  }

  /**
   * Duration of current and next tracks (excluding live tracks)
   */
  get duration() {
    return this.#tracks.reduce((time, track) => time + (track.isLive ? 0 : track.duration), 0);
  }

  /**
   * Formatted duration of current and next tracks (excluding live tracks)
   */
  get formattedDuration() {
    return formatDuration(this.duration);
  }

  /**
   * Position in milliseconds of the current track
   */
  get currentTime() {
    if (this.#player.paused || !this.#player.state.connected) return this.#player.state.position;
    if (this.#player.state.position === 0) return 0;
    return this.#player.state.position + (Date.now() - this.#player.state.time);
  }

  /**
   * Formatted position in milliseconds of the current track
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

  async #update(data: PlayerUpdateRequestBody, params?: PlayerUpdateQueryParams) {
    const player = await this.rest.updatePlayer(this.guildId, data, params);
    Object.assign(this.#player, player);
  }

  /**
   * Sync lavalink player data
   * @param target Target to update (`local` for queue, `remote` for node)
   */
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
        channelId: voice.channel_id,
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

  /**
   * Search for tracks with the queue's node
   * @param query Search terms or url
   * @param prefix Query prefix
   */
  async search(query: string, prefix = this.player.options.queryPrefix) {
    return this.player.search(query, { prefix, node: this.node.name });
  }

  /**
   * Add a track, list of tracks, or playlist to the queue
   * @param source track, list of tracks, or playlist
   * @param userData Object to shallow merge in all track's user data
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
   * Add related tracks to the queue
   * @param refTrack Track to use as reference
   */
  async addRelated(refTrack?: Track) {
    refTrack ??= this.track ?? this.previousTrack!;
    if (!refTrack) throw new Error("The queue is empty and there is no track to refer");
    const relatedTracks = await this.player.options.fetchRelatedTracks(this, refTrack);
    this.add(relatedTracks);
    return relatedTracks;
  }

  /**
   * Remove one track from the queue
   * @param index zero-based position of the track
   */
  remove(index: number): Track | undefined;
  /**
   * Remove multiple tracks from the queue
   * @param indices zero-based positions of tracks to remove
   */
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

  /**
   * Remove tracks by type (all if none specified)
   * @param type Type of tracks (`current` for current and next, `previous` for previous)
   * @remarks current track is only removed if its stopped
   */
  clear(type?: "current" | "previous") {
    switch (type) {
      case "current":
        if (!this.finished) this.#tracks.length = this.stopped ? 0 : 1;
        break;
      case "previous":
        this.#previousTracks.length = 0;
        break;
      default:
        if (!this.finished) this.#tracks.length = this.stopped ? 0 : 1;
        this.#previousTracks.length = 0;
    }
  }

  /**
   * Jump to a specific track in queue
   * @param index zero-based position of the track
   * @remarks this will absolutely play and trigger corresponding track events
   */
  async jump(index: number) {
    if (this.empty) throw this.#error("The queue is empty at the moment");
    if (!isNumber(index, "integer")) throw this.#error("Index must be a integer");
    const track = index < 0 ? this.#previousTracks[this.#previousTracks.length + index] : this.#tracks[index];
    if (!track) throw this.#error("Specified index is out of range");
    this[LastTrackSymbol] = this.track;
    if (index < 0) this.#tracks.unshift(...this.#previousTracks.splice(index));
    else this.#previousTracks.push(...this.#tracks.splice(0, index));
    await this.#update({
      paused: false,
      track: { encoded: track.encoded, userData: track.userData },
    });
    return track;
  }

  /**
   * Pause the lavalink player
   */
  async pause() {
    await this.#update({ paused: true });
    return this.#player.paused;
  }

  /**
   * Unpause the lavalink player and play the current track if its present but stopped
   */
  async resume() {
    if (this.stopped) await this.jump(0);
    else await this.#update({ paused: false });
    return !this.#player.paused;
  }

  /**
   * Jump to a specific position in the current track
   * @param ms Position in milliseconds
   */
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

  /**
   * Play the next track in queue
   */
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
      this[LastTrackSymbol] = this.track;
      this.#previousTracks.push(this.#tracks.shift()!);
      await this.stop();
    }
    return null;
  }

  /**
   * Play the previous track in queue
   */
  async previous() {
    if (this.hasPrevious) return this.jump(-1);
    return null;
  }

  /**
   * Shuffle the next tracks in queue
   * @param includePrevious Whether to include previous tracks
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
   * Set the lavalink player's volume
   * @param volume Numeric value between 0 and 1000
   */
  async setVolume(volume: number) {
    if (!isNumber(volume, "whole")) throw this.#error("Volume must be a whole number");
    if (volume > 1000) throw this.#error("Volume cannot be more than 1000");
    await this.#update({ volume });
    return this.#player.volume;
  }

  /**
   * Set autoplay mode
   * @param autoplay Whether autoplay should be enabled
   */
  setAutoplay(autoplay = false) {
    if (typeof autoplay === "boolean") this.#autoplay = autoplay;
    else throw this.#error("Autoplay must be a boolean value");
    return this.#autoplay;
  }

  /**
   * Set repeat mode
   * @param repeatMode Repeat mode (`none` for default, `track` for track, `queue` for queue)
   */
  setRepeatMode(repeatMode: RepeatMode = "none") {
    if (repeatMode === "track" || repeatMode === "queue" || repeatMode === "none") this.#repeatMode = repeatMode;
    else throw this.#error("Repeat mode can only be set to track, queue, or none");
    return this.#repeatMode;
  }

  /**
   * Stop the current track in lavalink player
   */
  async stop() {
    this[LastTrackSymbol] ??= this.track;
    return this.#update({ track: { encoded: null } });
  }

  /**
   * Destroy this queue instance
   * @param reason Reason for destroying
   */
  async destroy(reason?: string) {
    return this.player.queues.destroy(this.guildId, reason);
  }
}
