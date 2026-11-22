import { resolveRequestProcedures } from "../../../shared/request-procedure-contract.js";
import { normalizeRequest, statusLabels } from "../../domain";
import type { AnyRecord } from "../../types";
import { dataUrlToUint8Array, formatDateTime, getDataUrlMimeType, getDocumentPreviewSource, getUserUploadedProcessDocuments, uint8ArrayToDataUrl } from "../../utils";
import { createMunicipalPdfContext, documentFileName, importPdfLib, municipalDocumentDate } from "../municipal-documents/municipal-pdf";
import type { MunicipalPdfContext } from "../municipal-documents/municipal-pdf";
import { drawDocumentTitle, drawParagraph, drawSectionHeading, startMunicipalPdfFlow } from "../municipal-documents/municipal-pdf-blocks";
import type { HeaderBandItem } from "../municipal-documents/municipal-pdf-header";
import { createRequestDocumentPdf } from "../municipal-documents/request-document-pdf";
import { appendPrescriptionPdf } from "../process-modal/prescription-pdf";
import { historyBlocks, issuedPrescriptions } from "./process-report";

const IMAGE_MARGIN = 36;

async function appendPdfBytes(ctx: MunicipalPdfContext, bytes: Uint8Array) {
  const source = await ctx.lib.PDFDocument.load(bytes);
  for (const page of await ctx.pdf.copyPages(source, source.getPageIndices())) ctx.pdf.addPage(page);
}

// An attached photo or scan fills its own page, as it was sent.
async function appendImage(ctx: MunicipalPdfContext, dataUrl: string, mimeType: string) {
  const bytes = dataUrlToUint8Array(dataUrl);
  const image = mimeType.includes("png") ? await ctx.pdf.embedPng(bytes) : await ctx.pdf.embedJpg(bytes);
  const page = ctx.pdf.addPage(ctx.pageSize);
  const [pageWidth, pageHeight] = ctx.pageSize;
  const { width, height } = image.scaleToFit(pageWidth - IMAGE_MARGIN * 2, pageHeight - IMAGE_MARGIN * 2);
  page.drawImage(image, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
}

// A page that names a document the report could not include.
function appendUnavailablePage(ctx: MunicipalPdfContext, band: HeaderBandItem[], title: string, fileName: string) {
  const flow = startMunicipalPdfFlow(ctx, band);
  drawDocumentTitle(flow, title, 16);
  drawParagraph(flow, fileName, { font: ctx.bold, color: ctx.colors.dark });
  drawParagraph(flow, "Arquivo anexado sem prévia compatível para inclusão automática na juntada.", { color: ctx.colors.muted });
}

function appendHistory(ctx: MunicipalPdfContext, band: HeaderBandItem[], request: AnyRecord) {
  const flow = startMunicipalPdfFlow(ctx, band);
  drawDocumentTitle(flow, "TRAMITAÇÃO DO PROCESSO");
  drawSectionHeading(flow, "01", "REGISTROS");
  const blocks = historyBlocks(request.rawHistory, (status) => statusLabels[status] || status, formatDateTime);
  if (!blocks.length) drawParagraph(flow, "Nenhuma tramitação registrada para este processo.", { color: ctx.colors.muted });
  for (const block of blocks) {
    if (block.heading) drawParagraph(flow, block.heading, { font: ctx.bold, color: ctx.colors.dark, after: 1 });
    if (block.text) drawParagraph(flow, block.text, { size: 8.5, color: ctx.colors.muted, indent: 10, after: 7 });
  }
}

// The whole process in one PDF: the document of the request, its history, the attachments and the prescriptions issued.
export async function generateProcessReportPdf(request: AnyRecord, municipality: AnyRecord | null, requestTypes: AnyRecord[] = []) {
  const output = await (await importPdfLib()).PDFDocument.create();
  const ctx = await createMunicipalPdfContext(output, municipality);
  const normalized = normalizeRequest(request);
  const band = [
    { label: "PROTOCOLO", value: normalized.protocol },
    { label: "DATA DE EMISSÃO", value: municipalDocumentDate(new Date().toISOString()) },
    { label: "SITUAÇÃO", value: statusLabels[normalized.status] || normalized.status },
  ];
  try {
    await appendPdfBytes(ctx, (await createRequestDocumentPdf(request, municipality)).bytes);
  } catch {
    appendUnavailablePage(ctx, band, "Documento do processo", `Não foi possível gerar o documento do processo ${normalized.protocol}.`);
  }
  appendHistory(ctx, band, normalized);
  for (const attachment of getUserUploadedProcessDocuments(request.documents)) {
    const dataUrl = getDocumentPreviewSource(attachment);
    const mimeType = attachment.fileType || attachment.type || attachment.mimeType || getDataUrlMimeType(dataUrl);
    try {
      if (dataUrl && mimeType === "application/pdf") {
        await appendPdfBytes(ctx, dataUrlToUint8Array(dataUrl));
        continue;
      }
      if (dataUrl && mimeType?.startsWith("image/")) {
        await appendImage(ctx, dataUrl, mimeType);
        continue;
      }
    } catch {
      // A file the PDF cannot read gets the page that names it, below.
    }
    appendUnavailablePage(ctx, band, attachment.documentName || "Documento anexado", attachment.fileName || "Arquivo sem prévia");
  }
  const animals = resolveRequestProcedures(request, requestTypes);
  for (const { animal, prescription } of issuedPrescriptions(animals.length ? animals : normalized.animals)) {
    appendPrescriptionPdf(ctx, request, prescription, animal);
  }
  return { fileName: documentFileName("Relatório", normalized.protocol), dataUrl: uint8ArrayToDataUrl(await output.save(), "application/pdf") };
}
