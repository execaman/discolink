/**
 * Matches a numerical string of 17-20 characters
 */
export const SnowflakeRegex = /^\d{17,20}$/;

/**
 * Matches a substring preceding discord's voice server domain
 */
export const VoiceRegionIdRegex = /^([-a-z]{2,20})(?=[-a-z\d]*\.discord\.media:\d+$)/;
