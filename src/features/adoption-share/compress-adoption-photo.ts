import { dataUrlBytes, fittedSize, loadImage, readAsDataUrl } from "../images/image-data";

const ADOPTION_PHOTO_MAX_SIDE = 1280;
const ADOPTION_PHOTO_TARGET_BYTES = 200 * 1024;
const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.52];

// A new adoption photo made light enough for chats to show it in a link preview: at most 1280 px on its longest side, as
// JPEG on white, lowering the quality until it fits about 200 KB. When the browser cannot redraw it, or the result is not
// smaller, the original stays.
export async function compressAdoptionPhoto(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const image = await loadImage(original);
    const size = fittedSize(image.naturalWidth, image.naturalHeight, ADOPTION_PHOTO_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context || !size.width || !size.height) return original;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    let best = original;
    for (const quality of JPEG_QUALITIES) {
      const candidate = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(candidate) < dataUrlBytes(best)) best = candidate;
      if (dataUrlBytes(candidate) <= ADOPTION_PHOTO_TARGET_BYTES) break;
    }
    return best;
  } catch {
    return original;
  }
}
