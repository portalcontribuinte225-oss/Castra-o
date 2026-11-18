import { readFile, stat } from "node:fs/promises";
import { AdoptionStatus, MAX_ADOPTION_PHOTO_BYTES, adoptionSharePath } from "../../../shared/adoption-contract.js";
import { decodeRasterDataUrl } from "./raster-image.js";

const APP_ICON_PATH = "/pwa-icon-512.png";
const DESCRIPTION_LIMIT = 150;
const GENERIC_PREVIEW = {
  title: "Animais para adoção",
  description: "Conheça os animais que estão esperando por um lar no seu município.",
};

// The photo an animal shows first: the one marked as main, the first of the list or the single old photo.
export function mainPhotoOf(adoption) {
  const source = adoption || {};
  const photos = Array.isArray(source.photos) ? source.photos.filter(Boolean) : [];
  const index = Number.isInteger(source.main_photo_index) ? source.main_photo_index : 0;
  return photos[index] || photos[0] || source.photo_url || "";
}

export function mainRasterPhotoOf(adoption) {
  return decodeRasterDataUrl(mainPhotoOf(adoption), MAX_ADOPTION_PHOTO_BYTES);
}

// The address the request came to, so the preview links back to the same site; behind the host's proxy the scheme comes
// from X-Forwarded-Proto.
export function requestBaseUrl(req) {
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwarded === "https" || forwarded === "http" ? forwarded : req.protocol;
  const host = String(req.get("host") || "");
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? `${protocol}://${host}` : "";
}

function shorten(text, limit) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

// What a shared link shows in a chat: the animal's name, a short summary and its photo; an adopted animal says it found a
// family; without an animal, the adoption page in general.
export function sharePreview(adoption, baseUrl) {
  const icon = `${baseUrl}${APP_ICON_PATH}`;
  if (!adoption) return { ...GENERIC_PREVIEW, image: icon, url: `${baseUrl}/` };
  const name = String(adoption.animal_name || "").trim() || "Este animal";
  const url = `${baseUrl}${adoptionSharePath(adoption.id)}`;
  const image = mainRasterPhotoOf(adoption) ? `${baseUrl}/api/adoptions/${adoption.id}/photo` : icon;
  if (adoption.status === AdoptionStatus.ADOPTED) {
    return { title: `${name} já encontrou uma família`, description: "Conheça outros animais que estão esperando por um lar.", image, url };
  }
  const species = String(adoption.species || "").trim();
  const traits = [adoption.age, adoption.sex].map((value) => String(value || "").trim()).filter(Boolean).join(", ");
  return {
    title: species ? `${name} · ${species} para adoção` : `${name} para adoção`,
    description: shorten([traits, adoption.description].filter(Boolean).join(". "), DESCRIPTION_LIMIT) || GENERIC_PREVIEW.description,
    image,
    url,
  };
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

// The app's page with the preview of a shared link: its title and description replaced and the tags chats read added;
// every value is escaped, since the animal's texts are typed by people.
export function injectSharePreview(indexHtml, preview) {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const tags = [
    ["og:type", "website"],
    ["og:title", preview.title],
    ["og:description", preview.description],
    ["og:image", preview.image],
    ["og:url", preview.url],
  ].map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`);
  tags.push('<meta name="twitter:card" content="summary_large_image" />');
  return indexHtml
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${title}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, () => `<meta name="description" content="${description}" />`)
    .replace(/<\/head>/i, () => `  ${tags.join("\n    ")}\n  </head>`);
}

let cachedPage = { path: "", modified: 0, html: "" };

// The built page of the app, read again only when the build changes it.
export async function readIndexHtml(path) {
  const { mtimeMs } = await stat(path);
  if (cachedPage.path !== path || cachedPage.modified !== mtimeMs) cachedPage = { path, modified: mtimeMs, html: await readFile(path, "utf8") };
  return cachedPage.html;
}
