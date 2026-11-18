import { dataUrlBytes, fittedSize, loadImage, readAsDataUrl } from "../adoption-share/compress-adoption-photo";

export const MUNICIPALITY_IMAGE_MAX_SIDE = 512;
// Its public link serves nothing bigger, so a larger image would never reach the e-mails.
export const MUNICIPALITY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
// The types the public link of an image serves; the file picker offers only these.
export const MUNICIPALITY_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MUNICIPALITY_IMAGE_ERROR = "Envie uma imagem PNG, JPG ou WEBP de até 2 MB.";

// An image larger than 512 px on its longest side is redrawn at that size as PNG, so a transparent background stays. A smaller
// image, or one the browser cannot redraw, stays as it is.
async function fitImage(dataUrl: string): Promise<string> {
  try {
    const image = await loadImage(dataUrl);
    if (Math.max(image.naturalWidth, image.naturalHeight) <= MUNICIPALITY_IMAGE_MAX_SIDE) return dataUrl;
    const size = fittedSize(image.naturalWidth, image.naturalHeight, MUNICIPALITY_IMAGE_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, size.width, size.height);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

// A brasão or a logo ready to save, as a data URL: PNG, JPG or WEBP, fitted into 512 px and at most 2 MB. Anything else is
// refused with the message the form shows.
export async function prepareMunicipalityImage(file: File): Promise<string> {
  if (!MUNICIPALITY_IMAGE_TYPES.includes(file.type)) throw new Error(MUNICIPALITY_IMAGE_ERROR);
  const image = await fitImage(await readAsDataUrl(file));
  if (dataUrlBytes(image) > MUNICIPALITY_IMAGE_MAX_BYTES) throw new Error(MUNICIPALITY_IMAGE_ERROR);
  return image;
}
