import { displayText, normalizeRequest } from "../../domain";
import type { AnyRecord } from "../../types";
import { animalBreedLabel, animalMicrochipLabel, animalWeightLabel, requestTutorName } from "../municipal-documents/document-fields";
import { createMunicipalPdfContext, documentFileName, importPdfLib, municipalDocumentDate, municipalPdfText, wrapMunicipalPdfText } from "../municipal-documents/municipal-pdf";
import type { MunicipalPdfContext } from "../municipal-documents/municipal-pdf";
import { drawDocumentTitle, drawFieldRow, drawSignature, ensureRoom, startMunicipalPdfFlow } from "../municipal-documents/municipal-pdf-blocks";

// A prescription as the server saved it: the number and the moment of issue are the server's.
export interface PrintablePrescription {
  text: string;
  professionalName?: string;
  professionalRegistry?: string;
  number?: string;
  issuedAt?: string;
}

const TEXT_SIZE = 10;
const LINE_HEIGHT = 15;
// In the model the place and the date sit here, leaving the space above them for the prescription.
const DATE_BASELINE = 343;
// The place, the date and the signature under them.
const SIGNATURE_HEIGHT = 140;

// "Dr(a). Ana Souza", unless the name already carries the title.
function professionalTitle(name: string): string {
  return !name || /^dr(?:a|\(a\))?\.?\s/i.test(name) ? name : `Dr(a). ${name}`;
}

// One prescription, on its own pages, in a PDF that may hold other documents of the process.
export function appendPrescriptionPdf(ctx: MunicipalPdfContext, request: AnyRecord, prescription: PrintablePrescription, animal: AnyRecord) {
  const normalized = normalizeRequest(request);
  const professional = professionalTitle(String(prescription.professionalName || "").trim());
  const registry = String(prescription.professionalRegistry || "").trim();
  const flow = startMunicipalPdfFlow(ctx, [
    { label: "PROTOCOLO", value: normalized.protocol },
    { label: "DATA DE EMISSÃO", value: municipalDocumentDate(prescription.issuedAt) },
    { label: "Nº DO DOCUMENTO", value: String(prescription.number || "") },
  ]);
  if (professional) {
    flow.page.drawText(wrapMunicipalPdfText(professional, ctx.bold, 12, ctx.width)[0], { x: ctx.margin, y: flow.y - 12, size: 12, font: ctx.bold, color: ctx.colors.dark });
    flow.y -= 36;
  }
  drawDocumentTitle(flow, "RECEITUÁRIO VETERINÁRIO");
  drawFieldRow(flow, [
    { label: "TUTOR(A)", value: requestTutorName(normalized) },
    { label: "PET", value: displayText(animal.name) },
    { label: "PROTOCOLO", value: normalized.protocol },
  ], { tinted: true });
  drawFieldRow(flow, [
    { label: "ESPÉCIE / RAÇA", value: [displayText(animal.species), animalBreedLabel(animal)].filter(Boolean).join(" / ") },
    { label: "SEXO", value: displayText(animal.sex) },
    { label: "PESO", value: animalWeightLabel(animal.weight) },
    { label: "MICROCHIP", value: animalMicrochipLabel(animal) },
  ], { tinted: true, weights: [1.35, 0.93, 1.07, 1.53] });
  flow.y -= 24;
  ensureRoom(flow, 40);
  flow.page.drawText("PRESCRIÇÃO:", { x: ctx.margin, y: flow.y - 10, size: 10, font: ctx.bold, color: ctx.colors.dark });
  flow.y -= 26;
  const lines = wrapMunicipalPdfText(prescription.text, ctx.font, TEXT_SIZE, ctx.width);
  lines.forEach((line, index) => {
    // The last line goes with the signature, so a page never holds the signature alone.
    ensureRoom(flow, LINE_HEIGHT + (index === lines.length - 1 ? SIGNATURE_HEIGHT : 0));
    if (line) flow.page.drawText(line, { x: ctx.margin, y: flow.y - TEXT_SIZE, size: TEXT_SIZE, font: ctx.font, color: ctx.colors.ink });
    flow.y -= LINE_HEIGHT;
  });

  ensureRoom(flow, SIGNATURE_HEIGHT);
  flow.y = Math.min(flow.y - 16, DATE_BASELINE + 9);
  const placeAndDate = [ctx.identity.place, municipalDocumentDate(prescription.issuedAt, true)].filter(Boolean).join(", ");
  if (placeAndDate) {
    const text = municipalPdfText(`${placeAndDate}.`);
    flow.page.drawText(text, { x: ctx.margin + ctx.width - ctx.font.widthOfTextAtSize(text, 9), y: flow.y - 9, size: 9, font: ctx.font, color: ctx.colors.muted });
  }
  flow.y -= 9;
  drawSignature(flow, { name: professional, details: [registry, "Assinatura do profissional"].filter(Boolean).join(" · "), gap: 86 });
}

export async function createPrescriptionPdfDocument(request: AnyRecord, prescription: PrintablePrescription, municipality: AnyRecord | null, animal: AnyRecord) {
  const { PDFDocument } = await importPdfLib();
  const pdf = await PDFDocument.create();
  appendPrescriptionPdf(await createMunicipalPdfContext(pdf, municipality), request, prescription, animal);
  return {
    dataUrl: await pdf.saveAsBase64({ dataUri: true }),
    fileName: documentFileName("Receita", String(prescription.number || "")),
  };
}
