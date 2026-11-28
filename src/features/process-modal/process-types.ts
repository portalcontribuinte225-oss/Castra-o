import { ProcedureAction } from "../../../shared/request-procedure-contract.js";
import type { AnyRecord } from "../../types";

export interface AppointmentSlot {
  date: string;
  occurrenceKey?: string;
  slotTime?: string;
  locationName?: string;
}

export interface ProcedureTarget {
  animalIndex: number;
  requestTypeId: string;
}

export interface HealthDraft {
  doencas: string;
  alergias: string;
  microchip: string;
}

export type HealthEdit = Partial<HealthDraft> & { animalIndex: number };
export interface ClinicalBatch {
  health: HealthEdit[];
  results: ProcedureTarget[];
}

export interface ScheduleSelection {
  date: string;
  occurrenceKey: string;
  time: string;
}

export interface PrescriptionDraft {
  animalIndex: number;
  requestTypeId: string;
  professionalName: string;
  professionalRegistry: string;
  text: string;
}

export type ProcedureOperation =
  | { action: typeof ProcedureAction.SAVE | typeof ProcedureAction.CLOSE; data: ClinicalBatch }
  | { action: typeof ProcedureAction.NO_SHOW; data: { results: ProcedureTarget[] } }
  | { action: typeof ProcedureAction.CONFIRM_SCHEDULE }
  | { action: typeof ProcedureAction.RESCHEDULE; data: { schedule: ScheduleSelection; reason: string } }
  | { action: typeof ProcedureAction.REMOVE; data: { target: ProcedureTarget; reason: string } }
  | { action: typeof ProcedureAction.PRESCRIPTION; data: { prescriptions: PrescriptionDraft[] } };

export type ProcessActionResult = { ok: true } | { ok: false; message: string; code?: string };

export type ProcessProcedure = AnyRecord & { requestTypeId: string; status: string; name: string; schedule?: AppointmentSlot | null };
export type ProcessAnimal = AnyRecord & { procedures: ProcessProcedure[] };

export const procedureTargetKey = ({ animalIndex, requestTypeId }: ProcedureTarget) => JSON.stringify([animalIndex, requestTypeId]);
