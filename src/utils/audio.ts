/**
 * Audio utility functions for MIME type detection and duration formatting.
 */

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/**
 * Detect the best supported audio MIME type at runtime.
 * Returns the first supported type from the preference list,
 * or empty string if none are supported (browser will use its default).
 */
export function getPreferredMimeType(): string {
  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return "";
}

/**
 * Map an audio MIME type to a storage-path file extension.
 * Strips any ;codecs=... suffix first. NEVER hardcode '.opus' — the
 * container (webm/mp4/ogg) is what matters for playback, not the codec.
 */
export function extFromMime(mime: string): string {
  const base = mime.split(";")[0].trim();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
      return "mp4";
    case "audio/ogg":
      return "ogg";
    default:
      return "webm";
  }
}

/**
 * Format milliseconds to "M:SS" display string.
 * Minutes are not zero-padded; seconds are always two digits.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
