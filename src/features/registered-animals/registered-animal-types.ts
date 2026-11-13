import type { StepToggles } from "../request-steps/request-steps";
import { DocumentReviewStatus, DocumentReuseState } from "../../../shared/document-reuse-contract.js";

export interface RegisteredAnimal {
  id: string;
  name: string;
  species: string;
  sex?: string;
  size?: string;
  breed?: string;
  breedType?: string;
  breedDescription?: string;
  coat?: string;
  birthDate?: string;
  age?: string;
  weight?: string;
  microchip?: string;
  confirmedMicrochip?: string;
  declaredMicrochip?: string;
  microchipStatus?: string;
  identificationTypeId?: string;
  status?: string;
  dewormed?: string;
  vaccinated?: string;
  illnessHistory?: string;
  food?: string;
  hasChip?: string;
}

export interface PreviousAnimalCandidate {
  sourceRequestId: string;
  animalIndex: number;
  fingerprint: string;
  name: string;
  species?: string;
  declaredMicrochip?: string;
}

export interface ReusedDocumentReference {
  sourceRequestId: string;
  attachmentId: string;
  hash: string;
}

export interface ReusableDocumentCandidate {
  attachmentId: string;
  documentId: string;
  documentName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: typeof DocumentReviewStatus[keyof typeof DocumentReviewStatus];
  state: typeof DocumentReuseState[keyof typeof DocumentReuseState];
  eligible: boolean;
  receivedAt?: string;
  expiresAt?: string | null;
  reuseRef: ReusedDocumentReference;
}

export interface RequestConfigItem extends StepToggles {
  id: string;
  name: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface RegisteredTutorSnapshot {
  name: string;
  tutor?: string;
  cpf: string;
  email?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  number?: string;
}

export interface RegisteredRequestContext {
  animal: RegisteredAnimal;
  tutor: RegisteredTutorSnapshot;
  requestTypes: RequestConfigItem[];
  identificationTypes: RequestConfigItem[];
  documentTypes: RequestConfigItem[];
  documents: ReusableDocumentCandidate[];
  eligibility?: { canSubmit: boolean; reason?: string };
}

export interface RegisteredAnimalsPage {
  animals: RegisteredAnimal[];
  candidates: PreviousAnimalCandidate[];
  nextCursor: string | null;
}
