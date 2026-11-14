import { AuthAudience } from "../shared/auth-contract.js";
import { splitSubmissionEnvelope } from "./features/tutor-access/submission-envelope";
import type { AuthRequestOptions, EnrollmentCredential, RecoveryContext } from "./features/tutor-access/auth-types";
import type { PreviousAnimalCandidate, ReusedDocumentReference } from "./features/registered-animals/registered-animal-types";

const BASE = import.meta.env.VITE_API_URL || "/api";
let sessionMutationVersion = 0;

export const SESSION_INVALID_EVENT = "castragestao:session-invalid";

export class ApiError extends Error {
  status: number;
  code: string;
  retryAfter: number;
  constructor(message: string, status: number, code = "", retryAfter = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function getToken() {
  return localStorage.getItem("castragestao:token");
}

function headers(json = true) {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request(method: string, path: string, body?: unknown, responseType: "json" | "blob" = "json", options?: AuthRequestOptions) {
  const requestToken = getToken();
  const requestSessionVersion = sessionMutationVersion;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401 && requestToken && requestToken === getToken() && requestSessionVersion === sessionMutationVersion && !options?.signal?.aborted && (!options?.isCurrent || options.isCurrent()) && !path.startsWith("/auth/login") && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
    }
    throw new ApiError(err.error || res.statusText, res.status, err.code || "", Number(err.retryAfter || res.headers.get("Retry-After")) || 0);
  }
  if (res.status === 204) return null;
  if (responseType === "blob") return res.blob();
  return res.json();
}

export const api = {
  async login(identifier: string, password: string, audience: string = AuthAudience.STAFF, municipalityId = "", options?: AuthRequestOptions) {
    const version = ++sessionMutationVersion;
    const data = await request("POST", "/auth/login", { identifier, password, audience, municipalityId }, "json", options);
    if (version !== sessionMutationVersion || options?.signal?.aborted || options?.isCurrent?.() === false) throw new DOMException("Operação encerrada.", "AbortError");
    localStorage.setItem("castragestao:token", data.token);
    return data.user;
  },
  hasToken: () => Boolean(getToken()),
  getSession: () => request("GET", "/auth/me"),
  async changePassword(body: { currentPassword: string; password: string }, options?: AuthRequestOptions) {
    const version = ++sessionMutationVersion;
    const data = await request("POST", "/auth/change-password", body, "json", options);
    if (version !== sessionMutationVersion || options?.signal?.aborted || options?.isCurrent?.() === false) throw new DOMException("Operação encerrada.", "AbortError");
    localStorage.setItem("castragestao:token", data.token);
    return data.user;
  },
  getRecoveryOptions: (body: RecoveryContext & { identifier: string }, options?: AuthRequestOptions) => request("POST", "/auth/recovery-options", body, "json", options),
  forgotPassword: (body: RecoveryContext & { recoveryToken: string; optionId: string }, options?: AuthRequestOptions) => request("POST", "/auth/forgot-password", body, "json", options),
  async resetPassword(body: RecoveryContext & { challengeId: string; code: string; password: string }, options?: AuthRequestOptions) {
    const version = sessionMutationVersion;
    const data = await request("POST", "/auth/reset-password", body, "json", options);
    if (version !== sessionMutationVersion || options?.signal?.aborted || options?.isCurrent?.() === false) throw new DOMException("Operação encerrada.", "AbortError");
    api.logout();
    return data;
  },
  getTutorProfile: () => request("GET", "/auth/tutor/profile"),
  requestContactChallenge: (body) => request("POST", "/auth/tutor/contact-challenges", body),
  confirmContactChallenge: (challengeId: string, code: string) => request("POST", `/auth/tutor/contact-challenges/${encodeURIComponent(challengeId)}/confirm`, { code }),
  searchTutors: (cpf: string, municipalityId: string) => request("GET", `/auth/tutors?cpf=${encodeURIComponent(cpf)}&municipalityId=${encodeURIComponent(municipalityId)}`),
  recoverTutorAccess: (id: string, body) => request("POST", `/auth/tutors/${encodeURIComponent(id)}/assisted-recovery`, body),
  upsertAuthUser: (body) => request("PUT", "/auth/users", body),
  logout() {
    sessionMutationVersion += 1;
    localStorage.removeItem("castragestao:token");
  },

  getRequests: () => request("GET", "/requests"),
  async createRequest(body, onEnrollment?: (credential?: EnrollmentCredential) => void) {
    const envelope = splitSubmissionEnvelope(await request("POST", "/requests", body));
    onEnrollment?.(envelope.enrollment);
    return envelope.request;
  },
  consultRequestsByCredentials: (cpf, validationKey, municipalityId) => request("POST", "/requests/consult", { cpf, validationKey, municipalityId }),
  patchRequest: (id, patch) => request("PATCH", `/requests/${id}`, patch),
  deleteRequest: (id) => request("DELETE", `/requests/${id}`),

  lookupAnimalByMicrochip: (microchip) => request("POST", "/animals/lookup", { microchip }),
  getMyAnimals: (query = "", cursor = "") => request("GET", `/animals/mine?query=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
  resolvePreviousAnimal: (reference: PreviousAnimalCandidate) => request("POST", "/animals/from-request", { sourceRequestId: reference.sourceRequestId, animalIndex: reference.animalIndex, fingerprint: reference.fingerprint }),
  getAnimalRequestContext: (id: string, requestTypeId = "") => request("GET", `/animals/${encodeURIComponent(id)}/request-context${requestTypeId ? `?requestTypeId=${encodeURIComponent(requestTypeId)}` : ""}`),
  getReusedDocumentContent: (animalId: string, reference: ReusedDocumentReference) => request("GET", `/animals/${encodeURIComponent(animalId)}/documents/${encodeURIComponent(reference.sourceRequestId)}/${encodeURIComponent(reference.attachmentId)}?hash=${encodeURIComponent(reference.hash)}`, undefined, "blob"),
  consultAnimalByMicrochip: (body) => request("POST", "/animals/consult", body),
  createAnimalDeathRequest: (animalId, body) => request("POST", `/animals/${animalId}/death`, body),
  createAnimalTransferRequest: (animalId, body) => request("POST", `/animals/${animalId}/transfer`, body),

  getAdoptions: (municipalityId?: string) => request("GET", municipalityId ? `/adoptions?municipalityId=${encodeURIComponent(municipalityId)}` : "/adoptions"),
  consultAdoptionsByCredentials: (cpf, validationKey, municipalityId) => request("POST", "/adoptions/consult", { cpf, validationKey, municipalityId }),
  createAdoption: (body) => request("POST", "/adoptions", body),
  updateAdoption: (id, body) => request("PATCH", `/adoptions/${id}`, body),
  deleteAdoption: (id) => request("DELETE", `/adoptions/${id}`),
  registerInterest: (id, body, municipalityId) => request("POST", `/adoptions/${id}/interest`, { ...body, municipalityId }),
  getInterests: (id) => request("GET", `/adoptions/${id}/interests`),
  removeInterest: (id, index) => request("DELETE", `/adoptions/${id}/interest/${index}`),

  getAccessRequests: () => request("GET", "/access-requests"),
  createAccessRequest: (body) => request("POST", "/access-requests", body),
  reviewAccessRequest: (id, body) => request("PATCH", `/access-requests/${id}/review`, body),

  getSchedule: (municipalityId = "") => request("GET", municipalityId ? `/schedule?municipalityId=${encodeURIComponent(municipalityId)}` : "/schedule"),
  getScheduleAvailability: (municipalityId: string, from: string, to: string) => request("GET", `/schedule/availability?municipalityId=${encodeURIComponent(municipalityId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  createScheduleDay: (body) => request("POST", "/schedule", body),
  bulkCreateScheduleDays: (body) => request("POST", "/schedule/bulk", body),
  updateScheduleDay: (id, body) => request("PATCH", `/schedule/${id}`, body),
  deleteScheduleDay: (id) => request("DELETE", `/schedule/${id}`),

  getConfig: (key, municipalityId = "") => request("GET", municipalityId ? `/config/${key}?municipalityId=${encodeURIComponent(municipalityId)}` : `/config/${key}`),
  testSmsConnection: (body: { municipalityId: string; token?: string }) => request("POST", "/sms/test-connection", body),
  setConfig: (key, value, municipalityId = "") => request(
    "PUT",
    municipalityId ? `/config/${key}?municipalityId=${encodeURIComponent(municipalityId)}` : `/config/${key}`,
    value,
  ),

  getMunicipalities: () => request("GET", "/municipalities"),
  getMunicipalitiesAdmin: () => request("GET", "/municipalities/admin"),
  createMunicipality: (body) => request("POST", "/municipalities", body),
  updateMunicipality: (id, body) => request("PATCH", `/municipalities/${id}`, body),

  validateDocument: (body) => request("POST", "/ai/validate", body),

  getWhatsappQuotaStatus: (municipalityId: string) => request("GET", `/whatsapp/quota-status?municipalityId=${encodeURIComponent(municipalityId)}`),
  resetWhatsappQuota: (municipalityId: string) => request("POST", "/whatsapp/reset-quota", { municipalityId }),
  sendWhatsappTest: (municipalityId: string, phone: string) => request("POST", "/whatsapp/test", { municipalityId, phone }),
};
