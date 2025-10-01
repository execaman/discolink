/**
 * Formats duration as a string
 * @param ms Duration in milliseconds
 * @returns formatted duration as `hh:mm:ss` or `mm:ss` if less than an hour
 */
export function formatDuration(ms: number) {
  ms = Math.floor(ms);
  if (ms <= 0 || !Number.isFinite(ms)) return "00:00";
  const ss = Math.floor(ms / 1000) % 60;
  const mm = Math.floor(ms / (60 * 1000)) % 60;
  const hh = Math.floor(ms / (60 * 60 * 1000));
  const mm_ss = `${mm < 10 ? `0${mm}` : mm}:${ss < 10 ? `0${ss}` : ss}`;
  if (hh === 0) return mm_ss;
  return `${hh < 10 ? `0${hh}` : hh}:${mm_ss}`;
}
