import { Router } from "express";
import { ADOPTION_SHARE_PREFIX } from "../../../shared/adoption-contract.js";
import { loadPublicAdoption } from "../repositories/adoption-share.js";
import { isUuid } from "../repositories/request-tracking.js";
import { publicAdoption } from "../services/adoption-public-view.js";
import { injectSharePreview, mainRasterPhotoOf, readIndexHtml, requestBaseUrl, sharePreview } from "../services/adoption-share.js";
import { sendCachedImage } from "../services/raster-image.js";

async function findAdoption(id) {
  if (!isUuid(id)) return null;
  try {
    return await loadPublicAdoption(id);
  } catch {
    return null;
  }
}

// The shared link of an animal for adoption. Public on purpose: a chat app fetches the page and the photo without a
// session, and both carry only what the public adoption list already shows. Every invalid case of the data and the photo
// answers the same 404.
export function createAdoptionShareRouter({ indexHtmlPath }) {
  const router = Router();

  router.get(`${ADOPTION_SHARE_PREFIX}:id`, async (req, res, next) => {
    try {
      const adoption = await findAdoption(req.params.id);
      const html = injectSharePreview(await readIndexHtml(indexHtmlPath), sharePreview(adoption, requestBaseUrl(req)));
      res.set("Cache-Control", "no-store, no-cache, must-revalidate").type("html").send(html);
    } catch {
      next();
    }
  });

  router.get("/api/adoptions/:id/public", async (req, res) => {
    const adoption = await findAdoption(req.params.id);
    if (!adoption) return res.status(404).json({ error: "Animal indisponível." });
    return res.json(publicAdoption(adoption));
  });

  router.get("/api/adoptions/:id/photo", async (req, res) => {
    const image = mainRasterPhotoOf(await findAdoption(req.params.id));
    if (!image) return res.status(404).json({ error: "Foto indisponível." });
    return sendCachedImage(req, res, image);
  });

  return router;
}
