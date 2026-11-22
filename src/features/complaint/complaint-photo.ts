import {
  COMPLAINT_PHOTO_MAX_MB,
  COMPLAINT_PHOTO_MIME_TYPES,
} from "../../../shared/complaint-photo-contract.js";
import { readFileAsDataUrl } from "../../utils";
import { fittedSize, loadImage } from "../images/image-data";

const MAX_BYTES = COMPLAINT_PHOTO_MAX_MB * 1024 * 1024;
const MAX_SIDE = 2560;
const JPEG_QUALITIES = [0.9, 0.82, 0.74, 0.66];
const JPEG = "image/jpeg";
const PNG = "image/png";
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export interface ComplaintPhoto {
  documentId: string;
  fileName: string;
  fileType: string;
  dataUrl: string;
}

async function jpegWithinLimit(image: HTMLImageElement): Promise<Blob> {
  const { width, height } = fittedSize(image.naturalWidth, image.naturalHeight, MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context || !width || !height) throw new Error("Não foi possível preparar a foto.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  for (const quality of JPEG_QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, JPEG, quality));
    if (blob?.type === JPEG && blob.size > 0 && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error(`A foto ultrapassa ${COMPLAINT_PHOTO_MAX_MB} MB. Escolha uma imagem menor.`);
}

async function originalPhotoType(file: File): Promise<string> {
  const signature = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  if (signature[0] === 255 && signature[1] === 216 && signature[2] === 255) return JPEG;
  if (PNG_SIGNATURE.every((byte, index) => byte === signature[index])) return PNG;
  return "";
}

export async function prepareComplaintPhoto(file: File, documentId: string): Promise<ComplaintPhoto> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const originalType = await originalPhotoType(file);
    const prepared = file.size <= MAX_BYTES && COMPLAINT_PHOTO_MIME_TYPES.some((type) => type === originalType)
      ? file.slice(0, file.size, originalType)
      : await jpegWithinLimit(image);
    const dataUrl = await readFileAsDataUrl(prepared);
    if (!dataUrl) throw new Error("Não foi possível ler a foto selecionada.");
    const fileName = file.name.replace(/\.[^.]+$/, "") || "foto-da-ocorrencia";
    const extension = prepared.type === PNG ? "png" : "jpg";
    return { documentId, fileName: `${fileName}.${extension}`, fileType: prepared.type, dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}
