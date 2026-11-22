import { RequestType, requestTypeDomainLabels } from "../../domain";
import type { AnyRecord } from "../../types";
import { documentCep, documentCpf, documentPhone, requestTutorName } from "./document-fields";
import { createSectionsPdf, requestDocumentBand, requestSection } from "./sections-pdf";

// The request to pass an animal to another tutor, as the staff analyzes it. `request` is normalized.
export function createTutorTransferPdf(request: AnyRecord, municipality: AnyRecord | null) {
  const animal: AnyRecord = request.animals[0] || {};
  return createSectionsPdf(municipality, {
    title: "TROCA DE TUTOR",
    band: requestDocumentBand(request),
    sections: [
      requestSection(request, requestTypeDomainLabels[RequestType.TUTOR_TRANSFER], [[{ label: "MOTIVO", value: request.notes }]]),
      { title: "TUTOR ATUAL", rows: [[
        { label: "NOME COMPLETO", value: requestTutorName(request) },
        { label: "CPF", value: documentCpf(request.cpf) },
        { label: "CELULAR", value: documentPhone(request.phone) },
        { label: "E-MAIL", value: request.email },
      ]] },
      { title: "NOVO TUTOR", rows: [
        [
          { label: "NOME COMPLETO", value: request.targetTutorName },
          { label: "CPF", value: documentCpf(request.targetTutorCpf) },
          { label: "CELULAR", value: documentPhone(request.targetTutorPhone) },
          { label: "E-MAIL", value: request.targetTutorEmail },
        ],
        [
          { label: "ENDEREÇO", value: request.targetTutorAddress },
          { label: "BAIRRO", value: request.targetTutorNeighborhood },
          { label: "CIDADE / UF", value: [request.targetTutorCity, request.targetTutorState].filter(Boolean).join(" / ") },
          { label: "CEP", value: documentCep(request.targetTutorCep) },
        ],
      ] },
      { title: "DADOS DO ANIMAL", rows: [[
        { label: "NOME", value: animal.name },
        { label: "ESPÉCIE", value: animal.species },
        { label: "MICROCHIP", value: animal.microchip || request.animalMicrochip },
      ]] },
    ],
  });
}
