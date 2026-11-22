import type { PDFDocument, PDFFont, PDFImage } from "pdf-lib";
import type { AnyRecord } from "../../types";
import { dataUrlToUint8Array } from "../../utils";
import { loadImage } from "../images/image-data";
import { stateHeading } from "./brazilian-states";

// The look of every document the municipality issues, taken from its models.
const THEME = Object.freeze({
  ink: "#203347",
  dark: "#143346",
  accent: "#0B6E73",
  muted: "#617687",
  tint: "#F1F7F7",
  line: "#D8E9EC",
  white: "#FFFFFF",
});

const A4_PAGE_SIZE: [number, number] = [595.28, 841.89];
const PAGE_MARGIN = 48;
const DOCUMENT_TIME_ZONE = "America/Sao_Paulo";
const RASTER_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,/i;
const IMAGE_MAX_SIDE = 512;

export function importPdfLib(): Promise<typeof import("pdf-lib")> {
  return import("pdf-lib").catch((error) => {
    // A page left open during a deploy may still point to the previous PDF chunk.
    if (typeof window !== "undefined" && /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(String(error?.message || ""))) {
      window.location.reload();
    }
    throw error;
  });
}

// The standard PDF fonts write only Latin-1 and a few punctuation marks; anything else becomes a space.
export function municipalPdfText(value: unknown): string {
  return String(value ?? "").normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[‐‑]/g, "-")
    .replace(/[^\x20-\x7E -ÿ–—‘’‚“”„•…\n]/g, " ");
}

function documentMoment(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime()) ? date : null;
}

// "19/11/2026", or "19 de novembro de 2026" when long; empty when the value is not a date.
export function municipalDocumentDate(value: unknown, long = false): string {
  const date = documentMoment(value);
  return date ? new Intl.DateTimeFormat("pt-BR", { timeZone: DOCUMENT_TIME_ZONE, dateStyle: long ? "long" : "short" }).format(date) : "";
}

// "19/11/2026 · 20:31:12"
export function municipalDocumentStamp(value: unknown): string {
  const date = documentMoment(value);
  if (!date) return "";
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: DOCUMENT_TIME_ZONE, timeStyle: "medium" }).format(date);
  return `${municipalDocumentDate(value)} · ${time}`;
}

// The name of the downloaded file: the slash of a number would cut the name, so it becomes a dash.
export function documentFileName(title: string, number = ""): string {
  return `${[title, number.trim().replace(/\//g, "-")].filter(Boolean).join(" ")}.pdf`;
}

export function wrapMunicipalPdfText(value: unknown, font: PDFFont, size: number, width: number): string[] {
  const fits = (text: string) => font.widthOfTextAtSize(text, size) <= width;
  return municipalPdfText(value).split("\n").flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const joined = line ? `${line} ${word}` : word;
      if (fits(joined)) {
        line = joined;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      if (fits(word)) {
        line = word;
        continue;
      }
      for (const letter of word) {
        if (line && !fits(line + letter)) {
          lines.push(line);
          line = "";
        }
        line += letter;
      }
    }
    return [...lines, line];
  });
}

// The brasão and the logo of the municipality are PNG, JPG or WEBP; a WEBP is redrawn as PNG, which only a browser can do.
async function embedMunicipalImage(pdf: PDFDocument, dataUrl: unknown): Promise<PDFImage | null> {
  if (typeof dataUrl !== "string") return null;
  const type = RASTER_DATA_URL.exec(dataUrl)?.[1]?.toLowerCase();
  try {
    if (type === "png") return await pdf.embedPng(dataUrlToUint8Array(dataUrl));
    if (type === "jpeg" || type === "jpg") return await pdf.embedJpg(dataUrlToUint8Array(dataUrl));
    if (type !== "webp" || typeof document === "undefined") return null;
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await pdf.embedPng(dataUrlToUint8Array(canvas.toDataURL("image/png")));
  } catch {
    return null;
  }
}

// What every page of a document of the municipality needs: the fonts, its brasão and logo, the lines of its header and the colors.
export async function createMunicipalPdfContext(pdf: PDFDocument, municipality: AnyRecord | null = null) {
  const lib = await importPdfLib();
  const color = (hex: string) => lib.rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  );
  const [font, bold, crest, logo] = await Promise.all([
    pdf.embedFont(lib.StandardFonts.Helvetica),
    pdf.embedFont(lib.StandardFonts.HelveticaBold),
    embedMunicipalImage(pdf, municipality?.brasao),
    embedMunicipalImage(pdf, municipality?.department_logo || municipality?.departmentLogo),
  ]);
  const name = String(municipality?.name || "").trim();
  const state = String(municipality?.state || "").trim();
  return {
    lib, pdf, font, bold, crest, logo,
    identity: {
      state: stateHeading(state).toLocaleUpperCase("pt-BR"),
      prefeitura: name ? `PREFEITURA MUNICIPAL DE ${name.toLocaleUpperCase("pt-BR")}` : "",
      department: String(municipality?.department_name || municipality?.departmentName || "").trim(),
      // "Içara/SC", where a document is signed.
      place: [name, state].filter(Boolean).join("/"),
    },
    colors: Object.fromEntries(Object.entries(THEME).map(([key, hex]) => [key, color(hex)])) as Record<keyof typeof THEME, ReturnType<typeof color>>,
    margin: PAGE_MARGIN,
    width: A4_PAGE_SIZE[0] - 2 * PAGE_MARGIN,
    pageSize: A4_PAGE_SIZE,
  };
}

export type MunicipalPdfContext = Awaited<ReturnType<typeof createMunicipalPdfContext>>;
