/**
 * Do nothing, return nothing
 */
export const noop = () => {};

/**
 * Format duration as a string
 * @param ms Duration in milliseconds
 * @returns `hh:mm:ss`, `mm:ss`, or `00:00` (default)
 */
export const formatDuration = (ms: number) => {
  if (!Number.isSafeInteger(ms) || ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const ss = `${s % 60}`.padStart(2, "0");
  const mm = `${Math.floor(s / 60) % 60}`.padStart(2, "0");
  if (s <= 3600) return (s === 3600 ? "01:" : "") + mm + ":" + ss;
  return `${Math.floor(s / 3600)}`.padStart(2, "0") + ":" + mm + ":" + ss;
};
