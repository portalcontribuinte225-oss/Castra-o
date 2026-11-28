import type { AnyRecord } from "./types";
import { maskCpf, maskName } from "./utils";
import { normalizeDocumentReusePolicy } from "../shared/document-reuse-contract.js";
import { RequestKind, RequestOrigin, RequestStatus, RequestTag } from "../shared/request-contract.js";
import { animalRequestTypeIds } from "../shared/request-types-contract.js";

export const statuses = [
  RequestStatus.NEW,
  RequestStatus.SCHEDULED,
  RequestStatus.COMPLETED,
  RequestStatus.CANCELLED,
];

export const statusLabels: AnyRecord = {
  NOVA: "Nova",
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

export const RequestType = {
  PROCEDURE: RequestKind.PROCEDURE,
  ANIMAL_DEATH: RequestKind.DEATH,
  TUTOR_TRANSFER: RequestKind.TRANSFER,
  COMPLAINT: RequestKind.COMPLAINT,
} as const;

export const requestTypeDomainLabels: AnyRecord = {
  [RequestType.PROCEDURE]: "Procedimento",
  [RequestType.ANIMAL_DEATH]: "Óbito do animal",
  [RequestType.TUTOR_TRANSFER]: "Troca de tutor",
  [RequestType.COMPLAINT]: "Denúncia",
};

const REQUEST_TYPE_VALUES: string[] = Object.values(RequestType);

export function normalizeRequestType(type = "") {
  const value = String(type || "").trim();
  if (REQUEST_TYPE_VALUES.includes(value)) return value;
  // Any other text is the names of the procedures, which is how a procedure request stores its type.
  return RequestType.PROCEDURE;
}

export const initialDocumentTypes: AnyRecord[] = [];
export const initialRequestTypes: AnyRecord[] = [];
export const initialBreeds: AnyRecord[] = [];
export const initialNeighborhoods: AnyRecord[] = [];
export const initialSpecies: AnyRecord[] = [];
export const initialSizes: AnyRecord[] = [];
export const initialMunicipalities: AnyRecord[] = [];

export const accessRequesterTypes = [
  { id: "ONG", label: "ONG", sector: "ONGs", role: "ong" },
  { id: "PROTETOR", label: "Protetor de animais", sector: "Protetores", role: "protetor" },
];

export const aiProviderOptions: AnyRecord = {
  OpenAI: {
    keyUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
  },
  Anthropic: {
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],
  },
  Gemini: {
    keyUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
  },
};

export const initialAiSettings: AnyRecord = {
  active: false,
  provider: "OpenAI",
  model: "gpt-4o",
  apiKey: "",
  keyValid: null,
  lastValidatedAt: "",
  callCount: 0,
  lastUsedAt: "",
};

export const initialWhatsappSettings: AnyRecord = {
  integrated: false,
  phoneNumberId: "",
  wabaId: "",
  tokenVariable: "",
};

export const CONFIG_KEYS = {
  requestTypes: "castragestao:request-types",
  documentTypes: "castragestao:document-types",
  species: "castragestao:species",
  sizes: "castragestao:sizes",
  breeds: "castragestao:breeds",
  neighborhoods: "castragestao:neighborhoods",
  teams: "castragestao:teams",
  scheduleRules: "castragestao:schedule-rules",
  permissionGroups: "permission_groups",
  whatsapp: "whatsapp",
};

export const CONFIG_KEYS_LIST = Object.values(CONFIG_KEYS);

// Where the global administration's municipality filter is kept in the browser; it is cleared when the session ends.
export const GLOBAL_MUNICIPALITY_FILTER_KEY = "castragestao:globalMunicipalityFilterId";
export const initialTeams = { sectors: [], users: [] };

const DEFAULT_DOCUMENT_ACCEPT = ["image/jpeg", "image/png", "application/pdf"];
const DEFAULT_DOCUMENT_MAX_SIZE_MB = 5;

export const DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE = 0.55;

export function textToCriteriaList(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDocumentConfidence(value: any): number {
  if (value === undefined || value === null || value === "") return NaN;
  return Number(String(value).replace(",", "."));
}

export function normalizeDocumentAnalysisRules(rules: AnyRecord = {}, migrationSource: AnyRecord = {}): AnyRecord {
  const minimumConfidence = parseDocumentConfidence(rules.minimumConfidence);
  return {
    expectedDocument: String(rules.expectedDocument || migrationSource.expectedDocument || "").trim().toUpperCase(),
    requiredCriteria: textToCriteriaList(rules.requiredCriteria ?? migrationSource.requiredCriteria),
    rejectionCriteria: textToCriteriaList(rules.rejectionCriteria ?? migrationSource.rejectionCriteria),
    matchRules: Array.isArray(rules.matchRules) ? rules.matchRules : [],
    minimumConfidence: Number.isFinite(minimumConfidence)
      ? Math.max(0, Math.min(1, minimumConfidence))
      : DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE,
    useAi: rules.useAi !== false,
  };
}

export function normalizeDocumentType(document: AnyRecord = {}): AnyRecord {
  const {
    modelHint,
    aiCriteria,
    rejectionRules,
    analysisRules,
    ...rest
  } = document;

  return {
    ...rest,
    ...normalizeDocumentReusePolicy(document),
    required: document.required !== false,
    active: document.active !== false,
    accept: Array.isArray(document.accept) && document.accept.length ? document.accept : DEFAULT_DOCUMENT_ACCEPT,
    maxSizeMb: Number(document.maxSizeMb) > 0 ? Number(document.maxSizeMb) : DEFAULT_DOCUMENT_MAX_SIZE_MB,
    analysisRules: normalizeDocumentAnalysisRules(analysisRules, {
      expectedDocument: modelHint || document.name || "",
      requiredCriteria: aiCriteria,
      rejectionCriteria: rejectionRules,
    }),
  };
}

export function normalizeScheduleSlots(inputSlots: any, fallbackTime = "08:00", fallbackVacancies: any = 0) {
  const slots = Array.isArray(inputSlots) ? inputSlots : [];
  const normalized = slots
    .map((slot) => ({
      time: String(slot?.time || "").trim(),
      vacancies: Math.max(Number(slot?.vacancies) || 0, 0),
    }))
    .filter((slot) => slot.time && slot.vacancies > 0);

  if (normalized.length > 0) return normalized.sort((left, right) => left.time.localeCompare(right.time));
  return [{
    time: fallbackTime || "08:00",
    vacancies: Math.max(Number(fallbackVacancies) || 0, 0),
  }];
}

export function sumScheduleSlotsVacancies(slots: any, fallbackTime = "08:00", fallbackVacancies: any = 0) {
  return normalizeScheduleSlots(slots, fallbackTime, fallbackVacancies).reduce((sum, slot) => sum + slot.vacancies, 0);
}

export function formatScheduleDate(date: Date) {
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
}

function getScheduleWeekdayLabel(date: Date) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][date.getDay()];
}

export function generateScheduleDaysFromRule(rule: AnyRecord) {
  const isMutirao = String(rule.kind || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "mutirao";
  const occurrences = Array.isArray(rule.occurrences) ? rule.occurrences : [];

  if (isMutirao && occurrences.length) {
    return occurrences
      .map((occurrence: AnyRecord, index: number) => {
        const dateText = normalizeScheduleDateText(occurrence.date || occurrence.start || "");
        if (!dateText) return null;
        const [day, month, year] = dateText.split("/").map(Number);
        const date = new Date(year, month - 1, day);
        const slots = normalizeScheduleSlots(occurrence.slots, occurrence.time || rule.time, occurrence.vacancies || rule.vacancies);
        const vacancies = sumScheduleSlotsVacancies(slots, occurrence.time || rule.time, occurrence.vacancies || rule.vacancies);
        return {
          date: dateText,
          weekday: getScheduleWeekdayLabel(date),
          vacancies,
          slots,
          active: rule.active !== false && occurrence.active !== false,
          scheduleRuleId: rule.id,
          occurrenceId: occurrence.id || `${rule.id}_occ_${index + 1}`,
          description: rule.description,
          startTime: slots[0]?.time || occurrence.time || rule.time,
          kind: rule.kind,
          municipalityId: rule.municipalityId,
          municipalityName: rule.municipalityName,
          locationName: occurrence.locationName || rule.locationName,
          locationAddress: occurrence.locationAddress || rule.locationAddress,
          addressUrl: occurrence.addressUrl || rule.addressUrl,
          latitude: occurrence.latitude || rule.latitude,
          longitude: occurrence.longitude || rule.longitude,
        };
      })
      .filter(Boolean);
  }

  const [startDay, startMonth, startYear] = rule.start.split("/").map(Number);
  const [endDay, endMonth, endYear] = rule.end.split("/").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const days = [];
  const slots = normalizeScheduleSlots(rule.slots, rule.time, rule.vacancies);
  const vacancies = sumScheduleSlotsVacancies(slots, rule.time, rule.vacancies);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (!rule.weekdays.includes(date.getDay())) continue;
    days.push({
      date: formatScheduleDate(date),
      weekday: getScheduleWeekdayLabel(date),
      vacancies,
      slots,
      active: rule.active !== false,
      scheduleRuleId: rule.id,
      description: rule.description,
      startTime: slots[0]?.time || rule.time,
      kind: rule.kind,
      municipalityId: rule.municipalityId,
      municipalityName: rule.municipalityName,
      locationName: rule.locationName,
      locationAddress: rule.locationAddress,
      addressUrl: rule.addressUrl,
      latitude: rule.latitude,
      longitude: rule.longitude,
    });
  }

  return days;
}

export function formatSizeRange(size: AnyRecord = {}) {
  const start = String(size.weightStart ?? "").trim();
  const end = String(size.weightEnd ?? "").trim();
  const unit = String(size.weightUnit || "kg").trim();
  if (start && end) return `${start}-${end} ${unit}`;
  return size.description || "";
}

const REQUEST_STATUSES: string[] = Object.values(RequestStatus);

// The status of a request; a value the system does not write reads as a new request.
function normalizeRequestStatus(status: unknown): string {
  return REQUEST_STATUSES.includes(String(status)) ? String(status) : RequestStatus.NEW;
}

export function requestHasTag(request: AnyRecord, tag: string) {
  return Array.isArray(request?.tags) && request.tags.includes(tag);
}

export function requestResultLabel(request: AnyRecord = {}) {
  const cancelReason = request.workflow_data?.cancelReason || request.workflowData?.cancelReason || "";
  if (request.status === "CANCELADA" && cancelReason) return cancelReason;
  return statusLabels[request.status] || request.status || "Sem status";
}

export function triageStatusTone(request: AnyRecord = {}) {
  if (request.status === RequestStatus.NEW) return requestHasTag(request, RequestTag.ASSIGNED) ? "triage-status--analysis" : "triage-status--inbox";
  if (request.status === "AGENDADA") return "triage-status--surgery";
  if (request.status === "REALIZADA") return "triage-status--archived";
  if (request.status === "CANCELADA") return "triage-status--archived";
  return "";
}

export function displayText(value = "") {
  const text = String(value || "").trim();
  const labels: AnyRecord = {
    "Animal nao informado": "Animal não informado",
    "Comprovante de Residência": "Comprovante de Residência",
    "Endereco completo": "Endereço completo",
    "Endereço completo": "Endereço completo",
    "Gestao Municipal": "Gestão Municipal",
    "Médio": "Médio",
    "Nao": "Não",
    "Nao compareceu": "Não compareceu",
    "Nao informado": "Não informado",
    "Nao se aplica": "Não se aplica",
    "Tutor nao informado": "Tutor não informado",
    animal_rua: "Animal de rua",
    ninhada: "Ninhada",
    castracao: "Castração",
  };
  return labels[text] || text;
}

export function requestTypeLabel(request: AnyRecord = {}) {
  const labels: AnyRecord = {
    ANIMAL_OBITO: "Óbito do animal",
    TROCA_TUTOR: "Troca de tutor",
    animal_rua: "Animal de rua",
    ninhada: "Ninhada",
    Microchipagem: "Microchipagem",
    Ambos: "Castração e microchipagem",
    Castracao: "Castração",
    castracao: "Castração",
    "Castração": "Castração",
  };
  const type = request.type || request.request_type || request.requestTypeId || "";
  return labels[type] || displayText(type) || "Castração";
}

// The procedures a request was made with, each by its own name as stored when it was made; empty for a request that is not a procedure.
export function storedRequestTypeNames(request: AnyRecord = {}): string[] {
  const workflow = request.workflowData || request.workflow_data || {};
  const names: string[] = Array.isArray(workflow.requestTypeNames) ? workflow.requestTypeNames.filter((name) => typeof name === "string" && name.trim()) : [];
  return [...new Set(names.map((name) => requestTypeLabel({ type: name })))];
}

// The procedures asked for one animal of a request, by name: the animal keeps their ids, the request the names that go with them.
export function animalProcedureLabels(animal: AnyRecord = {}, request: AnyRecord = {}): string[] {
  const workflow = request.workflowData || request.workflow_data || {};
  const ids: string[] = Array.isArray(workflow.requestTypeIds) ? workflow.requestTypeIds : [];
  const names: string[] = Array.isArray(workflow.requestTypeNames) ? workflow.requestTypeNames : [];
  return animalRequestTypeIds(animal).map((id) => names[ids.indexOf(id)]).filter((name) => typeof name === "string" && name.trim()).map((name) => requestTypeLabel({ type: name }));
}

// Each procedure of a request by its own name; a request that is not a procedure has the label of its kind.
export function requestTypeLabels(request: AnyRecord = {}): string[] {
  const names = storedRequestTypeNames(request);
  return names.length ? names : [requestTypeLabel(request)];
}

export function normalizeRequest(request: AnyRecord = {}): AnyRecord {
  const workflowData = request.workflowData || request.workflow_data || {};
  const status = normalizeRequestStatus(request.status);
  const tags = [...new Set((Array.isArray(request.tags) ? request.tags : []).filter(Boolean))];
  const animals = Array.isArray(request.animals) && request.animals.length
    ? request.animals
    : [
        {
          name: request.animal_name || request.animalName || "Animal não informado",
          species: request.species || "Não informado",
          size: request.size || "Não informado",
          sex: request.sex || "Não informado",
          age: request.birthDate || request.birth_date || request.age || "",
          birthDate: request.birthDate || request.birth_date || "",
          procedure: request.procedure || request.request_type || request.type || "",
          microchip: request.microchip || request.animal_microchip || request.animalMicrochip || request.microchip_number || request.microchipNumber || "",
        },
      ];

  const rawHistory = Array.isArray(request.rawHistory) ? request.rawHistory : Array.isArray(request.history) ? request.history : [];
  const history = rawHistory.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object") return [];
    return [[item.status, item.title, item.notes, item.by ? `por ${item.by}` : "", item.at].filter(Boolean).join(" - ")];
  });
  const rescheduleCount = rawHistory.filter(
    (item) => typeof item === "object" && item !== null && !item.notification && /reagendad/i.test(`${item.title || ""} ${item.notes || ""}`),
  ).length || (tags.includes(RequestTag.RESCHEDULED) ? 1 : 0);

  return {
    ...request,
    status,
    tags,
    origin: request.origin || RequestOrigin.PUBLIC,
    rescheduleCount,
    protocol: request.protocol || String(request.id || "").slice(0, 8).toUpperCase() || "SEM-ID",
    signedAt: request.signedAt || request.signed_at || "",
    isConfidential: Boolean(request.isConfidential || request.is_confidential),
    tutor: (request.isConfidential || request.is_confidential)
      ? maskName(request.tutor || request.tutor_name || request.tutorName)
      : (request.tutor || request.tutor_name || request.tutorName || "Tutor não informado"),
    email: request.email || request.tutor_email || request.tutorEmail || "",
    cpf: (request.isConfidential || request.is_confidential) ? maskCpf(request.cpf) : (request.cpf || ""),
    phone: request.phone || "",
    cep: request.cep || "",
    address: request.address || "",
    neighborhood: request.neighborhood || "",
    city: request.city || "",
    state: request.state || "",
    type: request.type || request.request_type || "Castracao",
    requestTypeId: request.requestTypeId || request.request_type || "",
    preferredSchedule: request.preferredSchedule || request.schedule_date || request.appointment || "",
    appointment: request.appointment || request.schedule_date || "",
    createdAt: request.createdAt || request.created_at || "",
    updatedAt: request.updatedAt || request.updated_at || "",
    assignedSectorId: request.assignedSectorId || workflowData.assignedSectorId || "",
    assignedUserId: request.assignedUserId || workflowData.assignedUserId || "",
    assignedSectorName: workflowData.assignedSectorName ?? request.assignedSectorName ?? request.assigned_sector ?? "",
    responsible: workflowData.responsible ?? request.responsible ?? request.responsible_unit ?? "",
    scheduleLocationName: request.scheduleLocationName || request.schedule_location_name || "",
    scheduleAddress: request.scheduleAddress || request.schedule_address || "",
    scheduleAddressUrl: request.scheduleAddressUrl || request.schedule_address_url || "",
    municipalityId: request.municipalityId || request.municipality_id || "",
    municipalityName: request.municipalityName || request.municipality_name || request.municipality || request.scheduleMunicipality || request.schedule_municipality || "",
    scheduleMunicipality: request.scheduleMunicipality || request.schedule_municipality || "",
    responsibleUnit: request.responsibleUnit || request.responsible_unit || "",
    veterinarian: request.veterinarian || "",
    animalMicrochip: request.animalMicrochip || request.animal_microchip || animals.find((animal) => animal.microchip)?.microchip || "",
    previousSchedule: request.previousSchedule || workflowData.previousSchedule || "",
    scheduleTime: request.scheduleTime || request.schedule_time || workflowData.scheduleTime || workflowData.schedule_time || "",
    scheduleSlotTime: request.scheduleSlotTime || request.schedule_slot_time || workflowData.scheduleSlotTime || workflowData.schedule_slot_time || request.scheduleTime || request.schedule_time || "",
    rejectionReason: request.rejectionReason || workflowData.rejectionReason || "",
    rejectionNote: request.rejectionNote || workflowData.rejectionNote || "",
    performedProcedures: request.performedProcedures || workflowData.performedProcedures || "",
    attendanceNote: request.attendanceNote || workflowData.attendanceNote || "",
    isFarmer: Boolean(request.isFarmer || request.is_farmer || workflowData.isFarmer || workflowData.is_farmer),
    documents: Array.isArray(request.documents) ? request.documents : [],
    rawHistory,
    history,
    animals,
    targetTutorName: request.targetTutorName || request.target_tutor_name || "",
    targetTutorCpf: request.targetTutorCpf || request.target_tutor_cpf || "",
    targetTutorPhone: request.targetTutorPhone || request.target_tutor_phone || "",
    targetTutorEmail: request.targetTutorEmail || request.target_tutor_email || "",
    targetTutorAddress: request.targetTutorAddress || request.target_tutor_address || "",
    targetTutorNeighborhood: request.targetTutorNeighborhood || request.target_tutor_neighborhood || "",
    targetTutorCity: request.targetTutorCity || request.target_tutor_city || "",
    targetTutorState: request.targetTutorState || request.target_tutor_state || "",
    targetTutorCep: request.targetTutorCep || request.target_tutor_cep || "",
    deathDate: request.deathDate || request.death_date || "",
    deathCause: request.deathCause || request.death_cause || "",
    complaintDescription: request.complaintDescription || request.notes || "",
  };
}

export function normalizeScheduleDateText(dateText = "") {
  const value = String(dateText || "").trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return value;
}

export function isSameScheduleDate(dateText = "", targetDate = "") {
  const normalized = normalizeScheduleDateText(dateText);
  return normalized === targetDate || normalized.startsWith(`${targetDate} `);
}

export function isRequestOnScheduleDate(request: AnyRecord = {}, targetDate = "") {
  return [
    request.preferredSchedule,
    request.appointment,
    request.schedule_date,
  ].some((dateText) => isSameScheduleDate(dateText, targetDate));
}

export function normalizeScheduleDay(day: AnyRecord = {}) {
  const slots = normalizeScheduleSlots(day.slots, day.startTime || day.start_time || day.time, day.vacancies);
  return {
    ...day,
    date: normalizeScheduleDateText(day.date),
    vacancies: sumScheduleSlotsVacancies(slots, day.startTime || day.start_time || day.time, day.vacancies),
    slots,
    startTime: day.startTime || day.start_time || slots[0]?.time || "",
    municipalityId: day.municipalityId || day.municipality_id || "",
    scheduleRuleId: day.scheduleRuleId || day.schedule_rule_id || "",
    locationName: day.locationName || day.location_name || "",
    locationAddress: day.locationAddress || day.location_address || "",
    addressUrl: day.addressUrl || day.address_url || "",
  };
}

export function parseScheduleDate(dateText: string) {
  const [day, month, year] = normalizeScheduleDateText(dateText).split("/").map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function isPastScheduleDay(dateText: string) {
  const date = parseScheduleDate(dateText);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today.getTime();
}

export function getNextUpcomingMutirao(scheduleDays: AnyRecord[] = []) {
  return scheduleDays
    .filter((day) => day.active !== false && day.kind === "Mutirao" && !isPastScheduleDay(day.date))
    .sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date))[0] || null;
}

export function mergeTags(current: any[] = [], next: any[] = []) {
  return [...new Set([...(Array.isArray(current) ? current : []), ...next].filter(Boolean))];
}

export function getItemMunicipalityId(item: AnyRecord = {}) {
  return item.municipalityId || item.municipality_id || "";
}

export function filterByMunicipalityScope(items: any[] = [], municipalityId = "") {
  const list = Array.isArray(items) ? items : [];
  if (!municipalityId) return list;
  return list.filter((item) => getItemMunicipalityId(item) === municipalityId);
}
