import { ContactKind } from "../../../shared/auth-contract.js";

export type AccessChannel = typeof ContactKind[keyof typeof ContactKind];

// What the request document needs of the tutor's own request, as the server projects it.
export interface AccessedRequest {
  protocol: string;
  request_type: string;
  status: string;
  origin: string;
  created_at: string | null;
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
}

export interface AccessView {
  request: AccessedRequest;
  account: { exists: boolean };
}

export interface AccessSession {
  token: string;
  expiresIn: number;
}

export interface AccessStartBody {
  municipalityId: string;
  protocol: string;
  cpf: string;
  channel: AccessChannel;
}
