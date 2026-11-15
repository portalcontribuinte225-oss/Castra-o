export const TRACKING_TOKEN_SECONDS = 1800;
export const TRACKING_CODE_PATTERN = /^\d{6}$/;

const PROTOCOL_PATTERN = /^(\d{1,9})\/(\d{4})$/;

// The canonical protocol is the one the server prints ("000123/2026"); anything else cannot identify a request.
export function normalizeTrackingProtocol(value) {
  const match = PROTOCOL_PATTERN.exec(typeof value === "string" ? value.trim().replace(/^#/, "") : "");
  return match ? `${String(Number.parseInt(match[1], 10)).padStart(6, "0")}/${match[2]}` : null;
}
