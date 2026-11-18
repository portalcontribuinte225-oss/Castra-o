import { Router } from "express";
import { loadMunicipalityImage } from "../repositories/municipality-identity.js";
import { isUuid } from "../repositories/request-tracking.js";
import { MAX_MUNICIPALITY_IMAGE_BYTES, MunicipalityImage } from "../services/municipality-images.js";
import { decodeRasterDataUrl, sendCachedImage } from "../services/raster-image.js";

const router = Router();

// Public on purpose: a mail client fetches them without a session. Each link exposes only its image, which the public municipality
// list already carries. Every invalid case answers the same 404, so nothing tells why.
for (const image of Object.values(MunicipalityImage)) {
  router.get(`/:id/${image.path}`, async (req, res) => {
    const notFound = () => res.status(404).json({ error: "Imagem indisponível." });
    if (!isUuid(req.params.id)) return notFound();
    try {
      const decoded = decodeRasterDataUrl(await loadMunicipalityImage(req.params.id, image.column), MAX_MUNICIPALITY_IMAGE_BYTES);
      return decoded ? sendCachedImage(req, res, decoded) : notFound();
    } catch {
      return notFound();
    }
  });
}

export default router;
