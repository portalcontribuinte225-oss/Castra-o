import { animalProcedureLabels, normalizeRequest, normalizeScheduleDateText, requestTypeLabel } from "../../domain";
import type { AnyRecord } from "../../types";
import { formatCep, normalizeText, onlyDigits } from "../../utils";
import {
  animalAgeLabel, animalBreedLabel, animalMicrochipLabel, animalWeightLabel, documentCep, documentCpf, documentPhone, requestTutorName, yesNoAnswer,
} from "../municipal-documents/document-fields";
import { createMunicipalPdfContext, importPdfLib, municipalDocumentDate, municipalDocumentStamp, municipalPdfText, wrapMunicipalPdfText } from "../municipal-documents/municipal-pdf";
import {
  drawDocumentTitle, drawFieldRow, drawLabelHeading, drawParagraph, drawSectionHeading, drawSignature, ensureRoom, measureFieldRow,
  newMunicipalPdfPage, startMunicipalPdfFlow,
} from "../municipal-documents/municipal-pdf-blocks";
import type { MunicipalPdfFlow, PdfField } from "../municipal-documents/municipal-pdf-blocks";
import { DECLARATION_TITLE, RECOMMENDATIONS_TITLE, declarationIntro, renderDeclaration } from "./request-declaration";

const TO_DEFINE = "A definir";
const ACCEPTANCE_TEXT = "O(a) tutor(a) declarou ciência e concordância com os termos acima ao confirmar o requerimento. O aceite ficou registrado eletronicamente e vinculado a este protocolo.";

// The street and number of the tutor; a saved address may still carry the other fields at its end, which have their own cells.
function tutorStreetAddress(request: AnyRecord): string {
  const parts = String(request.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  const cep = String(request.cep || "");
  const separateFields = [request.neighborhood, request.city, request.state, cep, onlyDigits(cep), formatCep(cep)]
    .filter(Boolean).map((part) => normalizeText(String(part)));
  while (parts.length > 1 && separateFields.includes(normalizeText(parts[parts.length - 1]))) parts.pop();
  const number = String(request.number || (request.workflowData || request.workflow_data || {}).number || "").trim();
  if (number && !parts.includes(number)) parts.push(number);
  return parts.join(", ");
}

function drawRequestInformation(flow: MunicipalPdfFlow, request: AnyRecord) {
  drawSectionHeading(flow, "01", "INFORMAÇÕES DO ATENDIMENTO");
  drawFieldRow(flow, [
    { label: "DATA AGENDADA", value: normalizeScheduleDateText(request.preferredSchedule || request.appointment) || TO_DEFINE },
    { label: "HORÁRIO", value: request.scheduleSlotTime || request.scheduleTime || TO_DEFINE },
  ], { valueSize: 16 });
  drawFieldRow(flow, [{ label: "LOCAL / POSTO", value: request.scheduleLocationName || TO_DEFINE }]);
  drawFieldRow(flow, [{ label: "ENDEREÇO DO LOCAL", value: request.scheduleAddress || TO_DEFINE }]);
  if (/^https?:\/\//i.test(request.scheduleAddressUrl || "")) {
    drawFieldRow(flow, [{ label: "LINK DO LOCAL", value: request.scheduleAddressUrl, link: request.scheduleAddressUrl }]);
  }
  flow.y -= 16;
  drawSectionHeading(flow, "02", "IDENTIFICAÇÃO DO TUTOR");
  drawFieldRow(flow, [
    { label: "NOME COMPLETO", value: requestTutorName(request) },
    { label: "CPF", value: documentCpf(request.cpf) },
    { label: "CELULAR", value: documentPhone(request.phone) },
    { label: "E-MAIL", value: request.email },
  ]);
  drawFieldRow(flow, [
    { label: "ENDEREÇO", value: tutorStreetAddress(request) },
    { label: "BAIRRO", value: request.neighborhood },
    { label: "CIDADE / UF", value: [request.city, request.state].filter(Boolean).join(" / ") },
    { label: "CEP", value: documentCep(request.cep) },
  ]);
  flow.y -= 16;
}

function animalDetails(animal: AnyRecord): string {
  const vaccines = yesNoAnswer(animal.vaccinated);
  const illnesses = yesNoAnswer(animal.illnessHistory);
  const lower = (value: string) => (value === "Sim" || value === "Não" ? value.toLowerCase() : value);
  return [
    ["Pelagem", animal.coat || animal.color],
    ["Vacinas", vaccines === "Sim" ? "em dia" : lower(vaccines)],
    ["Vermifugação", lower(yesNoAnswer(animal.dewormed))],
    ["Doenças prévias", illnesses === "Não" ? "não relatadas" : lower(illnesses)],
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
}

function drawAnimal(flow: MunicipalPdfFlow, request: AnyRecord, animal: AnyRecord, index: number, issuedOn: Date) {
  const { ctx } = flow;
  const fields: PdfField[] = [
    { label: "RAÇA", value: animalBreedLabel(animal) },
    { label: "PORTE", value: animal.size },
    { label: "PESO", value: animalWeightLabel(animal.weight) },
    { label: "IDADE", value: animalAgeLabel(animal, issuedOn) },
    { label: "MICROCHIP", value: animalMicrochipLabel(animal) },
  ];
  ensureRoom(flow, 22 + measureFieldRow(ctx, fields) + 44);
  const heading = [`${String(index + 1).padStart(2, "0")}   ${String(animal.name || "Animal").toLocaleUpperCase("pt-BR")}`, [animal.species, animal.sex].filter(Boolean).join(" · ")]
    .filter(Boolean).join("   ·   ");
  flow.page.drawRectangle({ x: ctx.margin, y: flow.y - 21, width: ctx.width, height: 21, color: ctx.colors.tint });
  const headingText = municipalPdfText(heading);
  const fittedHeading = ctx.bold.widthOfTextAtSize(headingText, 10) <= ctx.width - 20 ? headingText : wrapMunicipalPdfText(headingText, ctx.bold, 10, ctx.width - 20)[0];
  flow.page.drawText(fittedHeading, { x: ctx.margin + 10, y: flow.y - 14.5, size: 10, font: ctx.bold, color: ctx.colors.dark });
  flow.y -= 21;
  drawFieldRow(flow, fields);

  const procedures = animalProcedureLabels(animal, request).join(" • ") || requestTypeLabel(request);
  const label = "PROCEDIMENTOS";
  const labelWidth = ctx.bold.widthOfTextAtSize(label, 6.5) + 8;
  const procedureLines = wrapMunicipalPdfText(procedures, ctx.bold, 9, ctx.width - 10 - labelWidth);
  procedureLines.forEach((line, lineIndex) => {
    ensureRoom(flow, 20);
    if (lineIndex === 0) flow.page.drawText(label, { x: ctx.margin + 10, y: flow.y - 13.5, size: 6.5, font: ctx.bold, color: ctx.colors.muted });
    flow.page.drawText(line, { x: ctx.margin + 10 + labelWidth, y: flow.y - 14, size: 9, font: ctx.bold, color: ctx.colors.accent });
    flow.y -= 13;
  });
  flow.y -= 7;
  flow.page.drawLine({ start: { x: ctx.margin, y: flow.y }, end: { x: ctx.margin + ctx.width, y: flow.y }, thickness: 0.6, color: ctx.colors.line });
  flow.y -= 4;
  const details = animalDetails(animal);
  if (details) {
    drawParagraph(flow, details, { size: 7.5, color: ctx.colors.muted, indent: 10, after: 2 });
    flow.page.drawLine({ start: { x: ctx.margin, y: flow.y }, end: { x: ctx.margin + ctx.width, y: flow.y }, thickness: 0.6, color: ctx.colors.line });
  }
  flow.y -= 14;
}

// The electronic acceptance of the web, in a tinted block with the moment the server recorded it.
function drawElectronicAcceptance(flow: MunicipalPdfFlow, fields: PdfField[]) {
  const { ctx } = flow;
  const lines = wrapMunicipalPdfText(ACCEPTANCE_TEXT, ctx.font, 9, ctx.width - 20);
  const fieldsHeight = measureFieldRow(ctx, fields);
  const height = 12 + 14 + lines.length * 13 + 2 + fieldsHeight;
  ensureRoom(flow, height);
  flow.page.drawRectangle({ x: ctx.margin, y: flow.y - height, width: ctx.width, height, color: ctx.colors.tint });
  flow.page.drawText("ACEITE ELETRÔNICO CONFIRMADO NO SISTEMA", { x: ctx.margin + 10, y: flow.y - 19, size: 9, font: ctx.bold, color: ctx.colors.accent });
  flow.y -= 26;
  for (const line of lines) {
    flow.page.drawText(line, { x: ctx.margin + 10, y: flow.y - 9, size: 9, font: ctx.font, color: ctx.colors.ink });
    flow.y -= 13;
  }
  flow.y -= 2;
  drawFieldRow(flow, fields, { rule: false });
}

function drawDeclaration(flow: MunicipalPdfFlow, request: AnyRecord, municipality: AnyRecord | null) {
  const { ctx } = flow;
  const { groups, recommendations } = renderDeclaration({ municipalityName: municipality?.name || request.municipalityName });
  newMunicipalPdfPage(flow);
  drawDocumentTitle(flow, DECLARATION_TITLE);
  drawParagraph(flow, declarationIntro(requestTutorName(request)), { font: ctx.bold, size: 9.5, color: ctx.colors.dark, after: 10 });
  let clause = 0;
  groups.forEach((group, index) => {
    drawLabelHeading(flow, `${String(index + 1).padStart(2, "0")}  /  ${group.title}`);
    for (const item of group.items) drawParagraph(flow, item, { marker: String(++clause).padStart(2, "0") });
    flow.y -= 6;
  });
  if (recommendations.length) {
    drawLabelHeading(flow, RECOMMENDATIONS_TITLE);
    drawParagraph(flow, recommendations.join(" "), { after: 10 });
  }
  const number = String(groups.length + 1).padStart(2, "0");
  const tutor = { label: "TUTOR(A) / RESPONSÁVEL", value: requestTutorName(request) };
  const cpf = { label: "CPF", value: documentCpf(request.cpf) };
  const acceptedAt = municipalDocumentStamp(request.signedAt);
  if (acceptedAt) {
    drawLabelHeading(flow, `${number}  /  REGISTRO DE ACEITE ELETRÔNICO`);
    drawElectronicAcceptance(flow, [tutor, cpf, { label: "DATA E HORA DO ACEITE", value: acceptedAt }]);
    return;
  }
  // A request made at the counter has no electronic acceptance: the tutor signs the printed declaration.
  drawLabelHeading(flow, `${number}  /  ASSINATURA DO TUTOR OU RESPONSÁVEL`);
  drawFieldRow(flow, [tutor, cpf]);
  drawSignature(flow, { details: "Assinatura do tutor ou responsável", gap: 52 });
}

// The requirement of a procedure request: what was asked, for which animals, and the declaration the tutor accepted or will sign.
export async function createRequestRequirementPdf(source: AnyRecord, municipality: AnyRecord | null): Promise<Uint8Array> {
  const { PDFDocument } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const request = normalizeRequest(source);
  const ctx = await createMunicipalPdfContext(pdf, municipality);
  const issuedOn = request.createdAt ? new Date(request.createdAt) : new Date();
  const flow = startMunicipalPdfFlow(ctx, [
    { label: "PROTOCOLO", value: request.protocol },
    { label: "DATA DE EMISSÃO", value: municipalDocumentDate(request.createdAt) },
  ]);
  drawDocumentTitle(flow, "REQUERIMENTO", 24);
  drawRequestInformation(flow, request);
  drawSectionHeading(flow, "03", "ANIMAIS E PROCEDIMENTOS");
  request.animals.forEach((animal: AnyRecord, index: number) => drawAnimal(flow, request, animal, index, issuedOn));
  ensureRoom(flow, 14);
  flow.page.drawText(municipalPdfText("Cada animal e seus procedimentos estão vinculados a um único protocolo."), { x: ctx.margin, y: flow.y - 8, size: 8, font: ctx.font, color: ctx.colors.muted });
  drawDeclaration(flow, request, municipality);
  return pdf.save();
}
