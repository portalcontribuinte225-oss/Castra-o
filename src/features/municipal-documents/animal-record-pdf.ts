import { RequestStatus } from "../../../shared/request-contract.js";
import { resolveRequestProcedures } from "../../../shared/request-procedure-contract.js";
import { normalizeRequest, requestTypeLabel, statusLabels } from "../../domain";
import type { AnyRecord } from "../../types";
import { formatDateTime, maskCpf, uint8ArrayToDataUrl } from "../../utils";
import { AnimalRecordType, animalHistoryTitle, getAnimalHistoryMunicipality, getAnimalHistorySchedule, isScheduledHistoryItem } from "../animal-services/animal-history";
import { issuedPrescriptions } from "../process-report/process-report";
import { requestTutorName } from "./document-fields";
import { createMunicipalPdfContext, documentFileName, importPdfLib, municipalDocumentDate } from "./municipal-pdf";
import { drawDocumentTitle, drawFieldSections, drawParagraph, drawSectionHeading, startMunicipalPdfFlow } from "./municipal-pdf-blocks";
import type { MunicipalPdfFlow } from "./municipal-pdf-blocks";

interface RecordEvent {
  date: string;
  title: string;
  details: string[];
}

const PROCEDURE_EVENTS: string[] = [AnimalRecordType.SURGERY_DONE, AnimalRecordType.PROCEDURE_REQUEST];

// The events of the animal, oldest first; without its history, the steps of the request the record was asked from.
function recordEvents(request: AnyRecord, history: AnyRecord[]): RecordEvent[] {
  if (history.length) {
    return [...history]
      .sort((a, b) => new Date(a.occurred_at || a.created_at || 0).getTime() - new Date(b.occurred_at || b.created_at || 0).getTime())
      .map((item) => ({
        date: municipalDocumentDate(item.occurred_at || item.created_at),
        title: animalHistoryTitle(item),
        details: [item.protocol && `Protocolo: ${item.protocol}`, item.status && `Situação: ${statusLabels[item.status] || item.status}`, item.notes].filter(Boolean).map(String),
      }));
  }
  if (!request.id && !request.protocol) return [];
  const workflow: AnyRecord = request.workflowData || request.workflow_data || {};
  const scheduled = request.preferredSchedule || request.appointment || "";
  const events: RecordEvent[] = [
    { date: municipalDocumentDate(request.createdAt), title: "Abertura da solicitação", details: [requestTypeLabel(request), `Protocolo: ${request.protocol}`] },
    { date: scheduled, title: "Agendamento", details: [[request.scheduleLocationName, request.scheduleAddress].filter(Boolean).join(" - ") || "Local não informado"] },
  ];
  if (request.status === RequestStatus.COMPLETED) {
    events.push({ date: scheduled, title: "Procedimento realizado", details: [
      workflow.attendanceMicrochip ? `Microchip aplicado: ${workflow.attendanceMicrochip}` : "",
      request.attendanceNote ? `Observação: ${request.attendanceNote}` : "",
    ].filter(Boolean) });
  } else if (request.status === RequestStatus.CANCELLED) {
    events.push({ date: "", title: "Processo cancelado ou indeferido", details: [workflow.cancelReason || request.rejectionReason || "Motivo não informado", request.rejectionNote].filter(Boolean) });
  } else {
    events.push({ date: "", title: "Realização", details: ["Procedimento ainda não realizado"] });
  }
  for (const { subtitle, prescription } of issuedPrescriptions(resolveRequestProcedures(request), { completedOnly: true })) {
    events.push({ date: municipalDocumentDate(prescription.issuedAt), title: "Receita prescrita", details: [subtitle, prescription.text] });
  }
  return events;
}

function drawEvents(flow: MunicipalPdfFlow, events: RecordEvent[]) {
  const { ctx } = flow;
  if (!events.length) drawParagraph(flow, "Nenhum evento registrado.", { color: ctx.colors.muted });
  for (const event of events) {
    drawParagraph(flow, [event.date, event.title].filter(Boolean).join(" · "), { font: ctx.bold, color: ctx.colors.dark, after: 1 });
    for (const detail of event.details) drawParagraph(flow, detail, { size: 8.5, color: ctx.colors.muted, indent: 10, after: 1 });
    flow.y -= 8;
  }
}

// The record of an animal: who it is, who its tutor is and everything that happened to it. `history` is the consultation of the animal;
// `request`, the request the record was asked from, when there is one.
export async function createAnimalRecordPdf({ request: source = {}, history: consultation = null, municipality = null }: { request?: AnyRecord; history?: AnyRecord | null; municipality?: AnyRecord | null }) {
  const hasRequest = Boolean(source.id || source.protocol);
  const request = hasRequest ? normalizeRequest(source) : {};
  const history: AnyRecord[] = Array.isArray(consultation?.history) ? consultation.history : [];
  const animal: AnyRecord = (hasRequest && request.animals[0]) || consultation?.animal || {};
  const tutor: AnyRecord = consultation?.tutor || {};
  const microchip = String(animal.microchip || request.animalMicrochip || "");
  const summary = [animal.species, animal.sex, animal.size].filter(Boolean).join(" · ");
  const latest = history[0];
  const nextSchedule = history.find((item) => isScheduledHistoryItem(item) && getAnimalHistorySchedule(item));
  const latestProcedure = history.find((item) => PROCEDURE_EVENTS.includes(item.type));
  const municipalities = [...new Set(history.map(getAnimalHistoryMunicipality).filter(Boolean))];

  const { PDFDocument } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const flow = startMunicipalPdfFlow(await createMunicipalPdfContext(pdf, municipality), [
    { label: "ANIMAL", value: String(animal.name || "Sem nome") },
    { label: "MICROCHIP", value: microchip || "Não informado" },
    { label: "DATA DE EMISSÃO", value: municipalDocumentDate(new Date().toISOString()) },
  ]);
  drawDocumentTitle(flow, "PRONTUÁRIO DO ANIMAL");
  drawFieldSections(flow, [
    { title: "ANIMAL", rows: [[
      { label: "NOME", value: animal.name },
      { label: "ESPÉCIE / SEXO / PORTE", value: summary },
      { label: "MICROCHIP", value: microchip || "Não informado" },
      { label: "SITUAÇÃO", value: String(animal.status || "ativo").toLocaleUpperCase("pt-BR") },
    ]] },
    { title: "TUTOR ATUAL", rows: [
      [
        { label: "NOME", value: hasRequest ? requestTutorName(request) : tutor.tutor_name || tutor.name },
        { label: "CPF", value: maskCpf((hasRequest ? request.cpf : tutor.cpf) || "") },
        { label: "CONTATO", value: [hasRequest ? request.phone : tutor.phone || tutor.celular, hasRequest ? request.email : tutor.tutor_email || tutor.email].filter(Boolean).join(" · ") },
      ],
      [{ label: "ENDEREÇO", value: hasRequest
        ? [request.address, request.neighborhood, [request.city, request.state].filter(Boolean).join("/"), request.cep && `CEP ${request.cep}`].filter(Boolean).join(" - ")
        : [tutor.address, tutor.neighborhood, tutor.city, tutor.state].filter(Boolean).join(", ") }],
    ] },
    { title: "RESUMO", rows: [
      [
        { label: "ÚLTIMO EVENTO", value: latest ? [animalHistoryTitle(latest), latest.occurred_at && formatDateTime(latest.occurred_at)].filter(Boolean).join(" · ") : "Sem eventos" },
        { label: "PRÓXIMA AGENDA", value: nextSchedule ? getAnimalHistorySchedule(nextSchedule) : "Sem agenda" },
        { label: "ÚLTIMO PROCEDIMENTO", value: latestProcedure ? animalHistoryTitle(latestProcedure) : "Não informado" },
      ],
      [
        { label: "MUNICÍPIOS", value: municipalities.join(", ") || "Não informado" },
        { label: "EVENTOS", value: `${history.length} registro(s)` },
      ],
    ] },
  ]);
  drawSectionHeading(flow, "04", history.length ? "HISTÓRICO DO ANIMAL" : "HISTÓRICO DO PROCESSO");
  drawEvents(flow, recordEvents(request, history));
  if (!microchip) {
    drawParagraph(flow, `Histórico parcial: animal sem microchip registrado${request.protocol ? `; os dados se referem ao protocolo ${request.protocol}` : ""}.`, { size: 7.5, color: flow.ctx.colors.muted });
  }
  return {
    fileName: documentFileName(["Prontuário", animal.name].filter(Boolean).join(" "), microchip || request.protocol || ""),
    dataUrl: uint8ArrayToDataUrl(await pdf.save(), "application/pdf"),
  };
}

// Builds the record and starts its download.
export async function downloadAnimalRecordPdf(input: Parameters<typeof createAnimalRecordPdf>[0]) {
  const { dataUrl, fileName } = await createAnimalRecordPdf(input);
  const anchor = window.document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.click();
}
