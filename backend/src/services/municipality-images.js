import { decodeRasterDataUrl } from "./raster-image.js";

// The largest image a municipality keeps: its public link serves nothing bigger.
export const MAX_MUNICIPALITY_IMAGE_BYTES = 2 * 1024 * 1024;

// The images of a municipality: the column that holds each one, the name the form sends, the path of its public link and how a
// message names it. The identity answers whether each exists as `has_<column>`.
export const MunicipalityImage = Object.freeze({
  BRASAO: Object.freeze({ column: "brasao", formName: "brasao", path: "brasao", label: "o brasão" }),
  DEPARTMENT_LOGO: Object.freeze({ column: "department_logo", formName: "departmentLogo", path: "department-logo", label: "o logo do órgão" }),
});

const images = Object.values(MunicipalityImage);

export const hasMunicipalityImage = (identity, image) => Boolean(identity?.[`has_${image.column}`]);

// The images the body carries (by column or by form name): each one empty, to remove it, or a raster data URL of at most 2 MB, the
// only kind its public link serves. Images the body does not carry are not in the answer, so a PATCH touches only what was sent.
// Throws a 400 for an image that could not be shown.
export function readMunicipalityImages(body = {}) {
  const fields = {};
  for (const image of images) {
    const sent = body[image.column] !== undefined ? body[image.column] : body[image.formName];
    if (sent === undefined) continue;
    const value = String(sent ?? "").trim();
    if (value && !decodeRasterDataUrl(value, MAX_MUNICIPALITY_IMAGE_BYTES)) {
      throw Object.assign(new Error(`Não foi possível usar ${image.label}. Envie uma imagem PNG, JPG ou WEBP de até 2 MB.`), { status: 400 });
    }
    fields[image.column] = value;
  }
  return fields;
}

// The public link of an image the municipality keeps. It carries the last update, so a changed image is not served from a stale
// cache. Empty without the image or without the public address of the system.
export function municipalityImageUrl(identity, image, publicUrl) {
  if (!hasMunicipalityImage(identity, image) || !publicUrl) return "";
  const version = new Date(identity.updated_at).getTime();
  return `${publicUrl}/api/public/municipalities/${identity.id}/${image.path}${Number.isFinite(version) ? `?v=${version}` : ""}`;
}
