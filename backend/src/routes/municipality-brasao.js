import { createHash } from "node:crypto";
import { Router } from "express";
import { loadMunicipalityBrasao } from "../repositories/municipality-identity.js";
import { isUuid } from "../repositories/request-tracking.js";

const MAX_BRASAO_BYTES = 2 * 1024 * 1024;
// Only raster images are served: an SVG could carry script and would run on this origin.
const RASTER_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;

const router = Router();

// Public on purpose: a mail client fetches it without a session. It exposes only the image, which the public
// municipality list already carries. Every invalid case answers the same 404, so nothing tells why.
router.get("/:id/brasao", async (req, res) => {
  const notFound = () => res.status(404).json({ error: "Brasão indisponível." });
  if (!isUuid(req.params.id)) return notFound();
  try {
    const row = await loadMunicipalityBrasao(req.params.id);
    const stored = typeof row?.brasao === "string" ? row.brasao : "";
    if (!stored || stored.length > Math.ceil(MAX_BRASAO_BYTES * 4 / 3) + 64) return notFound();
    const match = RASTER_DATA_URL.exec(stored);
    if (!match) return notFound();
    const image = Buffer.from(match[2], "base64");
    if (!image.length || image.length > MAX_BRASAO_BYTES) return notFound();
    const etag = `"${createHash("sha1").update(image).digest("hex")}"`;
    res.set({ ETag: etag, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.set("Content-Type", `image/${match[1]}`);
    return res.send(image);
  } catch {
    return notFound();
  }
});

export default router;
