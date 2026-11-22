import type { AnyRecord } from "../../types";
import { formatDateTime } from "../../utils";
import { createMunicipalPdfContext, importPdfLib, municipalDocumentDate } from "./municipal-pdf";
import { drawDocumentTitle, drawFieldSections, startMunicipalPdfFlow } from "./municipal-pdf-blocks";
import type { FieldSection } from "./municipal-pdf-blocks";
import type { HeaderBandItem } from "./municipal-pdf-header";

// The band of a request document: its protocol and the day it was registered.
export function requestDocumentBand(request: AnyRecord): HeaderBandItem[] {
  return [
    { label: "PROTOCOLO", value: String(request.protocol || "") },
    { label: "DATA DE EMISSÃO", value: municipalDocumentDate(request.createdAt) },
  ];
}

// The first section of every request document: what was asked and when.
export function requestSection(request: AnyRecord, kind: string, extra: FieldSection["rows"] = []): FieldSection {
  return {
    title: "DADOS DA SOLICITAÇÃO",
    rows: [[
      { label: "TIPO DE SOLICITAÇÃO", value: kind },
      { label: "DATA DA SOLICITAÇÃO", value: request.createdAt ? formatDateTime(request.createdAt) : "" },
    ], ...extra],
  };
}

// A document that only shows what was registered, in numbered sections of fields.
export async function createSectionsPdf(municipality: AnyRecord | null, { title, band, sections }: { title: string; band: HeaderBandItem[]; sections: FieldSection[] }) {
  const { PDFDocument } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const flow = startMunicipalPdfFlow(await createMunicipalPdfContext(pdf, municipality), band);
  drawDocumentTitle(flow, title);
  drawFieldSections(flow, sections);
  return pdf.save();
}
