export interface TrackedRequest {
  protocol: string;
  requestType: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  schedule: { date: string; locationName: string; address: string } | null;
  documents: { total: number; approved: number; needsCorrection: number; pending: number };
}

export interface TrackingSession {
  token: string;
  expiresIn: number;
}

export interface TrackingStartBody {
  municipalityId: string;
  protocol: string;
  contact: string;
}
