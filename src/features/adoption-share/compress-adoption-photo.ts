export const ADOPTION_PHOTO_MAX_SIDE = 1280;
export const ADOPTION_PHOTO_TARGET_BYTES = 200 * 1024;
const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.52];

// The size a photo is redrawn at so its longest side fits the limit, keeping its proportions; a smaller photo keeps its size.
export function fittedSize(width: number, height: number, maxSide = ADOPTION_PHOTO_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!longest || longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// The bytes a base64 data URL decodes to.
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = comma === -1 ? "" : dataUrl.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Imagem ilegível."));
    image.src = source;
  });
}

// A new adoption photo made light enough for chats to show it in a link preview: at most 1280 px on its longest side, as
// JPEG on white, lowering the quality until it fits about 200 KB. When the browser cannot redraw it, or the result is not
// smaller, the original stays.
export async function compressAdoptionPhoto(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const image = await loadImage(original);
    const size = fittedSize(image.naturalWidth, image.naturalHeight);
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
