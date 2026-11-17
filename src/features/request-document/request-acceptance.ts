import { RequestOrigin } from "../../../shared/request-contract.js";

// How the request document records the tutor's agreement. The public form takes an electronic acceptance of the declaration, with its
// date and time. A request made at the counter has no term on the screen: its document says when the staff registered it and leaves a
// line for the tutor to sign on paper.
export enum RequestAcceptance {
  ELECTRONIC = "electronic",
  COUNTER = "counter",
}

interface AcceptanceSource {
  origin?: string;
  signedAt?: string;
  signed_at?: string;
  createdAt?: string;
  created_at?: string;
}

// `at` is when it happened: the signature of the public form (or its registration, when the signature has no date), or the
// registration at the counter. Empty when the request has neither date yet.
export function requestAcceptance(request: AcceptanceSource = {}): { kind: RequestAcceptance; at: string } {
  const registeredAt = request.createdAt || request.created_at || "";
  if (request.origin === RequestOrigin.INTERNAL) return { kind: RequestAcceptance.COUNTER, at: registeredAt };
  return { kind: RequestAcceptance.ELECTRONIC, at: request.signedAt || request.signed_at || registeredAt };
}
