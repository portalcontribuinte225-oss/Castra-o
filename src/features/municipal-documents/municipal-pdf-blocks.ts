import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { municipalPdfText, wrapMunicipalPdfText } from "./municipal-pdf";
import type { MunicipalPdfContext } from "./municipal-pdf";
import { CONTENT_BOTTOM, addMunicipalPdfPage } from "./municipal-pdf-header";
import type { HeaderBandItem } from "./municipal-pdf-header";

// Where the writing of a document is: its page and how far down it went. A block that does not fit opens a new page with the header.
export interface MunicipalPdfFlow {
  ctx: MunicipalPdfContext;
  band: HeaderBandItem[];
  page: PDFPage;
  y: number;
}

export interface PdfField {
  label: string;
  value?: unknown;
  // An http(s) address the value opens when clicked.
  link?: string;
}

interface FieldRowOptions {
  weights?: number[];
  valueSize?: number;
  tinted?: boolean;
  rule?: boolean;
}

export interface FieldSection {
  title: string;
  rows: PdfField[][];
}

const LABEL_SIZE = 6.5;
const FIELD_INSET = 10;

export function startMunicipalPdfFlow(ctx: MunicipalPdfContext, band: HeaderBandItem[]): MunicipalPdfFlow {
  return { ctx, band, ...addMunicipalPdfPage(ctx, band) };
}

export function newMunicipalPdfPage(flow: MunicipalPdfFlow) {
  Object.assign(flow, addMunicipalPdfPage(flow.ctx, flow.band));
}

export function ensureRoom(flow: MunicipalPdfFlow, height: number) {
  if (flow.y - height < CONTENT_BOTTOM) newMunicipalPdfPage(flow);
}

function drawCenteredText(flow: MunicipalPdfFlow, value: unknown, y: number, font: PDFFont, size: number, color: RGB) {
  const text = municipalPdfText(value);
  flow.page.drawText(text, { x: flow.ctx.margin + (flow.ctx.width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
}

export function drawDocumentTitle(flow: MunicipalPdfFlow, title: string, size = 22) {
  const { ctx } = flow;
  const text = municipalPdfText(title);
  let fitted = size;
  while (fitted > 12 && ctx.bold.widthOfTextAtSize(text, fitted) > ctx.width) fitted -= 0.5;
  ensureRoom(flow, fitted + 20);
  drawCenteredText(flow, text, flow.y - fitted, ctx.bold, fitted, ctx.colors.dark);
  flow.y -= fitted + 22;
}

// "01  INFORMAÇÕES DO ATENDIMENTO", kept on the same page as the first lines that follow it.
export function drawSectionHeading(flow: MunicipalPdfFlow, number: string, title: string) {
  ensureRoom(flow, 70);
  const { page, ctx } = flow;
  page.drawText(number, { x: ctx.margin, y: flow.y - 10, size: 8, font: ctx.bold, color: ctx.colors.accent });
  page.drawText(municipalPdfText(title), { x: ctx.margin + 16, y: flow.y - 10, size: 10.5, font: ctx.bold, color: ctx.colors.dark });
  flow.y -= 22;
}

// A small heading in the accent color: "01 / CUIDADOS E AUTORIZAÇÃO", "ORIENTAÇÕES PARA O DIA DO ATENDIMENTO".
export function drawLabelHeading(flow: MunicipalPdfFlow, text: string) {
  ensureRoom(flow, 50);
  flow.page.drawText(municipalPdfText(text), { x: flow.ctx.margin, y: flow.y - 9, size: 8.5, font: flow.ctx.bold, color: flow.ctx.colors.accent });
  flow.y -= 18;
}

function safeLink(link: unknown): string {
  return typeof link === "string" && /^https?:\/\/\S+$/i.test(link.trim()) ? link.trim() : "";
}

function addLink(flow: MunicipalPdfFlow, url: string, x: number, y: number, width: number, height: number) {
  const { lib, pdf } = flow.ctx;
  const annotation = pdf.context.register(pdf.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [x, y, x + width, y + height], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: lib.PDFString.of(url) },
  }));
  flow.page.node.addAnnot(annotation);
}

function layoutFieldRow(ctx: MunicipalPdfContext, fields: PdfField[], { weights = fields.map(() => 1), valueSize = 9.5 }: FieldRowOptions) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const available = ctx.width - FIELD_INSET;
  let x = ctx.margin + FIELD_INSET;
  const cells = fields.map((field, index) => {
    const width = available * weights[index] / total;
    const cell = {
      x,
      label: municipalPdfText(field.label),
      lines: wrapMunicipalPdfText(municipalPdfText(field.value).trim() || "—", ctx.bold, valueSize, width - 10),
      link: safeLink(field.link),
    };
    x += width;
    return cell;
  });
  const step = valueSize * 1.25;
  const lineCount = Math.max(1, ...cells.map((cell) => cell.lines.length));
  return { cells, step, height: 11 + valueSize + 4 + (lineCount - 1) * step + 10 };
}

export function measureFieldRow(ctx: MunicipalPdfContext, fields: PdfField[], options: FieldRowOptions = {}): number {
  return layoutFieldRow(ctx, fields, options).height;
}

// A row of fields without boxes: each label small in gray, its value in bold, and a thin line under the row.
export function drawFieldRow(flow: MunicipalPdfFlow, fields: PdfField[], options: FieldRowOptions = {}) {
  const { ctx } = flow;
  const { valueSize = 9.5, tinted = false, rule = true } = options;
  const { cells, step, height } = layoutFieldRow(ctx, fields, options);
  ensureRoom(flow, height);
  const { page, y } = flow;
  if (tinted) page.drawRectangle({ x: ctx.margin, y: y - height, width: ctx.width, height, color: ctx.colors.tint });
  for (const cell of cells) {
    page.drawText(cell.label, { x: cell.x, y: y - 11, size: LABEL_SIZE, font: ctx.bold, color: ctx.colors.muted });
    cell.lines.forEach((line, index) => {
      const baseline = y - 15 - valueSize - index * step;
      page.drawText(line, { x: cell.x, y: baseline, size: valueSize, font: ctx.bold, color: cell.link ? ctx.colors.accent : ctx.colors.dark });
      if (!cell.link) return;
      const lineWidth = ctx.bold.widthOfTextAtSize(line, valueSize);
      page.drawLine({ start: { x: cell.x, y: baseline - 1.5 }, end: { x: cell.x + lineWidth, y: baseline - 1.5 }, thickness: 0.6, color: ctx.colors.accent });
      addLink(flow, cell.link, cell.x, baseline - 3, lineWidth, valueSize + 3);
    });
  }
  if (rule) page.drawLine({ start: { x: ctx.margin, y: y - height }, end: { x: ctx.margin + ctx.width, y: y - height }, thickness: 0.6, color: ctx.colors.line });
  flow.y -= height;
}

interface ParagraphStyle {
  font?: PDFFont;
  size?: number;
  color?: RGB;
  // The number written before the first line, in the accent color; the text keeps its indent on every line.
  marker?: string;
  indent?: number;
  after?: number;
}

export function drawParagraph(flow: MunicipalPdfFlow, text: string, style: ParagraphStyle = {}) {
  const { ctx } = flow;
  const { font = ctx.font, size = 9, color = ctx.colors.ink, marker = "", indent = marker ? 18 : 0, after = 5 } = style;
  const lineHeight = size * 1.45;
  const lines = wrapMunicipalPdfText(text, font, size, ctx.width - indent);
  ensureRoom(flow, Math.min(2, lines.length) * lineHeight);
  lines.forEach((line, index) => {
    ensureRoom(flow, lineHeight);
    if (index === 0 && marker) flow.page.drawText(marker, { x: ctx.margin, y: flow.y - size, size: size - 0.5, font: ctx.bold, color: ctx.colors.accent });
    flow.page.drawText(line, { x: ctx.margin + indent, y: flow.y - size, size, font, color });
    flow.y -= lineHeight;
  });
  flow.y -= after;
}

// A line to sign, centered, with the name and the role written under it.
export function drawSignature(flow: MunicipalPdfFlow, { name = "", details = "", gap = 46 }: { name?: string; details?: string; gap?: number }) {
  const { ctx } = flow;
  ensureRoom(flow, gap + 34);
  const lineWidth = 230;
  const lineY = flow.y - gap;
  const x = ctx.margin + (ctx.width - lineWidth) / 2;
  flow.page.drawLine({ start: { x, y: lineY }, end: { x: x + lineWidth, y: lineY }, thickness: 0.7, color: ctx.colors.muted });
  let y = lineY - 13;
  if (name) {
    drawCenteredText(flow, name, y, ctx.bold, 9.5, ctx.colors.dark);
    y -= 12;
  }
  if (details) drawCenteredText(flow, details, y, ctx.font, 8.5, ctx.colors.muted);
  flow.y = y - 14;
}

// Numbered sections of fields: the layout of the documents that only show what was registered.
export function drawFieldSections(flow: MunicipalPdfFlow, sections: FieldSection[]) {
  sections.forEach(({ title, rows }, index) => {
    drawSectionHeading(flow, String(index + 1).padStart(2, "0"), title);
    rows.forEach((row) => drawFieldRow(flow, row));
    flow.y -= 14;
  });
}
