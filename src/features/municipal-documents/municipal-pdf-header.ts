import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import { municipalPdfText } from "./municipal-pdf";
import type { MunicipalPdfContext } from "./municipal-pdf";

// One cell of the band under the name of the municipality: the protocol, the date of issue, the number of the document...
export interface HeaderBandItem {
  label: string;
  value: string;
}

const IMAGES_TOP = 26;
const IMAGE_BOX = 70;
const BAND_TOP = 70;
const BAND_HEIGHT = 28;
const RULE_TOP = 112;
const FOOTER_BASELINE = 20;
const MIN_TEXT_SIZE = 6;
// Where the text of a page may go down to, above the footer.
export const CONTENT_BOTTOM = 44;

interface TextStyle {
  font: PDFFont;
  size: number;
  color: RGB;
  spacing?: number;
}

function textWidth(text: string, { font, size, spacing = 0 }: TextStyle): number {
  return font.widthOfTextAtSize(text, size) + spacing * Math.max(text.length - 1, 0);
}

// Draws the text centered in the given width, smaller when it would not fit.
function drawCentered(ctx: MunicipalPdfContext, page: PDFPage, value: string, x: number, width: number, y: number, style: TextStyle) {
  const text = municipalPdfText(value);
  if (!text) return;
  const fitted = { ...style };
  while (fitted.size > MIN_TEXT_SIZE && textWidth(text, fitted) > width) fitted.size -= 0.25;
  if (fitted.spacing) page.pushOperators(ctx.lib.setCharacterSpacing(fitted.spacing));
  page.drawText(text, { x: x + (width - textWidth(text, fitted)) / 2, y, size: fitted.size, font: fitted.font, color: fitted.color });
  if (fitted.spacing) page.pushOperators(ctx.lib.setCharacterSpacing(0));
}

function drawImage(page: PDFPage, image: PDFImage | null, x: number, top: number) {
  if (!image) return;
  const { width, height } = image.scaleToFit(IMAGE_BOX, IMAGE_BOX);
  page.drawImage(image, { x: x + (IMAGE_BOX - width) / 2, y: top - IMAGE_BOX + (IMAGE_BOX - height) / 2, width, height });
}

// A new page with the header of the municipality and the footer of the system; `y` is where the content starts.
export function addMunicipalPdfPage(ctx: MunicipalPdfContext, band: HeaderBandItem[]): { page: PDFPage; y: number } {
  const { pdf, pageSize, margin, width, colors, font, bold, identity } = ctx;
  const page = pdf.addPage(pageSize);
  const top = pageSize[1];
  drawImage(page, ctx.crest, margin + 4, top - IMAGES_TOP);
  drawImage(page, ctx.logo, margin + width - IMAGE_BOX - 4, top - IMAGES_TOP);

  const centerX = margin + IMAGE_BOX + 22;
  const centerWidth = width - 2 * (IMAGE_BOX + 22);
  drawCentered(ctx, page, identity.state, centerX, centerWidth, top - 36, { font: bold, size: 6.8, color: colors.muted, spacing: 1.4 });
  drawCentered(ctx, page, identity.prefeitura, centerX, centerWidth, top - 51, { font: bold, size: 12.5, color: colors.dark });
  drawCentered(ctx, page, identity.department, centerX, centerWidth, top - 63, { font: bold, size: 8.5, color: colors.dark });

  const bandTop = top - BAND_TOP;
  page.drawRectangle({ x: centerX, y: bandTop - BAND_HEIGHT, width: centerWidth, height: BAND_HEIGHT, color: colors.tint });
  const cell = centerWidth / Math.max(band.length, 1);
  band.forEach(({ label, value }, index) => {
    const x = centerX + index * cell;
    if (index) page.drawLine({ start: { x, y: bandTop - 5 }, end: { x, y: bandTop - BAND_HEIGHT + 5 }, thickness: 0.6, color: colors.line });
    drawCentered(ctx, page, label, x + 4, cell - 8, bandTop - 10.5, { font: bold, size: 6, color: colors.accent, spacing: 0.6 });
    drawCentered(ctx, page, value || "—", x + 4, cell - 8, bandTop - 22, { font: bold, size: 9.5, color: colors.dark });
  });
  page.drawLine({ start: { x: margin, y: top - RULE_TOP }, end: { x: margin + width, y: top - RULE_TOP }, thickness: 2, color: colors.accent });

  const footerLabel = "PROTEÇÃO ANIMAL";
  page.drawText(footerLabel, { x: margin, y: FOOTER_BASELINE, size: 7, font: bold, color: colors.accent });
  page.drawText("  |  Emissão eletrônica do sistema", { x: margin + bold.widthOfTextAtSize(footerLabel, 7), y: FOOTER_BASELINE, size: 7, font, color: colors.muted });
  return { page, y: top - RULE_TOP - 26 };
}
