import type { CommonPluginFilters, CommonPluginInfo, CommonUserData, EmptyObject, JsonObject } from "../Utility";
import type { Exception, PlayerState } from "./Websocket";

export const enum LoadType {
  /**
   * A track has been loaded
   */
  Track = "track",

  /**
   * A playlist has been loaded
   */
  Playlist = "playlist",

  /**
   * A search result has been loaded
   */
  Search = "search",

  /**
   * There has been no matches for your identifier
   */
  Empty = "empty",

  /**
   * Loading has failed with an error
   */
  Error = "error",
}

export const enum RoutePlannerType {
  /**
   * IP address used is switched on ban. Recommended for IPv4 blocks or IPv6 blocks smaller than a /64
   */
  Rotating = "RotatingIpRoutePlanner",

  /**
   * IP address used is switched on clock update. Use with at least 1 /64 IPv6 block
   */
  Nano = "NanoIpRoutePlanner",

  /**
   * IP address used is switched on clock update, rotates to a different /64 block on ban. Use with at least 2x /64 IPv6 blocks
   */
  RotatingNano = "RotatingNanoIpRoutePlanner",

  /**
   * IP address used is selected at random per request. Recommended for larger IP blocks
   */
  Balancing = "BalancingIpRoutePlanner",
}

export const enum IPBlockType {
  /**
   * The ipv4 block type
   */
  V4 = "Inet4Address",

  /**
   * The ipv6 block type
   */
  V6 = "Inet6Address",
}

export interface RestError {
  /**
   * The timestamp of the error in milliseconds since the Unix epoch
   */
  timestamp: number;

  /**
   * The HTTP status code
   */
  status: number;

  /**
   * The HTTP status code message
   */
  error: string;

  /**
   * The stack trace of the error when `trace=true` as query param has been sent
   */
  trace?: string;

  /**
   * The error message
   */
  message: string;

  /**
   * The request path
   */
  path: string;
}

export interface APITrack<
  UserData extends JsonObject = CommonUserData,
  PluginInfo extends JsonObject = CommonPluginInfo,
> {
  /**
   * The base64 encoded track data
   */
  encoded: string;

  /**
   * Info about the track
   */
  info: TrackInfo;

  /**
   * Additional track info provided by plugins
   */
  pluginInfo: PluginInfo;

  /**
   * Additional track data provided via the [Update Player](https://lavalink.dev/api/rest.html#update-player) endpoint
   */
  userData: UserData;
}

export interface TrackInfo {
  /**
   * The track identifier
   */
  identifier: string;

  /**
   * Whether the track is seekable
   */
  isSeekable: boolean;

  /**
   * The track author
   */
  author: string;

  /**
   * The track length in milliseconds
   */
  length: number;

  /**
   * Whether the track is a stream
   */
  isStream: boolean;

  /**
   * The track position in milliseconds
   */
  position: number;

  /**
   * The track title
   */
  title: string;

  /**
   * The track uri
   */
  uri: string | null;

  /**
   * The track artwork url
   */
  artworkUrl: string | null;

  /**
   * The track [ISRC](https://en.wikipedia.org/wiki/International_Standard_Recording_Code)
   */
  isrc: string | null;

  /**
   * The track source name
   */
  sourceName: string;
}

export interface PlaylistInfo {
  /**
   * The name of the playlist
   */
  name: string;

  /**
   * The selected track of the playlist (`-1` if no track is selected)
   */
  selectedTrack: number;
}

export interface TrackLoadResult {
  loadType: LoadType.Track;
  data: APITrack;
}

export interface APIPlaylist<PluginInfo extends JsonObject = CommonPluginInfo> {
  /**
   * The info of the playlist
   */
  info: PlaylistInfo;

  /**
   * Addition playlist info provided by plugins
   */
  pluginInfo: PluginInfo;

  /**
   * The tracks of the playlist
   */
  tracks: APITrack[];
}

export interface PlaylistLoadResult {
  loadType: LoadType.Playlist;
  data: APIPlaylist;
}

export interface SearchLoadResult {
  loadType: LoadType.Search;
  data: APITrack[];
}

export interface EmptyLoadResult {
  loadType: LoadType.Empty;
  data: EmptyObject;
}

export interface ErrorLoadResult {
  loadType: LoadType.Error;
  data: Exception;
}

export type LoadResult = TrackLoadResult | PlaylistLoadResult | SearchLoadResult | EmptyLoadResult | ErrorLoadResult;

export interface APIPlayer {
  /**
   * The guild id of the player
   */
  guildId: string;

  /**
   * The currently playing track
   */
  track: APITrack | null;

  /**
   * The volume of the player, range 0-1000, in percentage
   */
  volume: number;

  /**
   * Whether the player is paused
   */
  paused: boolean;

  /**
   * The state of the player
   */
  state: PlayerState;

  /**
   * The voice state of the player
   */
  voice: APIVoiceState;

  /**
   * The filters used by the player
   */
  filters: Filters;
}

export interface APIVoiceState {
  /**
   * The Discord voice token to authenticate with
   */
  token: string;

  /**
   * The Discord voice endpoint to connect to
   */
  endpoint: string;

  /**
   * The Discord voice session id to authenticate with
   */
  sessionId: string;

  /**
   * The Discord voice channel id the bot is connecting to
   */
  channelId: string;
}

export interface Filters<PluginFilters extends JsonObject = CommonPluginFilters> {
  /**
   * Adjusts the player volume from 0.0 to 5.0, where 1.0 is 100%. Values >1.0 may cause clipping
   */
  volume?: number;

  /**
   * Adjusts 15 different bands
   */
  equalizer?: EqualizerFilter;

  /**
   * Eliminates part of a band, usually targeting vocals
   */
  karaoke?: KaraokeFilter;

  /**
   * Changes the speed, pitch, and rate
   */
  timescale?: TimescaleFilter;

  /**
   * Creates a shuddering effect, where the volume quickly oscillates
   */
  tremolo?: TremoloFilter;

  /**
   * Creates a shuddering effect, where the pitch quickly oscillates
   */
  vibrato?: VibratoFilter;

  /**
   * Rotates the audio around the stereo channels/user headphones (aka Audio Panning)
   */
  rotation?: RotationFilter;

  /**
   * Distorts the audio
   */
  distortion?: DistortionFilter;

  /**
   * Mixes both channels (left and right)
   */
  channelMix?: ChannelMixFilter;

  /**
   * Filters higher frequencies
   */
  lowPass?: LowPassFilter;

  /**
   * Filter plugin configurations
   */
  pluginFilters?: PluginFilters;
}

/**
 * There are 15 bands (0-14) that can be changed. "gain" is the multiplier for the given band.
 * The default value is 0. Valid values range from -0.25 to 1.0, where -0.25 means the given band is completely muted, and 0.25 means it is doubled.
 * Modifying the gain could also change the volume of the output.
 */
export interface EqualizerBand {
  /**
   * The band (0 to 14)
   */
  band: number;

  /**
   * The gain (-0.25 to 1.0)
   */
  gain: number;
}

export type EqualizerFilter = EqualizerBand[];

/**
 * Uses equalization to eliminate part of a band, usually targeting vocals.
 */
export interface KaraokeFilter {
  /**
   * The level (0 to 1.0 where 0.0 is no effect and 1.0 is full effect)
   */
  level?: number;

  /**
   * The mono level (0 to 1.0 where 0.0 is no effect and 1.0 is full effect)
   */
  monoLevel?: number;

  /**
   * The filter band (in Hz)
   */
  filterBand?: number;

  /**
   * The filter width
   */
  filterWidth?: number;
}

/**
 * Changes the speed, pitch, and rate. All default to 1.0.
 */
export interface TimescaleFilter {
  /**
   * The playback speed 0.0 ≤ x
   */
  speed?: number;

  /**
   * The pitch 0.0 ≤ x
   */
  pitch?: number;

  /**
   * The rate 0.0 ≤ x
   */
  rate?: number;
}

/**
 * Uses amplification to create a shuddering effect, where the volume quickly oscillates.
 * Demo: https://en.wikipedia.org/wiki/File:Fuse_Electronics_Tremolo_MK-III_Quick_Demo.ogv
 */
export interface TremoloFilter {
  /**
   * The frequency 0.0 < x
   */
  frequency?: number;

  /**
   * The tremolo depth 0.0 < x ≤ 1.0
   */
  depth?: number;
}

/**
 * Similar to tremolo. While tremolo oscillates the volume, vibrato oscillates the pitch.
 */
export interface VibratoFilter {
  /**
   * The frequency 0.0 < x ≤ 14.0
   */
  frequency?: number;

  /**
   * The vibrato depth 0.0 < x ≤ 1.0
   */
  depth?: number;
}

/**
 * Rotates the sound around the stereo channels/user headphones (aka Audio Panning).
 * It can produce an effect similar to https://youtu.be/QB9EB8mTKcc (without the reverb).
 */
export interface RotationFilter {
  /**
   * The frequency of the audio rotating around the listener in Hz. 0.2 is similar to the example video above
   */
  rotationHz?: number;
}

/**
 * Distortion effect. It can generate some pretty unique audio effects.
 */
export interface DistortionFilter {
  /**
   * The sin offset
   */
  sinOffset?: number;

  /**
   * The sin scale
   */
  sinScale?: number;

  /**
   * The cos offset
   */
  cosOffset?: number;

  /**
   * The cos scale
   */
  cosScale?: number;

  /**
   * The tan offset
   */
  tanOffset?: number;

  /**
   * The tan scale
   */
  tanScale?: number;

  /**
   * The offset
   */
  offset?: number;

  /**
   * The scale
   */
  scale?: number;
}

/**
 * Mixes both channels (left and right), with a configurable factor on how much each channel affects the other.
 * With the defaults, both channels are kept independent of each other. Setting all factors to 0.5 means both channels get the same audio.
 */
export interface ChannelMixFilter {
  /**
   * The left to left channel mix factor (0.0 ≤ x ≤ 1.0)
   */
  leftToLeft?: number;

  /**
   * The left to right channel mix factor (0.0 ≤ x ≤ 1.0)
   */
  leftToRight?: number;

  /**
   * The right to left channel mix factor (0.0 ≤ x ≤ 1.0)
   */
  rightToLeft?: number;

  /**
   * The right to right channel mix factor (0.0 ≤ x ≤ 1.0)
   */
  rightToRight?: number;
}

/**
 * Higher frequencies get suppressed, while lower frequencies pass through this filter, thus the name low pass.
 * Any smoothing values equal to or less than 1.0 will disable the filter.
 */
export interface LowPassFilter {
  /**
   * The smoothing factor (1.0 < x)
   */
  smoothing?: number;
}

export interface PlayerUpdateQueryParams {
  /**
   * Whether to replace the current track with the new track. Defaults to `false`
   */
  noReplace?: boolean;
}

export interface PlayerUpdateRequestBody {
  /**
   * Specification for a new track to load, as well as user data to set
   */
  track?: PlayerUpdateTrackData;

  /**
   * The track position in milliseconds
   */
  position?: number;

  /**
   * The track end time in milliseconds (must be > 0). `null` resets this if it was set previously
   */
  endTime?: number | null;

  /**
   * The player volume, in percentage, from 0 to 1000
   */
  volume?: number;

  /**
   * Whether the player is paused
   */
  paused?: boolean;

  /**
   * The new filters to apply. This will override all previously applied filters
   */
  filters?: Filters;

  /**
   * Information required for connecting to Discord
   */
  voice?: APIVoiceState;
}

export interface PlayerUpdateTrackData<UserData extends JsonObject = CommonUserData> {
  /**
   * The base64 encoded track to play. `null` stops the current track.
   * `encoded` and `identifier` are mutually exclusive.
   */
  encoded?: string | null;

  /**
   * The identifier of the track to play.
   * `encoded` and `identifier` are mutually exclusive.
   */
  identifier?: string;

  /**
   * Additional track data to be sent back in the [Track Object](https://lavalink.dev/api/rest#track)
   */
  userData?: UserData;
}

export interface SessionUpdateRequestBody {
  /**
   * Whether resuming is enabled for this session or not
   */
  resuming?: boolean;

  /**
   * The timeout in seconds (default is 60s)
   */
  timeout?: number;
}

export type SessionUpdateResponseBody = Required<SessionUpdateRequestBody>;

export interface LavalinkInfo {
  /**
   * The version of this Lavalink server
   */
  version: LavalinkVersion;

  /**
   * The millisecond unix timestamp when this Lavalink jar was built
   */
  buildTime: number;

  /**
   * The git information of this Lavalink server
   */
  git: LavalinkGit;

  /**
   * The JVM version this Lavalink server runs on
   */
  jvm: string;

  /**
   * The Lavaplayer version being used by this server
   */
  lavaplayer: string;

  /**
   * The enabled source managers for this server
   */
  sourceManagers: string[];

  /**
   * The enabled filters for this server
   */
  filters: string[];

  /**
   * The enabled plugins for this server
   */
  plugins: LavalinkPlugin[];
}

export interface LavalinkVersion {
  /**
   * The full version string of this Lavalink server
   */
  semver: string;

  /**
   * The major version of this Lavalink server
   */
  major: number;

  /**
   * The minor version of this Lavalink server
   */
  minor: number;

  /**
   * The patch version of this Lavalink server
   */
  patch: number;

  /**
   * The pre-release version according to semver as a `.` separated list of identifiers
   */
  preRelease: string | null;

  /**
   * The build metadata according to semver as a `.` separated list of identifiers
   */
  build: string | null;
}

export interface LavalinkGit {
  /**
   * The branch this Lavalink server was built on
   */
  branch: string;

  /**
   * The commit this Lavalink server was built on
   */
  commit: string;

  /**
   * The millisecond unix timestamp for when the commit was created
   */
  commitTime: number;
}

export interface LavalinkPlugin {
  /**
   * The name of the plugin
   */
  name: string;

  /**
   * The version of the plugin
   */
  version: string;
}

export interface IPBlock {
  /**
   * The type of the ip block
   */
  type: IPBlockType;

  /**
   * The size of the ip block
   */
  size: string;
}

export interface FailingAddress {
  /**
   * The failing address
   */
  failingAddress: string;

  /**
   * The timestamp when the address failed
   */
  failingTimestamp: number;

  /**
   * The timestamp when the address failed as a pretty string
   */
  failingTime: string;
}

export interface BaseRoutePlannerDetails {
  /**
   * The ip block being used
   */
  ipBlock: IPBlock;

  /**
   * The failing addresses
   */
  failingAddresses: FailingAddress[];
}

export interface RotatingRoutePlannerDetails extends BaseRoutePlannerDetails {
  /**
   * The number of rotations
   */
  rotateIndex: string;

  /**
   * The current offset in the block
   */
  ipIndex: string;

  /**
   * The current address being used
   */
  currentAddress: string;
}

export interface NanoRoutePlannerDetails extends BaseRoutePlannerDetails {
  /**
   * The current offset in the ip block
   */
  currentAddressIndex: string;
}

export interface RotatingNanoRoutePlannerDetails extends BaseRoutePlannerDetails {
  /**
   * The current offset in the ip block
   */
  currentAddressIndex: string;

  /**
   * The information in which /64 block ips are chosen. This number increases on each ban.
   */
  blockIndex: string;
}

export interface BalancingRoutePlannerDetails extends BaseRoutePlannerDetails {}

export interface RotatingRoutePlannerStatus {
  class: RoutePlannerType.Rotating;
  details: RotatingRoutePlannerDetails;
}

export interface NanoRoutePlannerStatus {
  class: RoutePlannerType.Nano;
  details: NanoRoutePlannerDetails;
}

export interface RotatingNanoRoutePlannerStatus {
  class: RoutePlannerType.RotatingNano;
  details: RotatingNanoRoutePlannerDetails;
}

export interface BalancingRoutePlannerStatus {
  class: RoutePlannerType.Balancing;
  details: BalancingRoutePlannerDetails;
}

export interface NullishRoutePlannerStatus {
  class: null;
  details: null;
}

export type RoutePlannerStatus =
  | RotatingRoutePlannerStatus
  | NanoRoutePlannerStatus
  | RotatingNanoRoutePlannerStatus
  | BalancingRoutePlannerStatus
  | NullishRoutePlannerStatus;
