import { NotificationChannel } from "../../../shared/notification-contract.js";

export type AccessChannel = typeof NotificationChannel[keyof typeof NotificationChannel];

// How many documents of the request were approved, need correction or are still under review.
export interface AccessDocumentsSummary {
  total: number;
  approved: number;
  needsCorrection: number;
  pending: number;
}

// What the page shows of each of the tutor's own requests and what its request document needs, as the server projects it.
export interface AccessedRequest {
  protocol: string;
  request_type: string;
  status: string;
  origin: string;
  created_at: string | null;
  updated_at: string | null;
  signed_at: string | null;
  schedule_date: string;
  schedule_location_name: string;
  schedule_address: string;
  schedule_address_url: string;
  schedule_municipality: string;
  municipality: string;
  responsible_unit: string;
  veterinarian: string;
  tutor_name: string;
  cpf: string;
  phone: string;
  tutor_email: string;
  cep: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  animals: Array<Record<string, unknown>>;
  workflow_data: Record<string, unknown>;
  documents: AccessDocumentsSummary;
}

export interface AccessView {
  requests: AccessedRequest[];
  account: { exists: boolean };
}

export interface AccessSession {
  token: string;
  expiresIn: number;
}

export interface AccessStartBody {
  municipalityId: string;
  cpf: string;
  channel: AccessChannel;
}
