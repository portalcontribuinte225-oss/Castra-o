import type { AnyRecord } from "./types";

export const statuses = [
  "NOVA",
  "AGENDADA",
  "REALIZADA",
  "CANCELADA",
];

export const statusLabels: AnyRecord = {
  NOVA: "Nova",
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

export const workflowTagLabels: AnyRecord = {
  REAGENDADA: "Reagendada",
  ATRIBUIDA: "Atribuída",
  PRIORIDADE: "Prioridade",
  RETORNO_TUTOR: "Retorno tutor",
  MUTIRAO: "Mutirão",
  MICROCHIP: "Microchip",
  OBITO: "Óbito",
  TROCA_TUTOR: "Troca de tutor",
};

export const hiddenWorkflowTags = new Set(["PRESENCIAL", "MICROCHIP"]);

export const brazilStatesFallback = [
  { id: 12, sigla: "AC", nome: "Acre" },
  { id: 27, sigla: "AL", nome: "Alagoas" },
  { id: 16, sigla: "AP", nome: "Amapá" },
  { id: 13, sigla: "AM", nome: "Amazonas" },
  { id: 29, sigla: "BA", nome: "Bahia" },
  { id: 23, sigla: "CE", nome: "Ceará" },
  { id: 53, sigla: "DF", nome: "Distrito Federal" },
  { id: 32, sigla: "ES", nome: "Espírito Santo" },
  { id: 52, sigla: "GO", nome: "Goiás" },
  { id: 21, sigla: "MA", nome: "Maranhão" },
  { id: 51, sigla: "MT", nome: "Mato Grosso" },
  { id: 50, sigla: "MS", nome: "Mato Grosso do Sul" },
  { id: 31, sigla: "MG", nome: "Minas Gerais" },
  { id: 15, sigla: "PA", nome: "Pará" },
  { id: 25, sigla: "PB", nome: "Paraíba" },
  { id: 41, sigla: "PR", nome: "Paraná" },
  { id: 26, sigla: "PE", nome: "Pernambuco" },
  { id: 22, sigla: "PI", nome: "Piauí" },
  { id: 33, sigla: "RJ", nome: "Rio de Janeiro" },
  { id: 24, sigla: "RN", nome: "Rio Grande do Norte" },
  { id: 43, sigla: "RS", nome: "Rio Grande do Sul" },
  { id: 11, sigla: "RO", nome: "Rondônia" },
  { id: 14, sigla: "RR", nome: "Roraima" },
  { id: 42, sigla: "SC", nome: "Santa Catarina" },
  { id: 35, sigla: "SP", nome: "São Paulo" },
  { id: 28, sigla: "SE", nome: "Sergipe" },
  { id: 17, sigla: "TO", nome: "Tocantins" },
];

export const initialDocumentTypes: AnyRecord[] = [];
export const initialRequestTypes: AnyRecord[] = [];
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
    models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-7"],
  },
  Gemini: {
    keyUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
  },
};

export const initialAiSettings: AnyRecord = { active: false, provider: "OpenAI", model: "gpt-4o", apiKey: "", endpoint: "" };

export const initialWhatsappSettings: AnyRecord = {
  active: false,
  provider: "cloud_api",
  phoneNumberId: "",
  accessToken: "",
  confirmationTemplate: "confirmacao_agenda_castracao",
  languageCode: "pt_BR",
  templateVariables: [
    "tutor_name",
    "schedule_date",
  ],
};

export const WHATSAPP_TEMPLATE_VARS = [
  { key: "tutor_name", label: "Nome do tutor" },
  { key: "schedule_date", label: "Data agendamento" },
  { key: "schedule_time", label: "Hora agendamento" },
  { key: "protocol", label: "Protocolo" },
  { key: "schedule_location_name", label: "Local" },
  { key: "schedule_address", label: "Endereço" },
  { key: "animal_name", label: "Nome do animal" },
  { key: "species", label: "Espécie" },
  { key: "city", label: "Município" },
  { key: "phone", label: "Telefone" },
  { key: "validation_key", label: "Chave digital" },
];

export const CONFIG_KEYS = {
  requestTypes: "castragestao:request-types",
  documentTypes: "castragestao:document-types",
  species: "castragestao:species",
  sizes: "castragestao:sizes",
  teams: "castragestao:teams",
  scheduleRules: "castragestao:schedule-rules",
  permissionGroups: "permission_groups",
  whatsapp: "whatsapp",
  whatsappQuota: "whatsapp_quota",
};

export const CONFIG_KEYS_LIST = Object.values(CONFIG_KEYS);
export const initialTeams = { sectors: [], users: [] };
export const initialScheduleRules: AnyRecord[] = [];

const DEFAULT_DOCUMENT_ACCEPT = ["image/jpeg", "image/png", "application/pdf"];
const DEFAULT_DOCUMENT_MAX_SIZE_MB = 5;

export function normalizeDocumentType(document: AnyRecord = {}): AnyRecord {
  return {
    ...document,
    required: document.required !== false,
    active: document.active !== false,
    accept: Array.isArray(document.accept) && document.accept.length ? document.accept : DEFAULT_DOCUMENT_ACCEPT,
    maxSizeMb: Number(document.maxSizeMb) > 0 ? Number(document.maxSizeMb) : DEFAULT_DOCUMENT_MAX_SIZE_MB,
    modelHint: document.modelHint || "",
    aiCriteria: document.aiCriteria || "",
    rejectionRules: document.rejectionRules || "",
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

function generateScheduleDaysFromRule(rule: AnyRecord) {
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

export const initialScheduleDays = initialScheduleRules.flatMap(generateScheduleDaysFromRule);

export function formatSizeRange(size: AnyRecord = {}) {
  const start = String(size.weightStart ?? "").trim();
  const end = String(size.weightEnd ?? "").trim();
  const unit = String(size.weightUnit || "kg").trim();
  if (start && end) return `${start}-${end} ${unit}`;
  return size.description || "";
}

export function normalizeRequestStatus(status = "NOVA") {
  if (["NOVA", "AGENDADA", "REALIZADA", "CANCELADA"].includes(status)) return status;
  // Legacy status mapping
  if (["EM_ANALISE", "AGUARDANDO_TRIAGEM", "TRIAGEM", "SUBMETIDA", "AGUARDANDO_ATRIBUIR", "PENDENCIA_DOCUMENTAL"].includes(status)) return "NOVA";
  if (["AGUARDANDO_CIRURGIA", "DEFERIDA", "AGENDADA", "REAGENDADA"].includes(status)) return "AGENDADA";
  if (["REALIZADA", "CIRURGIA_REALIZADA"].includes(status)) return "REALIZADA";
  if (["INDEFERIDA", "CANCELADA", "ARQUIVADA"].includes(status)) return "CANCELADA";
  return "NOVA";
}

export function tagsFromLegacyStatus(status = "") {
  const map: AnyRecord = {
    REAGENDADA: ["REAGENDADA"],
  };
  return map[status] || [];
}

export function requestHasTag(request: AnyRecord, tag: string) {
  return Array.isArray(request?.tags) && request.tags.includes(tag);
}

export function requestResultTag(request: AnyRecord = {}) {
  return "";
}

export function visibleWorkflowTags(tags: string[] = [], _request: AnyRecord = {}) {
  return tags.filter((tag) => !hiddenWorkflowTags.has(tag));
}

export function requestResultLabel(request: AnyRecord = {}) {
  const cancelReason = request.workflow_data?.cancelReason || request.workflowData?.cancelReason || "";
  if (request.status === "CANCELADA" && cancelReason) return cancelReason;
  return statusLabels[request.status] || request.status || "Sem status";
}

export function triageStatusTone(request: AnyRecord = {}) {
  if (request.status === "NOVA") return requestHasTag(request, "ATRIBUIDA") ? "triage-status--analysis" : "triage-status--inbox";
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

export function normalizeRequest(request: AnyRecord = {}): AnyRecord {
  const workflowData = request.workflowData || request.workflow_data || {};
  const rawStatus = request.status || "NOVA";
  const status = normalizeRequestStatus(rawStatus);
  const rawTags = Array.isArray(request.tags) ? request.tags : [];
  // Strip flow-control tags that are now represented as status
  const flowControlTags = new Set(["DEFERIDA", "INDEFERIDA", "COMPARECEU", "NAO_COMPARECEU", "CANCELADA"]);
  const filteredRawTags = rawTags.filter((tag) => !flowControlTags.has(tag));
  const tags = [...new Set([...filteredRawTags, ...tagsFromLegacyStatus(rawStatus)].filter(Boolean))];
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

  const history = Array.isArray(request.history)
    ? request.history.map((item) => {
        if (typeof item === "string") return item;
        return [item.status, item.notes, item.by ? `por ${item.by}` : "", item.at]
          .filter(Boolean)
          .join(" - ");
      })
    : [];

  const rawHistory2 = Array.isArray(request.history) ? request.history : [];
  const rescheduleCount = rawHistory2.filter(
    (item) => typeof item === "object" && item !== null && (item.status === "REAGENDADA" || String(item.notes || "").toLowerCase().includes("reagendad")),
  ).length || (tags.includes("REAGENDADA") ? 1 : 0);

  return {
    ...request,
    status,
    tags,
    origin: request.origin || "PUBLICA",
    rescheduleCount,
    protocol: request.protocol || String(request.id || "").slice(0, 8).toUpperCase() || "SEM-ID",
    validationKey: request.validationKey || request.validation_key || "",
    signatureDataUrl: request.signatureDataUrl || request.signature_data_url || "",
    signedAt: request.signedAt || request.signed_at || "",
    tutor: request.tutor || request.tutor_name || request.tutorName || "Tutor não informado",
    email: request.email || request.tutor_email || request.tutorEmail || "",
    cpf: request.cpf || "",
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
    assignedSectorName: request.assignedSectorName || request.assigned_sector || workflowData.assignedSectorName || "",
    responsible: request.responsible || workflowData.responsible || request.responsible_unit || "",
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
    cadUnico: request.cadUnico || workflowData.cadUnico || "",
    cadUnicoNotApplicable: Boolean(request.cadUnicoNotApplicable || workflowData.cadUnicoNotApplicable),
    isFarmer: Boolean(request.isFarmer || request.is_farmer || workflowData.isFarmer || workflowData.is_farmer),
    documents: Array.isArray(request.documents) ? request.documents : [],
    rawHistory: Array.isArray(request.history) ? request.history : [],
    history,
    animals,
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
