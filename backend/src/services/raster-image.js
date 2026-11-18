import { createHash } from "node:crypto";

// Only raster images are served: an SVG could carry script and would run on this origin.
const RASTER_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;

// The bytes and type of an image stored as a data URL, when it is a raster image no larger than the limit; null otherwise.
export function decodeRasterDataUrl(value, maxBytes) {
  if (typeof value !== "string" || !value || value.length > Math.ceil(maxBytes * 4 / 3) + 64) return null;
  const match = RASTER_DATA_URL.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > maxBytes) return null;
  return { type: `image/${match[1]}`, bytes };
}

// Sends a public image with a validator and a day of cache, answering 304 when the client already holds it.
export function sendCachedImage(req, res, image) {
  const etag = `"${createHash("sha1").update(image.bytes).digest("hex")}"`;
  res.set({ ETag: etag, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.set("Content-Type", image.type);
  return res.send(image.bytes);
}
