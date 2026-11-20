import { AuthAudience, AuthErrorCode } from "../shared/auth-contract.js";
import { readSubmittedRequest } from "./features/tutor-access/submission-envelope";
import type { AuthChallenge, AuthRequestOptions, RecoveryContext, SessionUser } from "./features/tutor-access/auth-types";
import type { PreviousAnimalCandidate, ReusedDocumentReference } from "./features/registered-animals/registered-animal-types";
import type { AnimalDeathPayload, AnimalRecord, AnimalTransferPayload, CreatedAnimalRequest } from "./features/animal-services/animal-service-types";
import type { TrackedRequest, TrackingSession, TrackingStartBody } from "./features/request-tracking/tracking-types";
import type { AccessSession, AccessStartBody, AccessView } from "./features/request-access/access-types";
import type { MessageQuotaInput, MessageQuotaStatus } from "./features/message-contract/message-contract-types";
import type { SmsAccountInput } from "./features/sms/sms-types";
import type { WhatsappTemplateList } from "./features/whatsapp-integration/whatsapp-integration-types";
import type { EmailAccountInput, EmailSettings } from "./features/email/email-integration-types";

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

export function isInvalidSession(error: unknown) {
  return error instanceof ApiError && error.status === 401 && (error.code === AuthErrorCode.SESSION_INVALID
    // Accept the backend's previous responses while the two builds are being updated.
    || error.message === "Sessão inválida ou expirada." || error.message === "Sessão expirada.");
}

function getToken() {
  return localStorage.getItem("castragestao:token");
}

function headers(json = true, bearerToken?: string) {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const token = bearerToken ?? getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request(method: string, path: string, body?: unknown, responseType: "json" | "blob" = "json", options?: AuthRequestOptions) {
  const requestToken = getToken();
  const requestSessionVersion = sessionMutationVersion;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(true, options?.bearerToken),
    body: body ? JSON.stringify(body) : undefined,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const failure = new ApiError(err?.error || res.statusText, res.status, err?.code || "", Number(err?.retryAfter || res.headers.get("Retry-After")) || 0);
    if (isInvalidSession(failure) && (err?.error || err?.code === AuthErrorCode.SESSION_INVALID)
      && !options?.bearerToken && path !== "/auth/login" && requestToken && requestToken === getToken()
      && requestSessionVersion === sessionMutationVersion && !options?.signal?.aborted && options?.isCurrent?.() !== false
      && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
    }
    throw failure;
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
  async getSession(options?: Pick<AuthRequestOptions, "signal">): Promise<{ user: SessionUser }> {
    const token = getToken();
    const version = sessionMutationVersion;
    const session = await request("GET", "/auth/me", undefined, "json", options);
    if (token !== getToken() || version !== sessionMutationVersion || options?.signal?.aborted) {
      throw new DOMException("Operação encerrada.", "AbortError");
    }
    const user = session?.user;
    if (typeof user?.id !== "string" || !user.id || typeof user.role !== "string" || !user.role || typeof user.mustChangePassword !== "boolean") {
      throw new ApiError("Resposta de autenticação indisponível.", 502);
    }
    return { user };
  },
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
  getRequestTutor: (requestId: string, municipalityId = "") => request("GET", `/auth/request-tutor/${encodeURIComponent(requestId)}${municipalityId ? `?municipalityId=${encodeURIComponent(municipalityId)}` : ""}`),
  updateRequestTutor: (requestId: string, body: Record<string, string>, municipalityId = "") => request("PUT", `/auth/request-tutor/${encodeURIComponent(requestId)}`, municipalityId ? { ...body, municipalityId } : body),
  upsertAuthUser: (body) => request("PUT", "/auth/users", body),
  logout() {
    sessionMutationVersion += 1;
    localStorage.removeItem("castragestao:token");
  },

  getRequests: () => request("GET", "/requests"),
  async createRequest(body) {
    return readSubmittedRequest(await request("POST", "/requests", body));
  },
  patchRequest: (id, patch) => request("PATCH", `/requests/${id}`, patch),
  runProcedureAction: (id, action) => request("POST", `/requests/${id}/procedures/action`, action),
  deleteRequest: (id) => request("DELETE", `/requests/${id}`),

  lookupAnimalByMicrochip: (microchip) => request("POST", "/animals/lookup", { microchip }),
  getMyAnimals: (query = "", cursor = "") => request("GET", `/animals/mine?query=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
  resolvePreviousAnimal: (reference: PreviousAnimalCandidate) => request("POST", "/animals/from-request", { sourceRequestId: reference.sourceRequestId, animalIndex: reference.animalIndex, fingerprint: reference.fingerprint }),
  getAnimalRequestContext: (id: string, requestTypeId = "") => request("GET", `/animals/${encodeURIComponent(id)}/request-context${requestTypeId ? `?requestTypeId=${encodeURIComponent(requestTypeId)}` : ""}`),
  getReusedDocumentContent: (animalId: string, reference: ReusedDocumentReference) => request("GET", `/animals/${encodeURIComponent(animalId)}/documents/${encodeURIComponent(reference.sourceRequestId)}/${encodeURIComponent(reference.attachmentId)}?hash=${encodeURIComponent(reference.hash)}`, undefined, "blob"),
  consultAnimalByMicrochip: (body) => request("POST", "/animals/consult", body),
  consultAnimalById: (animalId: string): Promise<AnimalRecord> => request("POST", "/animals/consult", { animalId }),
  createAnimalDeathRequest: (animalId: string, body: AnimalDeathPayload): Promise<CreatedAnimalRequest> => request("POST", `/animals/${encodeURIComponent(animalId)}/death`, body),
  createAnimalTransferRequest: (animalId: string, body: AnimalTransferPayload): Promise<CreatedAnimalRequest> => request("POST", `/animals/${encodeURIComponent(animalId)}/transfer`, body),

  startRequestTracking: (body: TrackingStartBody, options?: AuthRequestOptions): Promise<AuthChallenge> => request("POST", "/request-tracking/challenges", body, "json", options),
  confirmRequestTracking: (challengeId: string, code: string, options?: AuthRequestOptions): Promise<TrackingSession> => request("POST", `/request-tracking/challenges/${encodeURIComponent(challengeId)}/confirm`, { code }, "json", options),
  getTrackedRequest: (token: string, options?: AuthRequestOptions): Promise<{ request: TrackedRequest }> => request("GET", "/request-tracking/request", undefined, "json", { ...options, bearerToken: token }),

  requestAccess: {
    start: (body: AccessStartBody, options?: AuthRequestOptions): Promise<AuthChallenge> => request("POST", "/request-access/challenges", body, "json", options),
    confirm: (challengeId: string, body: { code: string; cpf: string }, options?: AuthRequestOptions): Promise<AccessSession> => request("POST", `/request-access/challenges/${encodeURIComponent(challengeId)}/confirm`, body, "json", options),
    view: (token: string, options?: AuthRequestOptions): Promise<AccessView> => request("GET", "/request-access/request", undefined, "json", { ...options, bearerToken: token }),
    // The tutor's account is born here and signs in at once, as a login does.
    async createPassword(token: string, password: string, options?: AuthRequestOptions): Promise<SessionUser> {
      const version = ++sessionMutationVersion;
      const data = await request("POST", "/request-access/password", { password }, "json", { ...options, bearerToken: token });
      if (version !== sessionMutationVersion || options?.signal?.aborted || options?.isCurrent?.() === false) throw new DOMException("Operação encerrada.", "AbortError");
      localStorage.setItem("castragestao:token", data.token);
      return data.user;
    },
  },

  getAdoptions: (municipalityId?: string) => request("GET", municipalityId ? `/adoptions?municipalityId=${encodeURIComponent(municipalityId)}` : "/adoptions"),
  getPublicAdoption: (id: string) => request("GET", `/adoptions/${encodeURIComponent(id)}/public`),
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
  getEmailSettings: (municipalityId = ""): Promise<EmailSettings> => request("GET", municipalityId ? `/email/settings?municipalityId=${encodeURIComponent(municipalityId)}` : "/email/settings"),
  saveEmailAccount: (body: EmailAccountInput, municipalityId = ""): Promise<EmailSettings> => request("PUT", municipalityId ? `/email/account?municipalityId=${encodeURIComponent(municipalityId)}` : "/email/account", body),
  saveEmailTemplates: (templates: Record<string, string>, municipalityId = ""): Promise<EmailSettings> => request("PUT", municipalityId ? `/email/templates?municipalityId=${encodeURIComponent(municipalityId)}` : "/email/templates", { templates }),
  setEmailUseActive: (municipalityId: string, use: string, active: boolean): Promise<EmailSettings> => request("PUT", `/email/templates/active?municipalityId=${encodeURIComponent(municipalityId)}`, { use, active }),
  getSmsSettings: (municipalityId = ""): Promise<unknown> => request("GET", municipalityId ? `/sms/settings?municipalityId=${encodeURIComponent(municipalityId)}` : "/sms/settings"),
  saveSmsAccount: (body: SmsAccountInput, municipalityId = ""): Promise<unknown> => request("PUT", municipalityId ? `/sms/account?municipalityId=${encodeURIComponent(municipalityId)}` : "/sms/account", body),
  getSmsAvailability: (municipalityId: string): Promise<{ active?: boolean } | null> => request("GET", `/sms/availability?municipalityId=${encodeURIComponent(municipalityId)}`),
  testSmsConnection: (body: { token?: string }) => request("POST", "/sms/test-connection", body),
  sendSmsTest: (municipalityId: string, phone: string) => request("POST", municipalityId ? `/sms/test-message?municipalityId=${encodeURIComponent(municipalityId)}` : "/sms/test-message", { phone }),
  setSmsUseActive: (municipalityId: string, use: string, active: boolean) => request("PUT", `/sms/uses/active?municipalityId=${encodeURIComponent(municipalityId)}`, { use, active }),
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

  getMessageQuota: (channel: string, municipalityId: string): Promise<MessageQuotaStatus | null> => request("GET", `/message-quota/${channel}?municipalityId=${encodeURIComponent(municipalityId)}`),
  saveMessageQuota: (channel: string, municipalityId: string, body: MessageQuotaInput): Promise<MessageQuotaStatus | null> => request("PUT", `/message-quota/${channel}?municipalityId=${encodeURIComponent(municipalityId)}`, body),
  resetMessageQuota: (channel: string, municipalityId: string): Promise<MessageQuotaStatus | null> => request("POST", `/message-quota/${channel}/reset?municipalityId=${encodeURIComponent(municipalityId)}`),
  setMessageService: (channel: string, municipalityId: string, enabled: boolean): Promise<MessageQuotaStatus | null> => request("PUT", `/message-quota/${channel}/enabled?municipalityId=${encodeURIComponent(municipalityId)}`, { enabled }),
  sendWhatsappTest: (municipalityId: string, phone: string) => request("POST", "/whatsapp/test", { municipalityId, phone }),
  getWhatsappTemplates: (municipalityId: string): Promise<WhatsappTemplateList> => request("GET", `/whatsapp/templates?municipalityId=${encodeURIComponent(municipalityId)}`),
  syncWhatsappTemplates: (municipalityId: string): Promise<WhatsappTemplateList> => request("POST", "/whatsapp/templates/sync", { municipalityId }),
  setWhatsappTemplateActive: (municipalityId: string, body: { name: string; language: string; active: boolean }): Promise<WhatsappTemplateList> => request("PUT", "/whatsapp/templates/active", { ...body, municipalityId }),
  setWhatsappTemplateLink: (municipalityId: string, body: { name: string; language: string; use: string; fields: string[] }): Promise<WhatsappTemplateList> => request("PUT", "/whatsapp/templates/link", { ...body, municipalityId }),
};
