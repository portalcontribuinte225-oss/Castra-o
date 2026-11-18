import { Router } from "express";
import { loadMunicipalityBrasao } from "../repositories/municipality-identity.js";
import { isUuid } from "../repositories/request-tracking.js";
import { decodeRasterDataUrl, sendCachedImage } from "../services/raster-image.js";

const MAX_BRASAO_BYTES = 2 * 1024 * 1024;

const router = Router();

// Public on purpose: a mail client fetches it without a session. It exposes only the image, which the public
// municipality list already carries. Every invalid case answers the same 404, so nothing tells why.
router.get("/:id/brasao", async (req, res) => {
  const notFound = () => res.status(404).json({ error: "Brasão indisponível." });
  if (!isUuid(req.params.id)) return notFound();
  try {
    const row = await loadMunicipalityBrasao(req.params.id);
    const image = decodeRasterDataUrl(row?.brasao, MAX_BRASAO_BYTES);
    return image ? sendCachedImage(req, res, image) : notFound();
  } catch {
    return notFound();
  }
});

export default router;
