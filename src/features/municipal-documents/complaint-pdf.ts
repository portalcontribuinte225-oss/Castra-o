import { RequestType, requestTypeDomainLabels } from "../../domain";
import type { AnyRecord } from "../../types";
import { documentCpf, documentPhone, requestTutorName } from "./document-fields";
import { createSectionsPdf, requestDocumentBand, requestSection } from "./sections-pdf";

// A complaint, with whoever made it and what they reported. `request` is normalized: a confidential reporter arrives masked.
export function createComplaintPdf(request: AnyRecord, municipality: AnyRecord | null) {
  return createSectionsPdf(municipality, {
    title: "DENÚNCIA",
    band: requestDocumentBand(request),
    sections: [
      requestSection(request, requestTypeDomainLabels[RequestType.COMPLAINT]),
      { title: "DADOS DO DENUNCIANTE", rows: [
        [
          { label: "NOME COMPLETO", value: requestTutorName(request) },
          { label: "CPF", value: documentCpf(request.cpf) },
          { label: "CELULAR", value: documentPhone(request.phone) },
          { label: "E-MAIL", value: request.email },
        ],
        [{ label: "ENDEREÇO DA OCORRÊNCIA", value: [request.address, request.neighborhood, request.city, request.state].filter(Boolean).join(" - ") }],
      ] },
      { title: "RELATO", rows: [[{ label: "DESCRIÇÃO", value: request.complaintDescription }]] },
    ],
  });
}
