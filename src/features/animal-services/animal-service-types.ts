export enum AnimalService { RECORD = "record", TRANSFER = "transfer", DEATH = "death" }

export interface AnimalSummary {
  id: string;
  name?: string;
  species?: string;
  sex?: string;
  size?: string;
  microchip?: string | null;
  confirmedMicrochip?: string;
  declaredMicrochip?: string;
  status?: string;
}

export interface AnimalHistoryRegistration {
  municipality?: string;
  schedule_municipality?: string;
  schedule_date?: string;
}

export interface AnimalHistoryItem {
  source?: string;
  type?: string;
  title?: string;
  status?: string;
  notes?: string;
  protocol?: string;
  request_id?: string;
  id?: string;
  occurred_at?: string;
  data?: { registration?: AnimalHistoryRegistration };
}

export interface AnimalTutorSnapshot {
  tutor_name?: string;
  name?: string;
  cpf?: string;
  phone?: string;
  tutor_email?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface AnimalRecord {
  animal: AnimalSummary;
  tutor: AnimalTutorSnapshot | null;
  history: AnimalHistoryItem[];
}

export interface AnimalDeathPayload {
  death_date: string;
  death_cause: string;
  notes: string;
}

export interface AnimalTransferPayload {
  target_tutor_name: string;
  target_tutor_cpf: string;
  target_tutor_phone: string;
  target_tutor_email: string;
  target_tutor_cep: string;
  target_tutor_address: string;
  target_tutor_neighborhood: string;
  target_tutor_city: string;
  target_tutor_state: string;
  notes: string;
}

export interface CreatedAnimalRequest {
  protocol?: string;
}
