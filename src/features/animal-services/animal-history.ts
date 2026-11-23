import { RequestKind, RequestStatus } from "../../../shared/request-contract.js";
import type { AnimalHistoryItem, AnimalHistoryRegistration } from "./animal-service-types";

// Record types stored by the backend in animal_records that this history names or colors.
export enum AnimalRecordType {
  DEATH_REQUEST = "SOLICITACAO_OBITO",
  TRANSFER_REQUEST = "SOLICITACAO_TROCA_TUTOR",
  PROCEDURE_REQUEST = "SOLICITACAO_PROCEDIMENTO",
  SURGERY_DONE = "CIRURGIA_REALIZADA",
  REQUEST = "SOLICITACAO",
}

export enum AnimalHistoryTone { DANGER = "danger", TRANSFER = "transfer", SUCCESS = "success", SCHEDULED = "scheduled", NEUTRAL = "neutral" }

const deathTypes: string[] = [RequestKind.DEATH, AnimalRecordType.DEATH_REQUEST];
const transferTypes: string[] = [RequestKind.TRANSFER, AnimalRecordType.TRANSFER_REQUEST];

const historyTitles: Record<string, string> = {
  [RequestKind.DEATH]: "Registro de óbito",
  [RequestKind.TRANSFER]: "Troca de tutor",
  [AnimalRecordType.DEATH_REQUEST]: "Solicitação de óbito",
  [AnimalRecordType.TRANSFER_REQUEST]: "Solicitação de troca de tutor",
  [AnimalRecordType.PROCEDURE_REQUEST]: "Solicitação de procedimento",
  [AnimalRecordType.SURGERY_DONE]: "Cirurgia realizada",
  [AnimalRecordType.REQUEST]: "Solicitação",
};

export function animalHistoryTitle(item: AnimalHistoryItem = {}): string {
  return historyTitles[item.type || ""] || item.title || item.type || "Evento";
}

export function getAnimalHistoryRegistration(item: AnimalHistoryItem = {}): AnimalHistoryRegistration {
  return item.data?.registration || {};
}

export function getAnimalHistoryMunicipality(item: AnimalHistoryItem = {}): string {
  const registration = getAnimalHistoryRegistration(item);
  return registration.municipality || registration.schedule_municipality || "";
}

export function getAnimalHistorySchedule(item: AnimalHistoryItem = {}): string {
  return getAnimalHistoryRegistration(item).schedule_date || "";
}

export function isScheduledHistoryItem(item: AnimalHistoryItem = {}): boolean {
  return item.status === RequestStatus.SCHEDULED;
}

export function animalHistoryTone(item: AnimalHistoryItem = {}): AnimalHistoryTone {
  if (deathTypes.includes(item.type)) return AnimalHistoryTone.DANGER;
  if (transferTypes.includes(item.type)) return AnimalHistoryTone.TRANSFER;
  if (item.type === AnimalRecordType.SURGERY_DONE) return AnimalHistoryTone.SUCCESS;
  if (isScheduledHistoryItem(item)) return AnimalHistoryTone.SCHEDULED;
  return AnimalHistoryTone.NEUTRAL;
}
