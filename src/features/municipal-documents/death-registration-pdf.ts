import { RequestType, normalizeScheduleDateText, requestTypeDomainLabels } from "../../domain";
import type { AnyRecord } from "../../types";
import { documentCpf, documentPhone, requestTutorName } from "./document-fields";
import { createSectionsPdf, requestDocumentBand, requestSection } from "./sections-pdf";

// The death of an animal the tutor registered, as the staff analyzes it. `request` is normalized.
export function createDeathRegistrationPdf(request: AnyRecord, municipality: AnyRecord | null) {
  const animal: AnyRecord = request.animals[0] || {};
  return createSectionsPdf(municipality, {
    title: "REGISTRO DE ÓBITO",
    band: requestDocumentBand(request),
    sections: [
      requestSection(request, requestTypeDomainLabels[RequestType.ANIMAL_DEATH]),
      { title: "TUTOR", rows: [[
        { label: "NOME COMPLETO", value: requestTutorName(request) },
        { label: "CPF", value: documentCpf(request.cpf) },
        { label: "CELULAR", value: documentPhone(request.phone) },
      ]] },
      { title: "DADOS DO ANIMAL", rows: [[
        { label: "NOME", value: animal.name },
        { label: "ESPÉCIE", value: animal.species },
        { label: "MICROCHIP", value: animal.microchip || request.animalMicrochip },
      ]] },
      { title: "REGISTRO DE ÓBITO", rows: [
        [
          { label: "DATA DO ÓBITO", value: normalizeScheduleDateText(request.deathDate) },
          { label: "CAUSA MORTIS", value: request.deathCause },
        ],
        [{ label: "OBSERVAÇÕES", value: request.notes }],
      ] },
    ],
  });
}
