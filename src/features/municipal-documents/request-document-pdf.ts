import { RequestType, normalizeRequest, normalizeRequestType } from "../../domain";
import type { AnyRecord } from "../../types";
import { uint8ArrayToDataUrl } from "../../utils";
import { createRequestRequirementPdf } from "../request-document/request-requirement-pdf";
import { createComplaintPdf } from "./complaint-pdf";
import { createDeathRegistrationPdf } from "./death-registration-pdf";
import { documentFileName } from "./municipal-pdf";
import { createTutorTransferPdf } from "./tutor-transfer-pdf";

type RequestDocumentBuilder = (request: AnyRecord, municipality: AnyRecord | null) => Promise<Uint8Array>;

// The requests that are not procedures have a document of their own; a procedure request has the requirement.
const DOCUMENTS: Record<string, { name: string; create: RequestDocumentBuilder }> = {
  [RequestType.TUTOR_TRANSFER]: { name: "Troca de tutor", create: createTutorTransferPdf },
  [RequestType.ANIMAL_DEATH]: { name: "Registro de óbito", create: createDeathRegistrationPdf },
  [RequestType.COMPLAINT]: { name: "Denúncia", create: createComplaintPdf },
};
const REQUIREMENT = { name: "Requerimento", create: createRequestRequirementPdf };

function requestDocument(request: AnyRecord) {
  return DOCUMENTS[normalizeRequestType(request.request_type || request.type)] || REQUIREMENT;
}

// The document the system generates for a request, with the municipality that issues it.
export async function createRequestDocumentPdf(source: AnyRecord, municipality: AnyRecord | null): Promise<{ name: string; fileName: string; bytes: Uint8Array }> {
  const request = normalizeRequest(source);
  const { name, create } = requestDocument(request);
  return { name, fileName: documentFileName(name, request.protocol), bytes: await create(request, municipality) };
}

export async function createRequestDocumentDataUrl(request: AnyRecord, municipality: AnyRecord | null): Promise<string> {
  return uint8ArrayToDataUrl((await createRequestDocumentPdf(request, municipality)).bytes, "application/pdf");
}
