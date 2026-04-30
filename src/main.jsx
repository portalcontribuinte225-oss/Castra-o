import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api.js";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Cat,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Dog,
  Eye,
  FileText,
  Filter,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  Lock,
  MapPin,
  Menu,
  Navigation,
  PawPrint,
  Plus,
  ClipboardList,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import "./styles.css";

const envUsers = [
  {
    role: "admin",
    name: "Administrador",
    email: import.meta.env.VITE_ADMIN_EMAIL || "",
    password: "",
  },
];

const statuses = [
  "EM_ANALISE",
  "AGUARDANDO_CIRURGIA",
  "ARQUIVADA",
];

const statusLabels = {
  EM_ANALISE: "Em análise",
  AGUARDANDO_CIRURGIA: "Aguardando cirurgia",
  ARQUIVADA: "Arquivada",
};

const workflowTagLabels = {
  REAGENDADA: "Reagendada",
  DEFERIDA: "Deferida",
  INDEFERIDA: "Indeferida",
  COMPARECEU: "Compareceu",
  NAO_COMPARECEU: "Nao compareceu",
  CANCELADA: "Cancelada",
  ATRIBUIDA: "Atribuída",
  PRIORIDADE: "Prioridade",
  RETORNO_TUTOR: "Retorno tutor",
  MUTIRAO: "Mutirão",
  PRESENCIAL: "Presencial",
  MICROCHIP: "Microchip",
  OBITO: "Óbito",
  TROCA_TUTOR: "Troca de tutor",
};

const menu = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "admin", label: "Solicitações de castração", icon: LayoutDashboard },
  { id: "credenciamento", label: "Credenciamentos", icon: ClipboardList },
  { id: "adocao", label: "Adoção", icon: HeartHandshake },
  { id: "relatorios", label: "Relatórios", icon: Activity },
  { id: "config", label: "Configurações", icon: Settings },
];

const configSidebarItems = [
  { id: "environment", label: "Configurar Ambiente" },
  { id: "users", label: "Criar Usuários" },
  { id: "sectors", label: "Criar Setores" },
];


const initialDocumentTypes = [
  {
    id: "cnh",
    name: "Carteira Nacional de Habilitação (CNH)",
    required: true,
    active: true,
    accept: ["image/jpeg", "image/png", "application/pdf"],
    maxSizeMb: 5,
    modelHint: "Documento oficial com nome, foto, número de registro e validade legíveis.",
    aiCriteria: "Nome completo; foto; número de registro; data de validade; documento sem cortes.",
    rejectionRules: "Imagem borrada; documento vencido; arquivo cortado; documento diferente de CNH.",
  },
  {
    id: "comprovante_residencia",
    name: "Comprovante de Residência",
    required: true,
    active: true,
    accept: ["image/jpeg", "image/png", "application/pdf"],
    maxSizeMb: 5,
    modelHint: "Comprovante recente com nome, endereço completo, cidade e data de emissão legíveis.",
    aiCriteria: "Nome; endereço completo; cidade; data de emissão recente; documento legível.",
    rejectionRules: "Endereço incompleto; cidade divergente; imagem ilegível; comprovante antigo.",
  },
];
const initialRequestTypes = [
  { id: "cadunico", name: "CadUnico", fee: "", billingAmount: "", active: true, documents: initialDocumentTypes },
  { id: "animal-de-rua", name: "Animal de Rua", fee: "", billingAmount: "", active: true, documents: initialDocumentTypes },
  { id: "ninhada", name: "Ninhada", fee: "", billingAmount: "", active: true, documents: initialDocumentTypes },
];
const DEFAULT_DOCUMENT_ACCEPT = ["image/jpeg", "image/png", "application/pdf"];
const DEFAULT_DOCUMENT_MAX_SIZE_MB = 5;

function normalizeDocumentType(document = {}) {
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
const initialSpecies = [
  { id: "canino", name: "Canino", active: true },
  { id: "felino", name: "Felino", active: true },
];
const initialSizes = [
  { id: "pequeno", name: "Pequeno", weightStart: "0", weightEnd: "5", weightUnit: "kg", description: "0-5 kg", active: true },
  { id: "medio", name: "Médio", weightStart: "5", weightEnd: "8", weightUnit: "kg", description: "5-8 kg", active: true },
  { id: "grande", name: "Grande", weightStart: "8", weightEnd: "12", weightUnit: "kg", description: "8-12 kg", active: true },
];
const initialMunicipalities = [];
const accessRequesterTypes = [
  { id: "ONG", label: "ONG", sector: "ONGs", role: "ong" },
  { id: "PROTETOR", label: "Protetor de animais", sector: "Protetores", role: "protetor" },
];
const defaultAccessSectors = accessRequesterTypes.map((type) => ({
  id: `setor_${type.id.toLowerCase()}`,
  name: type.sector,
  active: true,
}));
const aiProviderOptions = {
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
const initialAiSettings = { active: false, provider: "OpenAI", model: "gpt-4o", apiKey: "", endpoint: "" };
const AI_SETTINGS_STORAGE_KEY = "castragestao:ai-settings";
const CONFIG_KEYS = {
  requestTypes: "castragestao:request-types",
  documentTypes: "castragestao:document-types",
  species: "castragestao:species",
  sizes: "castragestao:sizes",
  municipalities: "castragestao:municipalities",
  teams: "castragestao:teams",
  scheduleRules: "castragestao:schedule-rules",
};
const initialTeams = { sectors: defaultAccessSectors, users: [] };
const initialScheduleRules = [
  {
    id: "agenda_recorrente_padrao_2026",
    description: "Agenda recorrente padrão 2026",
    createdAt: "01/01/2026 00:00:00",
    active: true,
    unavailable: false,
    type: "Recorrência",
    kind: "Agenda",
    repeatEvery: 1,
    weekdays: [1, 2, 3],
    start: "01/01/2026",
    end: "31/12/2026",
    time: "08:00",
    vacancies: 10,
    municipalityId: "",
    municipalityName: "",
    locationName: "",
    addressUrl: "",
    latitude: "",
    longitude: "",
  },
];

function formatScheduleDate(date) {
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
}

function getScheduleWeekdayLabel(date) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][date.getDay()];
}

function generateScheduleDaysFromRule(rule) {
  const [startDay, startMonth, startYear] = rule.start.split("/").map(Number);
  const [endDay, endMonth, endYear] = rule.end.split("/").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const days = [];

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (!rule.weekdays.includes(date.getDay())) continue;
    days.push({
      date: formatScheduleDate(date),
      weekday: getScheduleWeekdayLabel(date),
      vacancies: rule.vacancies,
      active: rule.active !== false,
      scheduleRuleId: rule.id,
      description: rule.description,
      startTime: rule.time,
      kind: rule.kind,
      municipalityId: rule.municipalityId,
      municipalityName: rule.municipalityName,
      locationName: rule.locationName,
      addressUrl: rule.addressUrl,
      latitude: rule.latitude,
      longitude: rule.longitude,
    });
  }

  return days;
}

const initialScheduleDays = initialScheduleRules.flatMap(generateScheduleDaysFromRule);

function formatSizeRange(size = {}) {
  const start = String(size.weightStart ?? "").trim();
  const end = String(size.weightEnd ?? "").trim();
  const unit = String(size.weightUnit || "kg").trim();
  if (start && end) return `${start}-${end} ${unit}`;
  return size.description || "";
}

function normalizeRequestStatus(status = "EM_ANALISE") {
  if (["EM_ANALISE", "AGUARDANDO_CIRURGIA", "ARQUIVADA"].includes(status)) return status;
  if (["AGUARDANDO_TRIAGEM", "TRIAGEM", "SUBMETIDA", "AGUARDANDO_ATRIBUIR", "PENDENCIA_DOCUMENTAL"].includes(status)) return "EM_ANALISE";
  if (["INDEFERIDA", "CANCELADA", "REALIZADA"].includes(status)) return "ARQUIVADA";
  if (["DEFERIDA", "AGENDADA", "REAGENDADA"].includes(status)) return "AGUARDANDO_CIRURGIA";
  return "EM_ANALISE";
}

function tagsFromLegacyStatus(status = "") {
  const map = {
    DEFERIDA: ["DEFERIDA"],
    AGENDADA: ["DEFERIDA"],
    INDEFERIDA: ["INDEFERIDA"],
    REALIZADA: ["DEFERIDA", "COMPARECEU"],
    CANCELADA: ["CANCELADA"],
    REAGENDADA: ["DEFERIDA", "REAGENDADA"],
  };
  return map[status] || [];
}

function requestHasTag(request, tag) {
  return Array.isArray(request?.tags) && request.tags.includes(tag);
}

function requestResultLabel(request = {}) {
  const resultOrder = ["COMPARECEU", "NAO_COMPARECEU", "INDEFERIDA", "CANCELADA", "DEFERIDA"];
  const tag = resultOrder.find((item) => requestHasTag(request, item));
  return tag ? workflowTagLabels[tag] : statusLabels[request.status] || request.status || "Sem status";
}

function requestTypeLabel(request = {}) {
  const labels = {
    ANIMAL_OBITO: "Óbito do animal",
    TROCA_TUTOR: "Troca de tutor",
    Microchipagem: "Microchipagem",
    Ambos: "Castração e microchipagem",
    Castracao: "Castração",
    "Castração": "Castração",
  };
  const type = request.type || request.request_type || request.requestTypeId || "";
  return labels[type] || type || "Castração";
}

function normalizeRequest(request = {}) {
  const workflowData = request.workflowData || request.workflow_data || {};
  const rawStatus = request.status || "EM_ANALISE";
  const status = normalizeRequestStatus(rawStatus);
  const rawTags = Array.isArray(request.tags) ? request.tags : [];
  const tags = [...new Set([...rawTags, ...tagsFromLegacyStatus(rawStatus)].filter(Boolean))];
  const animals = Array.isArray(request.animals) && request.animals.length
    ? request.animals
    : [
        {
          name: request.animal_name || request.animalName || "Animal nao informado",
          species: request.species || "Nao informado",
          size: request.size || "Nao informado",
          sex: request.sex || "Nao informado",
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

  return {
    ...request,
    status,
    tags,
    protocol: request.protocol || String(request.id || "").slice(0, 8).toUpperCase() || "SEM-ID",
    validationKey: request.validationKey || request.validation_key || "",
    signatureDataUrl: request.signatureDataUrl || request.signature_data_url || "",
    signedAt: request.signedAt || request.signed_at || "",
    tutor: request.tutor || request.tutor_name || request.tutorName || "Tutor nao informado",
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
    scheduleAddressUrl: request.scheduleAddressUrl || request.schedule_address_url || "",
    scheduleMunicipality: request.scheduleMunicipality || request.schedule_municipality || "",
    responsibleUnit: request.responsibleUnit || request.responsible_unit || "",
    veterinarian: request.veterinarian || "",
    animalMicrochip: request.animalMicrochip || request.animal_microchip || animals.find((animal) => animal.microchip)?.microchip || "",
    previousSchedule: request.previousSchedule || workflowData.previousSchedule || "",
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

function normalizeScheduleDay(day = {}) {
  return {
    ...day,
    locationName: day.locationName || day.location_name || "",
    addressUrl: day.addressUrl || day.address_url || "",
  };
}

function mergeTags(current = [], next = []) {
  return [...new Set([...(Array.isArray(current) ? current : []), ...next].filter(Boolean))];
}

function App() {
  const [currentUser, setCurrentUserRaw] = useState(() => {
    try {
      const saved = localStorage.getItem("castragestao:user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem("castragestao:user", JSON.stringify(user));
    } else {
      localStorage.removeItem("castragestao:user");
      api.logout();
    }
    setCurrentUserRaw(user);
  }
  const [active, setActive] = useState("admin");
  const [configArea, setConfigArea] = useState("environment");
  const [requests, setRequests] = useState([]);
  const [adoptionAnimals, setAdoptionAnimals] = useState([]);
  const [requestTypes, setRequestTypes] = useState(() => readStoredJson(CONFIG_KEYS.requestTypes, initialRequestTypes));
  const [documentTypes, setDocumentTypes] = useState(() => readStoredJson(CONFIG_KEYS.documentTypes, initialDocumentTypes));
  const [speciesOptions, setSpeciesOptions] = useState(() => readStoredJson(CONFIG_KEYS.species, initialSpecies));
  const [sizeOptions, setSizeOptions] = useState(() => readStoredJson(CONFIG_KEYS.sizes, initialSizes));
  const [municipalities, setMunicipalities] = useState(() => readStoredJson(CONFIG_KEYS.municipalities, initialMunicipalities));
  const [aiSettings, setAiSettings] = useState(() => ({
    ...initialAiSettings,
    ...readStoredJson(AI_SETTINGS_STORAGE_KEY, {}),
  }));
  const [scheduleDays, setScheduleDays] = useState(initialScheduleDays);
  const [scheduleRules, setScheduleRules] = useState(() => {
    const stored = readStoredJson(CONFIG_KEYS.scheduleRules, null);
    return Array.isArray(stored) && stored.length > 0 ? stored : initialScheduleRules;
  });
  const [teams, setTeams] = useState(() => normalizeTeams(readStoredJson(CONFIG_KEYS.teams, initialTeams)));
  const [accessRequests, setAccessRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [publicForm, setPublicForm] = useState(false);
  const [publicFormInitialScreen, setPublicFormInitialScreen] = useState("agenda");
  const [globalSearch, setGlobalSearch] = useState("");
  const [configMenuOpen, setConfigMenuOpen] = useState(true);

  const selected = requests.find((request) => request.id === selectedId) || requests[0] || null;
  const metrics = useMemo(() => buildMetrics(requests), [requests]);

  useEffect(() => {
    api.getAdoptions().then((list) => setAdoptionAnimals(list.map(normalizeAdoptionAnimal))).catch(console.error);
  }, []);

  useEffect(() => { localStorage.setItem(CONFIG_KEYS.requestTypes, JSON.stringify(requestTypes)); }, [requestTypes]);
  useEffect(() => { localStorage.setItem(CONFIG_KEYS.documentTypes, JSON.stringify(documentTypes)); }, [documentTypes]);
  useEffect(() => { localStorage.setItem(CONFIG_KEYS.species, JSON.stringify(speciesOptions)); }, [speciesOptions]);
  useEffect(() => { localStorage.setItem(CONFIG_KEYS.sizes, JSON.stringify(sizeOptions)); }, [sizeOptions]);
  useEffect(() => { localStorage.setItem(CONFIG_KEYS.municipalities, JSON.stringify(municipalities)); }, [municipalities]);
  useEffect(() => { localStorage.setItem(CONFIG_KEYS.teams, JSON.stringify(teams)); }, [teams]);
  useEffect(() => { localStorage.setItem(CONFIG_KEYS.scheduleRules, JSON.stringify(scheduleRules)); }, [scheduleRules]);

  useEffect(() => {
    api.getConfig("ai").then((saved) => {
      if (saved && typeof saved === "object") {
        const merged = { ...initialAiSettings, ...saved, active: Boolean(saved.active) };
        const validModels = aiProviderOptions[merged.provider]?.models || [];
        if (validModels.length && !validModels.includes(merged.model)) merged.model = validModels[0];
        localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        setAiSettings(merged);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    api.getRequests().then((list) => setRequests(list.map(normalizeRequest))).catch(console.error);
    api.getAccessRequests().then((list) => setAccessRequests(list.map(normalizeAccessRequest))).catch(console.error);
    api.getSchedule().then((days) => {
      if (!days.length) return;
      setScheduleDays(days.map(normalizeScheduleDay).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date)));
    }).catch(console.error);
  }, [currentUser]);

  async function patchRequest(requestId, patch, historyNote = "") {
    try {
      const updated = await api.patchRequest(requestId, historyNote ? { ...patch, history_note: historyNote } : patch);
      setRequests((current) => current.map((r) => (r.id === updated.id ? normalizeRequest(updated) : r)));
    } catch (err) {
      console.error("Erro ao atualizar solicitação:", err);
    }
  }

  async function createRequest(payload) {
    try {
      const newRequest = await api.createRequest({
        animal_name: payload.animalName || payload.animal_name,
        species: payload.species,
        size: payload.size,
        animal_id: payload.animal_id || payload.animalId || "",
        animal_microchip: payload.animal_microchip || payload.animalMicrochip || "",
        request_type: payload.requestType || payload.request_type,
        municipality: payload.municipality,
        notes: payload.notes,
        tutor_name: payload.tutor || currentUser?.name || "",
        tutor_email: payload.email || currentUser?.email || "",
        cpf: payload.cpf || "",
        phone: payload.phone || "",
        cep: payload.cep || "",
        address: payload.address || "",
        neighborhood: payload.neighborhood || "",
        city: payload.city || "",
        state: payload.state || "",
        preferredSchedule: payload.preferredSchedule || "",
        schedule_date: payload.preferredSchedule || payload.schedule_date || "",
        scheduleLocationName: payload.scheduleLocationName || "",
        scheduleAddressUrl: payload.scheduleAddressUrl || "",
        scheduleMunicipality: payload.scheduleMunicipality || "",
        responsibleUnit: payload.responsibleUnit || "",
        veterinarian: payload.veterinarian || "",
        animals: payload.animals || [],
        documents: payload.documents || [],
        signatureDataUrl: payload.signatureDataUrl || "",
        signedAt: payload.signedAt || "",
        type: payload.type || payload.requestType || payload.request_type || "",
        requestTypeId: payload.requestTypeId || "",
        fee: payload.fee || "",
        tags: payload.tags || [],
        workflow_data: payload.workflowData || payload.workflow_data || {},
      });
      registerCreatedRequest(newRequest, { openAdmin: Boolean(currentUser) });
      return newRequest;
    } catch (err) {
      console.error("Erro ao criar solicitação:", err);
    }
  }

  async function createAccessRequest(payload) {
    const created = await api.createAccessRequest(payload);
    return normalizeAccessRequest(created);
  }

  async function reviewAccessRequest(requestId, decision) {
    const updated = await api.reviewAccessRequest(requestId, decision);
    const normalized = normalizeAccessRequest(updated);
    setAccessRequests((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
    return normalized;
  }

  function registerCreatedRequest(newRequest, options = {}) {
    const normalized = normalizeRequest(newRequest);
    setRequests((current) => (
      current.some((request) => request.id === normalized.id)
        ? current.map((request) => (request.id === normalized.id ? normalized : request))
        : [normalized, ...current]
    ));
    if (normalized.id) setSelectedId(normalized.id);
    if (options.openAdmin && currentUser?.role === "admin") setActive("admin");
    return normalized;
  }

  if (publicForm) {
    return (
      <PublicCastrationForm
        createRequest={createRequest}
        onBack={() => setPublicForm(false)}
        initialScreen={publicFormInitialScreen}
        scheduleDays={scheduleDays}
        requestTypes={requestTypes}
        requests={requests}
        speciesOptions={speciesOptions}
        sizeOptions={sizeOptions}
        aiSettings={aiSettings}
        onRequestCreated={registerCreatedRequest}
      />
    );
  }

  function handleInterestSent(updated) {
    setAdoptionAnimals((current) => current.map((a) => a.id === updated.id ? normalizeAdoptionAnimal(updated) : a));
  }

  if (!currentUser) {
    return (
      <LoginView
        onLogin={setCurrentUser}
        onPublicRequest={() => { setPublicFormInitialScreen("formulario"); setPublicForm(true); }}
        onPublicConsult={() => { setPublicFormInitialScreen("consulta"); setPublicForm(true); }}
        onAccessRequest={createAccessRequest}
        adoptionAnimals={adoptionAnimals}
        onInterestSent={handleInterestSent}
      />
    );
  }

  const visibleMenu = menu;

  const ActiveView = {
    admin: AdminDashboard,
    adocao: AdoptionView,
    credenciamento: AccessRequestsView,
    dashboard: DashboardView,
    relatorios: ReportsView,
    config: ConfigView,
  }[active];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <PawPrint size={24} />
          </div>
          <div>
            <strong>Sistema municipal</strong>
          </div>
        </div>

        <nav aria-label="Menu principal">
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.id}>
                <button
                  className={`${active === item.id ? "active" : ""} ${item.id === "config" ? "sidebar-parent" : ""}`}
                  onClick={() => {
                    if (item.id === "config") {
                      setConfigMenuOpen((current) => (active === "config" ? !current : true));
                      setActive("config");
                      return;
                    }
                    setActive(item.id);
                    setMobileOpen(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.id === "config" && (
                    <ChevronRight className={configMenuOpen ? "sidebar-chevron open" : "sidebar-chevron"} size={16} />
                  )}
                </button>
                {item.id === "config" && active === "config" && configMenuOpen && (
                  <div className="sidebar-subnav" aria-label="Subabas de configurações">
                    {configSidebarItems.map((subitem) => (
                      <button
                        key={subitem.id}
                        className={configArea === subitem.id ? "active" : ""}
                        type="button"
                        onClick={() => {
                          setActive("config");
                          setConfigArea(subitem.id);
                          setMobileOpen(false);
                        }}
                      >
                        {subitem.label}
                      </button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-user">
            <ShieldCheck size={18} />
            <div className="public-animal-meta">
              <strong>{currentUser.name || "Usuário"}</strong>
              <span>{userRoleLabel(currentUser.role)}</span>
            </div>
          </div>
          <button className="logout-button" onClick={() => setCurrentUser(null)}>
            Sair
          </button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div className="main-reader">
            <h1>Sistema de gestão de castração animal</h1>
          </div>
          <div className="topbar-actions">
            <label className="topbar-search" aria-label="Buscar no sistema">
              <Search size={20} />
              <input
                type="search"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Protocolo, CPF, tutor, microchip..."
              />
            </label>
            <button className="icon-button" aria-label="Notificacoes">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <ActiveView
          requests={requests}
          selected={selected}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          metrics={metrics}
          patchRequest={patchRequest}
          createRequest={createRequest}
          adoptionAnimals={adoptionAnimals}
          setAdoptionAnimals={setAdoptionAnimals}
          currentUser={currentUser}
          scheduleDays={scheduleDays}
          requestTypes={requestTypes}
          documentTypes={documentTypes}
          setRequestTypes={setRequestTypes}
          setDocumentTypes={setDocumentTypes}
          speciesOptions={speciesOptions}
          setSpeciesOptions={setSpeciesOptions}
          sizeOptions={sizeOptions}
          setSizeOptions={setSizeOptions}
          municipalities={municipalities}
          setMunicipalities={setMunicipalities}
          aiSettings={aiSettings}
          setAiSettings={setAiSettings}
          setScheduleDays={setScheduleDays}
          scheduleRules={scheduleRules}
          setScheduleRules={setScheduleRules}
          teams={teams}
          setTeams={setTeams}
          accessRequests={accessRequests}
          reviewAccessRequest={reviewAccessRequest}
          setActive={setActive}
          configArea={configArea}
          globalSearch={globalSearch}
        />
      </main>
    </div>
  );
}

function readStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTeams(value = initialTeams) {
  const sectors = Array.isArray(value.sectors) ? value.sectors : [];
  const users = Array.isArray(value.users) ? value.users : [];
  const sectorNames = new Set(sectors.map((sector) => normalizeText(sector.name)));
  const missingSectors = defaultAccessSectors.filter((sector) => !sectorNames.has(normalizeText(sector.name)));
  return { sectors: [...sectors, ...missingSectors], users };
}

function normalizeAccessRequest(item = {}) {
  const requesterType = item.requesterType || item.requester_type || "";
  const type = accessRequesterTypes.find((option) => option.id === requesterType);
  return {
    ...item,
    requesterType,
    requesterLabel: type?.label || requesterType || "Solicitante",
    organizationName: item.organizationName || item.organization_name || "",
    responsibleName: item.responsibleName || item.responsible_name || "",
    intendedUse: item.intendedUse || item.intended_use || "",
    assignedSector: item.assignedSector || item.assigned_sector || type?.sector || "",
    reviewNote: item.reviewNote || item.review_note || "",
    temporaryPassword: item.temporaryPassword || item.temporary_password || "",
    createdAt: item.createdAt || item.created_at || "",
    reviewedAt: item.reviewedAt || item.reviewed_at || "",
    status: item.status || "PENDENTE",
  };
}

function userRoleLabel(role = "") {
  return {
    admin: "Admin",
    tutor: "Tutor",
    ong: "ONG",
    protetor: "Protetor",
    servidor_publico: "Servidor publico",
  }[role] || role || "Usuario";
}

function canManagePublicAnimalFlows(role = "") {
  return ["admin", "ong", "protetor", "servidor_publico"].includes(role);
}

function TutorMobileApp({
  currentUser,
  requests,
  createRequest,
  adoptionAnimals,
  setAdoptionAnimals,
  requestTypes,
  aiSettings,
  scheduleDays,
  speciesOptions,
  sizeOptions,
  onRequestCreated,
  setCurrentUser,
}) {
  const [screen, setScreen] = useState("home");
  const [selectedSchedule, setSelectedSchedule] = useState("");

  return (
    <main className="tutor-app">
      <header className="tutor-topbar">
        <div className="brand login-brand">
          <div className="brand-mark">
            <PawPrint size={22} />
          </div>
          <div>
            <strong>Sistema municipal</strong>
            <span>Ola, {currentUser.name}</span>
          </div>
        </div>
        <button className="ghost-button" onClick={() => setCurrentUser(null)}>
          Sair
        </button>
      </header>

      {screen === "home" && (
        <section className="tutor-home">
          <p className="tutor-home-intro">Selecione uma vaga disponivel e preencha os dados da castracao em seguida.</p>

          <PublicSchedulePicker
            requests={requests}
            scheduleDays={scheduleDays}
            selectedDate={selectedSchedule}
            requestTypes={requestTypes}
            onSelect={(date) => {
              setSelectedSchedule(date);
              setScreen("solicitacao");
            }}
          />

          <div className="tutor-action-grid compact-actions">
            <button className="tutor-big-action" onClick={() => setScreen("consulta")}>
              <Search size={28} />
              <strong>Consultar solicitacao</strong>
              <span>Ver protocolo e andamento</span>
            </button>
          </div>
        </section>
      )}

      {screen === "solicitacao" && (
        <section className="tutor-screen">
          <NewRequest
            createRequest={createRequest}
            currentUser={currentUser}
            compact
            onBack={() => setScreen("home")}
            onDone={() => setScreen("home")}
            requests={requests}
            scheduleDays={scheduleDays}
            requestTypes={requestTypes}
            aiSettings={aiSettings}
            speciesOptions={speciesOptions}
            sizeOptions={sizeOptions}
            initialSchedule={selectedSchedule}
          />
        </section>
      )}

      {screen === "consulta" && (
        <section className="tutor-screen">
          <button className="back-button" onClick={() => setScreen("home")}>
            Voltar
          </button>
          <ValidationKeyConsultation fallbackRequests={requests} currentUser={currentUser} onRequestCreated={onRequestCreated} />
        </section>
      )}

      {screen === "adocao" && (
        <section className="tutor-screen">
          <button className="back-button" onClick={() => setScreen("home")}>
            Voltar
          </button>
          <AdoptionView adoptionAnimals={adoptionAnimals} setAdoptionAnimals={setAdoptionAnimals} currentUser={currentUser} />
        </section>
      )}
    </main>
  );
}

const ADOPTION_STATUS_LABEL = { disponivel: "Disponível", em_processo: "Em processo", adotado: "Adotado" };

function ValidationKeyConsultation({ fallbackRequests = [], currentUser, onRequestCreated }) {
  const [microchip, setMicrochip] = useState("");
  const [cpf, setCpf] = useState(formatCpf(currentUser?.cpf || ""));
  const [validationKey, setValidationKey] = useState("");
  const [resultRequests, setResultRequests] = useState(null);
  const [resultAdoptions, setResultAdoptions] = useState([]);
  const [animalRecord, setAnimalRecord] = useState(null);
  const [status, setStatus] = useState("");
  const [searchOk, setSearchOk] = useState(false);
  const [isConsulting, setIsConsulting] = useState(false);

  const hasSearched = resultRequests !== null;
  const visibleRequests = hasSearched ? resultRequests : fallbackRequests;
  const normalizedVisibleRequests = (Array.isArray(visibleRequests) ? visibleRequests : []).map(normalizeRequest);
  const activeRequestsCount = normalizedVisibleRequests.filter((request) => request.status !== "ARQUIVADA").length;
  const nextRequest = normalizedVisibleRequests.find((request) => request.status !== "ARQUIVADA" && requestHasTag(request, "DEFERIDA") && (request.appointment || request.preferredSchedule));
  const nextAppointment = nextRequest ? nextRequest.appointment || nextRequest.preferredSchedule : "Nenhum";

  async function consult(event) {
    event.preventDefault();
    const cleanCpf = onlyDigits(cpf);
    const key = validationKey.trim();
    const chip = microchip.trim();
    const hasValidCredential = cleanCpf.length === 11 && !/^0+$/.test(cleanCpf) && Boolean(key);
    if (!chip && cleanCpf.length !== 11) {
      setStatus("Informe um CPF valido.");
      setSearchOk(false);
      return;
    }
    if (!chip && !key) {
      setStatus("Informe a chave de validação.");
      setSearchOk(false);
      return;
    }
    setStatus("Consultando...");
    setSearchOk(false);
    setIsConsulting(true);
    try {
      const [record, reqList, adoptList] = chip
        ? await Promise.all([
            api.consultAnimalByMicrochip({ microchip: chip, ...(hasValidCredential ? { cpf: cleanCpf, validationKey: key } : {}) }),
            Promise.resolve([]),
            Promise.resolve([]),
          ])
        : await Promise.all([
            Promise.resolve(null),
            api.consultRequestsByCredentials(cleanCpf, key),
            api.consultAdoptionsByCredentials(cleanCpf, key),
          ]);
      const normalizedReqs = Array.isArray(reqList) ? reqList.map(normalizeRequest) : [];
      const normalizedAdopts = Array.isArray(adoptList) ? adoptList : [];

      setAnimalRecord(record);
      setResultRequests(normalizedReqs);
      setResultAdoptions(normalizedAdopts);
      const total = normalizedReqs.length + normalizedAdopts.length + (record?.animal ? 1 : 0);
      setSearchOk(total > 0);
      if (record?.animal) {
        setStatus(`Animal localizado. ${normalizedReqs.length} solicitação(ões) e ${normalizedAdopts.length} adoção(ões) vinculada(s).`);
      } else {
        setStatus(total > 0
          ? `${normalizedReqs.length} solicitação(ões) e ${normalizedAdopts.length} adoção(ões) encontrada(s).`
          : chip ? "Nenhum registro encontrado para este microchip." : "Nenhum registro encontrado para este CPF/chave.");
      }
    } catch (err) {
      setAnimalRecord(null);
      setResultRequests([]);
      setResultAdoptions([]);
      setStatus(err.message || "Não foi possível consultar o microchip.");
    } finally {
      setIsConsulting(false);
    }
  }

  return (
    <div className="consultation-stack">
      <form className="validation-key-card consultation-card" onSubmit={consult}>
        <div className="consultation-card-header">
          <div className="consultation-title-row">
          <div className="metric-icon">
            <ShieldCheck size={20} />
          </div>
          <div>
          <span className="eyebrow">Prontuário animal</span>
          <h2>Consultar prontuário</h2>
          <p>Digite o microchip para abrir o prontuário. CPF e chave continuam disponíveis para consulta do tutor.</p>
          </div>
          </div>
          <div className="consultation-inline-metrics">
            <span>
              <ClipboardCheck size={16} />
              <strong>{activeRequestsCount}</strong>
              Ativas
            </span>
            <span>
              <CalendarDays size={16} />
              <strong>{nextAppointment}</strong>
              Agenda
            </span>
          </div>
        </div>
        <div className="consultation-search-row">
        <label className="field">
          <span>Microchip</span>
          <input value={microchip} onChange={(event) => setMicrochip(event.target.value.toUpperCase())} placeholder="Digite o microchip" />
        </label>
        <label className="field">
          <span>CPF</span>
          <input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="000.000.000-00" />
        </label>
        <label className="field">
          <span>Chave de validação</span>
          <input value={validationKey} onChange={(event) => setValidationKey(event.target.value.toUpperCase())} placeholder="Cole ou digite sua chave" />
        </label>
        <button className="primary-action consultation-submit" type="submit" disabled={isConsulting}>
          <Search size={18} />
          {isConsulting ? "Consultando" : "Consultar"}
        </button>
        </div>
        {status && <p className={searchOk ? "sms-status confirmed" : "helper-text"}>{status}</p>}
      </form>

      {animalRecord?.animal && (
        <AnimalRecordPanel
          record={animalRecord}
          cpf={onlyDigits(cpf)}
          validationKey={validationKey.trim()}
          onRequestCreated={(request) => {
            const normalized = onRequestCreated?.(request, { openAdmin: true }) || normalizeRequest(request);
            setResultRequests((current) => (
              Array.isArray(current) && current.some((item) => item.id === normalized.id)
                ? current.map((item) => (item.id === normalized.id ? normalized : item))
                : [normalized, ...(Array.isArray(current) ? current : [])]
            ));
            setStatus(`Solicitação ${normalized.protocol} criada e enviada para análise.`);
            setSearchOk(true);
          }}
        />
      )}

      {hasSearched && resultAdoptions.length > 0 && (
        <div className="consultation-adoptions">
          <h3 className="section-eyebrow-title">Adoções vinculadas</h3>
          <div className="consult-adoption-list">
            {resultAdoptions.map((a) => (
              <div key={a.id} className="consult-adoption-card">
                {a.photo_url && <img src={a.photo_url} alt={a.animal_name} className="consult-adoption-photo" />}
                <div className="consult-adoption-info">
                  <strong>{a.animal_name}</strong>
                  <span>{[a.species, a.sex, a.age].filter(Boolean).join(" · ")}</span>
                  <span className={`adoption-status-badge ${a.status}`}>{ADOPTION_STATUS_LABEL[a.status] || a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TutorDashboard
        requests={visibleRequests}
        setActive={() => {}}
        currentUser={currentUser}
        compact
        cpf={onlyDigits(cpf)}
        validationKey={validationKey.trim()}
        onRequestCreated={(request) => {
          const normalized = onRequestCreated?.(request, { openAdmin: true }) || normalizeRequest(request);
          setResultRequests((current) => (
            Array.isArray(current) && current.some((item) => item.id === normalized.id)
              ? current.map((item) => (item.id === normalized.id ? normalized : item))
              : [normalized, ...(Array.isArray(current) ? current : [])]
          ));
          setStatus(`Solicitação ${normalized.protocol} criada e enviada para análise.`);
          setSearchOk(true);
        }}
      />
    </div>
  );
}

function PublicSchedulePicker({
  requests,
  scheduleDays = [],
  selectedDate = "",
  onSelect,
  pendingReservation = null,
}) {
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const requiredVacancies = Math.max(Number(pendingReservation?.count) || 1, 1);
  const scheduleWithUsage = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const confirmed = countUsedVacancies(requests, day.date);
    const pending = pendingReservation?.date === day.date ? (pendingReservation.count || 0) : 0;
    const used = confirmed + pending;
    const confirmedRemaining = Math.max(day.vacancies - confirmed, 0);
    return {
      ...day,
      used,
      remaining: Math.max(day.vacancies - used, 0),
      hasEnoughVacancies: confirmedRemaining >= requiredVacancies,
      isPast: isPastScheduleDay(day.date),
    };
  });
  const scheduleMonths = buildScheduleMonths(scheduleWithUsage);
  const activeScheduleMonth = scheduleMonths[scheduleMonthIndex] || "";
  const scheduleByDate = new Map(scheduleWithUsage.map((day) => [day.date, day]));
  const visibleScheduleDays = buildMonthCalendarDays(activeScheduleMonth).map((calendarDay) => {
    if (calendarDay.offset) return calendarDay;
    const configuredDay = scheduleByDate.get(calendarDay.date);
    return configuredDay
      ? { ...configuredDay, calendarDay: calendarDay.day, available: true }
      : {
          ...calendarDay,
          weekday: calendarDay.weekday,
          vacancies: 0,
          remaining: 0,
          used: 0,
          isPast: isPastScheduleDay(calendarDay.date),
          available: false,
        };
  });

  useEffect(() => {
    setScheduleMonthIndex(Math.max(scheduleMonths.indexOf(getCurrentScheduleMonthKey()), 0));
  }, [scheduleMonths.join("|")]);

  return (
    <section className="panel public-schedule-picker">
      <div className="showcase-header schedule-picker-header">
        <div>
          <h2>Datas disponíveis</h2>
        </div>
      </div>
      <div className="calendar-month-header">
        <button
          type="button"
          onClick={() => setScheduleMonthIndex((current) => Math.max(current - 1, 0))}
          disabled={scheduleMonthIndex === 0}
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <strong className="calendar-month-label">{formatMonthYear(activeScheduleMonth)}</strong>
        <button
          type="button"
          onClick={() => setScheduleMonthIndex((current) => Math.min(current + 1, scheduleMonths.length - 1))}
          disabled={scheduleMonthIndex >= scheduleMonths.length - 1}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="calendar-availability">
        {visibleScheduleDays.length === 0 && (
          <div className="calendar-empty-month">Nenhuma data configurada para {formatMonthYear(activeScheduleMonth)}.</div>
        )}
        {visibleScheduleDays.map((day, index) =>
          day.offset
            ? <div key={`offset-${index}`} className="calendar-day-button calendar-day-offset" aria-hidden="true" />
            : (
              <button
                key={day.date}
                className={[
                  "calendar-day-button",
                  selectedDate === day.date ? "selected" : "",
                  day.kind === "Mutirao" ? "mutirao-day" : "",
                  day.available && !day.isPast && day.hasEnoughVacancies ? "has-vacancy" : "",
                ].filter(Boolean).join(" ")}
                type="button"
                disabled={!day.available || !day.hasEnoughVacancies || day.isPast}
                onClick={() => onSelect(day.date)}
              >
                <strong>{String(day.calendarDay || day.date.slice(0, 2)).padStart(2, "0")}</strong>
                <small>{!day.available ? "Sem agenda" : day.isPast ? "Passado" : day.hasEnoughVacancies ? `${day.remaining} vagas` : "Sem vagas suficientes"}</small>
                {day.kind === "Mutirao" && <em>Mutirão</em>}
                {day.locationName && <small>{day.locationName}</small>}
              </button>
            )
        )}
      </div>
    </section>
  );
}

function AdoptionCarousel({ adoptionAnimals, onOpenAdoption, limit = 6, showViewAll = true, onInterestSent }) {
  const availableAnimals = adoptionAnimals.filter((animal) => animal.status !== "adotado");
  const [adoptionFilters, setAdoptionFilters] = useState({ species: "", sex: "" });
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestForm, setInterestForm] = useState({ name: "", phone: "", visit_date: "", cpf: "" });
  const speciesFilterOptions = [...new Set(["Felino", "Canino", ...availableAnimals.map((animal) => animal.species).filter(Boolean)])];
  const sexFilterOptions = [...new Set(["Femea", "Macho", ...availableAnimals.map((animal) => animal.sex).filter(Boolean)])];
  const filteredAnimals = availableAnimals
    .filter((animal) => !adoptionFilters.species || animal.species === adoptionFilters.species)
    .filter((animal) => !adoptionFilters.sex || animal.sex === adoptionFilters.sex)
    .slice(0, limit);
  const activeFilterCount = Number(Boolean(adoptionFilters.species)) + Number(Boolean(adoptionFilters.sex));
  const speciesQuickFilters = [
    { value: "", label: "Todos os pets", icon: PawPrint },
    ...speciesFilterOptions.map((species) => ({
      value: species,
      label: species,
      icon: normalizeText(species).includes("fel") ? Cat : normalizeText(species).includes("can") ? Dog : PawPrint,
    })),
  ];
  const sexQuickFilters = [
    { value: "", label: "Todos os sexos", icon: HeartHandshake },
    ...sexFilterOptions.map((sex) => ({ value: sex, label: sex, icon: Users })),
  ];

  function openAnimalModal(animal, openInterestForm = false) {
    setSelectedAnimal(animal);
    setShowInterestForm(openInterestForm);
    setInterestSent(false);
    setInterestForm({ name: "", phone: "", visit_date: "", cpf: "" });
  }

  function closeAnimalModal() {
    setSelectedAnimal(null);
    setShowInterestForm(false);
    setInterestSent(false);
    setInterestForm({ name: "", phone: "", visit_date: "", cpf: "" });
  }

  async function submitInterest(e) {
    e.preventDefault();
    try {
      const updated = await api.registerInterest(selectedAnimal.id, interestForm);
      setInterestSent(true);
      onInterestSent?.(updated);
    } catch (err) {
      console.error("Erro ao registrar interesse:", err);
    }
  }

  return (
    <>
    <div className="adoption-filter-rail" aria-label="Filtros da galeria de adoção">
      <div className="adoption-filter-group" aria-label="Filtrar por espécie">
        {speciesQuickFilters.map((filter) => {
          const Icon = filter.icon;
          return (
            <button
              key={`species-${filter.value || "all"}`}
              className={adoptionFilters.species === filter.value ? "selected" : ""}
              type="button"
              onClick={() => setAdoptionFilters((current) => ({ ...current, species: filter.value }))}
            >
              <Icon size={18} />
              <span>{filter.label}</span>
            </button>
          );
        })}
      </div>
      <div className="adoption-filter-group" aria-label="Filtrar por sexo">
        {sexQuickFilters.map((filter) => {
          const Icon = filter.icon;
          return (
            <button
              key={`sex-${filter.value || "all"}`}
              className={adoptionFilters.sex === filter.value ? "selected" : ""}
              type="button"
              onClick={() => setAdoptionFilters((current) => ({ ...current, sex: filter.value }))}
            >
              <Icon size={18} />
              <span>{filter.label}</span>
            </button>
          );
        })}
      </div>
      {activeFilterCount > 0 && (
        <button className="ghost-button adoption-clear-filters" type="button" onClick={() => setAdoptionFilters({ species: "", sex: "" })}>
          Limpar filtros
        </button>
      )}
    </div>
    <section className={`${filteredAnimals.length <= 2 ? "adoption-showcase few-animals" : "adoption-showcase"} ${showViewAll ? "" : "compact-gallery"}`.trim()}>
      <div className="showcase-header adoption-showcase-header">
        <div>
          <span className="eyebrow">Adoção</span>
          <h2>Adote um amigo para a vida toda</h2>
          <p>Conheça os animais disponíveis e escolha quem combina com sua rotina.</p>
        </div>
        <div className="adoption-header-actions">
        {showViewAll && (
          <button className="ghost-button" type="button" onClick={onOpenAdoption}>
            Ver todos
          </button>
        )}
        </div>
      </div>

      <div className="public-animal-grid">
        {filteredAnimals.length === 0 && (
          <div className="adoption-filter-empty">
            {availableAnimals.length === 0 ? "Nenhum animal disponível para adoção no momento." : "Nenhum animal encontrado com estes filtros."}
          </div>
        )}
        {filteredAnimals.map((animal) => {
          const displayName = String(animal.name || animal.animal_name || "Animal").trim();
          const profileSummary = [animal.species, animal.sex, animal.age].map((item) => String(item || "").trim()).filter(Boolean).join(" - ");
          const interestCount = Array.isArray(animal.interests) ? animal.interests.length : 0;
          const rawStatus = String(animal.status || "").toLowerCase();
          const statusLabel = rawStatus === "em_processo" ? "Em análise" : "Disponível";
          const statusClass = rawStatus === "em_processo" ? "adoption-status-badge processing" : "adoption-status-badge available";
          const description = String(animal.tone || animal.description || "").trim();
          return (
            <article
              className="public-animal-card"
              key={animal.id || animal.name}
            >
              <button className="public-animal-open-area" type="button" onClick={() => openAnimalModal(animal)}>
                <div className={`public-animal-photo ${getAnimalGradient(animal)}`}>
                  {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={displayName} /> : <PawPrint size={36} />}
                </div>
                <div className="public-animal-meta">
                  <div className="public-animal-badges" aria-label="Status da adocao">
                    <span className="public-interest-count">
                      <Users size={13} />
                      {interestCount} interessado{interestCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <strong>Adote {displayName}</strong>
                  <span>{profileSummary || "Perfil em atualização"}</span>
                  {description && <small>{description}</small>}
                </div>
              </button>
              <button
                className="public-interest-cta"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openAnimalModal(animal, true);
                }}
              >
                <HeartHandshake size={16} />
                Quero adotar
              </button>
            </article>
          );
        })}
      </div>

    </section>

    {selectedAnimal && (
      <div className="modal-backdrop">
        <div className="animal-detail-modal adoption-profile-modal">
          <ModalHeader title={selectedAnimal.name || selectedAnimal.animal_name || "Animal"} eyebrow="Adoção" onClose={closeAnimalModal} />
          <div className="adoption-profile-media">
            <div className={`adoption-main-photo ${getAnimalGradient(selectedAnimal)}`}>
              {getAnimalMainPhoto(selectedAnimal) ? <img src={getAnimalMainPhoto(selectedAnimal)} alt={selectedAnimal.name} /> : <PawPrint size={54} />}
            </div>
            {getAnimalPhotos(selectedAnimal).length > 1 && (
              <div className="adoption-thumb-row">
                {getAnimalPhotos(selectedAnimal).slice(0, 5).map((photo, index) => (
                  <img src={photo} alt={`${selectedAnimal.name} ${index + 1}`} key={`${selectedAnimal.name}-photo-${index}`} />
                ))}
              </div>
            )}
          </div>
          <div className="adoption-profile-info">
            <span className="eyebrow">Adoção</span>
            <h2>{selectedAnimal.name || selectedAnimal.animal_name}</h2>
            <div className="adoption-profile-tags">
              {selectedAnimal.species && <Chip>{selectedAnimal.species}</Chip>}
              {selectedAnimal.sex && <Chip>{selectedAnimal.sex}</Chip>}
              {selectedAnimal.age && <Chip>{selectedAnimal.age}</Chip>}
            </div>
            <p>{selectedAnimal.tone || selectedAnimal.description}</p>
            {!showInterestForm && !interestSent && (
              <button className="primary-action" type="button" onClick={() => setShowInterestForm(true)}>
                Quero adotar
              </button>
            )}

            {showInterestForm && !interestSent && (
              <form className="adoption-interest-form" onSubmit={submitInterest}>
                <p className="adoption-interest-title">Preencha seus dados e entraremos em contato</p>
                <label className="field"><span>Nome completo</span>
                  <input value={interestForm.name} onChange={(e) => setInterestForm((f) => ({ ...f, name: e.target.value }))} placeholder="Seu nome" required />
                </label>
                <label className="field"><span>Telefone / WhatsApp</span>
                  <input value={interestForm.phone} onChange={(e) => setInterestForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" required />
                </label>
                <label className="field"><span>CPF (opcional — vincula ao seu código de acompanhamento)</span>
                  <input value={interestForm.cpf} onChange={(e) => setInterestForm((f) => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
                </label>
                <label className="field"><span>Data para visitar o pet</span>
                  <input type="date" value={interestForm.visit_date} onChange={(e) => setInterestForm((f) => ({ ...f, visit_date: e.target.value }))} />
                </label>
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => setShowInterestForm(false)}>Voltar</button>
                  <button className="primary-action" type="submit">Enviar interesse</button>
                </div>
              </form>
            )}

            {interestSent && (
              <div className="adoption-interest-success">
                <CheckCircle2 size={32} color="#15803d" />
                <strong>Interesse enviado!</strong>
                <p>Entraremos em contato em breve pelo WhatsApp informado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function getAnimalGradient(animal) {
  if (animal.gradient) return animal.gradient;
  const gradients = ["photo-teal", "photo-sky", "photo-rose"];
  const str = String(animal.id || animal.animal_name || animal.name || "");
  const code = str.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return gradients[code % gradients.length];
}

function normalizeAdoptionAnimal(animal) {
  const photos = Array.isArray(animal.photos)
    ? animal.photos.filter(Boolean)
    : (animal.photo_url ? [animal.photo_url] : []);
  const mainPhotoIndexRaw = Number.isInteger(animal.main_photo_index) ? animal.main_photo_index : Number(animal.mainPhotoIndex || 0);
  const mainPhotoIndex = Number.isFinite(mainPhotoIndexRaw) && mainPhotoIndexRaw >= 0 ? mainPhotoIndexRaw : 0;
  return {
    ...animal,
    name: animal.animal_name || animal.name || "",
    tone: animal.description || animal.tone || "",
    health: Array.isArray(animal.health) ? animal.health : [],
    photos,
    mainPhotoIndex,
    interests: Array.isArray(animal.interests) ? animal.interests : [],
    gradient: getAnimalGradient(animal),
  };
}

function getAnimalPhotos(animal) {
  if (Array.isArray(animal.photos) && animal.photos.length > 0) return animal.photos;
  if (animal.photo_url) return [animal.photo_url];
  return [];
}

function getAnimalMainPhoto(animal) {
  const photos = getAnimalPhotos(animal);
  return photos[animal.mainPhotoIndex || 0] || photos[0] || "";
}

function LoginView({ onLogin, onPublicRequest, onPublicConsult, onAccessRequest, adoptionAnimals = [], onInterestSent }) {
  const [email, setEmail] = useState(envUsers[0].email);
  const [password, setPassword] = useState(envUsers[0].password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showVetModal, setShowVetModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showMobileAdoption, setShowMobileAdoption] = useState(false);

  async function submit(event) {
    event.preventDefault();
    try {
      const user = await api.login(email.trim(), password);
      setError("");
      onLogin(user);
    } catch {
      setError("Email ou senha incorretos.");
    }
  }

  return (
    <main className="login-page">
      <div className="login-layout">
        <button className="mobile-adoption-toggle" type="button" onClick={() => setShowMobileAdoption((current) => !current)}>
          {showMobileAdoption ? "Ocultar adoção" : "Ver animais para adoção"}
        </button>

        <PetWelcomeArt className="login-wide-banner" />

        <section className={showMobileAdoption ? "login-adoption-panel mobile-visible" : "login-adoption-panel"}>
          <AdoptionCarousel adoptionAnimals={adoptionAnimals} limit={12} showViewAll={false} onInterestSent={onInterestSent} />
        </section>

        <section className="login-card">
          <div className="brand login-brand">
            <div className="brand-mark">
              <PawPrint size={24} />
            </div>
            <div>
              <strong>Sistema municipal</strong>
            </div>
          </div>

          <div className="login-welcome">
            <h1>Castração animal gratuita</h1>
            <p>Selecione como deseja continuar</p>
          </div>

          <div className="login-main-actions">
            <button className="login-big-action primary" onClick={onPublicRequest}>
              <PawPrint size={28} />
              <strong>Solicitações</strong>
              <span>Primeiro cadastro do tutor e animal</span>
            </button>

            <button className="login-big-action consult" onClick={onPublicConsult}>
              <Search size={28} />
              <strong>Prontuário</strong>
              <span>Consultar histórico e solicitar procedimento</span>
            </button>

            <button className="login-big-action secondary login-vet-action" onClick={() => setShowVetModal(true)}>
              <Lock size={28} />
              <strong>Credenciados</strong>
              <span>Acesso credenciado</span>
            </button>

            <button className="login-big-action access" onClick={() => setShowAccessModal(true)}>
              <Users size={28} />
              <strong>Solicitar credenciamento</strong>
              <span>ONGs e protetores</span>
            </button>
          </div>
        </section>

      </div>
      {showAccessModal && (
        <PublicAccessRequestModal
          onClose={() => setShowAccessModal(false)}
          onSubmit={onAccessRequest}
        />
      )}
      {showVetModal && (
        <div className="modal-backdrop">
          <form className="auth-modal compact-auth-modal" onSubmit={submit}>
            <ModalHeader title="Credenciados" eyebrow="Acesso ao sistema" onClose={() => { setShowVetModal(false); setError(""); }} />
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" />
            </label>
            <label className="field password-field">
              <span>Senha</span>
              <div>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Ver senha">
                  <Eye size={18} />
                </button>
              </div>
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-action" type="submit">Entrar</button>
          </form>
        </div>
      )}
    </main>
  );
}

function PublicAccessRequestModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    requesterType: "ONG",
    organizationName: "",
    responsibleName: "",
    email: "",
    phone: "",
    document: "",
    city: "",
    state: "",
    intendedUse: "",
  });
  const [status, setStatus] = useState("");
  const [sent, setSent] = useState(false);
  const selectedType = accessRequesterTypes.find((type) => type.id === form.requesterType) || accessRequesterTypes[0];

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.responsibleName.trim() || !form.email.trim()) {
      setStatus("Informe o responsável e o email para contato.");
      return;
    }
    setStatus("Enviando solicitação...");
    try {
      await onSubmit?.({
        requester_type: form.requesterType,
        organization_name: form.organizationName,
        responsible_name: form.responsibleName,
        email: form.email,
        phone: form.phone,
        document: form.document,
        city: form.city,
        state: form.state,
        intended_use: form.intendedUse,
        assigned_sector: selectedType.sector,
      });
      setSent(true);
      setStatus("");
    } catch (err) {
      setStatus(err.message || "Não foi possível enviar a solicitação.");
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="auth-modal access-request-modal" onSubmit={submit}>
        <ModalHeader title="Solicitar credenciamento" eyebrow="Acesso à plataforma" onClose={onClose} />
        {sent ? (
          <div className="public-form-success compact-success">
            <CheckCircle2 size={42} />
            <h2>Solicitação enviada</h2>
            <p>Um usuário interno vai analisar o pedido e liberar o acesso se estiver tudo certo.</p>
            <button className="primary-action" type="button" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <>
            <div className="compact-choice-field access-type-field">
              <span>Tipo de solicitante</span>
              <div>
                {accessRequesterTypes.map((type) => (
                  <button
                    key={type.id}
                    className={form.requesterType === type.id ? "selected" : ""}
                    type="button"
                    onClick={() => patch("requesterType", type.id)}
                  >
                    <span>{type.label}</span>
                    <small>{type.sector}</small>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Nome da ONG ou grupo" value={form.organizationName} placeholder="Opcional para protetor independente" onChange={(value) => patch("organizationName", value)} />
            <Field label="Responsável" value={form.responsibleName} placeholder="Nome completo" onChange={(value) => patch("responsibleName", value)} />
            <Field label="Email" type="email" value={form.email} placeholder="email@dominio.com" onChange={(value) => patch("email", value)} />
            <div className="form-grid two">
              <Field label="Telefone" value={form.phone} placeholder="(00) 00000-0000" onChange={(value) => patch("phone", value)} />
              <Field label="CPF/CNPJ ou matrícula" value={form.document} placeholder="Identificação" onChange={(value) => patch("document", value)} />
              <Field label="Cidade" value={form.city} placeholder="Município" onChange={(value) => patch("city", value)} />
              <Field label="UF" value={form.state} placeholder="UF" onChange={(value) => patch("state", value.toUpperCase().slice(0, 2))} />
            </div>
            <label className="field">
              <span>Como pretende auxiliar</span>
              <textarea value={form.intendedUse} placeholder="Ex: cadastrar animais para adoção, indicar vagas de castração, acompanhar animais de rua..." onChange={(event) => patch("intendedUse", event.target.value)} />
            </label>
            {status && <p className={status.includes("Enviando") ? "helper-text" : "form-error"}>{status}</p>}
            <button className="primary-action" type="submit">Enviar solicitação</button>
          </>
        )}
      </form>
    </div>
  );
}

function PetWelcomeArt({ className = "" }) {
  return (
    <div className={`pet-welcome-art ${className}`.trim()} aria-hidden="true">
      <video
        className="pet-welcome-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1400&q=80"
      >
        <source src="https://assets.mixkit.co/videos/preview/mixkit-dog-catches-a-ball-in-a-river-1494-large.mp4" type="video/mp4" />
      </video>
      <div className="pet-video-shade" />
      <div className="pet-video-caption">
        <span className="eyebrow">Castração e adoção animal</span>
        <strong>Eles esperam por você. Adote e transforme duas vidas.</strong>
        <p>Cada animal adotado libera espaço para outro ser salvo.<br />Conheça quem está esperando um lar.</p>
      </div>
    </div>
  );
}

const GUEST_USER = { role: "guest", name: "", email: "", neighborhood: "", address: "", cpf: "", cep: "", number: "", city: "", state: "", phone: "" };

function PublicCastrationForm({ createRequest, onBack, initialScreen = "agenda", scheduleDays = [], requestTypes = [], requests = [], speciesOptions = [], sizeOptions = [], aiSettings = initialAiSettings, onRequestCreated }) {
  const [screen, setScreen] = useState(initialScreen === "consulta" ? "consulta" : "formulario");
  const [done, setDone] = useState(null);

  function goToStart() {
    setScreen("formulario");
  }

  const header = (backFn) => (
    <header className="public-form-header">
      <button className="public-back-button" type="button" onClick={backFn}>Voltar</button>
      <div>
        <strong>Sistema municipal</strong>
      </div>
    </header>
  );

  if (done) {
    return (
      <main className="public-form-page">
        {header(onBack)}
        <div className="public-form-success">
          <CheckCircle2 size={56} />
          <h2>Solicitação enviada!</h2>
          <p>Protocolo oficial: <strong>{done.protocol}</strong></p>
          <div className="success-validation-key">
            <span>Chave de validação</span>
            <strong>{done.validationKey || done.validation_key}</strong>
            <small>Use sempre CPF + chave de validação para consultar solicitações e adoções.</small>
          </div>
          <button className="primary-action" onClick={onBack}>Voltar ao início</button>
        </div>
      </main>
    );
  }

  if (screen === "consulta") {
    return (
      <main className="public-form-page">
        {header(onBack)}
        <section className="tutor-screen">
          <ValidationKeyConsultation fallbackRequests={requests} currentUser={GUEST_USER} onRequestCreated={onRequestCreated} />
        </section>
      </main>
    );
  }

  return (
    <main className="public-form-page">
      {header(goToStart)}
      <NewRequest
        createRequest={createRequest}
        currentUser={GUEST_USER}
        compact
        onBack={goToStart}
        onDone={(request) => { setDone(request); }}
        requests={requests}
        scheduleDays={scheduleDays}
        requestTypes={requestTypes}
        aiSettings={aiSettings}
        speciesOptions={speciesOptions}
        sizeOptions={sizeOptions}
      />
    </main>
  );
}

function TutorDashboard({ requests, setActive, currentUser, compact = false, cpf = "", validationKey = "", onRequestCreated }) {
  const safeRequests = useMemo(() => (Array.isArray(requests) ? requests : []).map(normalizeRequest), [requests]);
  const next = safeRequests.find((request) => request.status !== "ARQUIVADA" && requestHasTag(request, "DEFERIDA") && (request.appointment || request.preferredSchedule));

  return (
    <section className={compact ? "simple-stack consultation-results" : "content-grid"}>
      {!compact && <div className="hero-panel">
        <div>
          <span className="eyebrow">Area do solicitante</span>
          <h2>Olá, {currentUser.name}. Acompanhe protocolos, documentos e agendamentos em um único lugar.</h2>
          <p>
            O painel prioriza a próxima ação do tutor: enviar pendências, confirmar presença, solicitar reagendamento
            ou baixar documentos.
          </p>
        </div>
        <button className="primary-action" onClick={() => setActive("solicitacao")}>
          <Plus size={18} />
          Nova solicitação
        </button>
      </div>}

      {!compact && <div className="summary-row">
        <Metric title={compact ? "Ativas" : "Solicitacoes ativas"} value={safeRequests.filter((r) => r.status !== "ARQUIVADA").length} icon={ClipboardCheck} />
        <Metric title="Próximo agendamento" value={next ? next.appointment || next.preferredSchedule : "Nenhum"} icon={CalendarDays} />
        <Metric title={compact ? "Avisos" : "Notificacoes"} value="4" icon={Bell} />
      </div>}

      <div className="panel wide">
        <PanelHeader title={compact ? "Solicitacoes" : "Minhas solicitacoes"} action={compact ? "" : "Ver todas"} />
        <div className="request-list">
          {safeRequests.length === 0 && (
            <EmptyState
              title="Nenhuma solicitação cadastrada"
              text="Crie a primeira solicitação para iniciar os testes do fluxo completo."
              action="Nova solicitação"
              onAction={() => setActive("solicitacao")}
            />
          )}
          {safeRequests.slice(0, compact ? safeRequests.length : 4).map((request) => (
            <article className="request-card" key={request.id}>
              <div>
                <strong>#{request.protocol}</strong>
                <span>{request.animals.map((animal) => animal.name).join(", ")} - {requestTypeLabel(request)}</span>
              </div>
              <StatusBadge status={request.status} />
              <span>{request.appointment || request.createdAt}</span>
              <button className="ghost-button">
                Detalhes
                <ChevronRight size={16} />
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewRequest({
  createRequest,
  currentUser,
  compact = false,
  internalSimple = false,
  onBack,
  onDone,
  requests = [],
  scheduleDays = [],
  requestTypes = initialRequestTypes,
  aiSettings = initialAiSettings,
  speciesOptions = initialSpecies,
  sizeOptions = initialSizes,
  initialSchedule = "",
  initialType = "",
}) {
  const activeSpecies = speciesOptions.filter((item) => item.active !== false).map((item) => item.name);
  const activeSizes = sizeOptions.filter((item) => item.active !== false);
  const skipTutorStep = currentUser.role === "tutor" && currentUser.profileComplete === true;
  const [requestData, setRequestData] = useState({
    tutor: currentUser.role === "admin" ? "" : currentUser.name,
    neighborhood: currentUser.neighborhood || "",
    address: currentUser.address || "",
    cpf: currentUser.cpf || "",
    email: currentUser.email,
    cep: currentUser.cep || "",
    number: currentUser.number || "",
    city: currentUser.city || "",
    state: currentUser.state || "",
    cadUnico: currentUser.cadUnico || "",
    cadUnicoNotApplicable: Boolean(currentUser.cadUnicoNotApplicable),
    isFarmer: Boolean(currentUser.isFarmer || currentUser.is_farmer),
    latitude: "",
    longitude: "",
    type: initialType,
    phone: currentUser.phone || "",
    notes: "",
    schedule: initialSchedule,
  });
  const [animals, setAnimals] = useState([
    {
      name: "",
      species: "",
      sex: "",
      breedType: "",
      breedDescription: "",
      size: "",
      age: "",
      birthDate: "",
      procedure: "",
      coat: "",
      hasChip: "",
      microchip: "",
      dewormed: "",
      vaccinated: "",
      hadLitter: "",
      illnessHistory: "",
      food: "",
    },
  ]);
  const [accepted, setAccepted] = useState(false);
  const [cepStatus, setCepStatus] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [documentUploads, setDocumentUploads] = useState({});
  const [formStep, setFormStep] = useState(skipTutorStep ? 1 : 0);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [smsCode, setSmsCode] = useState("");
  const [smsInput, setSmsInput] = useState("");
  const [smsConfirmed, setSmsConfirmed] = useState(currentUser.role === "admin" || skipTutorStep);
  const [smsStatus, setSmsStatus] = useState("");
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    if (initialSchedule) {
      setRequestData((current) => ({ ...current, schedule: initialSchedule }));
    }
  }, [initialSchedule]);

  useEffect(() => {
    if (initialType) {
      setRequestData((current) => ({ ...current, type: initialType }));
    }
  }, [initialType]);

  const configuredRequestTypes = requestTypes.filter((type) => type.name.trim() && type.active !== false);
  const selectedRequestType = configuredRequestTypes.find((type) => type.name === requestData.type) || null;
  const selectedTypeDocuments = (selectedRequestType?.documents || [])
    .map(normalizeDocumentType)
    .filter((document) => document.active !== false);
  const acceptableUploadStatuses = ["approved", "attached"];
  const requiredDocsApproved = selectedTypeDocuments
    .filter((document) => document.required)
    .every((document) => acceptableUploadStatuses.includes(documentUploads[document.id]?.status));
  const requiredIssues = getRequestValidationIssues();
  const canSubmit = requiredIssues.length === 0;
  const formSteps = internalSimple
    ? [
        { step: 0, label: "Tutor" },
        { step: 1, label: "Animal" },
        { step: 2, label: "Agenda" },
        { step: 3, label: "Finalização" },
      ]
    : skipTutorStep
    ? [
        { step: 1, label: "Animal" },
        { step: 2, label: "Agenda" },
        { step: 3, label: "Documentos" },
      ]
    : [
        { step: 0, label: "Tutor" },
        { step: 1, label: "Animal" },
        { step: 2, label: "Agenda" },
        { step: 3, label: "Documentos" },
      ];
  const currentStepIndex = Math.max(formSteps.findIndex((item) => item.step === formStep), 0);
  function selectedScheduleHasCapacity() {
    if (!requestData.schedule) return false;
    const selectedDay = scheduleDays.find((day) => day.date === requestData.schedule && day.active !== false);
    if (!selectedDay || isPastScheduleDay(selectedDay.date)) return false;
    const remaining = Math.max((Number(selectedDay.vacancies) || 0) - countUsedVacancies(requests, selectedDay.date), 0);
    return remaining >= Math.max(animals.length, 1);
  }

  function addAnimal() {
    setAnimals((current) => [
      ...current,
      {
        name: "",
        species: "",
        sex: "",
        breedType: "",
        breedDescription: "",
        size: "",
        age: "",
        birthDate: "",
        procedure: "",
        coat: "",
        hasChip: "",
        microchip: "",
        dewormed: "",
        vaccinated: "",
        hadLitter: "",
        illnessHistory: "",
        food: "",
      },
    ]);
  }

  function updateAnimal(index, field, value) {
    setAnimals((current) =>
      current.map((animal, animalIndex) => (animalIndex === index ? { ...animal, [field]: value } : animal)),
    );
  }

  function removeAnimal(indexToRemove) {
    setAnimals((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function updateRequestField(field, value) {
    setRequestData((current) => ({ ...current, [field]: value }));
  }

  function toggleCadUnicoNotApplicable(checked) {
    setRequestData((current) => ({
      ...current,
      cadUnicoNotApplicable: checked,
      cadUnico: checked ? "" : current.cadUnico,
    }));
  }

  function updateMaskedRequestField(field, value) {
    const masks = {
      cpf: formatCpf,
      phone: formatPhone,
      cep: formatCep,
      state: (input) => input.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase(),
    };
    updateRequestField(field, masks[field] ? masks[field](value) : value);
    if (field === "phone") {
      setSmsConfirmed(currentUser.role === "admin");
      setSmsCode("");
      setSmsInput("");
      setSmsStatus("");
    }
  }

  function sendSmsCode() {
    const cleanPhone = requestData.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setSmsStatus("Informe um celular válido antes de enviar o SMS.");
      return;
    }

    const nextCode = String(Math.floor(100000 + Math.random() * 900000));
    setSmsCode(nextCode);
    setSmsInput("");
    setSmsConfirmed(false);
    setSmsStatus(`SMS enviado para ${requestData.phone}. Código de teste: ${nextCode}`);
  }

  function confirmSmsCode() {
    if (!smsCode) {
      setSmsStatus("Envie o SMS antes de confirmar.");
      return;
    }

    if (smsInput.trim() !== smsCode) {
      setSmsStatus("Código SMS incorreto.");
      return;
    }

    setSmsConfirmed(true);
    setSmsStatus("Celular confirmado por SMS.");
  }

  function getRequestValidationIssues() {
    const issues = [];
    const cleanCpf = requestData.cpf.replace(/\D/g, "");
    const cleanPhone = requestData.phone.replace(/\D/g, "");
    const filledAnimals = animals.length > 0 ? animals : [{}];

    if (!requestData.tutor.trim()) issues.push("Informe o nome do tutor.");
    if (cleanCpf.length !== 11) issues.push("Informe um CPF válido.");
    if (!internalSimple) {
      if (cleanPhone.length < 10) issues.push("Informe um celular válido.");
      if (!skipTutorStep && !smsConfirmed) issues.push("Confirme o código SMS recebido no celular cadastrado.");
      if (!requestData.address.trim()) issues.push("Informe o endereço.");
      if (!requestData.neighborhood.trim()) issues.push("Informe o bairro.");
      if (!requestData.city.trim()) issues.push("Informe a cidade.");
      if (requestData.state.trim().length !== 2) issues.push("Informe a UF.");
    }
    if (!internalSimple && !accepted) issues.push("Leia e aceite a declaração para encerrar o cadastro.");
    if (!requestData.schedule) issues.push("Escolha uma data disponível.");
    else if (!selectedScheduleHasCapacity()) issues.push("Escolha uma data com vagas suficientes para todos os animais.");
    if (configuredRequestTypes.length > 0 && !requestData.type) issues.push("Selecione o tipo de solicitação.");
    filledAnimals.forEach((animal, index) => {
      const label = filledAnimals.length > 1 ? ` do animal ${index + 1}` : " do animal";
      if (!animal.procedure) issues.push(`Selecione o procedimento${label}.`);
      if (!animal.species) issues.push(`Selecione a espécie${label}.`);
      if (!animal.sex) issues.push(`Selecione o sexo${label}.`);
      if (!animal.size) issues.push(`Selecione o porte${label}.`);
      if (!animal.breedType) issues.push(`Informe se a raça é definida ou indefinida${label}.`);
    });
    if (!internalSimple && !requiredDocsApproved) issues.push("Todos os documentos obrigatórios precisam estar aprovados pela validação.");

    return issues;
  }

  function getStepIssues(step = formStep) {
    const cleanCpf = requestData.cpf.replace(/\D/g, "");
    const cleanPhone = requestData.phone.replace(/\D/g, "");

    if (step === 0) {
      if (internalSimple) {
        return [
          !requestData.tutor.trim(),
          cleanCpf.length !== 11,
        ].filter(Boolean);
      }
      return [
        !requestData.tutor.trim(),
        cleanCpf.length !== 11,
        cleanPhone.length < 10,
        !smsConfirmed,
        !requestData.address.trim(),
        !requestData.neighborhood.trim(),
        !requestData.city.trim(),
        requestData.state.trim().length !== 2,
      ].filter(Boolean);
    }

    if (step === 1) {
      return animals
        .flatMap((animal, index) => [
          index === 0 && configuredRequestTypes.length > 0 && !requestData.type,
          !animal.procedure,
          !animal.species,
          !animal.sex,
          !animal.size,
          !animal.breedType,
        ])
        .filter(Boolean);
    }

    if (step === 2) {
      return [!requestData.schedule || !selectedScheduleHasCapacity()].filter(Boolean);
    }

    if (step === 3) {
      return [!requestData.schedule || !selectedScheduleHasCapacity(), !requiredDocsApproved, !accepted].filter(Boolean);
    }

    return [];
  }

  function showInvalid(field) {
    if (!submitAttempted) return false;
    const cleanCpf = requestData.cpf.replace(/\D/g, "");
    const cleanPhone = requestData.phone.replace(/\D/g, "");
    const firstAnimal = animals[0] || {};
    const checks = {
      tutor: !requestData.tutor.trim(),
      cpf: cleanCpf.length !== 11,
      email: Boolean(requestData.email.trim()) && !requestData.email.includes("@"),
      phone: cleanPhone.length < 10 || !smsConfirmed,
      sms: !smsConfirmed,
      cep: false,
      address: !requestData.address.trim(),
      number: false,
      neighborhood: !requestData.neighborhood.trim(),
      city: !requestData.city.trim(),
      state: requestData.state.trim().length !== 2,
      animalName: false,
      animalAge: false,
      type: configuredRequestTypes.length > 0 && !requestData.type,
      procedure: !firstAnimal.procedure,
      species: !firstAnimal.species,
      sex: !firstAnimal.sex,
      size: !firstAnimal.size,
      breedType: !firstAnimal.breedType,
      documents: !requiredDocsApproved,
      accepted: !accepted,
    };
    return Boolean(checks[field]);
  }

  function goToNextStep() {
    setSubmitAttempted(true);
    if (getStepIssues(formStep).length > 0) return;
    setSubmitAttempted(false);
    setFormStep(formSteps[Math.min(currentStepIndex + 1, formSteps.length - 1)].step);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Localização atual indisponível neste navegador.");
      return;
    }

    setLocationStatus("Solicitando localização atual...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRequestData((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocationStatus("Localização atual registrada.");
      },
      () => setLocationStatus("Não foi possível obter a localização atual."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function lookupCep(value) {
    const cleanCep = value.replace(/\D/g, "");
    const maskedCep = formatCep(value);
    updateRequestField("cep", maskedCep);

    if (cleanCep.length !== 8) {
      setCepStatus("");
      return;
    }

    setCepStatus("Buscando endereço...");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepStatus("CEP não encontrado.");
        return;
      }

      setRequestData((current) => ({
        ...current,
        cep: maskedCep,
        address: data.logradouro || current.address,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
      setCepStatus("Endereço preenchido pelo CEP.");
    } catch {
      setCepStatus("Não foi possível buscar o CEP agora.");
    }
  }

  async function handleDocumentFile(document, file) {
    if (!file) return;

    setDocumentUploads((current) => ({
      ...current,
      [document.id]: {
        fileName: file.name,
        status: "checking",
        message: aiSettings.active ? "IA analisando legibilidade e regras do documento..." : "Arquivo anexado sem análise de IA...",
      },
    }));

    try {
      const normalizedDocument = normalizeDocumentType(document);
      const dataUrl = await readFileAsDataUrl(file);
      const result = await validateDocumentWithAI(normalizedDocument, file, aiSettings, dataUrl);
      setDocumentUploads((current) => ({
        ...current,
        [normalizedDocument.id]: {
          documentId: normalizedDocument.id,
          documentName: normalizedDocument.name,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          dataUrl,
          ...result,
        },
      }));
    } catch (err) {
      setDocumentUploads((current) => ({
        ...current,
        [document.id]: {
          documentId: document.id,
          documentName: document.name,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          status: "attached",
          message: "Arquivo anexado para conferência manual.",
          confidence: null,
          error: true,
        },
      }));
    }
  }

  async function handleAnimalPhotoFile(file) {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDocumentUploads((current) => ({
        ...current,
        animal_photo: {
          documentId: "animal_photo",
          documentName: "Foto de registro animal",
          fileName: file.name || `foto-animal-${Date.now()}.jpg`,
          fileType: file.type || getDataUrlMimeType(dataUrl) || "image/jpeg",
          fileSize: file.size || 0,
          status: "attached",
          message: "Foto opcional anexada ao cadastro do animal.",
          dataUrl,
        },
      }));
    } catch {
      setSubmissionError("Não foi possível anexar a foto do animal.");
    }
  }

  function removeDocumentFile(documentId) {
    setDocumentUploads((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
  }

  async function submit() {
    setSubmitAttempted(true);
    if (submitting) return;
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (internalSimple) {
        await submitInternal();
      } else {
        await submitAccepted();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openDeclarationPdf() {
    const html = buildDeclarationPdfHtml(requestData, animals);
    printHtmlViaIframe(html);
  }

  async function submitInternal() {
    setSubmissionError("");
    const selectedScheduleDay = scheduleDays.find((day) => day.date === requestData.schedule);
    const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    const addressString = [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state, requestData.cep].filter(Boolean).join(", ");
    const { latitude, longitude } = mapsApiKey && addressString ? await geocodeAddress(addressString, mapsApiKey) : { latitude: "", longitude: "" };
    const localPayload = {
      tutor: requestData.tutor || currentUser.name,
      neighborhood: requestData.neighborhood || "Bairro não informado",
      address:
        [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state]
          .filter(Boolean)
          .join(", ") || "Endereço não informado",
      type: requestData.type || animals[0]?.procedure || "Cadastro animal",
      requestTypeId: selectedRequestType?.id || "",
      fee: selectedRequestType?.fee || "",
      phone: requestData.phone || "",
      cpf: requestData.cpf || "",
      email: requestData.email || "",
      cep: requestData.cep || "",
      preferredSchedule: requestData.schedule || "",
      scheduleLocationName: selectedScheduleDay?.locationName || "",
      scheduleAddressUrl: selectedScheduleDay?.addressUrl || "",
      scheduleMunicipality: selectedScheduleDay?.municipality || requestData.city || "",
      responsibleUnit: selectedScheduleDay?.responsibleUnit || selectedScheduleDay?.unit || "",
      veterinarian: selectedScheduleDay?.veterinarian || selectedScheduleDay?.responsible || "",
      latitude,
      longitude,
      workflowData: {
        cadUnico: requestData.cadUnicoNotApplicable ? "" : requestData.cadUnico,
        cadUnicoNotApplicable: requestData.cadUnicoNotApplicable,
        isFarmer: requestData.isFarmer,
      },
      animals: animals.map((animal, index) => ({
        ...animal,
        name: animal.name || "",
        age: animal.birthDate || animal.age || "",
      })),
      documents: Object.values(documentUploads).filter((upload) => upload?.documentId === "animal_photo"),
      signedAt: "",
      tags: ["PRESENCIAL"],
    };

    try {
      const newRequest = await createRequest(localPayload);
      onDone?.(newRequest || localPayload);
    } catch (err) {
      setSubmissionError(err?.message || "Falha ao criar solicitação. Tente novamente.");
    }
  }

  async function submitAccepted() {
    setSubmissionError("");
    const selectedScheduleDay = scheduleDays.find((day) => day.date === requestData.schedule);
    const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    const addressString = [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state, requestData.cep].filter(Boolean).join(", ");
    const { latitude, longitude } = mapsApiKey && addressString ? await geocodeAddress(addressString, mapsApiKey) : { latitude: "", longitude: "" };
    const uploadedDocuments = selectedTypeDocuments
      .map((document) => documentUploads[document.id])
      .filter((upload) => upload && acceptableUploadStatuses.includes(upload.status));
    const animalPhotoUpload = documentUploads.animal_photo;
    const allUploadedDocuments = [
      ...uploadedDocuments,
      ...(animalPhotoUpload ? [animalPhotoUpload] : []),
    ];
    const localPayload = {
      tutor: requestData.tutor || currentUser.name,
      neighborhood: requestData.neighborhood || "Bairro não informado",
      address:
        [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state]
          .filter(Boolean)
          .join(", ") || "Endereço não informado",
      type: requestData.type || animals[0]?.procedure || "Cadastro animal",
      requestTypeId: selectedRequestType?.id || "",
      fee: selectedRequestType?.fee || "",
      phone: requestData.phone || "",
      cpf: requestData.cpf || "",
      email: requestData.email || "",
      cep: requestData.cep || "",
      preferredSchedule: requestData.schedule || "",
      scheduleLocationName: selectedScheduleDay?.locationName || "",
      scheduleAddressUrl: selectedScheduleDay?.addressUrl || "",
      scheduleMunicipality: selectedScheduleDay?.municipality || requestData.city || "",
      responsibleUnit: selectedScheduleDay?.responsibleUnit || selectedScheduleDay?.unit || "",
      veterinarian: selectedScheduleDay?.veterinarian || selectedScheduleDay?.responsible || "",
      latitude,
      longitude,
      workflowData: {
        cadUnico: requestData.cadUnicoNotApplicable ? "" : requestData.cadUnico,
        cadUnicoNotApplicable: requestData.cadUnicoNotApplicable,
        isFarmer: requestData.isFarmer,
      },
      animals: animals.map((animal, index) => ({
        ...animal,
        name: animal.name || "",
        age: animal.birthDate || animal.age || "",
      })),
      documents: allUploadedDocuments,
      signedAt: new Date().toISOString(),
    };
    try {
      const newRequest = await createRequest(localPayload);
      const generatedProtocol = String(newRequest?.protocol || "").trim();
      const generatedValidationKey = String(newRequest?.validationKey || newRequest?.validation_key || "").trim();

      if (!generatedProtocol || !generatedValidationKey) {
        setSubmissionError("Nao foi possivel concluir: protocolo/chave de validacao nao foram gerados. Tente novamente.");
        return;
      }

      onDone?.(normalizeRequest({ ...localPayload, ...newRequest, protocol: generatedProtocol, validation_key: generatedValidationKey }));
    } catch (err) {
      setSubmissionError(err?.message || "Falha ao enviar solicitacao. Tente novamente.");
    }
  }

  return (
    <section className={compact ? "simple-stack" : "content-grid"}>
      <div className="panel wide">
        <div className="simple-form-header">
          <div>
            <span className="eyebrow">Nova solicitação</span>
          </div>
        </div>

        <div className="request-stepper" aria-label="Etapas da solicitação">
          {formSteps.map((item, index) => (
            <div
              key={item.label}
              type="button"
              className={index === currentStepIndex ? "selected" : index < currentStepIndex ? "done" : ""}
            >
              <span>{index + 1}</span>
              {item.label}
            </div>
          ))}
        </div>
        {submissionError && <p className="form-error">{submissionError}</p>}

        <div className="single-request-form clean-form">
          {formStep === 0 && <FormSection title="Tutor e endereço" action={
            <label className="toggle-switch farmer-toggle">
              <input type="checkbox" checked={requestData.isFarmer} onChange={(event) => updateRequestField("isFarmer", event.target.checked)} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              Agricultor?
            </label>
          }>
            <Field
              label="Nome"
              value={requestData.tutor}
              onChange={(value) => updateRequestField("tutor", value)}
              placeholder="Nome do tutor ou responsável"
              invalid={showInvalid("tutor")}
            />
            <Field
              label="CPF"
              value={requestData.cpf}
              onChange={(value) => updateMaskedRequestField("cpf", value)}
              placeholder="000.000.000-00"
              invalid={showInvalid("cpf")}
            />
            <div className="cadunico-row">
              <Field
                label="CadÚnico"
                value={requestData.cadUnico}
                onChange={(value) => updateRequestField("cadUnico", value)}
                placeholder="Número do CadÚnico"
                readOnly={requestData.cadUnicoNotApplicable}
              />
              <label className="checkbox-row cadunico-checkbox">
                <input
                  type="checkbox"
                  checked={requestData.cadUnicoNotApplicable}
                  onChange={(event) => toggleCadUnicoNotApplicable(event.target.checked)}
                />
                Não se aplica
              </label>
            </div>
            <div className="form-subsection-title">Endereço</div>
            <div className="address-lookup-grid">
              <div className="cep-with-map">
                <Field
                  label="CEP"
                  value={requestData.cep}
                  onChange={lookupCep}
                  placeholder="00000-000"
                  invalid={showInvalid("cep")}
                />
              </div>
              <Field
                label="Número"
                value={requestData.number}
                onChange={(value) => updateRequestField("number", value)}
                placeholder="123"
                invalid={showInvalid("number")}
              />
            </div>
            {cepStatus && <p className="cep-status">{cepStatus}</p>}
            <Field
              label="Endereço completo"
              value={requestData.address}
              onChange={(value) => updateRequestField("address", value)}
              placeholder="Rua, número, complemento"
              invalid={showInvalid("address")}
            />
            <Field
              label="Bairro"
              value={requestData.neighborhood}
              onChange={(value) => updateRequestField("neighborhood", value)}
              placeholder="Informe o bairro"
              invalid={showInvalid("neighborhood")}
            />
            <div className="two-column-fields">
              <Field
                label="Cidade"
                value={requestData.city}
                onChange={(value) => updateRequestField("city", value)}
                placeholder="Cidade"
                invalid={showInvalid("city")}
              />
              <Field
                label="UF"
                value={requestData.state}
                onChange={(value) => updateMaskedRequestField("state", value)}
                placeholder="SP"
                invalid={showInvalid("state")}
              />
            </div>
            {requestData.latitude && requestData.longitude && (
              <p className="map-selected-place">Localização atual registrada: {requestData.latitude}, {requestData.longitude}.</p>
            )}
            {locationStatus && <p className="cep-status">{locationStatus}</p>}
            <div className="form-subsection-title">Contato</div>
            <Field
              label="Email"
              value={requestData.email}
              onChange={(value) => updateRequestField("email", value)}
              placeholder="seuemail@exemplo.com"
              invalid={showInvalid("email")}
            />
            <div className="contact-confirmation-panel">
              <div className="phone-validation-row">
                <Field
                  label="Celular"
                  value={requestData.phone}
                  onChange={(value) => updateMaskedRequestField("phone", value)}
                  placeholder="Digite seu WhatsApp/celular"
                  invalid={showInvalid("phone")}
                />
                {!internalSimple && !smsCode && !smsConfirmed && (
                  <button className="secondary-action" type="button" onClick={sendSmsCode}>
                    Enviar código
                  </button>
                )}
                {!internalSimple && (smsCode || smsConfirmed) && (
                  <>
                    <label className={showInvalid("sms") ? "field sms-code-field invalid" : "field sms-code-field"}>
                      <span>Código SMS</span>
                      <input
                        value={smsInput}
                        onChange={(event) => setSmsInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        inputMode="numeric"
                        disabled={smsConfirmed}
                      />
                    </label>
                    <button className="ghost-button" type="button" onClick={confirmSmsCode} disabled={smsConfirmed}>
                      Confirmar
                    </button>
                  </>
                )}
              </div>
            </div>
            {smsStatus && <p className={smsConfirmed ? "sms-status confirmed" : "sms-status"}>{smsStatus}</p>}
          </FormSection>}

          {formStep === 1 && <FormSection title="Dados dos animais">
            {configuredRequestTypes.length > 0 && (
              <label className={showInvalid("type") ? "field invalid" : "field"}>
                <span>Tipo de solicitação</span>
                <select
                  value={requestData.type}
                  onChange={(event) => updateRequestField("type", event.target.value)}
                >
                  <option value="">Selecione o tipo</option>
                  {configuredRequestTypes.map((type) => (
                    <option key={type.id || type.name} value={type.name}>{type.name}</option>
                  ))}
                </select>
              </label>
            )}
            {animals.map((animal, index) => (
              <div className="animal-form" key={`animal-${index}`}>
                <div className="animal-form-header">
                  <strong>Animal {index + 1}</strong>
                </div>
                <SegmentedControl
                  label="Procedimento"
                  value={animal.procedure}
                  options={["Castração", "Microchipagem", "Ambos"]}
                  onChange={(value) => updateAnimal(index, "procedure", value)}
                  invalid={submitAttempted && !animal.procedure}
                />
                <div className="animal-main-grid">
                  <Field
                    label="Nome"
                    value={animal.name}
                    onChange={(value) => updateAnimal(index, "name", value)}
                    placeholder="Nome do animal"
                  />
                  <Field
                    label="Data de nascimento"
                    value={animal.birthDate || animal.age}
                    onChange={(value) => {
                      updateAnimal(index, "birthDate", value);
                      updateAnimal(index, "age", value);
                    }}
                    type="date"
                  />
                  <Field
                    label="Cor da pelagem"
                    value={animal.coat}
                    onChange={(value) => updateAnimal(index, "coat", value)}
                    placeholder="Ex: preto, caramelo"
                  />
                  <div className="inline-microchip-fields">
                    <Field
                      label="Código do microchip"
                      value={animal.microchip}
                      onChange={(value) => updateAnimal(index, "microchip", value)}
                      placeholder={animal.hasChip === "Sim" ? "Número do chip" : "Marque o campo ao lado"}
                      readOnly={animal.hasChip !== "Sim"}
                    />
                    <label className="checkbox-row compact-checkbox" title="Animal já é chipado">
                      <input
                        type="checkbox"
                        aria-label="Animal já é chipado"
                        checked={animal.hasChip === "Sim"}
                        onChange={(event) => {
                          updateAnimal(index, "hasChip", event.target.checked ? "Sim" : "Nao");
                          if (!event.target.checked) updateAnimal(index, "microchip", "");
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="choice-card">
                  <strong>Características</strong>
                  <div className="animal-choice-grid">
                    <CompactChoiceField
                      label="Espécie"
                      value={animal.species}
                      options={activeSpecies}
                      onChange={(value) => updateAnimal(index, "species", value)}
                      invalid={submitAttempted && !animal.species}
                    />
                    <CompactChoiceField
                      label="Sexo"
                      value={animal.sex}
                      options={["Macho", "Fêmea"]}
                      onChange={(value) => updateAnimal(index, "sex", value)}
                      invalid={submitAttempted && !animal.sex}
                    />
                    <CompactChoiceField
                      label="Porte"
                      value={animal.size}
                      options={activeSizes.map((size) => ({ label: size.name, title: size.description, subtitle: formatSizeRange(size) }))}
                      onChange={(value) => updateAnimal(index, "size", value)}
                      invalid={submitAttempted && !animal.size}
                    />
                    <CompactChoiceField
                      label="Raça"
                      value={animal.breedType}
                      options={["Indefinida", "Definida"]}
                      onChange={(value) => updateAnimal(index, "breedType", value)}
                      invalid={submitAttempted && !animal.breedType}
                    />
                  </div>
                </div>
                {animal.breedType === "Definida" && (
                  <Field
                    label="Descreva a raça"
                    value={animal.breedDescription}
                    onChange={(value) => updateAnimal(index, "breedDescription", value)}
                    placeholder="Ex: Poodle, Siamês"
                  />
                )}
                <div className="health-card">
                  <strong>Saúde e cuidados <span className="optional-label">opcional</span></strong>
                  <div className="health-grid">
                  <YesNoField
                    label="Vermifugado?"
                    value={animal.dewormed}
                    onChange={(value) => updateAnimal(index, "dewormed", value)}
                  />
                  <YesNoField
                    label="Vacinas em dia?"
                    value={animal.vaccinated}
                    onChange={(value) => updateAnimal(index, "vaccinated", value)}
                  />
                  <YesNoField
                    label="Já teve cria?"
                    value={animal.hadLitter}
                    onChange={(value) => updateAnimal(index, "hadLitter", value)}
                  />
                  <YesNoField
                    label="Histórico de doenças?"
                    value={animal.illnessHistory}
                    onChange={(value) => updateAnimal(index, "illnessHistory", value)}
                  />
                  <CompactChoiceField
                    label="Alimentação"
                    value={animal.food}
                    options={["Ração", "Diversos"]}
                    onChange={(value) => updateAnimal(index, "food", value)}
                  />
                  </div>
                </div>
              </div>
            ))}
            <div className="animal-actions-row">
              <button className="secondary-action" type="button" onClick={addAnimal}>
                <Plus size={18} />
                Adicionar animal
              </button>
              {animals.length > 1 && (
                <button className="ghost-button danger-action" type="button" onClick={() => removeAnimal(animals.length - 1)}>
                  Remover último
                </button>
              )}
            </div>
          </FormSection>}

          {formStep === 2 && <FormSection title="Agenda">
            <PublicSchedulePicker
              requests={requests}
              scheduleDays={scheduleDays}
              selectedDate={requestData.schedule}
              pendingReservation={{ date: requestData.schedule, count: animals.length }}
              onSelect={(date) => updateRequestField("schedule", date)}
            />
          </FormSection>}

          {!internalSimple && formStep === 3 && <FormSection title="Documentos comprobatórios">
            <div className="animal-photo-upload-card">
              <div>
                <strong>Foto de registro animal</strong>
                <span>Opcional</span>
                {documentUploads.animal_photo?.fileName && <small>{documentUploads.animal_photo.fileName}</small>}
              </div>
              {documentUploads.animal_photo?.dataUrl && (
                <button className="animal-photo-preview" type="button" onClick={() => setPreviewDocument(documentUploads.animal_photo)}>
                  <img src={documentUploads.animal_photo.dataUrl} alt="Foto de registro animal" />
                </button>
              )}
              <div className="animal-photo-actions">
                <label className="secondary-action file-button">
                  Enviar foto
                  <input
                    type="file"
                    accept="image/*"
                    onClick={(event) => { event.currentTarget.value = ""; }}
                    onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])}
                  />
                </label>
                <label className="ghost-button file-button">
                  Abrir câmera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onClick={(event) => { event.currentTarget.value = ""; }}
                    onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])}
                  />
                </label>
                {documentUploads.animal_photo && (
                  <button className="danger-action" type="button" onClick={() => removeDocumentFile("animal_photo")}>
                    Remover
                  </button>
                )}
              </div>
            </div>
            <div className="document-upload-list">
              {!selectedRequestType && (
                <EmptyState
                  title="Nenhum documento obrigatório"
                  text="Este cadastro seguirá sem anexos obrigatórios nesta etapa."
                />
              )}
              {selectedTypeDocuments.map((document) => {
                const upload = documentUploads[document.id];
                return (
                  <DocumentScannerUpload
                    key={document.id}
                    document={document}
                    upload={upload}
                    aiActive={aiSettings.active}
                    onUpload={(file) => handleDocumentFile(document, file)}
                    onRemove={() => removeDocumentFile(document.id)}
                  />
                );
              })}
            </div>
            <div className="declaration-box">
              <FileText size={20} />
              <p>
                O tutor declara ciência dos cuidados pré e pós-cirúrgicos, responsabilidades de acompanhamento e autorização
                para registro do procedimento.{" "}
                <button className="inline-link-button" type="button" onClick={openDeclarationPdf}>
                  Ler declaração em PDF
                </button>
              </p>
            </div>
            <label className={showInvalid("accepted") ? "checkbox-row invalid" : "checkbox-row"}>
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              Li e aceito a declaração.
            </label>
          </FormSection>}

          {internalSimple && formStep === 3 && <FormSection title="Finalização">
            <div className="animal-photo-upload-card">
              <div>
                <strong>Foto de registro animal</strong>
                <span>Opcional</span>
                {documentUploads.animal_photo?.fileName && <small>{documentUploads.animal_photo.fileName}</small>}
              </div>
              {documentUploads.animal_photo?.dataUrl && (
                <button className="animal-photo-preview" type="button" onClick={() => setPreviewDocument(documentUploads.animal_photo)}>
                  <img src={documentUploads.animal_photo.dataUrl} alt="Foto de registro animal" />
                </button>
              )}
              <div className="animal-photo-actions">
                <label className="secondary-action file-button">
                  Enviar foto
                  <input
                    type="file"
                    accept="image/*"
                    onClick={(event) => { event.currentTarget.value = ""; }}
                    onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])}
                  />
                </label>
                <label className="ghost-button file-button">
                  Abrir câmera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onClick={(event) => { event.currentTarget.value = ""; }}
                    onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])}
                  />
                </label>
                {documentUploads.animal_photo && (
                  <button className="danger-action" type="button" onClick={() => removeDocumentFile("animal_photo")}>
                    Remover
                  </button>
                )}
              </div>
            </div>
          </FormSection>}

        </div>

        <div className="form-actions">
          <button
            className="ghost-button nav-back-action"
            type="button"
            disabled={currentStepIndex === 0 && !onBack}
            onClick={() => (currentStepIndex > 0 ? setFormStep(formSteps[currentStepIndex - 1].step) : onBack?.())}
          >
            Voltar
          </button>
          {currentStepIndex < formSteps.length - 1 ? (
            <button
              className="primary-action nav-next-action"
              type="button"
              disabled={!internalSimple && formStep === 0 && !skipTutorStep && !smsConfirmed}
              onClick={goToNextStep}
            >
              Continuar
            </button>
          ) : (
            <button className="primary-action nav-next-action" type="button" disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? "Enviando..." : "Encerrar"}
            </button>
          )}
        </div>
      </div>
      {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />}
    </section>
  );
}

function buildDeclarationPdfHtml(requestData, animals = []) {
  const animalRows = animals.map((animal, index) => `
    <div class="animal-card">
      <div class="animal-card-title">Animal ${index + 1}${animal.name ? ` - ${escapeHtml(animal.name)}` : ""}</div>
      <div class="data-grid three">
        <div class="data-item"><span>Espécie</span><strong>${escapeHtml(animal.species || "—")}</strong></div>
        <div class="data-item"><span>Sexo</span><strong>${escapeHtml(animal.sex || "—")}</strong></div>
        <div class="data-item"><span>Porte</span><strong>${escapeHtml(animal.size || "—")}</strong></div>
        <div class="data-item"><span>Procedimento</span><strong>${escapeHtml(animal.procedure || "—")}</strong></div>
      </div>
    </div>
  `).join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Declaração da solicitação</title>
    <style>${PDF_BASE_STYLES}</style>
  </head>
  <body>
    <header class="pdf-header">
      <div>
        <span class="kicker">Declaração do tutor</span>
        <h1>Solicitação de castração animal</h1>
      </div>
      <div class="header-box"><span>Data</span><strong>${new Date().toLocaleDateString("pt-BR")}</strong></div>
    </header>
    <section class="section">
      <div class="section-title">Dados do tutor</div>
      <div class="data-grid two">
        <div class="data-item"><span>Nome</span><strong>${escapeHtml(requestData.tutor || "—")}</strong></div>
        <div class="data-item"><span>CPF</span><strong>${escapeHtml(requestData.cpf || "—")}</strong></div>
      </div>
    </section>
    <section class="section">
      <div class="section-title">Animais</div>
      ${animalRows || "<p>Nenhum animal informado.</p>"}
    </section>
    <section class="section">
      <div class="section-title">Declaração</div>
      <div class="declaration-card">
        <p>Declaro que as informações prestadas são verdadeiras e autorizo o uso dos dados para triagem, agendamento e acompanhamento da solicitação de castração animal.</p>
        <p>Declaro ciência dos cuidados pré e pós-cirúrgicos, das responsabilidades de acompanhamento do animal e da necessidade de cumprir as orientações fornecidas pela equipe responsável.</p>
        <p>Ao marcar o aceite no sistema, confirmo que li e concordo com esta declaração.</p>
      </div>
    </section>
    <footer class="footer"><span>Sistema municipal de castração animal</span><span>Gerado em ${new Date().toLocaleString("pt-BR")}</span></footer>
  </body>
</html>`;
}

function SignatureModal({ requestData, animals, onConfirm, onClose }) {
  const [mode, setMode] = useState("digital");
  const [localAccepted, setLocalAccepted] = useState(false);
  const [sigData, setSigData] = useState("");
  const [attachedFile, setAttachedFile] = useState("");

  const canConfirm = localAccepted && (mode === "digital" ? Boolean(sigData) : Boolean(attachedFile));

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setAttachedFile(e.target.result);
    reader.readAsDataURL(file);
  }

  function downloadForm() {
    const address = [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state, requestData.cep].filter(Boolean).join(", ");
    const animalRows = animals.map((a, i) => `
      <div class="animal-card">
        <div class="animal-card-title">Animal ${i + 1}${a.name ? ` — ${escapeHtml(a.name)}` : ""}</div>
        <div class="data-grid three">
          <div class="data-item"><span>Espécie</span><strong>${escapeHtml(a.species || "—")}</strong></div>
          <div class="data-item"><span>Sexo</span><strong>${escapeHtml(a.sex || "—")}</strong></div>
          <div class="data-item"><span>Porte</span><strong>${escapeHtml(a.size || "—")}</strong></div>
          <div class="data-item"><span>Procedimento</span><strong>${escapeHtml(a.procedure || "—")}</strong></div>
          ${a.microchip ? `<div class="data-item"><span>Microchip</span><strong>${escapeHtml(a.microchip)}</strong></div>` : ""}
        </div>
      </div>
    `).join("");
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Requerimento de castração animal</title>
    <style>
      ${PDF_BASE_STYLES}
      body { display: flex; flex-direction: column; gap: 11px; }
      .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
      .sig-line { border-bottom: 1px solid #172026; padding-bottom: 4px; font-size: 10px; color: #5b6b7a; }
    </style>
  </head>
  <body>
    <header class="pdf-header">
      <div>
        <span class="kicker">Requerimento municipal</span>
        <h1>Solicitação de castração animal</h1>
      </div>
      <div class="header-box"><span>Data</span><strong>${new Date().toLocaleDateString("pt-BR")}</strong></div>
    </header>

    <section class="section">
      <div class="section-title">Agendamento</div>
      <div class="data-grid two">
        <div class="data-item"><span>Data escolhida</span><strong>${escapeHtml(requestData.schedule || "—")}</strong></div>
        <div class="data-item"><span>Tipo de serviço</span><strong>${escapeHtml(requestData.type || "—")}</strong></div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Dados do tutor</div>
      <div class="data-grid four">
        <div class="data-item" style="grid-column:span 2"><span>Nome completo</span><strong>${escapeHtml(requestData.tutor || "—")}</strong></div>
        <div class="data-item"><span>CPF</span><strong>${escapeHtml(requestData.cpf || "—")}</strong></div>
        <div class="data-item"><span>CadÚnico</span><strong>${escapeHtml(requestData.cadUnicoNotApplicable ? "Não se aplica" : requestData.cadUnico || "—")}</strong></div>
        <div class="data-item"><span>Celular</span><strong>${escapeHtml(requestData.phone || "—")}</strong></div>
        <div class="data-item"><span>E-mail</span><strong>${escapeHtml(requestData.email || "—")}</strong></div>
        <div class="data-item" style="grid-column:span 3"><span>Endereço</span><strong>${escapeHtml(address || "—")}</strong></div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Animais (${animals.length})</div>
      ${animalRows}
    </section>

    <section class="section">
      <div class="section-title">Declaração e assinatura</div>
      <div class="declaration-card">
        <p>Eu, <strong>${escapeHtml(requestData.tutor || "—")}</strong>, declaro que as informações prestadas neste requerimento são verdadeiras e autorizo o registro dos dados para triagem, agendamento e acompanhamento do procedimento solicitado.</p>
        <p>Declaro ciência dos cuidados pré e pós-cirúrgicos, das responsabilidades de acompanhamento do animal e da necessidade de cumprir as orientações fornecidas pela equipe responsável.</p>
        <div class="sig-block">
          <div>
            <div class="sig-line">Assinatura do tutor</div>
          </div>
          <div>
            <div class="sig-line">Data: _____ / _____ / __________</div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer"><span>Sistema municipal de castração animal</span><span>Gerado em ${new Date().toLocaleString("pt-BR")}</span></footer>
  </body>
</html>`;

    printHtmlViaIframe(html);
  }

  return (
    <div className="modal-backdrop">
      <div className="config-modal signature-modal">
        <ModalHeader title="Assinar solicitação" onClose={onClose} />
        <div className="declaration-box">
          <FileText size={20} />
          <p>
            Declaro que as informações prestadas são verdadeiras e autorizo o uso dos dados para triagem,
            agendamento e acompanhamento da solicitação de castração animal.
          </p>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={localAccepted} onChange={(e) => setLocalAccepted(e.target.checked)} />
          Li e aceito assinar eletronicamente esta solicitação.
        </label>
        <div className="agenda-kind-selector">
          <button type="button" className={mode === "digital" ? "selected" : ""} onClick={() => setMode("digital")}>
            Assinar digitalmente
          </button>
          <button type="button" className={mode === "attachment" ? "selected" : ""} onClick={() => setMode("attachment")}>
            Baixar e anexar
          </button>
        </div>
        {mode === "digital" && (
          <SignaturePad value={sigData} onChange={setSigData} />
        )}
        {mode === "attachment" && (
          <div className="signature-attachment-block">
            <p className="helper-text">
              Baixe o requerimento, imprima ou assine digitalmente em outro aplicativo, e envie o arquivo aqui.
            </p>
            <button className="secondary-action" type="button" onClick={downloadForm}>
              Baixar requerimento (PDF)
            </button>
            <label className="field">
              <span>Anexar documento assinado</span>
              <input type="file" accept="image/*,.pdf" onChange={handleFileChange} />
            </label>
            {attachedFile && <p className="cep-status-text" style={{ color: "var(--teal)" }}>Arquivo anexado com sucesso.</p>}
          </div>
        )}
        <div className="form-actions">
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-action" type="button" disabled={!canConfirm} onClick={() => onConfirm(mode === "digital" ? sigData : attachedFile)}>
            Confirmar e enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function SignaturePad({ value, onChange, invalid = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  const getPoint = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const startDrawing = useCallback((event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getPoint(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }, [getPoint]);

  const draw = useCallback((event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getPoint(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#172026";
    context.lineTo(point.x, point.y);
    context.stroke();
  }, [getPoint]);

  const finishDrawing = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }, [onChange]);

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  useEffect(() => {
    if (!value) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
  }, [value]);

  return (
    <div className={invalid ? "signature-pad invalid" : "signature-pad"}>
      <div className="signature-pad-head">
        <div>
          <strong>Assine no campo abaixo</strong>
          <span>Use o dedo no celular ou o mouse no computador.</span>
        </div>
        <button className="ghost-button" type="button" onClick={clearSignature}>Limpar</button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={260}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={finishDrawing}
        aria-label="Campo de assinatura"
      />
      {invalid && <p className="form-error">Desenhe a assinatura para concluir a solicitacao.</p>}
    </div>
  );
}

function SegmentedControl({ label, value, options, onChange, invalid = false }) {
  return (
    <div className={invalid ? "segmented-field invalid" : "segmented-field"}>
      <span>{label}</span>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "selected" : ""}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function DocumentPreviewModal({ document, onClose }) {
  const dataUrl = getDocumentPreviewSource(document);
  const mimeType = document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl);
  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const canPreview = Boolean(dataUrl) && (isImage || isPdf);

  return (
    <div className="modal-backdrop">
      <div className="document-preview-modal" role="dialog" aria-modal="true">
        <ModalHeader title={document.documentName || document.fileName} eyebrow={document.eyebrow || "Anexo"} subtitle={document.fileName} onClose={onClose} />
        <div className="document-preview-frame">
          {isImage && <img src={dataUrl} alt={document.documentName || document.fileName} />}
          {isPdf && (
            <object title={document.fileName} data={dataUrl} type="application/pdf">
              <embed src={dataUrl} type="application/pdf" />
            </object>
          )}
          {!canPreview && (
            <EmptyState title="Prévia indisponível" text="Este anexo não possui arquivo de prévia salvo em formato compatível." />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({
  requests,
  setSelectedId,
  currentUser,
  patchRequest,
  createRequest,
  scheduleDays = [],
  requestTypes = initialRequestTypes,
  speciesOptions = initialSpecies,
  sizeOptions = initialSizes,
  aiSettings = initialAiSettings,
  teams = initialTeams,
  globalSearch = "",
}) {
  const [requestFilter, setRequestFilter] = useState("analysis");
  const [previewRequest, setPreviewRequest] = useState(null);
  const [assignRequest, setAssignRequest] = useState(null);
  const [rescheduleRequest, setRescheduleRequest] = useState(null);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [attendanceRequest, setAttendanceRequest] = useState(null);
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [assignment, setAssignment] = useState({ sectorId: "", userId: "" });
  const [rejectData, setRejectData] = useState({ note: "" });
  const [attendanceData, setAttendanceData] = useState({ microchip: "", note: "" });

  const visibleRequests = useMemo(
    () => (Array.isArray(requests) ? requests : [])
      .map(normalizeRequest)
      .filter((request) => matchesRequestSearch(request, globalSearch)),
    [requests, globalSearch],
  );
  const filterTabs = [
    { id: "analysis", label: "Em análise", requests: visibleRequests.filter((r) => r.status === "EM_ANALISE") },
    { id: "surgery", label: "Aguardando cirurgia", requests: visibleRequests.filter((r) => r.status === "AGUARDANDO_CIRURGIA") },
    { id: "archived", label: "Arquivadas", requests: visibleRequests.filter((r) => r.status === "ARQUIVADA") },
    { id: "all", label: "Todas", requests: visibleRequests },
  ];
  const activeTab = filterTabs.find((tab) => tab.id === requestFilter) || filterTabs[0];
  const activeScheduleDays = scheduleDays
    .filter((day) => day.active !== false && !isPastScheduleDay(day.date))
    .map((day) => ({ ...day, remaining: Math.max((day.vacancies || 0) - countUsedVacancies(requests, day.date), 0) }));
  const activeUsers = teams.users?.filter((user) => user.active !== false) || [];
  const activeSectors = teams.sectors?.filter((sector) => sector.active !== false) || [];
  const assignableStatuses = ["EM_ANALISE", "AGUARDANDO_CIRURGIA"];
  const currentTeamUser = activeUsers.find((user) => user.email && currentUser.email && user.email.toLowerCase() === currentUser.email.toLowerCase())
    || activeUsers.find((user) => user.id === currentUser.id);
  const currentUserSector = activeSectors.find((sector) => sector.id === currentTeamUser?.sectorId);

  function openAssign(request) {
    setAssignRequest(request);
    setAssignment({ sectorId: request.assignedSectorId || activeSectors[0]?.id || "", userId: request.assignedUserId || "" });
  }

  function confirmAssign(event) {
    event.preventDefault();
    if (!assignRequest) return;
    const sector = activeSectors.find((item) => item.id === assignment.sectorId);
    const user = activeUsers.find((item) => item.id === assignment.userId);
    patchRequest?.(
      assignRequest.id,
      {
        status: assignRequest.status,
        assignedSectorId: sector?.id || "",
        assignedSectorName: sector?.name || "Não informado",
        assignedUserId: user?.id || "",
        responsible: user?.name || sector?.name || "Equipe",
        tags: mergeTags(assignRequest.tags, ["ATRIBUIDA"]),
      },
      `Atribuída para ${sector?.name || "setor"}${user ? ` / ${user.name}` : ""}`,
    );
    setAssignRequest(null);
  }

  function assumeRequest(request) {
    patchRequest?.(
      request.id,
      {
        status: request.status,
        assignedSectorId: currentUserSector?.id || request.assignedSectorId || "",
        assignedSectorName: currentUserSector?.name || request.assignedSectorName || "Sem setor",
        assignedUserId: currentTeamUser?.id || currentUser.id || "",
        responsible: currentTeamUser?.name || currentUser.name || "Usuário atual",
        tags: mergeTags(request.tags, ["ATRIBUIDA"]),
      },
      `Assumida por ${currentTeamUser?.name || currentUser.name || "usuário atual"}`,
    );
  }

  function approveRequest(request) {
    patchRequest?.(
      request.id,
      { status: "AGUARDANDO_CIRURGIA", tags: mergeTags(request.tags, ["DEFERIDA"]) },
      `Solicitação deferida por ${currentUser.name}`,
    );
    setPreviewRequest(null);
  }

  function archiveWithTag(request, tag, note) {
    patchRequest?.(
      request.id,
      { status: "ARQUIVADA", tags: mergeTags(request.tags, [tag]) },
      note,
    );
    setPreviewRequest(null);
  }

  function openAttendance(request) {
    setAttendanceRequest(request);
    const normalized = normalizeRequest(request);
    setAttendanceData({
      microchip: normalized.animalMicrochip || normalized.animals?.find((animal) => animal.microchip)?.microchip || "",
      note: "",
    });
  }

  function confirmAttendance(event) {
    event.preventDefault();
    if (!attendanceRequest) return;
    const normalized = normalizeRequest(attendanceRequest);
    const microchip = attendanceData.microchip.trim();
    const note = attendanceData.note.trim();
    const performedProcedures = getPerformedProceduresLabel(normalized);
    const currentAnimals = Array.isArray(normalized.animals) ? normalized.animals : [];
    const animals = microchip
      ? currentAnimals.map((animal, index) => index === 0 ? { ...animal, hasChip: "Sim", microchip } : animal)
      : currentAnimals;
    patchRequest?.(
      attendanceRequest.id,
      {
        status: "ARQUIVADA",
        tags: mergeTags(attendanceRequest.tags, ["COMPARECEU"]),
        animalMicrochip: microchip,
        animals,
        workflow_data: {
          performedProcedures,
          attendanceMicrochip: microchip,
          attendanceNote: note,
        },
      },
      `Comparecimento confirmado${microchip ? `. Microchip: ${microchip}` : ""}${note ? `. Observação: ${note}` : ""}`,
    );
    setAttendanceRequest(null);
    setPreviewRequest(null);
  }

  function openReject(request) {
    setRejectRequest(request);
    setRejectData({ note: "" });
  }

  function confirmReject(event) {
    event.preventDefault();
    if (!rejectRequest) return;
    const note = rejectData.note.trim();
    patchRequest?.(
      rejectRequest.id,
      {
        status: "ARQUIVADA",
        tags: mergeTags(rejectRequest.tags, ["INDEFERIDA"]),
        rejectionReason: note || "Indeferido",
        rejectionNote: note,
      },
      `Indeferida por ${currentUser.name}${note ? `. Observação: ${note}` : ""}`,
    );
    setRejectRequest(null);
    setPreviewRequest(null);
  }

  function confirmReschedule(date) {
    if (!rescheduleRequest) return;
    const patch = {
      status: rescheduleRequest.status,
      tags: mergeTags(rescheduleRequest.tags, ["REAGENDADA"]),
      previousSchedule: rescheduleRequest.preferredSchedule || rescheduleRequest.appointment || "Não informado",
      preferredSchedule: date,
      appointment: date,
    };
    patchRequest?.(
      rescheduleRequest.id,
      patch,
      `Reagendada por ${currentUser.name}: ${rescheduleRequest.preferredSchedule || "sem data"} -> ${date}`,
    );
    setPreviewRequest((current) => current?.id === rescheduleRequest.id ? normalizeRequest({ ...current, ...patch }) : current);
    setRescheduleRequest(null);
  }

  function openRescheduleFromPreview(request) {
    setRescheduleRequest(request);
  }

  function rejectRequestFromProcess(request, data = {}) {
    if (!request) return;
    const note = String(data.note || "").trim();
    patchRequest?.(
      request.id,
      {
        status: "ARQUIVADA",
        tags: mergeTags(request.tags, ["INDEFERIDA"]),
        rejectionReason: note || "Indeferido",
        rejectionNote: note,
      },
      `Indeferida por ${currentUser.name}${note ? `. Observação: ${note}` : ""}`,
    );
    setPreviewRequest(null);
  }

  function confirmAttendanceFromProcess(request, data = {}) {
    if (!request) return;
    const normalized = normalizeRequest(request);
    const microchip = String(data.microchip || "").trim();
    const note = String(data.note || "").trim();
    const performedProcedures = getPerformedProceduresLabel(normalized);
    const currentAnimals = Array.isArray(normalized.animals) ? normalized.animals : [];
    const animals = microchip
      ? currentAnimals.map((animal, index) => index === 0 ? { ...animal, hasChip: "Sim", microchip } : animal)
      : currentAnimals;
    patchRequest?.(
      request.id,
      {
        status: "ARQUIVADA",
        tags: mergeTags(request.tags, ["COMPARECEU"]),
        animalMicrochip: microchip,
        animals,
        workflow_data: {
          performedProcedures,
          attendanceMicrochip: microchip,
          attendanceNote: note,
        },
      },
      `Comparecimento confirmado${microchip ? `. Microchip: ${microchip}` : ""}${note ? `. Observação: ${note}` : ""}`,
    );
    setPreviewRequest(null);
  }

  function openRequestPreview(request) {
    setSelectedId?.(request.id);
    setPreviewRequest(request);
  }

  return (
    <section className="request-workspace triage-workspace">
      <div className="workspace-heading">
        <div>
          <h2>Solicitações de castração</h2>
        </div>
        <button className="primary-action" type="button" onClick={() => setCreateRequestOpen(true)}>
          <Plus size={18} />
          Criar Solicitação
        </button>
      </div>

      <div className="request-filter-tabs">
        {filterTabs.map((tab) => (
          <button key={tab.id} type="button" className={requestFilter === tab.id ? "selected" : ""} onClick={() => setRequestFilter(tab.id)}>
            {tab.label}<span>{tab.requests.length}</span>
          </button>
        ))}
      </div>

      <div className="triage-card-grid">
        {activeTab.requests.length === 0 && <EmptyState title="Nenhuma solicitação nesta etapa" text="Quando houver registros, eles aparecerão aqui em cards responsivos." />}
        {activeTab.requests.map((request) => (
          <article
            className="triage-card clickable-triage-card"
            key={request.id}
            role="button"
            tabIndex={0}
            onClick={() => openRequestPreview(request)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openRequestPreview(request);
              }
            }}
          >
            <div className="triage-row">
              <div className="triage-row-main">
                <div className="triage-card-top">
                  <div><span className="eyebrow">#{request.protocol}</span><h3>{request.tutor}</h3></div>
                  <StatusBadge status={request.status} className="triage-status-badge" />
                </div>
                <p>Tipo: {requestTypeLabel(request)}</p>
                <p>Data: {request.preferredSchedule || request.appointment || "Aguardando"}</p>
                <p>Responsável: {request.responsible || "Não atribuído"}</p>
                <p>Setor: {request.assignedSectorName || "Sem setor"}</p>
                <p>Animal: {request.animals.map((animal) => animal.name).join(", ") || "Animal nao informado"}</p>
                <MicrochipLine request={request} />
                {request.tags.length > 0 && (
                  <div className="workflow-tag-list">
                    {request.tags.map((tag) => <span key={tag}>{workflowTagLabels[tag] || tag}</span>)}
                  </div>
                )}
                {request.tags.includes("REAGENDADA") && <p className="helper-text">Antes: {request.previousSchedule || "Nao informado"} | Nova: {request.preferredSchedule}</p>}
                {request.rejectionReason && <p className="form-error">Justificativa: {request.rejectionReason}</p>}
              </div>
              <div className="triage-row-actions" onClick={(event) => event.stopPropagation()}>
                {assignableStatuses.includes(request.status) && (
                  <>
                    <button className="assign-corner-action" type="button" onClick={() => openAssign(request)} aria-label="Atribuir">
                      <ClipboardList size={20} />
                      <span>Atribuir</span>
                    </button>
                    <button className="assign-corner-action assume-corner-action" type="button" onClick={() => assumeRequest(request)} aria-label="Assumir">
                      <CheckCircle2 size={20} />
                      <span>Assumir</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {previewRequest && (
        <RequestPreviewModal
          request={previewRequest}
          requestTypes={requestTypes}
          scheduleDays={activeScheduleDays}
          onClose={() => setPreviewRequest(null)}
          onApprove={approveRequest}
          onReject={rejectRequestFromProcess}
          onArchive={archiveWithTag}
          onAttendance={confirmAttendanceFromProcess}
          onReschedule={openRescheduleFromPreview}
        />
      )}

      {createRequestOpen && (
        <div className="modal-backdrop">
          <div className="config-modal request-preview-modal internal-request-modal" role="dialog" aria-modal="true">
            <ModalHeader title="Criar Solicitação" eyebrow="Nova solicitação" onClose={() => setCreateRequestOpen(false)} />
            <NewRequest
              createRequest={createRequest}
              currentUser={currentUser}
              compact
              internalSimple
              onBack={() => setCreateRequestOpen(false)}
              onDone={() => setCreateRequestOpen(false)}
              requests={requests}
              scheduleDays={scheduleDays}
              requestTypes={requestTypes}
              aiSettings={aiSettings}
              speciesOptions={speciesOptions}
              sizeOptions={sizeOptions}
            />
          </div>
        </div>
      )}

      {assignRequest && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={confirmAssign}>
            <ModalHeader title="Setor e usuário" eyebrow="Atribuir" onClose={() => setAssignRequest(null)} />
            <label className="field"><span>Setor</span><select value={assignment.sectorId} onChange={(event) => setAssignment((current) => ({ ...current, sectorId: event.target.value, userId: "" }))}>{activeSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></label>
            <label className="field"><span>Usuario</span><select value={assignment.userId} onChange={(event) => setAssignment((current) => ({ ...current, userId: event.target.value }))}><option value="">Somente setor</option>{activeUsers.filter((user) => !assignment.sectorId || user.sectorId === assignment.sectorId).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            <button className="primary-action" type="submit">Confirmar atribuição</button>
          </form>
        </div>
      )}

      {rescheduleRequest && (
        <div className="modal-backdrop">
          <div className="workflow-modal wide-workflow-modal">
            <ModalHeader title="Escolha nova data" eyebrow="Reagendar" onClose={() => setRescheduleRequest(null)} />
            {activeScheduleDays.length === 0
              ? <EmptyState title="Nenhuma data disponível" text="Configure datas de atendimento em Configurações › Ambiente › Agenda antes de reagendar." />
              : <div className="reschedule-grid">{activeScheduleDays.map((day) => <button key={day.date} className={`calendar-day-button${day.remaining > 0 ? " has-vacancy" : ""}`} type="button" disabled={day.remaining <= 0} onClick={() => confirmReschedule(day.date)}><span>{day.weekday}</span><strong>{day.date}</strong><small>{day.remaining} vagas</small></button>)}</div>
            }
          </div>
        </div>
      )}

      {rejectRequest && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={confirmReject}>
            <ModalHeader title="Justificativa obrigatória" eyebrow="Reprovar" onClose={() => setRejectRequest(null)} />
            <label className="field"><span>Observacao interna</span><textarea value={rejectData.note} onChange={(event) => setRejectData((current) => ({ ...current, note: event.target.value }))} /></label>
            <button className="primary-action" type="submit">Confirmar reprovação</button>
          </form>
        </div>
      )}

      {attendanceRequest && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={confirmAttendance}>
            <ModalHeader title="Procedimentos realizados" eyebrow="Comparecimento" onClose={() => setAttendanceRequest(null)} />
            <label className="field">
              <span>Código do microchip</span>
              <input
                value={attendanceData.microchip}
                onChange={(event) => setAttendanceData((current) => ({ ...current, microchip: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                placeholder="Informe o código aplicado ou lido"
              />
            </label>
            <label className="field">
              <span>Observacao interna</span>
              <textarea value={attendanceData.note} onChange={(event) => setAttendanceData((current) => ({ ...current, note: event.target.value }))} placeholder="Descreva detalhes, intercorrências ou procedimentos adicionais." />
            </label>
            <button className="primary-action" type="submit">Confirmar comparecimento</button>
          </form>
        </div>
      )}
    </section>
  );
}

function RequestPreviewModal({ request, onClose, onApprove, onReject, onArchive, onAttendance, onReschedule, requestTypes = [], scheduleDays = [] }) {
  const normalizedRequest = normalizeRequest(request);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState("");
  const [downloadLoadingId, setDownloadLoadingId] = useState("");
  const [bundleLoading, setBundleLoading] = useState(false);
  const [rejectData, setRejectData] = useState({ note: "" });
  const [attendanceData, setAttendanceData] = useState({
    microchip: normalizedRequest.animalMicrochip || normalizedRequest.animals?.find((animal) => animal.microchip)?.microchip || "",
    note: normalizedRequest.attendanceNote || "",
  });
  const canAnalyze = request.status === "EM_ANALISE";
  const canApprove = canAnalyze && !requestHasTag(request, "DEFERIDA");
  const canRecordAttendance = request.status === "AGUARDANDO_CIRURGIA";
  const canReschedule = request.status === "AGUARDANDO_CIRURGIA"
    && Boolean(request.preferredSchedule || request.appointment);

  const uploadedDocs = getUserUploadedProcessDocuments(request.documents);
  const requestTypeConfig = requestTypes.find(
    (t) => (t.id && t.id === request.requestTypeId) || t.name === request.type,
  );
  const requiredDocTypes = (requestTypeConfig?.documents || [])
    .map(normalizeDocumentType)
    .filter((dt) => dt.active !== false);

  const requerimento = {
    id: `requerimento-${request.protocol || request.id || "processo"}`,
    kind: "request",
    nome: `Requerimento ${request.protocol || ""}.pdf`.trim(),
    tipo: "Requerimento municipal",
    status: "Gerado",
    available: true,
  };

  const requiredRows = requiredDocTypes.map((dt) => {
    const uploaded = uploadedDocs.find(
      (d) => d.documentName === dt.name || d.documentId === dt.id,
    );
    if (uploaded) {
      return {
        id: uploaded.documentId || uploaded.fileName || dt.id,
        kind: "attachment",
        nome: uploaded.fileName || uploaded.documentName || dt.name,
        tipo: dt.name,
        status: uploaded.status === "approved" ? "Aprovado" : uploaded.status === "rejected" ? "Recusado" : "Aguardando análise",
        message: uploaded.message || "",
        available: true,
        document: uploaded,
      };
    }
    return {
      id: `missing-${dt.id}`,
      kind: "missing",
      nome: dt.name,
      tipo: dt.name,
      status: "Não enviado",
      available: false,
    };
  });

  const extraDocs = uploadedDocs
    .filter((d) => !requiredDocTypes.find((dt) => d.documentName === dt.name || d.documentId === dt.id))
    .map((d, index) => ({
      id: d.documentId || d.fileName || `extra-${index}`,
      kind: "attachment",
      nome: d.fileName || d.documentName || `Documento ${index + 1}`,
      tipo: d.documentName || "Documento anexado",
      status: d.status === "approved" ? "Aprovado" : d.status === "rejected" ? "Recusado" : "Aguardando análise",
      message: d.message || "",
      available: true,
      document: d,
    }));

  const anexos = [requerimento, ...requiredRows, ...extraDocs];
  const missingRequiredDocuments = requiredRows.filter((item) => item.status === "Não enviado").length;
  const approvedDocuments = anexos.filter((item) => item.status === "Aprovado" || item.status === "Gerado").length;
  const timeline = buildRequestTimeline(normalizedRequest);

  function statusClass(status) {
    if (status === "Aprovado") return "approved";
    if (status === "Recusado") return "rejected";
    if (status === "Não enviado") return "missing";
    if (status === "Gerado") return "generated";
    return "pending";
  }

  async function handlePreview(item) {
    setPreviewLoadingId(item.id);
    try {
      setPreviewAttachment(await prepareProcessDocumentPreview(item, request));
    } catch (err) {
      console.error("Erro ao preparar prévia do documento:", err);
      setPreviewAttachment({
        documentName: "Prévia indisponível",
        fileName: item.tipo || "documento",
        fileType: "",
        dataUrl: "",
      });
    } finally {
      setPreviewLoadingId("");
    }
  }

  async function handleDownload(item) {
    setDownloadLoadingId(item.id);
    try {
      const prepared = await prepareProcessDocumentPreview(item, request);
      if (prepared?.dataUrl) {
        const anchor = window.document.createElement("a");
        anchor.href = prepared.dataUrl;
        anchor.download = prepared.fileName || item.nome || item.tipo || "documento";
        anchor.click();
      }
    } catch (err) {
      console.error("Erro ao baixar documento:", err);
    } finally {
      setDownloadLoadingId("");
    }
  }

  async function handleBundlePreview() {
    setBundleLoading(true);
    try {
      setPreviewAttachment(await generateDocumentBundlePdf(request));
    } catch (error) {
      console.error("Erro ao preparar juntada:", error);
      setPreviewAttachment(await generateFallbackBundlePdf(request, error));
    } finally {
      setBundleLoading(false);
    }
  }

  function confirmRejectInline(event) {
    event.preventDefault();
    onReject?.(request, rejectData);
  }

  function confirmAttendanceInline(event) {
    event.preventDefault();
    onAttendance?.(request, attendanceData);
  }

  function renderAttachments() {
    return (
      <div className="process-attachments-list">
        {anexos.map((anexo, index) => (
          <article className="process-attachment-row" key={`${anexo.kind}-${anexo.id}`}>
            <div className="process-attachment-main">
              <span className="process-attachment-number">{String(index + 1).padStart(2, "0")}</span>
              <FileText size={18} className="process-attachment-icon" />
              <div className="process-attachment-info">
                <strong>{anexo.tipo}</strong>
              </div>
              <span className={`attachment-status attachment-status--${statusClass(anexo.status)}`}>{anexo.status}</span>
            </div>
            <div className="process-attachment-actions">
              {anexo.available ? (
                <>
                  <button className="icon-action" title="Visualizar" type="button" disabled={previewLoadingId === anexo.id} onClick={() => handlePreview(anexo)}>
                    <Eye size={16} />
                  </button>
                  <button className="icon-action" title="Baixar" type="button" disabled={downloadLoadingId === anexo.id} onClick={() => handleDownload(anexo)}>
                    <Download size={16} />
                  </button>
                </>
              ) : (
                <span className="attachment-unavailable"><X size={14} />Não enviado</span>
              )}
            </div>
          </article>
        ))}
      </div>
    );
  }

  function renderFlowStep(step, children = null) {
    const isCurrent = step.state === "current";
    const isDone = step.state === "done";
    const isBlocked = step.state === "blocked";
    return (
      <section className={`process-flow-step ${step.state}`} key={step.id}>
        <div className="process-flow-marker">
          <span />
        </div>
        <div className="process-flow-card">
          <div className="process-flow-head">
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
              {step.detail && <small>{step.detail}</small>}
            </div>
            <span className={`process-flow-status ${step.state}`}>
              {isDone ? "Concluída" : isCurrent ? "Etapa atual" : isBlocked ? "Bloqueada" : "Travada"}
            </span>
          </div>
          {isCurrent && children}
        </div>
      </section>
    );
  }

  function renderDocumentDecision() {
    return (
      <form className="process-step-action" onSubmit={confirmRejectInline}>
        <div className="process-document-score">
          <span>{approvedDocuments}/{anexos.length}</span>
          <small>anexos prontos</small>
        </div>
        {renderAttachments()}
        <label className="field">
          <span>Observação interna</span>
          <textarea value={rejectData.note} onChange={(event) => setRejectData((current) => ({ ...current, note: event.target.value }))} />
        </label>
        <div className="analysis-actions process-action-buttons">
          {canApprove && <button className="primary-action" type="button" onClick={() => onApprove?.(request)}>Aprovar e avançar</button>}
          <button className="secondary-action danger-action" type="submit">Indeferir e encerrar</button>
        </div>
      </form>
    );
  }

  function renderProcedureDecision() {
    return (
      <form className="process-step-action" onSubmit={confirmAttendanceInline}>
        <label className="field">
          <span>Código do microchip</span>
          <input
            value={attendanceData.microchip}
            onChange={(event) => setAttendanceData((current) => ({ ...current, microchip: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
            placeholder="Informe o código aplicado ou lido"
          />
        </label>
        <label className="field">
          <span>Observação interna</span>
          <textarea value={attendanceData.note} onChange={(event) => setAttendanceData((current) => ({ ...current, note: event.target.value }))} />
        </label>
        <div className="analysis-actions process-action-buttons">
          {canReschedule && <button className="ghost-button" type="button" onClick={() => onReschedule?.(request)}>Reagendar</button>}
          <button className="secondary-action danger-action" type="button" onClick={() => onArchive?.(request, "CANCELADA", "Cirurgia cancelada")}>Cancelar</button>
          <button className="primary-action" type="submit">Confirmar comparecimento</button>
        </div>
      </form>
    );
  }

  function renderStepAction(step) {
    if (step.id === "documents" && canAnalyze) return renderDocumentDecision();
    if (step.id === "scheduled" && canRecordAttendance) return renderProcedureDecision();
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="config-modal request-preview-modal process-modal chronological-process-modal" role="dialog" aria-modal="true">
        <ModalHeader
          title={`Processo #${request.protocol}`}
          eyebrow={`Processo #${request.protocol}`}
          onClose={onClose}
          actions={<button className="secondary-action" type="button" disabled={bundleLoading} onClick={handleBundlePreview}>{bundleLoading ? "Preparando..." : "Baixar juntada"}</button>}
        />

        <div className="process-compact-summary">
          <p><span>Tutor</span>{normalizedRequest.tutor}</p>
          <p><span>Tipo</span>{getRequestTypeName(normalizedRequest, requestTypes)}</p>
          <p><span>Animais</span>{normalizedRequest.animals.length}</p>
          <p><span>Data</span>{normalizedRequest.preferredSchedule || "Aguardando"}</p>
          <StatusBadge status={normalizedRequest.status} />
        </div>

        <div className="process-flow">
          {timeline.map((step) => renderFlowStep(step, renderStepAction(step)))}
        </div>

        {previewAttachment && (
          <DocumentPreviewModal
            document={previewAttachment}
            onClose={() => setPreviewAttachment(null)}
          />
        )}
      </div>
    </div>
  );
}

function getCurrentProcessStage(request = {}) {
  if (request.status === "ARQUIVADA") {
    if (requestHasTag(request, "INDEFERIDA")) return { label: "Indeferido", description: request.rejectionReason || "Processo encerrado por indeferimento." };
    if (requestHasTag(request, "CANCELADA")) return { label: "Cancelado", description: "Processo encerrado por cancelamento." };
    if (requestHasTag(request, "COMPARECEU")) return { label: "Encerrado", description: "Procedimento confirmado e processo encerrado." };
    return { label: "Arquivado", description: "Processo encerrado." };
  }
  if (request.status === "AGUARDANDO_CIRURGIA") return { label: "Aguardando procedimento", description: "Solicitação deferida e aguardando atendimento." };
  return { label: "Análise documental", description: "Solicitação recebida e aguardando conferência." };
}

function buildRequestTimeline(request = {}) {
  const created = request.createdAt ? formatDateTime(request.createdAt) : "Data não informada";
  const hasDeferred = request.status === "AGUARDANDO_CIRURGIA" || requestHasTag(request, "DEFERIDA") || requestHasTag(request, "COMPARECEU");
  const isRejected = requestHasTag(request, "INDEFERIDA");
  const isCanceled = requestHasTag(request, "CANCELADA");
  const attended = requestHasTag(request, "COMPARECEU");
  const archived = request.status === "ARQUIVADA";

  return [
    {
      id: "received",
      label: "Solicitação recebida",
      description: `Protocolo ${request.protocol || "sem protocolo"}`,
      detail: created,
      state: "done",
    },
    {
      id: "documents",
      label: "Análise documental",
      description: isRejected ? "Indeferida na análise." : hasDeferred || archived ? "Análise concluída." : "Aguardando conferência.",
      detail: request.rejectionReason || "",
      state: isRejected || hasDeferred || archived ? "done" : "current",
    },
    {
      id: "approved",
      label: "Deferimento",
      description: isRejected ? "Não avançou para deferimento." : hasDeferred ? "Solicitação deferida." : "Aguardando decisão.",
      detail: request.responsible ? `Responsável: ${request.responsible}` : "",
      state: isRejected ? "blocked" : hasDeferred ? "done" : "pending",
    },
    {
      id: "scheduled",
      label: "Aguardando procedimento",
      description: request.preferredSchedule ? `Agendado para ${request.preferredSchedule}` : "Aguardando data.",
      detail: request.scheduleLocationName || "",
      state: attended || isCanceled ? "done" : hasDeferred ? "current" : "pending",
    },
    {
      id: "finished",
      label: "Encerramento",
      description: attended ? "Comparecimento confirmado." : isCanceled ? "Procedimento cancelado." : archived ? "Processo arquivado." : "Aguardando conclusão.",
      detail: request.animalMicrochip ? `Microchip: ${request.animalMicrochip}` : request.attendanceNote || "",
      state: archived ? "done" : "pending",
    },
  ];
}

function getPerformedProceduresLabel(request = {}) {
  const animals = Array.isArray(request.animals) ? request.animals : [];
  const procedures = animals.map((animal) => animal.procedure).filter(Boolean);
  const uniqueProcedures = [...new Set(procedures)];
  return uniqueProcedures.length ? uniqueProcedures.join(", ") : request.type || request.request_type || "Procedimento realizado";
}

function ScheduleView({
  requests,
  createRequest,
  currentUser,
  scheduleDays = [],
  requestTypes = initialRequestTypes,
  aiSettings = initialAiSettings,
  speciesOptions = initialSpecies,
  sizeOptions = initialSizes,
  municipalities = initialMunicipalities,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const scheduled = requests.map(normalizeRequest).filter((request) => request.status !== "ARQUIVADA" && (request.appointment || request.preferredSchedule));
  const scheduleWithUsage = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const used = countUsedVacancies(requests, day.date);
    return { ...day, used, remaining: Math.max(day.vacancies - used, 0), isPast: isPastScheduleDay(day.date) };
  });
  const scheduleMonths = buildScheduleMonths(scheduleWithUsage);
  const activeScheduleMonth = scheduleMonths[scheduleMonthIndex] || "";
  const visibleScheduleDays = scheduleWithUsage.filter((day) => {
    const [, month, year] = day.date.split("/");
    return `${month}/${year}` === activeScheduleMonth;
  });

  useEffect(() => {
    const currentMonthIndex = Math.max(scheduleMonths.indexOf(getCurrentScheduleMonthKey()), 0);
    setScheduleMonthIndex(currentMonthIndex);
  }, [scheduleMonths.join("|")]);

  return (
    <section className="content-grid">
      <div className="panel wide">
        <PanelHeader title="Agenda disponível" />
        <div className="agenda-main-layout">
          <div>
        <div className="calendar-month-header admin-month-filter">
          <button
            type="button"
            onClick={() => setScheduleMonthIndex((current) => Math.max(current - 1, 0))}
            disabled={scheduleMonthIndex === 0}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <label>
            <span>Mes</span>
            <select
              value={activeScheduleMonth}
              onChange={(event) => setScheduleMonthIndex(Math.max(scheduleMonths.indexOf(event.target.value), 0))}
            >
              {scheduleMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthYear(month)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setScheduleMonthIndex((current) => Math.min(current + 1, scheduleMonths.length - 1))}
            disabled={scheduleMonthIndex >= scheduleMonths.length - 1}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
        <div className="admin-calendar-grid">
          {visibleScheduleDays.length === 0 && (
            <div className="calendar-empty-month">Nenhuma data configurada para {formatMonthYear(activeScheduleMonth)}.</div>
          )}
          {visibleScheduleDays.map((day) => (
            <button
              className={[
                "admin-calendar-day",
                day.remaining === 0 || day.isPast ? "full" : "",
                day.kind === "Mutirao" ? "mutirao-day" : "",
                !day.isPast && day.remaining > 0 ? "has-vacancy" : "",
              ].filter(Boolean).join(" ")}
              key={day.date}
              type="button"
              disabled={day.remaining === 0 || day.isPast}
              onClick={() => setSelectedDay(day)}
            >
              <span>{day.weekday}</span>
              <strong>{day.date}</strong>
              <small>
                {day.isPast ? "Data passada" : `${day.remaining} livres de ${day.vacancies}`}
              </small>
              {day.kind === "Mutirao" && <em>Mutirão</em>}
              {day.locationName && <small>{day.locationName}</small>}
            </button>
          ))}
        </div>
          </div>
        </div>
      </div>

      <div className="panel wide">
        <PanelHeader title="Solicitacoes com data escolhida" action="Exportar PDF" />
        <div className="request-list">
          {scheduled.length === 0 && (
            <EmptyState
              title="Nenhum horario escolhido"
              text="Ao criar uma solicitação pela agenda, a data selecionada aparecerá vinculada ao cadastro."
            />
          )}
          {scheduled.map((request) => (
            <article className="request-card" key={request.id}>
              <span>{request.appointment || request.preferredSchedule}</span>
              <strong>{request.tutor}</strong>
              <span className="request-card-meta">
                {request.animals[0].name} - {request.animals[0].procedure}
                <MicrochipLine request={request} />
              </span>
              <StatusBadge status={request.status} />
            </article>
          ))}
        </div>
      </div>

      {selectedDay && (
        <div className="modal-backdrop">
          <div className="request-modal">
            <ModalHeader title="Criar solicitação presencial" eyebrow={`Agenda ${selectedDay.date}`} onClose={() => setSelectedDay(null)} />
            <NewRequest
              createRequest={createRequest}
              currentUser={currentUser}
              compact
              onDone={() => setSelectedDay(null)}
              requests={requests}
              scheduleDays={scheduleDays}
              requestTypes={requestTypes}
              aiSettings={aiSettings}
              speciesOptions={speciesOptions}
              sizeOptions={sizeOptions}
              initialSchedule={selectedDay.date}
            />
          </div>
        </div>
      )}
    </section>
  );

}

function AdoptionView({
  adoptionAnimals,
  setAdoptionAnimals,
  currentUser,
  speciesOptions = initialSpecies,
}) {
  const MAX_ADOPTION_PHOTOS = 5;
  const MAX_ADOPTION_PHOTO_BYTES = 2 * 1024 * 1024;
  const MAX_ADOPTION_TOTAL_BYTES = 8 * 1024 * 1024;
  const activeSpecies = speciesOptions.filter((item) => item.active !== false).map((item) => item.name);
  const emptyAnimalForm = {
    name: "",
    species: "",
    sex: "",
    age: "",
    tone: "",
    photos: [],
    mainPhotoIndex: 0,
  };
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [animalForm, setAnimalForm] = useState(emptyAnimalForm);
  const [formError, setFormError] = useState("");
  const [isSavingAnimal, setIsSavingAnimal] = useState(false);
  const [adoptionTab, setAdoptionTab] = useState("available");
  const [adoptionFilters, setAdoptionFilters] = useState({ species: "", sex: "" });
  const [editingAnimalId, setEditingAnimalId] = useState(null);
  const [interestsModal, setInterestsModal] = useState(null); // { animal, list }
  const canManageAdoptions = canManagePublicAnimalFlows(currentUser.role);
  const availableAnimals = adoptionAnimals.filter((animal) => animal.status !== "adotado");
  const adoptedAnimals = adoptionAnimals.filter((animal) => animal.status === "adotado");
  const baseDisplayedAnimals = canManageAdoptions && adoptionTab === "adopted" ? adoptedAnimals : availableAnimals;
  const displayedAnimals = baseDisplayedAnimals
    .filter((animal) => !adoptionFilters.species || animal.species === adoptionFilters.species)
    .filter((animal) => !adoptionFilters.sex || animal.sex === adoptionFilters.sex);
  const speciesFilterOptions = [...new Set(["Felino", "Canino", ...adoptionAnimals.map((animal) => animal.species).filter(Boolean)])];
  const sexFilterOptions = [...new Set(["Femea", "Macho", ...adoptionAnimals.map((animal) => animal.sex).filter(Boolean)])];
  const activeFilterCount = Number(Boolean(adoptionFilters.species)) + Number(Boolean(adoptionFilters.sex));
  const statusQuickFilters = [
    { value: "available", label: `Disponíveis (${availableAnimals.length})`, icon: HeartHandshake },
    { value: "adopted", label: `Adotados (${adoptedAnimals.length})`, icon: CheckCircle2 },
  ];
  const speciesQuickFilters = [
    { value: "", label: "Todos os pets", icon: PawPrint },
    ...speciesFilterOptions.map((species) => ({
      value: species,
      label: species,
      icon: normalizeText(species).includes("fel") ? Cat : normalizeText(species).includes("can") ? Dog : PawPrint,
    })),
  ];
  const sexQuickFilters = [
    { value: "", label: "Todos os sexos", icon: HeartHandshake },
    ...sexFilterOptions.map((sex) => ({ value: sex, label: sex, icon: Users })),
  ];

  function getAnimalKey(animal) {
    return animal.id || animal.name;
  }

  function updateAnimalForm(field, value) {
    setAnimalForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  }

  function estimatePhotoBytes(photo = "") {
    if (typeof photo !== "string" || !photo) return 0;
    const commaIndex = photo.indexOf(",");
    if (photo.startsWith("data:") && commaIndex !== -1) {
      const base64 = photo.slice(commaIndex + 1);
      return Math.floor((base64.length * 3) / 4);
    }
    return photo.length;
  }

  function openAnimalForm() {
    setEditingAnimalId(null);
    setAnimalForm(emptyAnimalForm);
    setFormError("");
    setIsFormOpen(true);
  }

  function closeAnimalForm(force = false) {
    if (isSavingAnimal && !force) return;
    setEditingAnimalId(null);
    setAnimalForm(emptyAnimalForm);
    setFormError("");
    setIsFormOpen(false);
  }

  function editAnimal(animal) {
    setEditingAnimalId(getAnimalKey(animal));
    setAnimalForm({
      name: animal.name || animal.animal_name || "",
      species: animal.species || "",
      sex: animal.sex || "",
      age: animal.age || "",
      tone: animal.tone || animal.description || "",
      photos: getAnimalPhotos(animal),
      mainPhotoIndex: animal.mainPhotoIndex || 0,
    });
    setFormError("");
    setIsFormOpen(true);
  }

  function handlePhotoChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const selectedInput = event.target;

    if (animalForm.photos.length >= MAX_ADOPTION_PHOTOS) {
      setFormError(`Limite de ${MAX_ADOPTION_PHOTOS} imagens por animal.`);
      selectedInput.value = "";
      return;
    }

    if (animalForm.photos.length + files.length > MAX_ADOPTION_PHOTOS) {
      setFormError(`Você pode enviar no máximo ${MAX_ADOPTION_PHOTOS} imagens.`);
      selectedInput.value = "";
      return;
    }

    if (files.some((file) => !file.type.startsWith("image/"))) {
      setFormError("Envie uma foto em formato de imagem.");
      selectedInput.value = "";
      return;
    }

    const oversized = files.find((file) => file.size > MAX_ADOPTION_PHOTO_BYTES);
    if (oversized) {
      setFormError(`Cada imagem pode ter no máximo ${Math.floor(MAX_ADOPTION_PHOTO_BYTES / (1024 * 1024))}MB.`);
      selectedInput.value = "";
      return;
    }

    const currentTotalBytes = animalForm.photos.reduce((total, photo) => total + estimatePhotoBytes(photo), 0);
    const incomingBytes = files.reduce((total, file) => total + file.size, 0);
    if (currentTotalBytes + incomingBytes > MAX_ADOPTION_TOTAL_BYTES) {
      setFormError(`Total de imagens excedido. Limite: ${Math.floor(MAX_ADOPTION_TOTAL_BYTES / (1024 * 1024))}MB.`);
      selectedInput.value = "";
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((photos) => {
      setAnimalForm((current) => ({
        ...current,
        photos: [...current.photos, ...photos],
        mainPhotoIndex: current.photos.length === 0 ? 0 : current.mainPhotoIndex,
      }));
      setFormError("");
      selectedInput.value = "";
    });
  }

  function removeAnimalPhoto(indexToRemove) {
    setAnimalForm((current) => {
      const photos = current.photos.filter((photo, index) => index !== indexToRemove);
      let mainPhotoIndex = current.mainPhotoIndex;

      if (indexToRemove === current.mainPhotoIndex) {
        mainPhotoIndex = 0;
      } else if (indexToRemove < current.mainPhotoIndex) {
        mainPhotoIndex = current.mainPhotoIndex - 1;
      }

      return { ...current, photos, mainPhotoIndex: photos.length === 0 ? 0 : Math.min(mainPhotoIndex, photos.length - 1) };
    });
  }

  async function publishAnimal(event) {
    event.preventDefault();
    if (isSavingAnimal) return;

    if (!animalForm.name.trim() || !animalForm.age.trim() || !animalForm.species || !animalForm.sex || !animalForm.tone.trim()) {
      setFormError("Preencha nome, idade, especie, sexo e descricao antes de publicar.");
      return;
    }

    const payload = {
      animal_name: animalForm.name.trim(),
      species: animalForm.species,
      sex: animalForm.sex,
      age: animalForm.age.trim(),
      description: animalForm.tone.trim(),
      photos: animalForm.photos,
      main_photo_index: animalForm.mainPhotoIndex || 0,
      photo_url: animalForm.photos[animalForm.mainPhotoIndex || 0] || animalForm.photos[0] || "",
    };

    try {
      setIsSavingAnimal(true);
      if (editingAnimalId) {
        const updated = await api.updateAdoption(editingAnimalId, payload);
        setAdoptionAnimals((current) => current.map((item) => getAnimalKey(item) === editingAnimalId ? normalizeAdoptionAnimal(updated) : item));
      } else {
        const created = await api.createAdoption(payload);
        setAdoptionAnimals((current) => [normalizeAdoptionAnimal(created), ...current]);
      }
      closeAnimalForm(true);
    } catch (err) {
      setFormError("Erro ao salvar animal. Tente novamente.");
      console.error(err);
    } finally {
      setIsSavingAnimal(false);
    }
  }

  async function updateAnimalStatus(animal, status) {
    try {
      const patch = status === "adotado" ? { status, adopted_at: new Date().toISOString() } : { status };
      const updated = await api.updateAdoption(animal.id, patch);
      setAdoptionAnimals((current) => current.map((item) => item.id === animal.id ? { ...item, ...updated } : item));
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  }

  async function deleteAnimal(animal) {
    try {
      await api.deleteAdoption(animal.id);
      setAdoptionAnimals((current) => current.filter((item) => item.id !== animal.id));
    } catch (err) {
      console.error("Erro ao excluir animal:", err);
    }
  }

  async function openInterestsModal(animal) {
    try {
      const list = await api.getInterests(animal.id);
      setInterestsModal({ animal, list });
    } catch (err) {
      console.error("Erro ao carregar interessados:", err);
    }
  }

  async function removeInterest(animalId, index) {
    try {
      const updated = await api.removeInterest(animalId, index);
      const normalized = normalizeAdoptionAnimal(updated);
      setAdoptionAnimals((current) => current.map((a) => a.id === animalId ? normalized : a));
      setInterestsModal((current) => current ? { ...current, animal: normalized, list: normalized.interests } : null);
    } catch (err) {
      console.error("Erro ao remover interesse:", err);
    }
  }

  return (
    <section className="content-grid">
      <div className="hero-panel adoption-hero">
        <video className="pet-welcome-video" autoPlay muted loop playsInline preload="metadata" poster="https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1400&q=80">
          <source src="https://assets.mixkit.co/videos/preview/mixkit-dog-catches-a-ball-in-a-river-1494-large.mp4" type="video/mp4" />
        </video>
        <div className="pet-video-shade" />
        <div>
          <h2>Adicione pets para adoção</h2>
        </div>
        {canManageAdoptions && (
          <button className="primary-action" onClick={openAnimalForm}>
            <Plus size={18} />
            Cadastrar animal
          </button>
        )}
      </div>

      {canManageAdoptions && isFormOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAnimalForm();
          }}
        >
          <form className="adoption-form-modal" onSubmit={publishAnimal} role="dialog" aria-modal="true">
            <ModalHeader title={editingAnimalId ? "Editar animal para adoção" : "Cadastrar animal para adoção"} onClose={closeAnimalForm} />
            <div className="adoption-editor-grid">
              <div className="adoption-photo-column">
                <label className="animal-photo-uploader">
                  {animalForm.photos.length > 0 ? (
                    <img src={animalForm.photos[animalForm.mainPhotoIndex]} alt="Previa principal do animal" />
                  ) : (
                    <span>
                      <UploadCloud size={28} />
                      Fotos do animal
                    </span>
                  )}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoChange} />
                </label>
                <small>Maximo: 5 imagens, 2MB por imagem, 8MB no total.</small>
                {animalForm.photos.length > 0 && (
                  <div className="animal-photo-picker">
                    {animalForm.photos.map((photo, index) => (
                      <div className="animal-photo-option" key={`${photo}-${index}`}>
                        <button
                          className={animalForm.mainPhotoIndex === index ? "selected" : ""}
                          type="button"
                          onClick={() => updateAnimalForm("mainPhotoIndex", index)}
                        >
                          <img src={photo} alt={`Foto ${index + 1}`} />
                          <span>{animalForm.mainPhotoIndex === index ? "Principal" : "Usar principal"}</span>
                        </button>
                        <button className="ghost-button danger-action" type="button" onClick={() => removeAnimalPhoto(index)}>
                          Excluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="adoption-editor-fields">
                <div className="animal-main-grid">
                  <Field label="Nome" value={animalForm.name} onChange={(value) => updateAnimalForm("name", value)} />
                  <Field label="Idade aproximada" value={animalForm.age} onChange={(value) => updateAnimalForm("age", value)} />
                </div>
                <div className="animal-choice-grid">
                  <CompactChoiceField
                    label="Especie"
                    value={animalForm.species}
                    options={activeSpecies}
                    onChange={(value) => updateAnimalForm("species", value)}
                  />
                  <CompactChoiceField
                    label="Sexo"
                    value={animalForm.sex}
                    options={["Femea", "Macho"]}
                    onChange={(value) => updateAnimalForm("sex", value)}
                  />
                </div>
                <label className="field">
                  <span>Descricao para a pagina publica</span>
                  <textarea
                    value={animalForm.tone}
                    placeholder="Temperamento, historia, cuidados e perfil de adotante indicado"
                    onChange={(event) => updateAnimalForm("tone", event.target.value)}
                  />
                </label>
              </div>
            </div>
            {formError && <p className="form-error">{formError}</p>}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={closeAnimalForm}>
                Cancelar
              </button>
              <button className="primary-action" type="submit" disabled={isSavingAnimal}>
                {isSavingAnimal ? "Salvando..." : editingAnimalId ? "Salvar alteracoes" : "Publicar na galeria"}
              </button>
            </div>
          </form>
        </div>
      )}

      {canManageAdoptions && (
        <div className="adoption-filter-rail internal-adoption-filters" aria-label="Filtros internos de adoção">
          <div className="adoption-filter-group" aria-label="Filtrar por status">
            {statusQuickFilters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.value}
                  className={adoptionTab === filter.value ? "selected" : ""}
                  type="button"
                  onClick={() => setAdoptionTab(filter.value)}
                >
                  <Icon size={18} />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>
          <div className="adoption-filter-group" aria-label="Filtrar por espécie">
            {speciesQuickFilters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={`internal-species-${filter.value || "all"}`}
                  className={adoptionFilters.species === filter.value ? "selected" : ""}
                  type="button"
                  onClick={() => setAdoptionFilters((current) => ({ ...current, species: filter.value }))}
                >
                  <Icon size={18} />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>
          <div className="adoption-filter-group" aria-label="Filtrar por sexo">
            {sexQuickFilters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={`internal-sex-${filter.value || "all"}`}
                  className={adoptionFilters.sex === filter.value ? "selected" : ""}
                  type="button"
                  onClick={() => setAdoptionFilters((current) => ({ ...current, sex: filter.value }))}
                >
                  <Icon size={18} />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>
          {activeFilterCount > 0 && (
            <button className="ghost-button adoption-clear-filters" type="button" onClick={() => setAdoptionFilters({ species: "", sex: "" })}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      <div className="adoption-grid">
        {displayedAnimals.length === 0 && (
          <EmptyState
            title={adoptionTab === "adopted" ? "Nenhum animal adotado" : "Nenhum animal para adocao"}
            text={
              currentUser.role === "admin"
                ? activeFilterCount > 0
                  ? "Nenhum animal encontrado com estes filtros."
                  : adoptionTab === "adopted"
                  ? "Animais marcados como adotados ficarao aqui como historico interno."
                  : "Cadastre o primeiro animal para testar a galeria pública."
                : "A galeria pública ainda nao possui animais cadastrados."
            }
          />
        )}
        {displayedAnimals.map((animal) => {
          const interestCount = Array.isArray(animal.interests) ? animal.interests.length : 0;
          return (
          <article className="adoption-card" key={animal.id || animal.name}>
            <div className="adoption-card-header strong">
              <h3>{animal.name || animal.animal_name}</h3>
              {canManageAdoptions && (
                <button
                  className="adoption-card-delete-top"
                  type="button"
                  aria-label="Excluir"
                  onClick={() => deleteAnimal(animal)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className={`animal-photo ${getAnimalGradient(animal)}`}>
              {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={animal.name} /> : <PawPrint size={44} />}
            </div>
            <button
              className={interestCount > 0 ? "adoption-interest-indicator has-interest interest-button" : "adoption-interest-indicator interest-button"}
              type="button"
              onClick={() => openInterestsModal(animal)}
            >
              <Users size={13} />
              <span>{interestCount > 0 ? `${interestCount} interessado(s)` : "Sem interessados"}</span>
            </button>
            {canManageAdoptions && (
              <div className="adoption-card-actions">
                <button className="ghost-button" type="button" onClick={() => editAnimal(animal)}>
                  Editar
                </button>
                {animal.status === "adotado" ? (
                  <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(animal, "disponivel")}>
                    Reativar
                  </button>
                ) : (
                  <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(animal, "adotado")}>
                    Marcar adotado
                  </button>
                )}
              </div>
            )}
          </article>
        );})}
      </div>

      {interestsModal && (
        <div className="modal-backdrop">
          <div className="auth-modal" style={{ maxWidth: 520 }}>
            <ModalHeader title={`Interessados em ${interestsModal.animal.name || interestsModal.animal.animal_name}`} eyebrow="Adoção" onClose={() => setInterestsModal(null)} />
            {interestsModal.list.length === 0 ? (
              <EmptyState title="Nenhum interesse ainda" text="Quando alguém manifestar interesse, aparecerá aqui." />
            ) : (
              <div className="interests-list">
                {interestsModal.list.map((item, i) => (
                  <div className="interest-item" key={i}>
                    <div className="interest-item-header">
                      <strong>{item.name}</strong>
                      <span>{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <p><span>Telefone:</span> {item.phone}</p>
                    {item.visit_date && <p><span>Data para visita:</span> {new Date(item.visit_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
                    <button className="ghost-button danger-action" type="button" onClick={() => removeInterest(interestsModal.animal.id, i)}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function sumValues(items = []) {
  return items.reduce((total, item) => total + Number(item.value || 0), 0);
}

function countBy(items = [], getKey) {
  const totals = new Map();
  items.forEach((item) => {
    const key = getKey(item) || "Não informado";
    totals.set(key, (totals.get(key) || 0) + 1);
  });
  return Array.from(totals, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function getRequestTypeName(request = {}, requestTypes = []) {
  const byId = requestTypes.find((type) => type.id && type.id === request.requestTypeId);
  return request.type || request.request_type || byId?.name || "Não informado";
}

function getRequestUserName(request = {}) {
  return request.responsible || request.assignedUserName || request.assignedSectorName || "Sem responsável";
}

function getTeamUserName(userId = "", teams = initialTeams, currentUser = null) {
  const id = String(userId || "").trim();
  if (!id) return "";
  const teamUser = (teams.users || []).find((user) => String(user.id) === id || String(user.email) === id);
  if (teamUser?.name) return teamUser.name;
  if (currentUser && (String(currentUser.id) === id || String(currentUser.email) === id)) return currentUser.name || currentUser.email;
  return id;
}

function getRequestClosedByName(request = {}, teams = initialTeams, currentUser = null) {
  const rawHistory = Array.isArray(request.rawHistory) ? request.rawHistory : [];
  const closingEntry = [...rawHistory].reverse().find((item) => {
    if (!item || typeof item === "string") return false;
    const status = String(item.status || "");
    const notes = String(item.notes || "");
    return status === "ARQUIVADA" || /comparec|cancel|indefer/i.test(notes);
  });
  const byFromEntry = getTeamUserName(closingEntry?.by, teams, currentUser);
  if (byFromEntry) return byFromEntry;

  const historyText = Array.isArray(request.history) ? [...request.history].reverse().join(" | ") : "";
  const byMatch = historyText.match(/\bpor\s+([^-|]+)/i);
  const byFromText = getTeamUserName(byMatch?.[1], teams, currentUser);
  return byFromText || getRequestUserName(request);
}

function AccessRequestsView({ accessRequests = [], reviewAccessRequest, teams = initialTeams }) {
  const [filter, setFilter] = useState("PENDENTE");
  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [status, setStatus] = useState("");
  const filtered = accessRequests.filter((item) => filter === "TODOS" || item.status === filter);
  const pendingCount = accessRequests.filter((item) => item.status === "PENDENTE").length;
  const approvedCount = accessRequests.filter((item) => item.status === "APROVADO").length;
  const rejectedCount = accessRequests.filter((item) => item.status === "RECUSADO").length;

  async function decide(decision) {
    if (!reviewing) return;
    setStatus("Registrando decisão...");
    try {
      const updated = await reviewAccessRequest?.(reviewing.id, { status: decision, review_note: reviewNote });
      setStatus(decision === "APROVADO" && updated?.temporaryPassword
        ? `Acesso aprovado. Senha inicial: ${updated.temporaryPassword}`
        : "Decisão registrada.");
      setReviewing(null);
      setReviewNote("");
    } catch (err) {
      setStatus(err.message || "Não foi possível revisar o credenciamento.");
    }
  }

  return (
    <section className="workspace">
      <div className="metrics-grid access-metrics-grid">
        <Metric title="Pendentes" value={pendingCount} icon={ClipboardList} />
        <Metric title="Aprovadas" value={approvedCount} icon={CheckCircle2} />
        <Metric title="Recusadas" value={rejectedCount} icon={X} />
      </div>

      <div className="panel wide">
        <PanelHeader
          title="Solicitações de credenciamento"
          aside={(
            <div className="config-status-filter">
              {["PENDENTE", "APROVADO", "RECUSADO", "TODOS"].map((item) => (
                <button key={item} className={filter === item ? "selected" : ""} type="button" onClick={() => setFilter(item)}>
                  {item === "TODOS" ? "Todos" : accessStatusLabel(item)}
                </button>
              ))}
            </div>
          )}
        />
        {status && <p className="access-review-status">{status}</p>}
        <div className="config-editor-grid access-request-grid">
          {filtered.length === 0 && (
            <EmptyState title="Nenhum credenciamento encontrado" text="As solicitações enviadas pela home aparecerão aqui para análise." />
          )}
          {filtered.map((item) => {
            const sector = (teams.sectors || []).find((candidate) => normalizeText(candidate.name) === normalizeText(item.assignedSector));
            return (
              <article className="request-type-card config-summary-card access-request-card" key={item.id}>
                <div className="config-card-title">
                  <strong>{item.organizationName || item.responsibleName}</strong>
                  <small className={`schedule-status ${item.status === "PENDENTE" ? "pending" : item.status === "APROVADO" ? "active" : "inactive"}`}>
                    {accessStatusLabel(item.status)}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{item.requesterLabel}</span>
                  <span>Responsável: {item.responsibleName}</span>
                  <span>{item.email}</span>
                  {item.phone && <span>{item.phone}</span>}
                  {(item.city || item.state) && <span>{[item.city, item.state].filter(Boolean).join("/")}</span>}
                  <span>Setor: {sector?.name || item.assignedSector || "Sem setor"}</span>
                  {item.intendedUse && <span>{item.intendedUse}</span>}
                  {item.temporaryPassword && <span>Senha inicial: {item.temporaryPassword}</span>}
                </div>
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => { setReviewing(item); setReviewNote(item.reviewNote || ""); }}>
                    Analisar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {reviewing && (
        <div className="modal-backdrop">
          <div className="workflow-modal" role="dialog" aria-modal="true">
            <ModalHeader title="Analisar credenciamento" eyebrow={reviewing.requesterLabel} onClose={() => setReviewing(null)} />
            <div className="detail-grid compact-detail-grid">
              <p><span>Solicitante</span>{reviewing.organizationName || reviewing.responsibleName}</p>
              <p><span>Responsável</span>{reviewing.responsibleName}</p>
              <p><span>Email</span>{reviewing.email}</p>
              <p><span>Setor</span>{reviewing.assignedSector}</p>
            </div>
            <label className="field">
              <span>Observação da análise</span>
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Motivo da aprovação, pendência ou recusa" />
            </label>
            <div className="form-actions">
              <button className="danger-action" type="button" onClick={() => decide("RECUSADO")}>Recusar</button>
              <button className="primary-action" type="button" onClick={() => decide("APROVADO")}>Aprovar e criar usuário</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function accessStatusLabel(status = "") {
  return {
    PENDENTE: "Pendente",
    APROVADO: "Aprovado",
    RECUSADO: "Recusado",
  }[status] || status || "Pendente";
}

function parseAnyDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRequestDate(request = {}) {
  return parseAnyDate(request.createdAt || request.created_at || request.preferredSchedule || request.appointment);
}

function isInPeriod(date, start, end) {
  if (!date) return true;
  if (start && date < new Date(`${start}T00:00:00`)) return false;
  if (end && date > new Date(`${end}T23:59:59`)) return false;
  return true;
}

function topItems(items = [], limit = 6) {
  return items.slice(0, limit);
}

function DashboardView({ requests, adoptionAnimals = [], scheduleDays = [], municipalities = initialMunicipalities, requestTypes = initialRequestTypes, teams = initialTeams, currentUser = null }) {
  const [dashboardTab, setDashboardTab] = useState("geral");
  const activeSchedules = scheduleDays.filter((day) => day.active !== false);
  const normalizedRequests = requests.map(normalizeRequest);
  const completedRequests = normalizedRequests.filter((request) => requestHasTag(request, "COMPARECEU"));
  const mutiraoCount = activeSchedules.filter((day) => day.kind === "Mutirao").length;
  const activeAdoptions = adoptionAnimals.filter((animal) => animal.status !== "adotado");
  const adoptedAnimals = adoptionAnimals.filter((animal) => animal.status === "adotado");
  const approvedRequests = normalizedRequests.filter((request) => requestHasTag(request, "DEFERIDA"));
  const rejectedRequests = normalizedRequests.filter((request) => requestHasTag(request, "INDEFERIDA"));
  const adoptionInterestCount = adoptionAnimals.reduce((total, animal) => total + (animal.interests?.length || 0), 0);
  const adoptionSpecies = countBy(adoptionAnimals, (animal) => animal.species);
  const adoptionByStatus = countBy(adoptionAnimals, (animal) => animal.status === "adotado" ? "Adotados" : "Disponíveis");
  const adoptionInterestRanking = topItems(
    adoptionAnimals
      .map((animal) => ({ label: animal.name || animal.animal_name || "Animal sem nome", value: animal.interests?.length || 0 }))
      .sort((a, b) => b.value - a.value),
  );
  const adoptionProfile = countBy(adoptionAnimals, (animal) => animal.sex || "Sem perfil");
  const castrationByStatus = countBy(normalizedRequests, (request) => statusLabels[request.status] || request.status);
  const castrationByType = countBy(requests, (request) => getRequestTypeName(request, requestTypes));
  const castrationByNeighborhood = topItems(countBy(requests, (request) => request.neighborhood));
  const closedRequests = normalizedRequests.filter((request) => request.status === "ARQUIVADA");
  const closedByUser = topItems(countBy(closedRequests, (request) => getRequestClosedByName(request, teams, currentUser)));
  const scheduleUsage = topItems(activeSchedules.map((day) => {
    const used = requests.filter((request) => request.preferredSchedule === day.date || request.appointment === day.date).length;
    return { label: day.date, value: used, secondary: `${Math.max(Number(day.vacancies || 0) - used, 0)} vagas` };
  }), 6);
  const dashboardTabs = [
    { id: "geral", label: "Geral", helper: "Visão executiva", value: activeSchedules.length + normalizedRequests.length + adoptionAnimals.length, icon: Activity },
    { id: "adocao", label: "Adoção", helper: "Animais e interesse", value: activeAdoptions.length, icon: HeartHandshake },
    { id: "castracao", label: "Castração", helper: "Fila e procedimentos", value: normalizedRequests.length, icon: ClipboardList },
  ];

  return (
    <section className="map-dashboard">
      <div className="dashboard-tabs" aria-label="Visões do dashboard">
        {dashboardTabs.map((tab) => {
          const Icon = tab.icon;
          return (
          <button key={tab.id} className={dashboardTab === tab.id ? "selected" : ""} type="button" onClick={() => setDashboardTab(tab.id)}>
            <span className="dashboard-tab-icon"><Icon size={18} /></span>
            <span className="dashboard-tab-copy">
              <strong>{tab.label}</strong>
              <small>{tab.helper}</small>
            </span>
            <span className="dashboard-tab-count">{tab.value}</span>
          </button>
          );
        })}
      </div>

      {dashboardTab === "geral" && (
        <>
          <div className="map-kpi-grid">
            <Metric title="Agendas" value={activeSchedules.length} icon={CalendarDays} />
            <Metric title="Mutirões" value={mutiraoCount} icon={MapPin} />
            <Metric title="Realizadas" value={completedRequests.length} icon={CheckCircle2} />
            <Metric title="Municípios" value={municipalities.length} icon={MapPin} />
          </div>

          <div className="map-dashboard-grid">
            <div className="map-side-stack">
              <div className="panel">
                <PanelHeader title="Agenda" />
                <DonutChart
                  segments={[
                    { label: "Agenda", value: Math.max(activeSchedules.length - mutiraoCount, 0), color: "var(--teal)" },
                    { label: "Mutirão", value: mutiraoCount, color: "#f97316" },
                  ]}
                />
              </div>
              <div className="panel">
                <PanelHeader title="Execução" />
                <DonutChart
                  segments={[
                    { label: "Realizadas", value: completedRequests.length, color: "#16a34a" },
                    { label: "Pendentes", value: Math.max(requests.length - completedRequests.length, 0), color: "#94a3b8" },
                  ]}
                />
              </div>
            </div>

            <div className="panel map-panel">
              <PanelHeader title="Mapa de castrações e microchipados" />
              <GoogleDashboardMap
                completedRequests={completedRequests}
              />
            </div>
          </div>
        </>
      )}

      {dashboardTab === "adocao" && (
        <>
          <div className="map-kpi-grid">
            <Metric title="Disponíveis" value={activeAdoptions.length} icon={HeartHandshake} />
            <Metric title="Adotados" value={adoptedAnimals.length} icon={CheckCircle2} />
            <Metric title="Interessados" value={adoptionInterestCount} icon={Users} />
            <Metric title="Total" value={adoptionAnimals.length} icon={PawPrint} />
          </div>
          <div className="panel wide">
            <PanelHeader title="Painel de adoção" />
            <div className="charts-grid">
              <DataBarChart title="Ranking real de interesses" items={adoptionInterestRanking} />
              <DataBarChart title="Perfil dos animais" items={adoptionProfile} />
              <DataBarChart title="Espécies em adoção" items={adoptionSpecies} />
              <DataDonutChart title="Status dos animais" items={adoptionByStatus} />
            </div>
          </div>
        </>
      )}

      {dashboardTab === "castracao" && (
        <>
          <div className="map-kpi-grid">
            <Metric title="Solicitações" value={requests.length} icon={FileText} />
            <Metric title="Aprovadas" value={approvedRequests.length} icon={CheckCircle2} />
            <Metric title="Reprovadas" value={rejectedRequests.length} icon={X} />
            <Metric title="Realizadas" value={completedRequests.length} icon={ClipboardCheck} />
          </div>
          <div className="charts-grid">
            <DataDonutChart title="Distribuição por status" items={castrationByStatus} />
            <DataBarChart title="Tipos de solicitação" items={castrationByType} />
            <DataBarChart title="Processos encerrados por usuário" items={closedByUser} />
            <DataBarChart title="Solicitações por bairro" items={castrationByNeighborhood} />
            <DataBarChart title="Ocupação da agenda" items={scheduleUsage} />
          </div>
        </>
      )}
    </section>
  );
}

function GoogleDashboardMap({ completedRequests = [] }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState(apiKey ? "Carregando Google Maps..." : "Configure a chave do Google Maps para visualizar o dashboard.");

  const points = useMemo(() => {
    return completedRequests
      .filter((request) => {
        const lat = Number(request.latitude);
        const lng = Number(request.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) &&
          lat >= -33.75 && lat <= 5.27 &&
          lng >= -73.99 && lng <= -29.35;
      })
      .map((request) => {
        const hasMicrochip = request.animals?.some((a) => a.microchip);
        const castrated = true;
        const type = hasMicrochip ? "both" : "castrated";
        return {
          lat: Number(request.latitude),
          lng: Number(request.longitude),
          type,
          label: type === "both" ? "Castrado e microchipado" : "Castrado",
          title: request.tutor || "Castração realizada",
          detail: request.scheduleLocationName || request.neighborhood || request.address || "Local informado",
          color: type === "both" ? "#7c3aed" : "#16a34a",
        };
      });
  }, [completedRequests]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let active = true;
    window.gm_authFailure = () => {
      setStatus("Google Maps recusou a chave configurada. Verifique restrições, faturamento e Maps JavaScript API.");
    };

    loadGoogleMapsApi(apiKey)
      .then((google) => {
        if (!active) return;
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: -27.2423, lng: -50.2189 },
          zoom: 6,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        setStatus(points.length ? "" : "Nenhum ponto com coordenadas para exibir.");
      })
      .catch(() => setStatus("Não foi possível carregar o Google Maps."));

    return () => {
      active = false;
      if (window.gm_authFailure) window.gm_authFailure = undefined;
    };
  }, [apiKey]);

  useEffect(() => {
    const google = window.google;
    const map = mapInstanceRef.current;
    if (!google?.maps || !map) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!points.length) {
      setStatus("Nenhum ponto com coordenadas para exibir.");
      return;
    }

    const infoWindow = new google.maps.InfoWindow();

    points.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      const marker = new google.maps.Marker({
        map,
        position,
        title: point.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: point.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 9,
        },
      });
      marker.addListener("click", () => {
        infoWindow.setContent(`<strong>${escapeHtml(point.title)}</strong><br>${escapeHtml(point.detail)}`);
        infoWindow.open({ anchor: marker, map });
      });
      markersRef.current.push(marker);
    });

    setStatus("");
  }, [points]);

  if (!apiKey) {
    return (
      <div className="google-map-fallback">
        <p>{status}</p>
      </div>
    );
  }

  return (
    <div className="google-dashboard-map">
      <div className="google-map-canvas dashboard" ref={mapRef} />
      {status && <p className="helper-text">{status}</p>}
      <div className="map-legend">
        <span><i className="legend-dot completed" /> Castrado</span>
        <span><i className="legend-dot microchipped" /> Castrado e microchipado</span>
      </div>
    </div>
  );
}


async function geocodeAddress(addressString, apiKey) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const data = await res.json();
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { latitude: String(loc.lat), longitude: String(loc.lng) } : { latitude: "", longitude: "" };
  } catch {
    return { latitude: "", longitude: "" };
  }
}

function loadGoogleMapsApi(apiKey) {
  if (window.google?.maps?.Map) return Promise.resolve(window.google);

  const scriptId = "google-maps-js-api";
  const existing = document.getElementById(scriptId);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=console.debug&libraries=maps,marker&v=beta`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
function AgendaKindSelector({ value, onChange }) {
  return (
    <div className="agenda-kind-selector">
      {["Agenda", "Mutirao"].map((option) => (
        <button key={option} className={value === option ? "selected" : ""} type="button" onClick={() => onChange(option)}>
          {option === "Agenda" ? "Agenda normal" : "Mutirão"}
        </button>
      ))}
    </div>
  );
}

function DonutChart({ segments }) {
  const total = segments.reduce((sum, segment) => sum + Number(segment.value || 0), 0) || 1;
  let start = 0;
  const gradient = segments.map((segment) => {
    const size = (Number(segment.value || 0) / total) * 100;
    const part = `${segment.color} ${start}% ${start + size}%`;
    start += size;
    return part;
  }).join(", ");

  return (
    <div className="map-donut-wrap">
      <div className="map-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <strong>{total}</strong>
      </div>
      <div className="map-donut-legend">
        {segments.map((segment) => (
          <span key={segment.label}>
            <i style={{ background: segment.color }} />
            {segment.label}: {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <FileText size={24} />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action && (
        <button className="secondary-action" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function ReportsView({ requests = [], metrics, requestTypes = initialRequestTypes, teams = initialTeams }) {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    type: "",
    status: "",
    user: "",
    fee: "",
    search: "",
  });
  const activeUsers = teams.users?.filter((user) => user.active !== false) || [];
  const normalizedReportRequests = requests.map(normalizeRequest);
  const filteredRequests = normalizedReportRequests.filter((request) => {
    const date = getRequestDate(request);
    const typeName = getRequestTypeName(request, requestTypes);
    const feeValue = request.fee || request.billingAmount || "";
    const hasFee = feeValue && feeValue !== "Gratuito";
    if (!isInPeriod(date, filters.start, filters.end)) return false;
    if (filters.type && typeName !== filters.type) return false;
    if (filters.status && request.status !== filters.status) return false;
    if (filters.user && getRequestUserName(request) !== filters.user) return false;
    if (filters.fee === "charged" && !hasFee) return false;
    if (filters.fee === "free" && hasFee) return false;
    return matchesRequestSearch(request, filters.search);
  });
  const reportMetrics = buildMetrics(filteredRequests);
  const typeOptions = countBy(requests, (request) => getRequestTypeName(request, requestTypes)).map((item) => item.label);
  const userOptions = Array.from(new Set([...activeUsers.map((user) => user.name), ...requests.map(getRequestUserName)])).filter(Boolean);
  const statusSeries = countBy(filteredRequests, (request) => statusLabels[request.status] || request.status);
  const resultSeries = countBy(filteredRequests, requestResultLabel);
  const typeSeries = countBy(filteredRequests, (request) => getRequestTypeName(request, requestTypes));
  const userSeries = topItems(countBy(filteredRequests, getRequestUserName));
  const feeSeries = countBy(filteredRequests, (request) => {
    const feeValue = request.fee || request.billingAmount || "";
    return feeValue && feeValue !== "Gratuito" ? "Com taxa" : "Gratuito";
  });
  const reportBreakdowns = [
    { title: "Status", items: statusSeries },
    { title: "Resultado", items: resultSeries },
    { title: "Tipos de solicitacao", items: typeSeries },
    { title: "Responsaveis", items: userSeries },
    { title: "Taxas", items: feeSeries },
  ];

  function patchFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function exportPdf() {
    generateReportsPdf(filteredRequests, filters, { statusSeries, resultSeries, typeSeries, userSeries, feeSeries }, requestTypes);
  }

  return (
    <section className="content-grid">
      <div className="summary-row">
        <Metric title="Solicitacoes" value={reportMetrics.total} icon={FileText} />
        <Metric title="Fila ativa" value={reportMetrics.pending} icon={RefreshCw} />
        <Metric title="Realizadas" value={reportMetrics.done} icon={CheckCircle2} />
        <Metric title="Exportacao" value="PDF" icon={Download} />
      </div>

      <div className="panel wide">
        <PanelHeader title="Relatorios e exportacoes" action="Exportar PDF" onAction={exportPdf} />
        <div className="reports-filter-grid">
          <label className="field">
            <span>Inicio</span>
            <input type="date" value={filters.start} onChange={(event) => patchFilter("start", event.target.value)} />
          </label>
          <label className="field">
            <span>Fim</span>
            <input type="date" value={filters.end} onChange={(event) => patchFilter("end", event.target.value)} />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select value={filters.type} onChange={(event) => patchFilter("type", event.target.value)}>
              <option value="">Todos</option>
              {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => patchFilter("status", event.target.value)}>
              <option value="">Todos</option>
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Usuario</span>
            <select value={filters.user} onChange={(event) => patchFilter("user", event.target.value)}>
              <option value="">Todos</option>
              {userOptions.map((user) => <option key={user} value={user}>{user}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Taxas</span>
            <select value={filters.fee} onChange={(event) => patchFilter("fee", event.target.value)}>
              <option value="">Todas</option>
              <option value="charged">Com taxa</option>
              <option value="free">Gratuitas</option>
            </select>
          </label>
          <label className="field reports-search">
            <span>Busca</span>
            <input value={filters.search} onChange={(event) => patchFilter("search", event.target.value)} placeholder="Protocolo, tutor, CPF..." />
          </label>
        </div>
        <div className="reports-breakdown-grid">
          {reportBreakdowns.map((group) => (
            <div className="reports-breakdown" key={group.title}>
              <div className="reports-breakdown-head">
                <span>{group.title}</span>
                <strong>{sumValues(group.items)}</strong>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Descricao</th>
                    <th>Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.items.length ? group.items : [{ label: "Sem dados", value: 0 }]).map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Tutor</th>
                <th>Tipo</th>
                  <th>Status</th>
                  <th>Resultado</th>
                <th>Usuario</th>
                <th>Taxa</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.slice(0, 12).map((request) => (
                <tr key={request.id || request.protocol}>
                  <td>{request.protocol || request.id}</td>
                  <td>{request.tutor || request.tutor_name || "Nao informado"}</td>
                  <td>{getRequestTypeName(request, requestTypes)}</td>
                  <td>{statusLabels[request.status] || request.status}</td>
                  <td>{requestResultLabel(request)}</td>
                  <td>{getRequestUserName(request)}</td>
                  <td>{request.fee || request.billingAmount || "Gratuito"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length === 0 && <EmptyState title="Nenhum registro encontrado" text="Ajuste os filtros para gerar o relatorio." />}
        </div>
      </div>
    </section>
  );
}

function ConfigView({
  requestTypes = initialRequestTypes,
  setRequestTypes,
  documentTypes = initialDocumentTypes,
  setDocumentTypes,
  speciesOptions = initialSpecies,
  setSpeciesOptions,
  sizeOptions = initialSizes,
  setSizeOptions,
  municipalities = initialMunicipalities,
  setMunicipalities,
  aiSettings = initialAiSettings,
  setAiSettings,
  scheduleDays = [],
  setScheduleDays,
  scheduleRules = [],
  setScheduleRules,
  teams = initialTeams,
  setTeams,
  configArea = "environment",
}) {
  const roles = ["Super Admin", "Coordenador", "Triagem", "Analista", "Agendador", "Veterinário", "Adoção", "Auditor", "Servidor Público"];
  const emptyRequestType = { name: "", charged: false, fee: "Gratuito", billingDescription: "", billingAmount: "", billingDueDate: "", active: true, overrideDailyLimit: false };
  const emptyAgendaForm = {
    description: "Agenda padrão",
    active: true,
    unavailable: false,
    kind: "Agenda",
    type: "Recorrência",
    repeatEvery: "1",
    weekdays: [1, 2, 3, 4],
    start: "",
    end: "",
    time: "08:00",
    vacancies: "10",
    municipalityId: "",
    locationName: "",
    latitude: "",
    longitude: "",
  };
  const [configTab, setConfigTab] = useState("agenda");
  const [configModal, setConfigModal] = useState(null);
  const [configStatusFilters, setConfigStatusFilters] = useState({});
  const [editingScheduleRuleId, setEditingScheduleRuleId] = useState(null);
  const [editingSpeciesId, setEditingSpeciesId] = useState(null);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [agendaLocationStatus, setAgendaLocationStatus] = useState("");
  const [newRequestType, setNewRequestType] = useState(emptyRequestType);
  const [editingRequestTypeId, setEditingRequestTypeId] = useState(null);
  const [editingSizeId, setEditingSizeId] = useState(null);
  const [newSpecies, setNewSpecies] = useState({ name: "", active: true });
  const [newSize, setNewSize] = useState({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true });
  const [newDocument, setNewDocument] = useState({ name: "", modelHint: "", aiCriteria: "", rejectionRules: "", required: true, active: true });
  const [newSectorName, setNewSectorName] = useState("");
  const [newSectorActive, setNewSectorActive] = useState(true);
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [sectorModal, setSectorModal] = useState(false);
  const [pendingSectorUserIds, setPendingSectorUserIds] = useState([]);
  const [newTeamUser, setNewTeamUser] = useState({ name: "", email: "", sectorId: "", role: "Analista", matricula: "", cargo: "", senha: "", active: true });
  const [editingTeamUserId, setEditingTeamUserId] = useState(null);
  const [userModal, setUserModal] = useState(false);
  const [agendaForm, setAgendaForm] = useState(emptyAgendaForm);
  const [aiSaveStatus, setAiSaveStatus] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [singleVacancies, setSingleVacancies] = useState("20");
  const [recurringStart, setRecurringStart] = useState("");
  const [recurringEnd, setRecurringEnd] = useState("");
  const [recurringVacancies, setRecurringVacancies] = useState("20");
  const [recurringWeekdays, setRecurringWeekdays] = useState([]);
  const environmentTabs = [
    { id: "agenda", label: "Agenda" },
    { id: "requests", label: "Tipo de Solicitação" },
    { id: "sizes", label: "Portes" },
    { id: "species", label: "Espécies" },
    { id: "documents", label: "Documentos Solicitados" },
    { id: "ai", label: "IA" },
  ];

  useEffect(() => {
    if (configArea === "environment") {
      setConfigTab((current) => (environmentTabs.some((tab) => tab.id === current) ? current : "agenda"));
      return;
    }
    setConfigTab(configArea);
  }, [configArea]);

  const selectedAiProvider = aiSettings.provider || "OpenAI";
  const selectedAiProviderConfig = aiProviderOptions[selectedAiProvider] || aiProviderOptions.OpenAI;
  const selectedAiModels = selectedAiProviderConfig.models || [];
  const selectedAiModel = selectedAiModels.includes(aiSettings.model) ? aiSettings.model : selectedAiModels[0] || "";

  useEffect(() => {
    if (!setAiSettings || !selectedAiModel) return;
    if (aiSettings.provider === selectedAiProvider && aiSettings.model === selectedAiModel) return;
    setAiSettings((current) => ({
      ...current,
      provider: selectedAiProvider,
      model: selectedAiModel,
    }));
  }, [aiSettings.model, aiSettings.provider, selectedAiModel, selectedAiProvider, setAiSettings]);

  async function saveAiCredentials() {
    const nextSettings = {
      ...aiSettings,
      active: Boolean(aiSettings.active),
      provider: selectedAiProvider,
      model: selectedAiModel,
      endpoint: aiSettings.endpoint || "",
      apiKey: aiSettings.apiKey || "",
    };
    setAiSaveStatus("Salvando configuração...");
    try {
      const saved = await api.setConfig("ai", nextSettings);
      const publicSettings = {
        ...nextSettings,
        ...(saved?.value || {}),
        apiKey: "",
        hasApiKey: Boolean(saved?.value?.hasApiKey || nextSettings.apiKey || aiSettings.hasApiKey),
      };
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(publicSettings));
      setAiSettings?.(publicSettings);
      setAiSaveStatus("Chave salva com sucesso.");
    } catch (err) {
      setAiSaveStatus(`Não foi possível salvar: ${err.message}`);
    }
  }

  const currentConfigKey = configArea === "environment" ? configTab : configArea;
  const configStatusFilter = configStatusFilters[currentConfigKey] || "active";
  const filterByConfigStatus = (items = []) =>
    items.filter((item) => (configStatusFilter === "active" ? item.active !== false : item.active === false));

  function setConfigStatusFilter(value) {
    setConfigStatusFilters((current) => ({ ...current, [currentConfigKey]: value }));
  }

  function createRequestType(payload = {}) {
    const billingAmount = payload.billingAmount || payload.fee || "";
    const selectedDocuments = payload.documents?.length
      ? payload.documents
      : documentTypes.filter((document) => document.active !== false);
    setRequestTypes?.((current) => [
      ...current,
      {
        id: `tipo_${Date.now()}`,
        name: payload.name || "",
        fee: payload.charged ? billingAmount : "Gratuito",
        charged: Boolean(payload.charged),
        billingDescription: payload.charged ? payload.billingDescription || "" : "",
        billingAmount: payload.charged ? billingAmount : "",
        billingDueDate: payload.charged ? payload.billingDueDate || "" : "",
        active: payload.active !== false,
        overrideDailyLimit: Boolean(payload.overrideDailyLimit),
        documents: selectedDocuments,
      },
    ]);
  }

  function patchRequestType(typeId, patch) {
    setRequestTypes?.((current) => current.map((type) => (type.id === typeId ? { ...type, ...patch } : type)));
  }

  function toggleRequestDocument(typeId, document) {
    setRequestTypes?.((current) =>
      current.map((type) => {
        if (type.id !== typeId) return type;
        const documents = type.documents || [];
        const exists = documents.some((item) => item.id === document.id);
        return {
          ...type,
          documents: exists ? documents.filter((item) => item.id !== document.id) : [...documents, document],
        };
      }),
    );
  }

  function createDocumentType(payload = {}) {
    const nextDocument = {
      id: `doc_${Date.now()}`,
      name: payload.name || "",
      required: payload.required !== false,
      active: payload.active !== false,
      accept: ["image/jpeg", "image/png", "application/pdf"],
      maxSizeMb: 5,
      modelHint: payload.modelHint || "",
      aiCriteria: payload.aiCriteria || "",
      rejectionRules: payload.rejectionRules || "",
    };
    const normalizedDocument = normalizeDocumentType(nextDocument);
    if (editingDocumentId) {
      setDocumentTypes?.((current) =>
        current.map((document) => (document.id === editingDocumentId ? { ...document, ...normalizedDocument, id: document.id } : document)),
      );
      setRequestTypes?.((current) =>
        current.map((type) => ({
          ...type,
          documents: (type.documents || []).map((document) =>
            document.id === editingDocumentId ? { ...document, ...normalizedDocument, id: document.id } : document,
          ),
        })),
      );
      return;
    }
    setDocumentTypes?.((current) => [...current, normalizedDocument]);
  }

  function patchDocumentType(documentId, patch) {
    setDocumentTypes?.((current) => current.map((document) => (document.id === documentId ? normalizeDocumentType({ ...document, ...patch }) : document)));
    setRequestTypes?.((current) =>
      current.map((type) => ({
        ...type,
        documents: (type.documents || []).map((document) => (document.id === documentId ? normalizeDocumentType({ ...document, ...patch }) : document)),
      })),
    );
  }

  function deleteDocumentType(documentId) {
    setDocumentTypes?.((current) => current.filter((document) => document.id !== documentId));
    setRequestTypes?.((current) =>
      current.map((type) => ({
        ...type,
        documents: (type.documents || []).filter((document) => document.id !== documentId),
      })),
    );
  }

  function createSpecies(payload = {}) {
    const nextSpecies = {
      id: `especie_${Date.now()}`,
      name: payload.name || "",
      active: payload.active !== false,
    };
    setSpeciesOptions?.((current) => editingSpeciesId
      ? current.map((species) => (species.id === editingSpeciesId ? { ...species, ...nextSpecies, id: species.id } : species))
      : [...current, nextSpecies]);
  }

  function openSpeciesModal(species = null) {
    if (species) {
      setEditingSpeciesId(species.id);
      setNewSpecies({ name: species.name || "", active: species.active !== false });
    } else {
      setEditingSpeciesId(null);
      setNewSpecies({ name: "", active: true });
    }
    setConfigModal("species");
  }

  function openDocumentModal(document = null) {
    if (document) {
      setEditingDocumentId(document.id);
      setNewDocument({
        name: document.name || "",
        modelHint: document.modelHint || "",
        aiCriteria: document.aiCriteria || "",
        rejectionRules: document.rejectionRules || "",
        required: document.required !== false,
        active: document.active !== false,
      });
    } else {
      setEditingDocumentId(null);
      setNewDocument({ name: "", modelHint: "", aiCriteria: "", rejectionRules: "", required: true, active: true });
    }
    setConfigModal("document");
  }

  function createSize(payload = {}) {
    const nextSize = {
      id: `porte_${Date.now()}`,
      name: payload.name || "",
      weightStart: payload.weightStart || "",
      weightEnd: payload.weightEnd || "",
      weightUnit: payload.weightUnit || "kg",
      active: payload.active !== false,
    };
    setSizeOptions?.((current) => [
      ...current,
      { ...nextSize, description: formatSizeRange(nextSize) },
    ]);
  }

  function saveSize(payload = {}) {
    const nextSize = {
      name: payload.name || "",
      weightStart: payload.weightStart || "",
      weightEnd: payload.weightEnd || "",
      weightUnit: payload.weightUnit || "kg",
      active: payload.active !== false,
    };
    if (editingSizeId) {
      setSizeOptions?.((current) =>
        current.map((size) =>
          size.id === editingSizeId ? { ...size, ...nextSize, description: formatSizeRange(nextSize) } : size,
        ),
      );
      return;
    }
    createSize(nextSize);
  }

  function openSizeModal(size = null) {
    if (size) {
      setEditingSizeId(size.id);
      setNewSize({
        name: size.name || "",
        weightStart: size.weightStart || "",
        weightEnd: size.weightEnd || "",
        weightUnit: size.weightUnit || "kg",
        active: size.active !== false,
      });
    } else {
      setEditingSizeId(null);
      setNewSize({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true });
    }
    setConfigModal("size");
  }

  function patchListItem(setter, itemId, patch) {
    setter?.((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  function deleteListItem(setter, itemId) {
    setter?.((current) => current.filter((item) => item.id !== itemId));
  }

  function createSector() {
    if (!newSectorName.trim()) return;
    if (editingSectorId) {
      setTeams?.((current) => ({
        ...current,
        sectors: (current.sectors || []).map((sector) =>
          sector.id === editingSectorId ? { ...sector, name: newSectorName.trim(), active: newSectorActive } : sector,
        ),
        users: (current.users || []).map((u) => {
          if (pendingSectorUserIds.includes(u.id)) return { ...u, sectorId: editingSectorId };
          if (u.sectorId === editingSectorId) return { ...u, sectorId: "" };
          return u;
        }),
      }));
      setEditingSectorId(null);
      setNewSectorName("");
      setNewSectorActive(true);
      setPendingSectorUserIds([]);
      return;
    }
    const newId = `setor_${Date.now()}`;
    setTeams?.((current) => ({
      ...current,
      sectors: [...(current.sectors || []), { id: newId, name: newSectorName.trim(), active: newSectorActive }],
      users: (current.users || []).map((u) => pendingSectorUserIds.includes(u.id) ? { ...u, sectorId: newId } : u),
    }));
    setNewSectorName("");
    setNewSectorActive(true);
    setPendingSectorUserIds([]);
  }

  function openSectorModal(sector = null) {
    if (sector) {
      setEditingSectorId(sector.id);
      setNewSectorName(sector.name || "");
      setNewSectorActive(sector.active !== false);
      setPendingSectorUserIds((teams.users || []).filter((u) => u.sectorId === sector.id).map((u) => u.id));
    } else {
      setEditingSectorId(null);
      setNewSectorName("");
      setNewSectorActive(true);
      setPendingSectorUserIds([]);
    }
    setSectorModal(true);
  }

  function patchSector(sectorId, patch) {
    setTeams?.((current) => ({
      ...current,
      sectors: (current.sectors || []).map((sector) => (sector.id === sectorId ? { ...sector, ...patch } : sector)),
    }));
  }

  function deleteSector(sectorId) {
    setTeams?.((current) => ({
      ...current,
      sectors: (current.sectors || []).filter((sector) => sector.id !== sectorId),
      users: (current.users || []).map((user) => (user.sectorId === sectorId ? { ...user, sectorId: "" } : user)),
    }));
  }

  function createTeamUser() {
    if (!newTeamUser.name.trim() || !newTeamUser.email.trim()) return;
    if (editingTeamUserId) {
      setTeams?.((current) => ({
        ...current,
        users: (current.users || []).map((user) => user.id === editingTeamUserId ? {
          ...user,
          name: newTeamUser.name.trim(),
          email: newTeamUser.email.trim(),
          sectorId: newTeamUser.sectorId,
          role: newTeamUser.role,
          matricula: newTeamUser.matricula.trim(),
          cargo: newTeamUser.cargo.trim(),
          active: newTeamUser.active !== false,
        } : user),
      }));
      setEditingTeamUserId(null);
      setNewTeamUser({ name: "", email: "", sectorId: "", role: "Analista", matricula: "", cargo: "", senha: "", active: true });
      return;
    }
    setTeams?.((current) => ({
      ...current,
      users: [
        ...(current.users || []),
        {
          id: `usuario_${Date.now()}`,
          name: newTeamUser.name.trim(),
          email: newTeamUser.email.trim(),
          sectorId: newTeamUser.sectorId,
          role: newTeamUser.role,
          matricula: newTeamUser.matricula.trim(),
          cargo: newTeamUser.cargo.trim(),
          active: newTeamUser.active !== false,
        },
      ],
    }));
    setNewTeamUser({ name: "", email: "", sectorId: "", role: "Analista", matricula: "", cargo: "", senha: "", active: true });
  }

  function openTeamUserModal(user = null) {
    if (user) {
      setEditingTeamUserId(user.id);
      setNewTeamUser({
        name: user.name || "",
        email: user.email || "",
        sectorId: user.sectorId || "",
        role: user.role || "Analista",
        matricula: user.matricula || "",
        cargo: user.cargo || "",
        senha: "",
        active: user.active !== false,
      });
    } else {
      setEditingTeamUserId(null);
      setNewTeamUser({ name: "", email: "", sectorId: "", role: "Analista", matricula: "", cargo: "", senha: "", active: true });
    }
    setUserModal(true);
  }

  function patchTeamUser(userId, patch) {
    setTeams?.((current) => ({
      ...current,
      users: (current.users || []).map((user) => (user.id === userId ? { ...user, ...patch } : user)),
    }));
  }

  function deleteTeamUser(userId) {
    setTeams?.((current) => ({
      ...current,
      users: (current.users || []).filter((user) => user.id !== userId),
    }));
  }

  function toInputDate(dateText) {
    if (!dateText) return "";
    const [day, month, year] = dateText.split("/");
    return `${year}-${month}-${day}`;
  }

  function toScheduleDate(dateValue) {
    const [year, month, day] = dateValue.split("-");
    return `${day}/${month}/${year}`;
  }

  function getWeekdayLabel(dateValue) {
    const date = new Date(`${dateValue}T12:00:00`);
    return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][date.getDay()];
  }

  async function upsertScheduleDay(dateValue, vacanciesValue) {
    if (!dateValue) return;
    const date = toScheduleDate(dateValue);
    const weekday = getWeekdayLabel(dateValue);
    const vacancies = Math.max(Number(vacanciesValue) || 0, 0);
    try {
      const existing = scheduleDays.find((day) => day.date === date);
      if (existing?.id) {
        const updated = await api.updateScheduleDay(existing.id, { vacancies });
        setScheduleDays?.((current) => current.map((day) => day.date === date ? normalizeScheduleDay(updated) : day));
      } else {
        const created = await api.createScheduleDay({ date, weekday, vacancies });
        setScheduleDays?.((current) =>
          [...current.filter((d) => d.date !== date), normalizeScheduleDay(created)]
            .sort((l, r) => parseScheduleDate(l.date) - parseScheduleDate(r.date))
        );
      }
    } catch (err) {
      console.error("Erro ao salvar dia de agenda:", err);
    }
  }

  async function createRecurringSchedule() {
    if (!recurringStart || !recurringEnd || recurringWeekdays.length === 0) return;
    const start = new Date(`${recurringStart}T12:00:00`);
    const end = new Date(`${recurringEnd}T12:00:00`);
    const newDays = [];

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (recurringWeekdays.includes(date.getDay())) {
        const value = date.toISOString().slice(0, 10);
        newDays.push({
          date: toScheduleDate(value),
          weekday: getWeekdayLabel(value),
          vacancies: Math.max(Number(recurringVacancies) || 0, 0),
          active: true,
        });
      }
    }

    const saved = [];
    for (const day of newDays) {
      try {
        const existing = scheduleDays.find((d) => d.date === day.date);
        if (existing?.id) {
          const updated = await api.updateScheduleDay(existing.id, { vacancies: day.vacancies });
          saved.push(normalizeScheduleDay(updated));
        } else {
          const created = await api.createScheduleDay(day);
          saved.push(normalizeScheduleDay(created));
        }
      } catch (err) {
        console.error("Erro ao salvar dia recorrente:", err);
      }
    }

    setScheduleDays?.((current) => {
      const byDate = new Map(current.map((d) => [d.date, d]));
      saved.forEach((d) => byDate.set(d.date, d));
      return Array.from(byDate.values()).sort((l, r) => parseScheduleDate(l.date) - parseScheduleDate(r.date));
    });
  }

  function patchAgendaForm(field, value) {
    setAgendaForm((current) => ({ ...current, [field]: value }));
  }

  function useAgendaCurrentLocation() {
    if (!navigator.geolocation) {
      setAgendaLocationStatus("Localizacao atual indisponivel neste navegador.");
      return;
    }

    setAgendaLocationStatus("Solicitando localizacao atual...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAgendaForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          locationName: current.locationName || "Localizacao atual",
        }));
        setAgendaLocationStatus("Localizacao atual registrada.");
      },
      () => setAgendaLocationStatus("Nao foi possivel obter a localizacao atual."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function openAgendaModal(rule = null) {
    if (rule) {
      setEditingScheduleRuleId(rule.id);
      setAgendaForm({
        ...emptyAgendaForm,
        description: rule.description || "",
        active: rule.active !== false,
        unavailable: rule.unavailable || false,
        kind: rule.kind || "Agenda",
        type: rule.type || "Recorrência",
        repeatEvery: String(rule.repeatEvery || "1"),
        weekdays: rule.weekdays || [],
        start: toInputDate(rule.start),
        end: toInputDate(rule.end || rule.start),
        time: rule.time || "08:00",
        vacancies: String(rule.vacancies || "20"),
        municipalityId: rule.municipalityId || "",
        locationName: rule.locationName || "",
        addressUrl: rule.addressUrl || "",
        latitude: rule.latitude || "",
        longitude: rule.longitude || "",
      });
    } else {
      setEditingScheduleRuleId(null);
      setAgendaForm(emptyAgendaForm);
    }
    setConfigModal("agenda");
  }

  async function createScheduleFromModal(event) {
    event.preventDefault();
    const isRecurring = normalizeText(agendaForm.type) === "recorrencia";
    if (!agendaForm.description.trim() || !agendaForm.start || (isRecurring && (!agendaForm.end || agendaForm.weekdays.length === 0))) {
      return;
    }

    const start = new Date(`${agendaForm.start}T12:00:00`);
    const end = new Date(`${isRecurring ? agendaForm.end : agendaForm.start}T12:00:00`);
    const repeatEvery = Math.max(Number(agendaForm.repeatEvery) || 1, 1);
    const vacancies = Math.max(Number(agendaForm.vacancies) || 0, 0);
    const municipality = municipalities.find((item) => item.id === agendaForm.municipalityId);
    const scheduleRuleId = editingScheduleRuleId || `agenda_${Date.now()}`;
    const nextDays = [];

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const weekDistance = Math.floor((date - start) / (7 * 24 * 60 * 60 * 1000));
      const matchesRepeat = weekDistance % repeatEvery === 0;
      const matchesWeekday = isRecurring ? agendaForm.weekdays.includes(date.getDay()) : true;
      if (matchesRepeat && matchesWeekday) {
        const value = date.toISOString().slice(0, 10);
        nextDays.push({
          date: toScheduleDate(value),
          weekday: getWeekdayLabel(value),
          vacancies,
          active: agendaForm.active && !agendaForm.unavailable,
          scheduleRuleId,
          description: agendaForm.description.trim(),
          startTime: agendaForm.time,
          kind: agendaForm.kind,
          municipalityId: agendaForm.municipalityId,
          municipalityName: municipality ? `${municipality.name}/${municipality.state}` : "",
          locationName: agendaForm.locationName,
          addressUrl: agendaForm.addressUrl,
          latitude: agendaForm.latitude,
          longitude: agendaForm.longitude,
        });
      }
    }

    const nextRule = {
      id: scheduleRuleId,
      description: agendaForm.description.trim(),
      createdAt: new Date().toLocaleString("pt-BR"),
      active: agendaForm.active && !agendaForm.unavailable,
      unavailable: agendaForm.unavailable,
      type: agendaForm.type,
      kind: agendaForm.kind,
      repeatEvery,
      weekdays: isRecurring ? agendaForm.weekdays : [start.getDay()],
      start: toScheduleDate(agendaForm.start),
      end: toScheduleDate(isRecurring ? agendaForm.end : agendaForm.start),
      time: agendaForm.time,
      vacancies,
      municipalityId: agendaForm.municipalityId,
      municipalityName: municipality ? `${municipality.name}/${municipality.state}` : "",
      locationName: agendaForm.locationName,
      addressUrl: agendaForm.addressUrl,
      latitude: agendaForm.latitude,
      longitude: agendaForm.longitude,
    };

    setScheduleRules?.((current) => editingScheduleRuleId
      ? current.map((rule) => (rule.id === editingScheduleRuleId ? nextRule : rule))
      : [nextRule, ...current]);
    const saved = [];
    for (const day of nextDays) {
      try {
        const existing = scheduleDays.find((d) => d.date === day.date);
        if (existing?.id) {
          const updated = await api.updateScheduleDay(existing.id, { vacancies: day.vacancies });
          saved.push({ ...normalizeScheduleDay(updated), scheduleRuleId });
        } else {
          const created = await api.createScheduleDay({ ...day, scheduleRuleId });
          saved.push({ ...normalizeScheduleDay(created), scheduleRuleId });
        }
      } catch (err) {
        console.error("Erro ao salvar dia de regra:", err);
      }
    }

    setScheduleDays?.((current) => {
      const keptDays = editingScheduleRuleId ? current.filter((day) => day.scheduleRuleId !== editingScheduleRuleId) : current;
      const byDate = new Map(keptDays.map((day) => [day.date, day]));
      saved.forEach((day) => byDate.set(day.date, day));
      return Array.from(byDate.values()).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));
    });
    setAgendaForm(emptyAgendaForm);
    setEditingScheduleRuleId(null);
    setConfigModal(null);
  }

  function formatScheduleWeekdays(weekdays) {
    const names = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    return weekdays.map((weekday) => names[weekday]).join(", ");
  }

  const filteredRequestTypes = filterByConfigStatus(requestTypes);
  const filteredScheduleRules = filterByConfigStatus(scheduleRules);
  const filteredSizes = filterByConfigStatus(sizeOptions);
  const filteredSpecies = filterByConfigStatus(speciesOptions);
  const filteredDocumentTypes = filterByConfigStatus(documentTypes);
  const filteredSectors = filterByConfigStatus(teams.sectors || []);
  const filteredTeamUsers = filterByConfigStatus(teams.users || []);
  const currentConfigItems = {
    requests: requestTypes,
    agenda: scheduleRules,
    sizes: sizeOptions,
    species: speciesOptions,
    users: teams.users || [],
    sectors: teams.sectors || [],
    ai: [{ id: "ai", active: Boolean(aiSettings.active) }],
    documents: documentTypes,
  }[currentConfigKey] || [];
  const configAreaTitle = {
    environment: "Configurar Ambiente",
    users: "Criar Usuários",
    sectors: "Criar Setores",
  }[configArea] || "Configurações";

  return (
    <section className="config-workspace">
      {configArea === "environment" && (
        <div className="panel wide">
          <PanelHeader title={configAreaTitle} />
          <div className="config-tabs" aria-label="Subabas de configurações">
            {environmentTabs.map((tab) => (
              <button key={tab.id} className={configTab === tab.id ? "selected" : ""} type="button" onClick={() => setConfigTab(tab.id)}>
                {tab.label}
              </button>
            ))}
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={currentConfigItems.filter((item) => item.active !== false).length}
              inactiveCount={currentConfigItems.filter((item) => item.active === false).length}
            />
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "requests" && (
        <div className="panel wide">
          <ConfigSectionHeader title="Tipos de solicitação" createLabel="Criar tipo" onCreate={() => setConfigModal("requestType")} />
          <div className="config-editor-grid">
            {filteredRequestTypes.length === 0 && (
              <EmptyState title="Nenhum tipo configurado" text="Crie os tipos de solicitação que o tutor poderá escolher. Cada tipo define taxa e documentos exigidos." />
            )}
            {filteredRequestTypes.map((type) => (
              <article className="request-type-card config-summary-card" key={type.id}>
                <div className="config-card-title">
                  <strong>{type.name}</strong>
                  <small className={type.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {type.active === false ? "Inativo" : "Ativo"}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{type.charged ? `Taxa: ${type.billingAmount || type.fee || "—"}` : "Gratuito"}</span>
                  {type.overrideDailyLimit && <span>Sobrepõe limite diário</span>}
                  {type.charged && type.billingDescription && <span>{type.billingDescription}</span>}
                  <span>{(type.documents?.length || 0)} documento(s) vinculado(s)</span>
                </div>
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => {
                    setEditingRequestTypeId(type.id);
                    setNewRequestType({ ...emptyRequestType, ...type });
                    setConfigModal("requestType");
                  }}>Editar</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "agenda" && (
        <div className="panel wide">
          <ConfigSectionHeader title="Agenda" createLabel="Criar agenda" onCreate={() => openAgendaModal()} />
          <div className="config-editor-grid">
            {filteredScheduleRules.length === 0 && (
              <EmptyState title="Nenhuma agenda cadastrada" text="Crie uma agenda para gerar dias disponíveis para castração." />
            )}
            {filteredScheduleRules.map((rule) => (
              <article className="request-type-card config-summary-card" key={rule.id}>
                <div className="config-card-title">
                  <strong>{rule.description}</strong>
                  <small className={rule.active ? "schedule-status active" : "schedule-status inactive"}>
                    {rule.active ? "Ativo" : "Inativo"}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{rule.kind || "Agenda"} - {rule.type}</span>
                  <span>{rule.start} a {rule.end}</span>
                  <span>{rule.time}h - {rule.vacancies} vagas/dia</span>
                  {rule.municipalityName && <span>{rule.municipalityName}</span>}
                  {rule.locationName && <span>{rule.locationName}</span>}
                  {normalizeText(rule.type) === "recorrencia" && <span>{formatScheduleWeekdays(rule.weekdays)}</span>}
                </div>
                <div className="form-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => openAgendaModal(rule)}
                  >
                    Editar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "sizes" && (
        <SimpleConfigList title="Portes" items={filteredSizes} onCreate={() => openSizeModal()} onEdit={openSizeModal} onPatch={(id, patch) => patchListItem(setSizeOptions, id, patch)} showDescription />
      )}

      {configArea === "environment" && configTab === "species" && (
        <SimpleConfigList title="Espécies" items={filteredSpecies} onCreate={() => openSpeciesModal()} onEdit={openSpeciesModal} onPatch={(id, patch) => patchListItem(setSpeciesOptions, id, patch)} />
      )}

      {configArea === "sectors" && (
        <div className="panel wide">
          <ConfigSectionHeader title={configAreaTitle} createLabel="Criar setor" onCreate={() => openSectorModal()}>
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={(teams.sectors || []).filter((item) => item.active !== false).length}
              inactiveCount={(teams.sectors || []).filter((item) => item.active === false).length}
            />
          </ConfigSectionHeader>
          <div className="team-config-column">
            <div className="team-list config-editor-grid">
              {filteredSectors.length === 0 && (
                <EmptyState title="Nenhum setor cadastrado" text="Crie setores para organizar usuários e atribuições internas." />
              )}
              {filteredSectors.map((sector) => {
                const sectorUsers = (teams.users || []).filter((u) => u.sectorId === sector.id);
                return (
                  <article className="request-type-card config-summary-card" key={sector.id}>
                    <div className="config-card-title">
                      <strong>{sector.name || "Setor sem nome"}</strong>
                      <small className={sector.active === false ? "schedule-status inactive" : "schedule-status active"}>
                        {sector.active === false ? "Inativo" : "Ativo"}
                      </small>
                    </div>
                    <div className="config-card-details">
                      <span>{sectorUsers.length} usuário(s) vinculado(s)</span>
                      {sectorUsers.length > 0 && <span>{sectorUsers.map((u) => u.name).join(", ")}</span>}
                    </div>
                    <div className="form-actions">
                      <button className="ghost-button" type="button" onClick={() => openSectorModal(sector)}>Editar</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {sectorModal && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={(e) => { e.preventDefault(); createSector(); setSectorModal(false); }}>
            <ModalHeader title={editingSectorId ? "Editar setor" : "Criar setor"} eyebrow={editingSectorId ? "Editar setor" : "Novo setor"} onClose={() => { setSectorModal(false); setEditingSectorId(null); }} />
            <div className="config-modal-options">
              <ConfigActiveToggle checked={newSectorActive} onChange={setNewSectorActive} />
            </div>
            <Field label="Nome do setor" value={newSectorName} placeholder="Ex: Triagem documental" onChange={setNewSectorName} />
            <label className="field">
              <span>Vincular usuários</span>
              <div className="team-user-checklist">
                {(teams.users || []).filter((u) => u.active !== false).length === 0 && (
                  <span className="helper-text">Nenhum usuário cadastrado ainda.</span>
                )}
                {(teams.users || []).filter((u) => u.active !== false).map((u) => (
                  <label key={u.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={pendingSectorUserIds.includes(u.id)}
                      onChange={() => setPendingSectorUserIds((current) =>
                        current.includes(u.id) ? current.filter((id) => id !== u.id) : [...current, u.id]
                      )}
                    />
                    {u.name}{u.sectorId ? ` (setor atual: ${(teams.sectors || []).find((s) => s.id === u.sectorId)?.name || "outro"})` : ""}
                  </label>
                ))}
              </div>
            </label>
            <button className="primary-action" type="submit" disabled={!newSectorName.trim()}>{editingSectorId ? "Salvar" : "Criar setor"}</button>
          </form>
        </div>
      )}

      {configArea === "users" && (
        <div className="panel wide">
          <ConfigSectionHeader title={configAreaTitle} createLabel="Criar usuário" onCreate={() => openTeamUserModal()}>
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={(teams.users || []).filter((item) => item.active !== false).length}
              inactiveCount={(teams.users || []).filter((item) => item.active === false).length}
            />
          </ConfigSectionHeader>
          <div className="team-config-column">
            <div className="team-list config-editor-grid">
              {filteredTeamUsers.length === 0 && (
                <EmptyState title="Nenhum usuário cadastrado" text="Crie usuários internos e vincule cada um a um setor." />
              )}
              {filteredTeamUsers.map((user) => {
                const sector = (teams.sectors || []).find((item) => item.id === user.sectorId);
                return (
                <article className="request-type-card config-summary-card" key={user.id}>
                  <div className="config-card-title">
                    <strong>{user.name || "Usuário sem nome"}</strong>
                    <small className={user.active === false ? "schedule-status inactive" : "schedule-status active"}>
                      {user.active === false ? "Inativo" : "Ativo"}
                    </small>
                  </div>
                  <div className="config-card-details">
                    <span>{user.email || "Email não informado"}</span>
                    <span>{user.role || "Analista"}</span>
                    <span>{sector?.name || "Sem setor"}</span>
                  </div>
                  <div className="form-actions">
                    <button className="ghost-button" type="button" onClick={() => openTeamUserModal(user)}>Editar</button>
                  </div>
                </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {userModal && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={(e) => { e.preventDefault(); createTeamUser(); setUserModal(false); }}>
            <ModalHeader title={editingTeamUserId ? "Editar usuário" : "Criar usuário"} eyebrow={editingTeamUserId ? "Editar usuário" : "Novo usuário"} onClose={() => { setUserModal(false); setEditingTeamUserId(null); }} />
            <div className="config-modal-options">
              <ConfigActiveToggle checked={newTeamUser.active !== false} onChange={(active) => setNewTeamUser((c) => ({ ...c, active }))} />
            </div>
            <Field label="Nome" value={newTeamUser.name} placeholder="Nome completo" onChange={(value) => setNewTeamUser((c) => ({ ...c, name: value }))} />
            <Field label="Email" value={newTeamUser.email} placeholder="email@dominio.com" onChange={(value) => setNewTeamUser((c) => ({ ...c, email: value }))} />
            <label className="field">
              <span>Setor vinculado</span>
              <select value={newTeamUser.sectorId} onChange={(e) => setNewTeamUser((c) => ({ ...c, sectorId: e.target.value }))}>
                <option value="">Sem setor</option>
                {(teams.sectors || []).filter((s) => s.active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <Field label="N° Matrícula" value={newTeamUser.matricula} placeholder="Ex: 00123" onChange={(value) => setNewTeamUser((c) => ({ ...c, matricula: value }))} />
            <label className="field">
              <span>Cargo</span>
              <select value={newTeamUser.role} onChange={(e) => setNewTeamUser((c) => ({ ...c, role: e.target.value }))}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Senha de login</span>
              <input type="password" value={newTeamUser.senha} placeholder="Senha inicial" onChange={(e) => setNewTeamUser((c) => ({ ...c, senha: e.target.value }))} />
            </label>
            <button className="primary-action" type="submit" disabled={!newTeamUser.name.trim() || !newTeamUser.email.trim()}>{editingTeamUserId ? "Salvar" : "Criar usuário"}</button>
          </form>
        </div>
      )}

      {configArea === "environment" && configTab === "ai" && (
        <div className="panel wide">
          <PanelHeader title="IA externa para documentos" />
          <div className="ai-settings-layout">
            <article className="request-type-card ai-settings-card">
              <ToggleSwitch
                label="Validação por IA"
                checked={Boolean(aiSettings.active)}
                onChange={(checked) => setAiSettings?.((current) => ({ ...current, active: checked }))}
                onText="Ativa"
                offText="Inativa"
              />
              <label className="field">
                <span>Provedor</span>
                <select
                  value={selectedAiProvider}
                  onChange={(event) => {
                    const provider = event.target.value;
                    setAiSettings?.((current) => ({
                      ...current,
                      provider,
                      model: aiProviderOptions[provider]?.models?.[0] || "",
                    }));
                  }}
                >
                  {Object.keys(aiProviderOptions).map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Modelo</span>
                <select value={selectedAiModel} onChange={(event) => setAiSettings?.((current) => ({ ...current, model: event.target.value }))}>
                  {selectedAiModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
              <Field label="Endpoint customizado" value={aiSettings.endpoint} placeholder="Opcional para proxy/backend proprio" onChange={(value) => setAiSettings?.((current) => ({ ...current, endpoint: value }))} />
            </article>
            <article className="ai-rules-card">
              <strong>Como a IA será usada</strong>
              <p>
                Ao anexar um documento, a IA usa a descrição/instrução do tipo de documento como regra. Se o comprovante
                exigir residência em uma cidade, por exemplo, a análise recusa arquivos que indiquem outra cidade.
              </p>
              <p>
                Com a IA inativa, o arquivo fica apenas anexado e não passa por análise automática.
              </p>
              <label className="field">
                <span>Token / chave API</span>
                <input
                  value={aiSettings.apiKey}
                  type="password"
                  placeholder={aiSettings.hasApiKey ? `Chave da ${selectedAiProvider} já salva` : `Cole a chave da ${selectedAiProvider}`}
                  onChange={(event) => setAiSettings?.((current) => ({ ...current, apiKey: event.target.value }))}
                />
              </label>
              {selectedAiProviderConfig.keyUrl && (
                <a className="external-provider-link" href={selectedAiProviderConfig.keyUrl} target="_blank" rel="noreferrer">
                  Criar ou acessar chave da {selectedAiProvider}
                </a>
              )}
              <button className="primary-action ai-save-key-action" type="button" onClick={saveAiCredentials}>
                Salvar chave
              </button>
              {aiSaveStatus && <p className={aiSaveStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{aiSaveStatus}</p>}
            </article>
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "documents" && (
        <div className="panel wide">
          <ConfigSectionHeader title="Tipos de documentos" createLabel="Criar documento" onCreate={() => openDocumentModal()} />
          <div className="config-editor-grid">
            {filteredDocumentTypes.length === 0 && (
              <EmptyState title="Nenhum documento cadastrado" text="Crie documentos para vincular aos tipos de solicitação." />
            )}
            {filteredDocumentTypes.map((document) => (
              <article className="request-type-card config-summary-card document-summary-card" key={document.id}>
                <div className="config-card-title">
                  <strong>{document.name || "Documento sem nome"}</strong>
                  <small className={document.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {document.active === false ? "Inativo" : "Ativo"}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{document.required !== false ? "Obrigatório" : "Opcional"}</span>
                  {document.modelHint && <span>Descrição: {document.modelHint}</span>}
                </div>
                <label className="field">
                  <span>Descrição/instrução para IA</span>
                  <textarea value={document.modelHint} onChange={(event) => patchDocumentType(document.id, { modelHint: event.target.value })} />
                </label>
                <label className="field">
                  <span>Critérios obrigatórios</span>
                  <textarea value={document.aiCriteria || ""} onChange={(event) => patchDocumentType(document.id, { aiCriteria: event.target.value })} />
                </label>
                <label className="field">
                  <span>Regras de recusa</span>
                  <textarea value={document.rejectionRules || ""} onChange={(event) => patchDocumentType(document.id, { rejectionRules: event.target.value })} />
                </label>
                <ToggleSwitch
                  label="Documento obrigatório"
                  checked={document.required !== false}
                  onChange={(checked) => patchDocumentType(document.id, { required: checked })}
                  onText="Obrigatório"
                  offText="Opcional"
                />
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => openDocumentModal(document)}>
                    Editar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {configModal === "agenda" && (
        <div className="modal-backdrop">
          <form className="config-modal" onSubmit={createScheduleFromModal} role="dialog" aria-modal="true">
            <ModalHeader
              title={editingScheduleRuleId ? "Editar agenda" : "Criar agenda"}
              onClose={() => { setConfigModal(null); setEditingScheduleRuleId(null); setAgendaForm(emptyAgendaForm); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={agendaForm.active}
                onChange={(checked) => patchAgendaForm("active", checked)}
              />
            </div>
            <div className="agenda-modal-layout">
              <section className="agenda-modal-block">
                <div className="agenda-block-title">
                  <strong>Dados</strong>
                </div>
                <Field label="Descrição" value={agendaForm.description} placeholder="Ex: Agenda padrão de castração" onChange={(value) => patchAgendaForm("description", value)} />
                <div className="modal-form-grid">
                  <label className="field">
                    <span>Tipo de agenda</span>
                    <select value={agendaForm.type} onChange={(event) => patchAgendaForm("type", event.target.value)}>
                      <option value="Recorrência">Recorrência</option>
                      <option value="Dia específico">Dia específico</option>
                    </select>
                  </label>
                  {normalizeText(agendaForm.type) === "recorrencia" && (
                    <Field label="Repetir a cada semana(s)" value={agendaForm.repeatEvery} onChange={(value) => patchAgendaForm("repeatEvery", value)} />
                  )}
                </div>
                <AgendaKindSelector value={agendaForm.kind} onChange={(value) => patchAgendaForm("kind", value)} />
                {normalizeText(agendaForm.type) === "recorrencia" && (
                  <div className="agenda-weekday-field">
                    <div>
                      <span>Dias da semana</span>
                      <small>Selecione quando esta agenda abre vagas.</small>
                    </div>
                    <div className="weekday-picker">
                    {[
                      { label: "Dom", name: "Domingo" },
                      { label: "Seg", name: "Segunda-feira" },
                      { label: "Ter", name: "Terça-feira" },
                      { label: "Qua", name: "Quarta-feira" },
                      { label: "Qui", name: "Quinta-feira" },
                      { label: "Sex", name: "Sexta-feira" },
                      { label: "Sáb", name: "Sábado" },
                    ].map((weekday, index) => (
                      <button
                        key={weekday.name}
                        type="button"
                        aria-label={weekday.name}
                        title={weekday.name}
                        className={agendaForm.weekdays.includes(index) ? "selected" : ""}
                        onClick={() =>
                          patchAgendaForm(
                            "weekdays",
                            agendaForm.weekdays.includes(index)
                              ? agendaForm.weekdays.filter((item) => item !== index)
                              : [...agendaForm.weekdays, index],
                          )
                        }
                      >
                        {weekday.label}
                      </button>
                    ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="agenda-modal-block">
                <strong>Local</strong>
                <div className="modal-form-grid">
                  <Field label="Local de atendimento" value={agendaForm.locationName} placeholder="Ex: Centro de zoonoses" onChange={(value) => patchAgendaForm("locationName", value)} />
                  <Field label="Link do endereco" value={agendaForm.addressUrl} placeholder="Cole o link do Google Maps" onChange={(value) => patchAgendaForm("addressUrl", value)} />
                </div>
              </section>


              <section className="agenda-modal-block">
                <strong>Período e capacidade</strong>
                <div className="modal-form-grid">
                  <label className="field">
                    <span>Início da agenda</span>
                    <input type="date" value={agendaForm.start} onChange={(event) => patchAgendaForm("start", event.target.value)} />
                  </label>
                  {normalizeText(agendaForm.type) === "recorrencia" && (
                    <label className="field">
                      <span>Fim da agenda</span>
                      <input type="date" value={agendaForm.end} onChange={(event) => patchAgendaForm("end", event.target.value)} />
                    </label>
                  )}
                  <label className="field">
                    <span>Hora de início das castrações</span>
                    <input type="time" value={agendaForm.time} onChange={(event) => patchAgendaForm("time", event.target.value)} />
                  </label>
                  <Field label="Número de castrações por dia" value={agendaForm.vacancies} onChange={(value) => patchAgendaForm("vacancies", value)} />
                </div>
              </section>
            </div>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setConfigModal(null); setEditingScheduleRuleId(null); setAgendaForm(emptyAgendaForm); }}>
                Cancelar
              </button>
              <button className="primary-action" type="submit">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {configModal === "requestType" && (
        <div className="modal-backdrop">
          <form
            className="config-modal compact request-type-modal"
            onSubmit={(event) => {
              event.preventDefault();
              if (editingRequestTypeId) {
                patchRequestType(editingRequestTypeId, newRequestType);
              } else {
                createRequestType(newRequestType);
              }
              setNewRequestType(emptyRequestType);
              setEditingRequestTypeId(null);
              setConfigModal(null);
            }}
          >
            <ModalHeader
              title={editingRequestTypeId ? "Editar tipo de solicitação" : "Criar tipo de solicitação"}
              onClose={() => { setConfigModal(null); setEditingRequestTypeId(null); setNewRequestType(emptyRequestType); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newRequestType.active !== false}
                onChange={(checked) => setNewRequestType((current) => ({ ...current, active: checked }))}
              />
              <label className="toggle-switch config-active-toggle">
                <input
                  type="checkbox"
                  checked={!!newRequestType.charged}
                  onChange={(e) => setNewRequestType((current) => ({ ...current, charged: e.target.checked, fee: e.target.checked ? current.billingAmount || "" : "Gratuito" }))}
                />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span>Cobrar taxa</span>
              </label>
              <label className="toggle-switch config-active-toggle">
                <input
                  type="checkbox"
                  checked={!!newRequestType.overrideDailyLimit}
                  onChange={(e) => setNewRequestType((current) => ({ ...current, overrideDailyLimit: e.target.checked }))}
                />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span>Sobrepor limite</span>
              </label>
            </div>
            <Field label="Nome" value={newRequestType.name} placeholder="Ex: Castração" onChange={(value) => setNewRequestType((current) => ({ ...current, name: value }))} />
            {newRequestType.charged && (
              <div className="billing-grid">
                <Field label="Descrição da taxa" value={newRequestType.billingDescription} placeholder="Ex: Taxa de castração" onChange={(value) => setNewRequestType((current) => ({ ...current, billingDescription: value }))} />
                <Field label="Valor" value={newRequestType.billingAmount} placeholder="Ex: R$ 20,00" onChange={(value) => setNewRequestType((current) => ({ ...current, billingAmount: value, fee: value }))} />
                <label className="field">
                  <span>Vencimento do boleto</span>
                  <input type="date" value={newRequestType.billingDueDate || ""} onChange={(e) => setNewRequestType((current) => ({ ...current, billingDueDate: e.target.value }))} />
                </label>
              </div>
            )}
            <DocumentButtonPicker
              documents={documentTypes}
              selectedDocuments={newRequestType.documents || []}
              onToggle={(document) =>
                setNewRequestType((current) => {
                  const selectedDocuments = current.documents || [];
                  const exists = selectedDocuments.some((item) => item.id === document.id);
                  return { ...current, documents: exists ? selectedDocuments.filter((item) => item.id !== document.id) : [...selectedDocuments, document] };
                })
              }
            />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setConfigModal(null); setEditingRequestTypeId(null); setNewRequestType(emptyRequestType); }}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "species" && (
        <div className="modal-backdrop">
          <form className="config-modal compact" onSubmit={(event) => { event.preventDefault(); createSpecies(newSpecies); setNewSpecies({ name: "", active: true }); setEditingSpeciesId(null); setConfigModal(null); }}>
            <ModalHeader
              title={editingSpeciesId ? "Editar espécie" : "Criar espécie"}
              onClose={() => { setConfigModal(null); setEditingSpeciesId(null); setNewSpecies({ name: "", active: true }); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newSpecies.active !== false}
                onChange={(checked) => setNewSpecies((current) => ({ ...current, active: checked }))}
              />
            </div>
            <Field label="Nome" value={newSpecies.name} onChange={(value) => setNewSpecies((current) => ({ ...current, name: value }))} />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setConfigModal(null); setEditingSpeciesId(null); setNewSpecies({ name: "", active: true }); }}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "size" && (
        <div className="modal-backdrop">
          <form className="config-modal compact" onSubmit={(event) => { event.preventDefault(); saveSize(newSize); setNewSize({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true }); setEditingSizeId(null); setConfigModal(null); }}>
            <ModalHeader
              title={editingSizeId ? "Editar porte" : "Criar porte"}
              onClose={() => { setConfigModal(null); setEditingSizeId(null); setNewSize({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true }); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newSize.active !== false}
                onChange={(checked) => setNewSize((current) => ({ ...current, active: checked }))}
              />
            </div>
            <Field label="Nome" value={newSize.name} onChange={(value) => setNewSize((current) => ({ ...current, name: value }))} />
            <div className="size-range-grid">
              <Field label="De" value={newSize.weightStart} placeholder="0" onChange={(value) => setNewSize((current) => ({ ...current, weightStart: value }))} />
              <Field label="Até" value={newSize.weightEnd} placeholder="5" onChange={(value) => setNewSize((current) => ({ ...current, weightEnd: value }))} />
              <Field label="Unidade" value={newSize.weightUnit} placeholder="kg" onChange={(value) => setNewSize((current) => ({ ...current, weightUnit: value }))} />
            </div>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setConfigModal(null); setEditingSizeId(null); setNewSize({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true }); }}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "document" && (
        <div className="modal-backdrop">
          <form className="config-modal compact" onSubmit={(event) => { event.preventDefault(); createDocumentType(newDocument); setNewDocument({ name: "", modelHint: "", aiCriteria: "", rejectionRules: "", required: true, active: true }); setEditingDocumentId(null); setConfigModal(null); }}>
            <ModalHeader
              title={editingDocumentId ? "Editar documento" : "Criar documento"}
              onClose={() => { setConfigModal(null); setEditingDocumentId(null); setNewDocument({ name: "", modelHint: "", aiCriteria: "", rejectionRules: "", required: true, active: true }); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newDocument.active !== false}
                onChange={(checked) => setNewDocument((current) => ({ ...current, active: checked }))}
              />
            </div>
            <Field label="Nome" value={newDocument.name} placeholder="Ex: RG ou CNH" onChange={(value) => setNewDocument((current) => ({ ...current, name: value }))} />
            <label className="field">
              <span>Descrição/instrução para IA</span>
              <textarea value={newDocument.modelHint} onChange={(event) => setNewDocument((current) => ({ ...current, modelHint: event.target.value }))} />
            </label>
            <label className="field">
              <span>Critérios obrigatórios</span>
              <textarea value={newDocument.aiCriteria} placeholder="Ex: nome, CPF, endereço completo, data recente" onChange={(event) => setNewDocument((current) => ({ ...current, aiCriteria: event.target.value }))} />
            </label>
            <label className="field">
              <span>Regras de recusa</span>
              <textarea value={newDocument.rejectionRules} placeholder="Ex: imagem borrada, documento vencido, cidade divergente" onChange={(event) => setNewDocument((current) => ({ ...current, rejectionRules: event.target.value }))} />
            </label>
            <ToggleSwitch
              label=""
              checked={newDocument.required}
              onChange={(checked) => setNewDocument((current) => ({ ...current, required: checked }))}
            />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setConfigModal(null); setEditingDocumentId(null); setNewDocument({ name: "", modelHint: "", aiCriteria: "", rejectionRules: "", required: true, active: true }); }}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );

}

function SimpleConfigList({ title, items, allItems = items, filterValue = "active", onFilterChange, onCreate, onEdit, onPatch, showDescription = false }) {
  return (
    <div className="panel wide">
      <ConfigSectionHeader title={title} createLabel="Criar item" onCreate={onCreate}>
        {onFilterChange && (
          <ConfigStatusFilter
            value={filterValue}
            onChange={onFilterChange}
            activeCount={allItems.filter((item) => item.active !== false).length}
            inactiveCount={allItems.filter((item) => item.active === false).length}
          />
        )}
      </ConfigSectionHeader>
      <div className="config-editor-grid">
        {items.length === 0 && (
          <EmptyState title={`Nenhum item ${filterValue === "active" ? "ativo" : "desativado"}`} text="Use o botão de criação para cadastrar novos itens nesta seção." />
        )}
        {items.map((item) => (
          <article className="request-type-card config-summary-card simple-summary-card" key={item.id}>
            {showDescription && (
              <>
                <div className="config-card-title">
                  <strong>{item.name}</strong>
                  <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {item.active === false ? "Inativo" : "Ativo"}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{formatSizeRange(item) || "Faixa de peso não informada"}</span>
                </div>
              </>
            )}
            {!showDescription && (
              <>
                <div className="config-card-title">
                  <strong>{item.name || "Item sem nome"}</strong>
                  <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {item.active === false ? "Inativo" : "Ativo"}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>Cadastro disponível para solicitações</span>
                </div>
              </>
            )}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => onEdit?.(item)}>
                Editar
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AnimalRecordPanel({ record, cpf, validationKey, onRequestCreated }) {
  const [procedureOpen, setProcedureOpen] = useState(false);
  const [deathOpen, setDeathOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [procedureForm, setProcedureForm] = useState({ request_type: "Castração", notes: "" });
  const [deathForm, setDeathForm] = useState({ death_date: "", death_cause: "", notes: "" });
  const [transferForm, setTransferForm] = useState({
    target_tutor_name: "",
    target_tutor_cpf: "",
    target_tutor_phone: "",
    target_tutor_email: "",
    notes: "",
  });
  const [formStatus, setFormStatus] = useState("");
  const [saving, setSaving] = useState("");
  const animal = record.animal || {};
  const tutor = record.tutor || {};
  const history = Array.isArray(record.history) ? record.history : [];

  async function submitProcedure(event) {
    event.preventDefault();
    const tutorCpf = onlyDigits(tutor.cpf || cpf);
    if (tutorCpf.length !== 11) {
      setFormStatus("CPF do tutor não está válido para abrir procedimento.");
      return;
    }
    try {
      setSaving("procedure");
      const created = await api.createRequest({
        tutor_name: tutor.tutor_name || tutor.name || "",
        tutor_email: tutor.tutor_email || tutor.email || "",
        cpf: tutorCpf,
        phone: tutor.phone || "",
        address: tutor.address || "",
        neighborhood: tutor.neighborhood || "",
        city: tutor.city || "",
        state: tutor.state || "",
        cep: tutor.cep || "",
        animal_id: animal.id,
        animal_microchip: animal.microchip,
        animal_name: animal.name,
        species: animal.species,
        size: animal.size,
        request_type: procedureForm.request_type,
        notes: procedureForm.notes,
        tags: ["MICROCHIP"],
        workflow_data: { animal_request_type: "procedure_from_record" },
        animals: [{
          id: animal.id,
          microchip: animal.microchip,
          name: animal.name,
          species: animal.species,
          sex: animal.sex,
          size: animal.size,
          procedure: procedureForm.request_type,
        }],
      });
      setProcedureOpen(false);
      setProcedureForm({ request_type: "Castração", notes: "" });
      setFormStatus("Solicitação de procedimento enviada para análise.");
      onRequestCreated?.(created);
    } catch (err) {
      setFormStatus(err.message || "Não foi possível solicitar o procedimento.");
    } finally {
      setSaving("");
    }
  }

  async function submitDeath(event) {
    event.preventDefault();
    if (!deathForm.death_date || !deathForm.death_cause.trim()) {
      setFormStatus("Informe data e causa do óbito.");
      return;
    }
    try {
      setSaving("death");
      const created = await api.createAnimalDeathRequest(animal.id, {
        ...deathForm,
        cpf,
        validationKey,
      });
      setDeathOpen(false);
      setDeathForm({ death_date: "", death_cause: "", notes: "" });
      setFormStatus("Registro de óbito enviado para análise.");
      onRequestCreated?.(created);
    } catch (err) {
      setFormStatus(err.message || "Não foi possível registrar o óbito.");
    } finally {
      setSaving("");
    }
  }

  async function submitTransfer(event) {
    event.preventDefault();
    if (!transferForm.target_tutor_name.trim() || onlyDigits(transferForm.target_tutor_cpf).length !== 11) {
      setFormStatus("Informe nome e CPF válido do novo tutor.");
      return;
    }
    try {
      setSaving("transfer");
      const created = await api.createAnimalTransferRequest(animal.id, {
        ...transferForm,
        target_tutor_cpf: onlyDigits(transferForm.target_tutor_cpf),
        cpf,
        validationKey,
      });
      setTransferOpen(false);
      setTransferForm({ target_tutor_name: "", target_tutor_cpf: "", target_tutor_phone: "", target_tutor_email: "", notes: "" });
      setFormStatus("Solicitação de troca de tutor enviada para análise.");
      onRequestCreated?.(created);
    } catch (err) {
      setFormStatus(err.message || "Não foi possível solicitar a troca de tutor.");
    } finally {
      setSaving("");
    }
  }

  return (
    <section className="animal-record-panel">
      <div className="animal-record-header">
        <div>
          <span className="eyebrow">Animal encontrado</span>
          <h3>{animal.name || "Animal sem nome"}</h3>
          <p>{[animal.species, animal.sex, animal.size].filter(Boolean).join(" · ") || "Dados do animal em atualização"}</p>
        </div>
        <span className="animal-status-chip">{animal.status || "ativo"}</span>
      </div>

      <div className="animal-record-grid">
        <InfoTile label="Microchip" value={animal.microchip || "Não informado"} />
        <InfoTile label="Tutor atual" value={tutor.tutor_name || tutor.name || "Não informado"} />
        <InfoTile label="CPF do tutor" value={maskCpf(tutor.cpf || cpf)} />
        <InfoTile label="Contato" value={[tutor.phone, tutor.tutor_email].filter(Boolean).join(" · ") || "Não informado"} />
      </div>

      <div className="animal-record-actions">
        <button className="primary-action" type="button" onClick={() => { setProcedureOpen((value) => !value); setDeathOpen(false); setTransferOpen(false); }}>
          Solicitar procedimento
        </button>
        <button className="secondary-action" type="button" onClick={() => { setDeathOpen((value) => !value); setProcedureOpen(false); setTransferOpen(false); }}>
          Registrar óbito
        </button>
        <button className="secondary-action" type="button" onClick={() => { setTransferOpen((value) => !value); setProcedureOpen(false); setDeathOpen(false); }}>
          Solicitar troca de tutor
        </button>
        <button className="ghost-button" type="button" onClick={() => printAnimalRecordPdf(animal, tutor, history)}>
          <Download size={16} />
          Exportar prontuário
        </button>
      </div>

      {procedureOpen && (
        <div className="modal-backdrop">
          <form className="workflow-modal animal-action-modal" onSubmit={submitProcedure} role="dialog" aria-modal="true">
            <ModalHeader title="Solicitar procedimento" eyebrow={animal.name || "Animal"} onClose={() => setProcedureOpen(false)} />
            <div className="detail-grid compact-detail-grid">
              <p><span>Microchip</span>{animal.microchip || "Não informado"}</p>
              <p><span>Tutor</span>{tutor.tutor_name || tutor.name || "Não informado"}</p>
            </div>
            <label className="field">
              <span>Procedimento</span>
              <select value={procedureForm.request_type} onChange={(event) => setProcedureForm((current) => ({ ...current, request_type: event.target.value }))}>
                <option>Castração</option>
                <option>Microchipagem</option>
                <option>Castração e microchipagem</option>
              </select>
            </label>
            <label className="field animal-form-notes">
              <span>Observações</span>
              <textarea value={procedureForm.notes} onChange={(event) => setProcedureForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Descreva a necessidade do procedimento" />
            </label>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setProcedureOpen(false)}>Cancelar</button>
              <button className="primary-action" type="submit" disabled={saving === "procedure"}>{saving === "procedure" ? "Enviando..." : "Enviar procedimento"}</button>
            </div>
          </form>
        </div>
      )}

      {deathOpen && (
        <div className="modal-backdrop">
          <form className="workflow-modal animal-action-modal" onSubmit={submitDeath} role="dialog" aria-modal="true">
            <ModalHeader title="Registrar óbito" eyebrow={animal.name || "Animal"} onClose={() => setDeathOpen(false)} />
            <div className="detail-grid compact-detail-grid">
              <p><span>Microchip</span>{animal.microchip || "Não informado"}</p>
              <p><span>Tutor</span>{tutor.tutor_name || tutor.name || "Não informado"}</p>
            </div>
            <label className="field"><span>Data do óbito</span><input type="date" value={deathForm.death_date} onChange={(event) => setDeathForm((current) => ({ ...current, death_date: event.target.value }))} /></label>
            <label className="field"><span>Causa mortis</span><input value={deathForm.death_cause} onChange={(event) => setDeathForm((current) => ({ ...current, death_cause: event.target.value }))} placeholder="Causa informada pelo tutor" /></label>
            <label className="field animal-form-notes"><span>Observações</span><textarea value={deathForm.notes} onChange={(event) => setDeathForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setDeathOpen(false)}>Cancelar</button>
              <button className="primary-action" type="submit" disabled={saving === "death"}>{saving === "death" ? "Enviando..." : "Enviar óbito"}</button>
            </div>
          </form>
        </div>
      )}

      {transferOpen && (
        <div className="modal-backdrop">
          <form className="workflow-modal animal-action-modal" onSubmit={submitTransfer} role="dialog" aria-modal="true">
            <ModalHeader title="Solicitar troca de tutor" eyebrow={animal.name || "Animal"} onClose={() => setTransferOpen(false)} />
            <div className="detail-grid compact-detail-grid">
              <p><span>Microchip</span>{animal.microchip || "Não informado"}</p>
              <p><span>Tutor atual</span>{tutor.tutor_name || tutor.name || "Não informado"}</p>
            </div>
            <label className="field"><span>Novo tutor</span><input value={transferForm.target_tutor_name} onChange={(event) => setTransferForm((current) => ({ ...current, target_tutor_name: event.target.value }))} /></label>
            <label className="field"><span>CPF do novo tutor</span><input value={transferForm.target_tutor_cpf} onChange={(event) => setTransferForm((current) => ({ ...current, target_tutor_cpf: formatCpf(event.target.value) }))} placeholder="000.000.000-00" /></label>
            <div className="two-column-fields">
              <label className="field"><span>Telefone</span><input value={transferForm.target_tutor_phone} onChange={(event) => setTransferForm((current) => ({ ...current, target_tutor_phone: event.target.value }))} /></label>
              <label className="field"><span>Email</span><input value={transferForm.target_tutor_email} onChange={(event) => setTransferForm((current) => ({ ...current, target_tutor_email: event.target.value }))} /></label>
            </div>
            <label className="field animal-form-notes"><span>Motivo</span><textarea value={transferForm.notes} onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setTransferOpen(false)}>Cancelar</button>
              <button className="primary-action" type="submit" disabled={saving === "transfer"}>{saving === "transfer" ? "Enviando..." : "Enviar troca"}</button>
            </div>
          </form>
        </div>
      )}

      {formStatus && <p className={formStatus.includes("enviad") || formStatus.includes("análise") ? "sms-status confirmed" : "helper-text"}>{formStatus}</p>}

      <div className="animal-history">
        <h4>Prontuário do animal</h4>
        {history.length === 0 && <p className="helper-text">Nenhum evento registrado para este microchip.</p>}
        {history.slice(0, 8).map((item, index) => (
          <article className="animal-history-item" key={`${item.source || "history"}-${item.request_id || item.id || index}`}>
            <span>{formatDateTime(item.occurred_at) || "Sem data"}</span>
            <strong>{animalHistoryTitle(item)}</strong>
            {(item.protocol || item.status || item.notes) && (
              <p>{[item.protocol ? `#${item.protocol}` : "", item.status ? statusLabels[item.status] || item.status : "", item.notes].filter(Boolean).join(" · ")}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value || "Não informado"}</strong>
    </div>
  );
}

function animalHistoryTitle(item = {}) {
  const labels = {
    ANIMAL_OBITO: "Registro de óbito",
    TROCA_TUTOR: "Troca de tutor",
    SOLICITACAO_OBITO: "Solicitação de óbito",
    SOLICITACAO_TROCA_TUTOR: "Solicitação de troca de tutor",
    SOLICITACAO_PROCEDIMENTO: "Solicitação de procedimento",
    IMPORTACAO_SOLICITACAO: "Cadastro importado",
    CIRURGIA_REALIZADA: "Cirurgia realizada",
    SOLICITACAO: "Solicitação",
  };
  return labels[item.type] || item.title || item.type || "Evento";
}

function ConfigSectionHeader({ title, createLabel, onCreate, children }) {
  return (
    <div className="config-section-header">
      <h2>{title}</h2>
      <div className="config-section-actions">
        {children}
        {createLabel && (
          <button className="secondary-action" type="button" onClick={onCreate}>
            <Plus size={18} />
            {createLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ConfigStatusFilter({ value, onChange, activeCount = 0, inactiveCount = 0 }) {
  return (
    <div className="config-status-filter">
      <button className={value === "active" ? "selected" : ""} type="button" onClick={() => onChange("active")}>
        Ativos <span>{activeCount}</span>
      </button>
      <button className={value === "inactive" ? "selected" : ""} type="button" onClick={() => onChange("inactive")}>
        Desativados <span>{inactiveCount}</span>
      </button>
    </div>
  );
}

function ConfigActiveToggle({ checked, onChange }) {
  return (
    <label className="toggle-switch config-active-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span>{checked ? "Ativo" : "Desativado"}</span>
    </label>
  );
}

function ConfigCreateRow({ label = "Criar", onClick }) {
  return (
    <div className="config-create-row">
      <button className="secondary-action" type="button" onClick={onClick}>
        <Plus size={18} />
        {label}
      </button>
    </div>
  );
}


function Metric({ title, value, icon: Icon, trend }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {trend && <small>{trend} vs periodo anterior</small>}
      </div>
    </article>
  );
}

function PanelHeader({ title, action, onAction, aside, actionClassName = "ghost-button" }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {aside}
      {action && <button className={actionClassName} type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function ModalHeader({ title, eyebrow, subtitle, onClose, actions }) {
  return (
    <div className="modal-header">
      <div className="modal-header-title">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div className="modal-header-actions">
        {actions}
        {onClose && (
          <button className="modal-header-close" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, className = "" }) {
  return <span className={`status-badge ${status.toLowerCase()} ${className}`.trim()}>{statusLabels[status]}</span>;
}

function Field({ label, value, onChange, placeholder, readOnly = false, invalid = false, type = "text" }) {
  return (
    <label className={invalid ? "field invalid" : "field"}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly || !onChange}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

function YesNoField({ label, value, onChange }) {
  return (
    <div className="yes-no-field">
      <span>{label}</span>
      <div>
        {["Sim", "Nao"].map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "selected" : ""}
            onClick={() => onChange(value === option ? "" : option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompactChoiceField({ label, value, options, onChange, invalid = false }) {
  return (
    <div className={invalid ? "compact-choice-field invalid" : "compact-choice-field"}>
      <span>{label}</span>
      <div>
        {options.map((option) => {
          const optionLabel = typeof option === "string" ? option : option.label;
          const optionTitle = typeof option === "string" ? "" : option.title;
          const optionSubtitle = typeof option === "string" ? "" : option.subtitle;
          return (
          <button
            key={optionLabel}
            type="button"
            title={optionTitle}
            className={value === optionLabel ? "selected" : ""}
            onClick={() => onChange(value === optionLabel ? "" : optionLabel)}
          >
            <span>{optionLabel}</span>
            {optionSubtitle && <small>{optionSubtitle}</small>}
          </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange, onText = "Ativo", offText = "Inativo" }) {
  return (
    <div className="toggle-switch-field">
      <button
        className={checked ? "toggle-switch is-on" : "toggle-switch"}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-switch-knob" />
      </button>
      {label && <span>{label}</span>}
      {label && <strong>{checked ? onText : offText}</strong>}
    </div>
  );
}

function DocumentButtonPicker({ documents, selectedDocuments, onToggle }) {
  return (
    <div className="document-button-field">
      <span>Documentos vinculados</span>
      <div className="document-button-grid">
        {documents.map((document) => {
          const selected = selectedDocuments.some((item) => item.id === document.id);
          return (
            <button
              className={selected ? "document-pill selected" : "document-pill"}
              key={document.id}
              type="button"
              onClick={() => onToggle(document)}
            >
              {document.name || "Documento sem nome"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DocumentScannerUpload({ document, upload, aiActive, onUpload, onRemove }) {
  const statusLabel = {
    checking: aiActive ? "Em análise" : "Conferindo arquivo",
    approved: aiActive ? "Aprovado pela IA" : "Aprovado",
    attached: aiActive ? "Conferência manual" : "Anexado sem IA",
    rejected: aiActive ? "Recusado pela IA" : "Recusado",
  }[upload?.status] || "Aguardando arquivo";
  const conclusionLabel = {
    checking: "Conclusão: análise em andamento.",
    approved: "Conclusão: documento aprovado.",
    attached: aiActive ? "Conclusão: arquivo aceito para conferência manual." : "Conclusão: arquivo anexado.",
    rejected: "Conclusão: documento recusado.",
  }[upload?.status] || "Conclusão: aguardando envio.";
  const confidence = Number(upload?.confidence);
  const showTechnicalDetails = upload?.status === "approved" || upload?.status === "rejected";
  const hasConfidence = showTechnicalDetails && Number.isFinite(confidence);
  const providerLabel = showTechnicalDetails ? [upload?.provider, upload?.model].filter(Boolean).join(" / ") : "";

  return (
    <article className={`document-upload-card scanner-card ${upload?.status || "empty"}`}>
      <div className="document-upload-title">
        <strong>
          {document.name} {document.required && <span>*</span>}
        </strong>
        {document.aiCriteria && <small>Critérios: {document.aiCriteria}</small>}
        {upload?.fileName && <small>{upload.fileName}</small>}
      </div>
      <div className="document-scanner-frame">
        <FileText size={26} />
        {upload?.status === "checking" && <span className="scanner-beam" />}
      </div>
      <div className="document-upload-actions">
        <label className="file-button">
          {upload ? "Substituir" : "Anexar"}
          <input
            type="file"
            accept={(document.accept || []).join(",")}
            onClick={(event) => { event.currentTarget.value = ""; }}
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </label>
        {upload && (
          <button className="ghost-button danger-action" type="button" onClick={onRemove}>
            Excluir
          </button>
        )}
      </div>
      <div className={`document-ai-result ${upload?.status || "empty"}`}>
        <span className="document-result-label">Status: {statusLabel}</span>
        <span>{upload?.message || conclusionLabel}</span>
        {providerLabel && <span>Motor: {providerLabel}</span>}
        {hasConfidence && <span>Confiança: {Math.round(confidence * 100)}%</span>}
      </div>
    </article>
  );
}

async function validateDocumentWithAI(document, file, aiSettings = initialAiSettings, dataUrl = "") {
  const localResult = await validateDocumentLocally(document, file, aiSettings);
  if (localResult.status === "rejected" || !aiSettings.active) return localResult;

  try {
    return await api.validateDocument({
      document: {
        id: document.id,
        name: document.name,
        modelHint: document.modelHint,
        aiCriteria: document.aiCriteria,
        rejectionRules: document.rejectionRules,
      },
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
      },
      aiSettings: {
        active: Boolean(aiSettings.active),
        provider: aiSettings.provider,
        model: aiSettings.model,
        endpoint: aiSettings.endpoint || "",
      },
    });
  } catch (err) {
    console.error("Erro ao validar documento com IA externa:", err);
    return {
      status: "attached",
      message: "Arquivo anexado para conferência manual.",
      confidence: null,
      provider: aiSettings.provider || "IA externa",
      model: aiSettings.model || "",
      error: true,
    };
  }
}

function validateDocumentLocally(document, file, aiSettings = initialAiSettings) {
  return new Promise((resolve) => {
    const safeDocument = normalizeDocumentType(document);
    const maxBytes = safeDocument.maxSizeMb * 1024 * 1024;

    if (!safeDocument.accept.includes(file.type)) {
      resolve({
        status: "rejected",
        message: "Recusado: tipo de arquivo diferente do solicitado.",
        confidence: 0.28,
      });
      return;
    }

    if (file.size > maxBytes) {
      resolve({
        status: "rejected",
        message: `Recusado: arquivo maior que ${safeDocument.maxSizeMb}MB.`,
        confidence: 0.35,
      });
      return;
    }

    if (!aiSettings.active) {
      resolve({
        status: "attached",
        message: "Arquivo anexado. A validação por IA está desativada nas configurações.",
        confidence: 0,
      });
      return;
    }

    resolve({
      status: "attached",
      message: "Arquivo anexado. Aguardando validacao da IA externa.",
      confidence: 0.6,
    });
  });
}


function formatMonthYear(monthYear) {
  const [month, year] = monthYear.split("/");
  const names = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };
  return `${names[month] || month} ${year || ""}`;
}

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeSearchKey(value = "") {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function matchesRequestSearch(request, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const animalNames = request.animals?.map((animal) => animal.name).join(" ") || "";
  const animalMicrochips = getRequestMicrochips(request).join(" ");
  const searchable = [
    request.protocol,
    request.tutor,
    request.cpf,
    request.email,
    request.phone,
    request.status,
    request.responsible,
    request.assignedSectorName,
    request.address,
    animalNames,
    animalMicrochips,
  ];
  const searchableText = searchable.filter(Boolean).join(" ");
  return normalizeText(searchableText).includes(normalizedQuery)
    || normalizeSearchKey(searchableText).includes(normalizeSearchKey(query));
}

function getRequestMicrochips(request = {}) {
  const values = [
    request.animalMicrochip,
    request.animal_microchip,
    ...(request.animals || []).map((animal) => animal.microchip),
  ]
    .filter(Boolean);
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeSearchKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function MicrochipLine({ request }) {
  const microchips = getRequestMicrochips(request);
  if (!microchips.length) return null;
  return <span className="microchip-line">Microchip: {microchips.join(", ")}</span>;
}

function onlyDigits(value = "") {
  return value.replace(/\D/g, "");
}

function formatCpf(value = "") {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCpf(value = "") {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return value || "Nao informado";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

function formatDateTime(value = "") {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || new Date().toLocaleString("pt-BR");
  return date.toLocaleString("pt-BR");
}

function formatCep(value = "") {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}



function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function getDataUrlMimeType(dataUrl = "") {
  const match = String(dataUrl).match(/^data:([^;,]+)[;,]/);
  return match?.[1] || "";
}

function getDocumentPreviewSource(document = {}) {
  const raw = document.dataUrl
    || document.data_url
    || document.previewUrl
    || document.preview_url
    || document.url
    || document.content
    || "";
  if (!raw) return "";
  if (String(raw).startsWith("data:") || String(raw).startsWith("blob:") || String(raw).startsWith("http")) return raw;

  const mimeType = document.fileType || document.type || document.mimeType || "application/pdf";
  return `data:${mimeType};base64,${raw}`;
}

function isRequestDocumentAttachment(document = {}) {
  return document?.documentId?.startsWith?.("requerimento-")
    || document?.documentName === "Requerimento municipal";
}

function getUserUploadedProcessDocuments(documents = []) {
  return (Array.isArray(documents) ? documents : []).filter((document) => !isRequestDocumentAttachment(document));
}

async function prepareProcessDocumentPreview(item, request) {
  if (item.kind === "request") {
    return {
      documentName: "Requerimento municipal",
      fileName: `Requerimento ${request.protocol || ""}.pdf`.trim(),
      fileType: "application/pdf",
      eyebrow: "Requerimento",
      dataUrl: await createRequestPdfDataUrl(request),
    };
  }

  const document = item.document || {};
  const dataUrl = getDocumentPreviewSource(document);
  const fileType = document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl);
  return {
    ...document,
    dataUrl,
    fileType,
    eyebrow: "Anexo",
    documentName: document.documentName || item.tipo || "Documento anexado",
    fileName: document.fileName || item.nome || "documento",
  };
}

const PDF_BASE_STYLES = `
  @page { size: A4; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #172026; margin: 0; font-size: 12px; line-height: 1.4; }
  .pdf-header { background: linear-gradient(135deg, #10364f, #1479b8); color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; gap: 14px; border-radius: 12px; }
  .pdf-header .kicker { color: #b9f3ff; font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; display: block; }
  .pdf-header h1 { margin: 4px 0 0; font-size: 20px; line-height: 1.1; }
  .header-box { border: 1px solid rgba(255,255,255,.3); border-radius: 10px; padding: 8px 12px; text-align: right; align-self: flex-start; min-width: 130px; }
  .header-box span { display: block; color: #b9f3ff; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .header-box strong { display: block; font-size: 16px; }
  .section { display: flex; flex-direction: column; gap: 7px; }
  .section-title { color: #10364f; font-weight: 900; font-size: 12px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ""; width: 6px; height: 18px; border-radius: 999px; background: #38a8e8; flex-shrink: 0; }
  .data-item > span, span.label { color: #5b6b7a; font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; display: block; }
  .data-grid { display: grid; gap: 7px; }
  .data-grid.two { grid-template-columns: repeat(2, 1fr); }
  .data-grid.three { grid-template-columns: repeat(3, 1fr); }
  .data-grid.four { grid-template-columns: repeat(4, 1fr); }
  .data-item { border: 1px solid #dbeaf3; border-radius: 8px; background: #f8fbfd; padding: 7px 10px; }
  .data-item strong { display: block; margin-top: 2px; font-size: 12px; overflow-wrap: anywhere; }
  .animal-card { border: 1px solid #fb923c; border-radius: 10px; background: #fff7ed; padding: 9px 11px; display: flex; flex-direction: column; gap: 7px; }
  .animal-card-title { font-weight: 900; font-size: 12px; color: #c2410c; }
  .declaration-card { border: 1px solid #dbeaf3; border-radius: 12px; padding: 16px; background: #f8fbfd; font-size: 12px; }
  .declaration-card p { margin: 0 0 11px; text-align: justify; }
  .declaration-card p:last-child { margin: 0; }
  .footer { color: #64748b; font-size: 9px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: auto; }
`;

function printHtmlViaIframe(html) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => iframe.remove(), 300);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 30000);
  };
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  try {
    doc.open();
    doc.write(html);
    doc.close();
  } catch {
    iframe.remove();
  }
}

function printAnimalRecordPdf(animal = {}, tutor = {}, history = []) {
  const typeLabels = {
    ANIMAL_OBITO: "Registro de óbito",
    TROCA_TUTOR: "Troca de tutor",
    SOLICITACAO_OBITO: "Solicitação de óbito",
    SOLICITACAO_TROCA_TUTOR: "Solicitação de troca de tutor",
    SOLICITACAO_PROCEDIMENTO: "Solicitação de procedimento",
    IMPORTACAO_SOLICITACAO: "Cadastro importado",
    CIRURGIA_REALIZADA: "Cirurgia realizada",
    SOLICITACAO: "Solicitação",
  };
  const statusLabels = {
    EM_ANALISE: "Em análise",
    AGUARDANDO_CIRURGIA: "Aguardando cirurgia",
    ARQUIVADA: "Arquivada",
  };

  const historyRows = history.length
    ? history.map((item) => {
        const label = typeLabels[item.type] || item.title || item.type || "Evento";
        const detail = [
          item.protocol ? `#${item.protocol}` : "",
          item.status ? (statusLabels[item.status] || item.status) : "",
          item.notes || "",
        ].filter(Boolean).join(" · ");
        const date = item.occurred_at
          ? new Date(item.occurred_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
          : "—";
        return `
          <tr>
            <td>${escapeHtml(date)}</td>
            <td><strong>${escapeHtml(label)}</strong>${detail ? `<br><span class="detail">${escapeHtml(detail)}</span>` : ""}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="2" class="empty-row">Nenhum evento registrado.</td></tr>`;

  const address = [tutor.address, tutor.neighborhood, tutor.city, tutor.state, tutor.cep].filter(Boolean).join(", ");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Prontuário — ${escapeHtml(animal.name || animal.microchip || "Animal")}</title>
    <style>
      ${PDF_BASE_STYLES}
      body { display: flex; flex-direction: column; gap: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #f0f7ff; color: #10364f; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; padding: 6px 10px; text-align: left; border-bottom: 1px solid #dbeaf3; }
      td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      td:first-child { white-space: nowrap; color: #64748b; font-size: 10px; width: 90px; }
      .detail { color: #64748b; font-size: 10px; }
      .empty-row { color: #94a3b8; font-style: italic; text-align: center; }
    </style>
  </head>
  <body>
    <header class="pdf-header">
      <div>
        <span class="kicker">Prontuário Animal</span>
        <h1>${escapeHtml(animal.name || "Animal não identificado")}</h1>
        <span style="font-size:11px;opacity:.8">${[animal.species, animal.sex, animal.size].filter(Boolean).join(" · ")}</span>
      </div>
      <div class="header-box">
        <span>Microchip</span>
        <strong style="font-size:13px">${escapeHtml(animal.microchip || "—")}</strong>
      </div>
    </header>

    <section class="section">
      <div class="section-title">Dados do animal</div>
      <div class="data-grid four">
        <div class="data-item"><span>Espécie</span><strong>${escapeHtml(animal.species || "—")}</strong></div>
        <div class="data-item"><span>Sexo</span><strong>${escapeHtml(animal.sex || "—")}</strong></div>
        <div class="data-item"><span>Porte</span><strong>${escapeHtml(animal.size || "—")}</strong></div>
        <div class="data-item"><span>Raça</span><strong>${escapeHtml(animal.breed || "—")}</strong></div>
        ${animal.color ? `<div class="data-item"><span>Cor / pelagem</span><strong>${escapeHtml(animal.color)}</strong></div>` : ""}
        ${animal.status ? `<div class="data-item"><span>Status</span><strong>${escapeHtml(animal.status)}</strong></div>` : ""}
      </div>
    </section>

    <section class="section">
      <div class="section-title">Dados do tutor</div>
      <div class="data-grid three">
        <div class="data-item"><span>Nome</span><strong>${escapeHtml(tutor.tutor_name || tutor.name || "—")}</strong></div>
        <div class="data-item"><span>CPF</span><strong>${escapeHtml(maskCpf(tutor.cpf || ""))}</strong></div>
        <div class="data-item"><span>Telefone</span><strong>${escapeHtml(tutor.phone || "—")}</strong></div>
        ${tutor.tutor_email || tutor.email ? `<div class="data-item"><span>Email</span><strong>${escapeHtml(tutor.tutor_email || tutor.email)}</strong></div>` : ""}
        ${address ? `<div class="data-item" style="grid-column:1/-1"><span>Endereço</span><strong>${escapeHtml(address)}</strong></div>` : ""}
      </div>
    </section>

    <section class="section">
      <div class="section-title">Histórico / Prontuário</div>
      <table>
        <thead><tr><th>Data</th><th>Evento</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </section>

    <footer class="footer">
      <span>Sistema municipal de castração animal</span>
      <span>Gerado em ${new Date().toLocaleString("pt-BR")}</span>
    </footer>
  </body>
</html>`;
  printHtmlViaIframe(html);
}

function generateRequestPdf(request, options = {}) {
  const animals = request.animals || [];
  const validationKey = request.validationKey || request.validation_key || "";
  const signedAt = request.signedAt || request.signed_at || request.createdAt || request.created_at || new Date().toISOString();
  const maskedCpf = maskCpf(request.cpf || "");
  const fullAddress = [
    [request.address, request.number].filter(Boolean).join(", "),
    request.neighborhood,
    request.city && request.state ? `${request.city}/${request.state}` : (request.city || request.state || ""),
    request.cep ? `CEP ${request.cep}` : "",
  ].filter(Boolean).join(" — ");

  const row = (label, value) => `
    <div class="field">
      <span>${label}</span>
      <strong>${escapeHtml(String(value || "—"))}</strong>
    </div>`;

  const animalBlocks = animals.map((animal, i) => {
    const breed = animal.breedType === "Definida" ? (animal.breedDescription || "Definida") : (animal.breedType || "—");
    return `
    <div class="animal-block">
      <div class="animal-block-title">Animal ${i + 1}${animal.name ? ` — ${escapeHtml(animal.name)}` : ""}</div>
      <div class="fields-row">
        ${row("Espécie", animal.species)}
        ${row("Sexo", animal.sex)}
        ${row("Porte", animal.size)}
        ${row("Nascimento", animal.birthDate || animal.age)}
        ${row("Raça", breed)}
        ${row("Pelagem / cor", animal.coat)}
        ${row("Procedimento", animal.procedure)}
        ${animal.microchip ? row("Microchip", animal.microchip) : ""}
        ${row("Vermifugado", animal.dewormed)}
        ${row("Vacinas em dia", animal.vaccinated)}
        ${row("Já teve cria", animal.hadLitter)}
        ${row("Alimentação", animal.food)}
      </div>
    </div>`;
  }).join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Solicitação ${escapeHtml(request.protocol || "")}</title>
    <style>
      ${PDF_BASE_STYLES}
      body { display: flex; flex-direction: column; gap: 14px; }
      .page { page-break-after: always; display: flex; flex-direction: column; gap: 14px; }
      .page:last-child { page-break-after: auto; }

      .block { display: flex; flex-direction: column; gap: 8px; }
      .block-title {
        font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
        color: #10364f; border-bottom: 1.5px solid #10364f; padding-bottom: 3px;
      }
      .fields-row { display: flex; flex-wrap: wrap; gap: 10px 20px; }
      .field { display: flex; flex-direction: column; gap: 1px; min-width: 100px; }
      .field span { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
      .field strong { font-size: 11px; color: #172026; }
      .field.wide { min-width: 220px; flex: 1; }

      .address-line { font-size: 11px; color: #172026; line-height: 1.5; }

      .animal-block { display: flex; flex-direction: column; gap: 6px; padding: 8px 0 8px 10px; border-left: 3px solid #fb923c; }
      .animal-block-title { font-size: 10px; font-weight: 900; color: #c2410c; }

      .validation-block { background: #f0f9ff; border-left: 3px solid #38a8e8; padding: 10px 14px; display: flex; flex-direction: column; gap: 3px; }
      .validation-block span { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
      .validation-block strong { font-size: 18px; letter-spacing: .1em; color: #0f172a; }
      .validation-block p { margin: 2px 0 0; font-size: 10px; color: #64748b; }

      .declaration-card { font-size: 11px; line-height: 1.7; color: #172026; display: flex; flex-direction: column; gap: 8px; }
      .declaration-card p { margin: 0; text-align: justify; }

      .acceptance-grid { display: flex; flex-wrap: wrap; gap: 10px 20px; }
      .signature-image { width: 100%; max-height: 100px; object-fit: contain; border-top: 1px solid #dbeaf3; padding-top: 8px; margin-top: 4px; }
    </style>
  </head>
  <body>
    <section class="page">
      <header class="pdf-header">
        <div>
          <span class="kicker">Requerimento municipal</span>
          <h1>Solicitação de castração animal</h1>
        </div>
        <div class="header-box">
          <span>Protocolo</span>
          <strong>${escapeHtml(request.protocol || "—")}</strong>
          <span style="margin-top:6px">Abertura</span>
          <strong style="font-size:11px">${escapeHtml(request.createdAt ? new Date(request.createdAt).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR"))}</strong>
        </div>
      </header>

      <div class="block">
        <div class="block-title">Dados do tutor</div>
        <div class="fields-row">
          ${row("Nome completo", request.tutor)}
          ${row("CPF", request.cpf)}
          ${row("CadÚnico", request.cadUnicoNotApplicable ? "Não se aplica" : request.cadUnico)}
          ${row("Celular", request.phone)}
          ${row("Email", request.email)}
          ${row("Agricultor(a)", request.isFarmer ? "Sim" : "Não")}
        </div>
      </div>

      <div class="block">
        <div class="block-title">Endereço</div>
        <p class="address-line">${escapeHtml(fullAddress || "—")}</p>
      </div>

      <div class="block">
        <div class="block-title">Animais (${animals.length})</div>
        ${animalBlocks || "<p style='font-size:11px;color:#64748b'>Nenhum animal informado.</p>"}
      </div>

      <div class="block">
        <div class="block-title">Agendamento</div>
        <div class="fields-row">
          ${row("Data escolhida", request.preferredSchedule || "A confirmar")}
          ${row("Tipo de procedimento", request.type)}
          ${row("Local", request.scheduleLocationName || "A confirmar")}
          ${request.scheduleMunicipality ? row("Município", request.scheduleMunicipality) : ""}
        </div>
      </div>

      <div class="validation-block">
        <span>Chave de validação</span>
        <strong>${escapeHtml(validationKey || "A definir")}</strong>
        <p>Guarde junto com o CPF para consultar suas solicitações e adoções no sistema.</p>
      </div>

      <footer class="footer">
        <span>Sistema municipal de castração animal</span>
        <span>Página 1 de 2</span>
      </footer>
    </section>

    <section class="page">
      <header class="pdf-header">
        <div>
          <span class="kicker">Declaração do tutor</span>
          <h1>Responsabilidade e autorização</h1>
        </div>
        <div class="header-box"><span>Protocolo</span><strong>${escapeHtml(request.protocol || "—")}</strong></div>
      </header>

      <div class="declaration-card">
        <p>Eu, <strong>${escapeHtml(request.tutor || "—")}</strong>, inscrito(a) no CPF <strong>${escapeHtml(maskedCpf || "—")}</strong>, declaro que as informações prestadas neste requerimento são verdadeiras e autorizo o registro dos dados para triagem, agendamento e acompanhamento do procedimento solicitado.</p>
        <p>Declaro ciência dos cuidados pré e pós-cirúrgicos, das responsabilidades de acompanhamento do animal, da necessidade de cumprir as orientações fornecidas pela equipe responsável e de manter os contatos informados disponíveis para comunicações sobre a solicitação.</p>
        <p>Estou ciente de que a solicitação poderá passar por análise documental, validação das informações, confirmação de agenda e eventuais solicitações de complementação antes da realização do atendimento.</p>
      </div>

      <div class="block">
        <div class="block-title">Aceite eletrônico</div>
        <div class="acceptance-grid">
          ${row("Aceite registrado por", request.tutor)}
          ${row("CPF", maskedCpf)}
          ${row("Data / hora", formatDateTime(signedAt))}
          ${row("Método", "Li e aceito")}
        </div>
      </div>

      <footer class="footer">
        <span>Sistema municipal de castração animal</span>
        <span>Página 2 de 2</span>
      </footer>
    </section>
  </body>
</html>`;

  if (options.returnHtml) return html;
  printHtmlViaIframe(html);
  return html;
}

async function generateDocumentBundlePdf(request = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const output = await PDFDocument.create();
  try {
    const requestDataUrl = await createRequestPdfDataUrl(request);
    await appendPdfDataUrl(output, requestDataUrl);
  } catch (error) {
    await appendUnsupportedAttachmentPage(output, {
      title: "Requerimento municipal",
      fileName: `Não foi possível gerar o requerimento do processo ${request.protocol || ""}`.trim(),
      StandardFonts,
      rgb,
    });
  }

  const documents = getUserUploadedProcessDocuments(request.documents);
  for (const document of documents) {
    const dataUrl = getDocumentPreviewSource(document);
    const mimeType = document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl);
    if (!dataUrl) {
      await appendUnsupportedAttachmentPage(output, {
        title: document.documentName || "Documento anexado",
        fileName: document.fileName || "Arquivo sem prévia",
        StandardFonts,
        rgb,
      });
      continue;
    }
    try {
      if (mimeType === "application/pdf") {
        await appendPdfDataUrl(output, dataUrl);
        continue;
      }
      if (mimeType?.startsWith("image/")) {
        await appendImageDataUrl(output, dataUrl, mimeType);
        continue;
      }
    } catch (error) {
      console.warn("Aviso: anexo ignorado na juntada:", error);
    }
    await appendUnsupportedAttachmentPage(output, {
      title: document.documentName || "Documento anexado",
      fileName: document.fileName || "Arquivo sem prévia",
      StandardFonts,
      rgb,
    });
  }

  const bytes = await output.save();
  return {
    documentName: "Juntada do processo",
    fileName: `Juntada ${request.protocol || ""}.pdf`.trim(),
    fileType: "application/pdf",
    eyebrow: "Juntada",
    dataUrl: uint8ArrayToDataUrl(bytes, "application/pdf"),
  };
}

async function generateFallbackBundlePdf(request = {}, error = null) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const output = await PDFDocument.create();
  await appendUnsupportedAttachmentPage(output, {
    title: "Juntada do processo",
    fileName: `Não foi possível preparar a juntada ${request.protocol || ""}`.trim(),
    StandardFonts,
    rgb,
  });
  const bytes = await output.save();
  return {
    documentName: "Juntada do processo",
    fileName: `Juntada ${request.protocol || ""}.pdf`.trim(),
    fileType: "application/pdf",
    eyebrow: "Juntada",
    dataUrl: uint8ArrayToDataUrl(bytes, "application/pdf"),
  };
}

async function createRequestPdfDataUrl(request = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const colors = {
    ink: rgb(0.09, 0.13, 0.15),
    muted: rgb(0.36, 0.43, 0.49),
    blue: rgb(0.08, 0.48, 0.72),
    blueDark: rgb(0.06, 0.21, 0.31),
    blueSoft: rgb(0.94, 0.98, 1),
    line: rgb(0.82, 0.89, 0.93),
    orange: rgb(0.78, 0.25, 0.05),
    orangeSoft: rgb(1, 0.97, 0.91),
    white: rgb(1, 1, 1),
  };
  const ctx = { font, bold, colors, rgb, margin: 40 };
  const pageSize = [595.28, 841.89];
  const validationKey = request.validationKey || request.validation_key || "A definir";
  const animals = Array.isArray(request.animals) ? request.animals : [];
  const signedAt = request.signedAt || request.signed_at || request.createdAt || request.created_at || new Date().toISOString();

  const page1 = pdf.addPage(pageSize);
  let y = drawRequestPdfHeader(page1, "REQUERIMENTO MUNICIPAL", "Solicitação de castração animal", request.protocol || "-", ctx);
  y = drawRequestPdfSectionTitle(page1, "Agendamento", y, ctx);
  y = drawRequestPdfInfoGrid(page1, [
    ["DATA ESCOLHIDA", request.preferredSchedule || "-"],
    ["TIPO", request.type || "-"],
    ["LOCAL", request.scheduleLocationName || "A confirmar"],
    ["ABERTURA", request.createdAt || new Date().toLocaleDateString("pt-BR")],
  ], y, { ...ctx, columns: 4 });
  y = drawRequestPdfSectionTitle(page1, "Dados do tutor", y - 8, ctx);
  const fullAddr = [
    [request.address, request.number].filter(Boolean).join(", "),
    request.neighborhood,
    request.city && request.state ? `${request.city}/${request.state}` : (request.city || request.state || ""),
    request.cep ? `CEP ${request.cep}` : "",
  ].filter(Boolean).join(" - ");
  y = drawRequestPdfInfoGrid(page1, [
    ["NOME", request.tutor || "-"],
    ["CPF", request.cpf || "-"],
    ["CADUNICO", request.cadUnicoNotApplicable ? "Nao se aplica" : request.cadUnico || "-"],
    ["CELULAR", request.phone || "-"],
    ["EMAIL", request.email || "-"],
    ["AGRICULTOR", request.isFarmer ? "Sim" : "Nao"],
    ["ENDEREÇO COMPLETO", fullAddr || "-"],
  ], y, { ...ctx, columns: 3, wideLast: true });
  y = drawRequestPdfSectionTitle(page1, `Animais (${animals.length})`, y - 8, ctx);
  for (const [index, animal] of animals.slice(0, 2).entries()) {
    y = drawRequestPdfAnimalCard(page1, animal, index, y, ctx);
  }
  y = drawRequestPdfSectionTitle(page1, "Validação", y - 6, ctx);
  drawRequestPdfValidationBox(page1, validationKey, y, ctx);
  drawRequestPdfFooter(page1, "Sistema municipal", "Página 1 de 2", ctx);

  const page2 = pdf.addPage(pageSize);
  y = drawRequestPdfHeader(page2, "DECLARAÇÃO DO TUTOR", "Responsabilidade e autorização", request.protocol || "-", ctx);
  y = drawRequestPdfDeclaration(page2, request, y, ctx);
  y = drawRequestPdfSectionTitle(page2, "Aceite eletrônico do tutor", y - 16, ctx);
  y = drawRequestPdfInfoGrid(page2, [
    ["ACEITE REGISTRADO POR", request.tutor || "-"],
    ["CPF", maskCpf(request.cpf || "") || "-"],
    ["DATA/HORA", formatDateTime(signedAt)],
    ["MÉTODO", "Li e aceito"],
  ], y, { ...ctx, columns: 4 });
  drawRequestPdfFooter(page2, "Sistema municipal", "Página 2 de 2", ctx);

  return uint8ArrayToDataUrl(await pdf.save(), "application/pdf");
}

function drawRequestPdfHeader(page, kicker, title, protocol, ctx) {
  const { bold, colors, rgb, margin } = ctx;
  const width = page.getWidth() - margin * 2;
  const y = page.getHeight() - margin - 70;
  page.drawRectangle({ x: margin, y, width, height: 70, color: colors.blueDark });
  page.drawRectangle({ x: margin + width * 0.56, y, width: width * 0.44, height: 70, color: colors.blue });
  page.drawText(pdfText(kicker), { x: margin + 14, y: y + 46, size: 8, font: bold, color: rgb(0.75, 0.95, 1) });
  page.drawText(pdfText(title), { x: margin + 14, y: y + 25, size: 18, font: bold, color: colors.white });
  page.drawRectangle({ x: margin + width - 98, y: y + 14, width: 82, height: 42, color: colors.blue, borderColor: rgb(0.5, 0.75, 0.9), borderWidth: 1 });
  page.drawText("PROTOCOLO", { x: margin + width - 75, y: y + 38, size: 7, font: bold, color: rgb(0.82, 0.96, 1) });
  page.drawText(pdfText(protocol), { x: margin + width - 84, y: y + 20, size: 13, font: bold, color: colors.white });
  return y - 20;
}

function drawRequestPdfSectionTitle(page, title, y, ctx) {
  const { bold, colors, margin } = ctx;
  page.drawRectangle({ x: margin, y: y - 3, width: 5, height: 16, color: colors.blue });
  page.drawText(pdfText(title), { x: margin + 10, y, size: 12, font: bold, color: colors.blueDark });
  return y - 30;
}

function drawRequestPdfInfoGrid(page, items, y, ctx) {
  const { font, bold, colors, rgb, margin, columns = 4, wideLast = false } = ctx;
  const gap = 6;
  const width = page.getWidth() - margin * 2;
  const colWidth = (width - gap * (columns - 1)) / columns;
  let x = margin;
  let rowY = y;
  items.forEach(([label, value], index) => {
    const span = wideLast && index === items.length - 1 ? 3 : 1;
    const boxWidth = colWidth * span + gap * (span - 1);
    if (x + boxWidth > margin + width + 1) {
      x = margin;
      rowY -= 46;
    }
    page.drawRectangle({ x, y: rowY - 33, width: boxWidth, height: 36, color: rgb(0.97, 0.99, 1), borderColor: colors.line, borderWidth: 1 });
    page.drawText(pdfText(label), { x: x + 8, y: rowY - 10, size: 7, font: bold, color: colors.muted });
    page.drawText(pdfText(String(value || "-")).slice(0, 58), { x: x + 8, y: rowY - 24, size: 9, font, color: colors.ink });
    x += boxWidth + gap;
  });
  return rowY - 48;
}

function drawRequestPdfAnimalCard(page, animal = {}, index, y, ctx) {
  const { font, bold, colors, rgb, margin } = ctx;
  const width = page.getWidth() - margin * 2;
  const height = 118;
  page.drawRectangle({ x: margin, y: y - height, width, height, color: colors.orangeSoft, borderColor: rgb(0.98, 0.45, 0.14), borderWidth: 1 });
  page.drawText(pdfText(`Animal ${index + 1} - ${animal.name || "Sem nome"}`), { x: margin + 10, y: y - 18, size: 11, font: bold, color: colors.orange });
  drawRequestPdfInfoGrid(page, [
    ["ESPÉCIE", animal.species || "-"],
    ["SEXO", animal.sex || "-"],
    ["PORTE", animal.size || "-"],
    ["NASCIMENTO", animal.birthDate || animal.age || "-"],
    ["RAÇA", animal.breedType === "Definida" ? (animal.breedDescription || "Definida") : (animal.breedType || "-")],
    ["PELAGEM", animal.coat || "-"],
    ["PROCEDIMENTO", animal.procedure || "-"],
    ["MICROCHIP", animal.microchip || "-"],
    ["VERMIFUGADO", animal.dewormed || "-"],
    ["VACINAS", animal.vaccinated || "-"],
    ["JA TEVE CRIA", animal.hadLitter || "-"],
    ["ALIMENTACAO", animal.food || "-"],
  ], y - 34, { font, bold, colors, rgb, margin: margin + 10, columns: 3 });
  return y - height - 10;
}

function drawRequestPdfValidationBox(page, key, y, ctx) {
  const { font, bold, colors, margin } = ctx;
  const width = page.getWidth() - margin * 2;
  page.drawRectangle({ x: margin, y: y - 54, width, height: 54, color: colors.blueSoft, borderColor: colors.blue, borderWidth: 1 });
  page.drawText("CHAVE DE VALIDAÇÃO", { x: margin + 12, y: y - 16, size: 8, font: bold, color: colors.blue });
  page.drawText(pdfText(key), { x: margin + 12, y: y - 34, size: 15, font: bold, color: colors.ink });
  page.drawText("Guarde junto com o CPF para consultar solicitações e adoções.", { x: margin + 12, y: y - 47, size: 8, font, color: colors.muted });
}

function drawRequestPdfDeclaration(page, request, y, ctx) {
  const { font, colors, rgb, margin } = ctx;
  const width = page.getWidth() - margin * 2;
  const paragraphs = [
    `Eu, ${request.tutor || "-"}, inscrito(a) no CPF ${request.cpf || "-"}, declaro que as informações prestadas neste requerimento são verdadeiras e autorizo o registro dos dados para triagem, agendamento e acompanhamento do procedimento solicitado.`,
    "Declaro ciência dos cuidados pré e pós-cirúrgicos, das responsabilidades de acompanhamento do animal, da necessidade de cumprir as orientações fornecidas pela equipe responsável e de manter os contatos informados disponíveis para comunicações sobre a solicitação.",
    "Estou ciente de que a solicitação poderá passar por análise documental, validação das informações, confirmação de agenda e eventuais solicitações de complementação antes da realização do atendimento.",
  ];
  page.drawRectangle({ x: margin, y: y - 160, width, height: 160, color: rgb(0.97, 0.99, 1), borderColor: colors.line, borderWidth: 1 });
  let textY = y - 24;
  paragraphs.forEach((paragraph) => {
    wrapPdfText(pdfText(paragraph), 95).forEach((line) => {
      page.drawText(line, { x: margin + 14, y: textY, size: 10, font, color: colors.ink });
      textY -= 14;
    });
    textY -= 8;
  });
  return y - 170;
}

async function drawRequestPdfSignatureImage(pdf, page, dataUrl, y, ctx) {
  if (!dataUrl) return;
  const { colors, rgb, margin } = ctx;
  try {
    const mimeType = getDataUrlMimeType(dataUrl);
    const bytes = dataUrlToUint8Array(dataUrl);
    const image = mimeType.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const width = page.getWidth() - margin * 2;
    page.drawRectangle({ x: margin, y, width, height: 90, color: rgb(1, 1, 1), borderColor: colors.line, borderWidth: 1 });
    const scale = Math.min((width - 20) / image.width, 74 / image.height);
    page.drawImage(image, { x: margin + 10, y: y + 8, width: image.width * scale, height: image.height * scale });
  } catch {}
}

function drawRequestPdfFooter(page, left, right, ctx) {
  const { font, colors, rgb, margin } = ctx;
  page.drawLine({ start: { x: margin, y: 32 }, end: { x: page.getWidth() - margin, y: 32 }, thickness: 1, color: rgb(0.89, 0.93, 0.95) });
  page.drawText(pdfText(left), { x: margin, y: 18, size: 8, font, color: colors.muted });
  page.drawText(pdfText(right), { x: page.getWidth() - margin - 60, y: 18, size: 8, font, color: colors.muted });
}

function wrapPdfText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  if (current) lines.push(current);
  return lines;
}

function pdfText(value = "") {
  return String(value).replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "-");
}

async function appendPdfDataUrl(targetPdf, dataUrl) {
  const { PDFDocument } = await import("pdf-lib");
  const sourcePdf = await PDFDocument.load(dataUrlToUint8Array(dataUrl));
  const pages = await targetPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
  pages.forEach((page) => targetPdf.addPage(page));
}

async function appendImageDataUrl(targetPdf, dataUrl, mimeType = "") {
  const bytes = dataUrlToUint8Array(dataUrl);
  const image = mimeType.includes("png")
    ? await targetPdf.embedPng(bytes)
    : await targetPdf.embedJpg(bytes);
  const page = targetPdf.addPage([595.28, 841.89]);
  const margin = 36;
  const availableWidth = page.getWidth() - margin * 2;
  const availableHeight = page.getHeight() - margin * 2;
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: (page.getWidth() - width) / 2,
    y: (page.getHeight() - height) / 2,
    width,
    height,
  });
}

async function appendUnsupportedAttachmentPage(targetPdf, { title, fileName, StandardFonts, rgb }) {
  const page = targetPdf.addPage([595.28, 841.89]);
  const font = await targetPdf.embedFont(StandardFonts.Helvetica);
  page.drawText(pdfText(title).slice(0, 70), { x: 48, y: 780, size: 16, font, color: rgb(0.06, 0.21, 0.31) });
  page.drawText(pdfText(fileName).slice(0, 90), { x: 48, y: 752, size: 11, font, color: rgb(0.25, 0.32, 0.38) });
  page.drawText(pdfText("Arquivo anexado sem prévia compatível para inclusão automática na juntada."), {
    x: 48,
    y: 704,
    size: 11,
    font,
    color: rgb(0.25, 0.32, 0.38),
  });
}

function dataUrlToUint8Array(dataUrl = "") {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToDataUrl(bytes, mimeType = "application/pdf") {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}


function generateReportsPdf(requests = [], filters = {}, series = {}, requestTypes = []) {
  const normalizedRequests = requests.map(normalizeRequest);
  const rows = normalizedRequests.map((request) => `
    <tr>
      <td>${escapeHtml(request.protocol || request.id || "")}</td>
      <td>${escapeHtml(request.tutor || request.tutor_name || "Nao informado")}</td>
      <td>${escapeHtml(getRequestTypeName(request, requestTypes))}</td>
      <td>${escapeHtml(statusLabels[request.status] || request.status || "")}</td>
      <td>${escapeHtml(requestResultLabel(request))}</td>
      <td>${escapeHtml(getRequestUserName(request))}</td>
      <td>${escapeHtml(request.fee || request.billingAmount || "Gratuito")}</td>
    </tr>
  `).join("");
  const buildSummaryRows = (items = []) => (items.length ? items : [{ label: "Sem dados", value: 0 }]).map((item) => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${item.value}</td>
    </tr>
  `).join("");
  const statusRows = buildSummaryRows(series.statusSeries);
  const resultRows = buildSummaryRows(series.resultSeries);
  const typeRows = buildSummaryRows(series.typeSeries);
  const userRows = buildSummaryRows(series.userSeries);
  const feeRows = buildSummaryRows(series.feeSeries);
  const period = [filters.start || "inicio", filters.end || "hoje"].join(" ate ");
  const filterRows = [
    ["Tipo", filters.type || "Todos"],
    ["Status", filters.status ? statusLabels[filters.status] || filters.status : "Todos"],
    ["Usuario", filters.user || "Todos"],
    ["Taxa", filters.fee === "charged" ? "Com taxa" : filters.fee === "free" ? "Gratuitas" : "Todas"],
    ["Busca", filters.search || "Sem busca"],
  ].map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("");
  const html = `
    <html>
      <head>
        <title>Relatorio municipal</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; color: #172026; font-family: Arial, sans-serif; background: #ffffff; }
          .page { min-height: 100vh; padding: 28px; display: grid; gap: 18px; align-content: start; }
          .header { background: #10364f; color: #ffffff; border-radius: 14px; padding: 20px; display: flex; justify-content: space-between; gap: 20px; }
          .header span, th { font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
          h1 { margin: 4px 0 0; font-size: 25px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .card { border: 1px solid #dbeaf3; border-radius: 10px; background: #f8fbfd; padding: 12px; }
          .card span { display: block; color: #5b6b7a; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          .card strong { display: block; margin-top: 5px; font-size: 18px; }
          .tables-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .section-title { margin: 0 0 8px; color: #10364f; font-size: 12px; font-weight: 800; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbeaf3; }
          th, td { padding: 9px 10px; border-bottom: 1px solid #e8f1f5; text-align: left; font-size: 11px; }
          th { background: #e6f5ff; color: #10364f; }
          td:last-child, th:last-child { text-align: right; }
          .records td:nth-child(2), .records th:nth-child(2),
          .records td:nth-child(3), .records th:nth-child(3),
          .records td:nth-child(4), .records th:nth-child(4),
          .records td:nth-child(5), .records th:nth-child(5) { text-align: left; }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="header">
            <div><span>Relatorio municipal</span><h1>Solicitacoes de castracao</h1></div>
            <div><span>Periodo</span><strong>${escapeHtml(period)}</strong></div>
          </header>
          <section class="summary">
            <div class="card"><span>Total</span><strong>${normalizedRequests.length}</strong></div>
            <div class="card"><span>Fila ativa</span><strong>${normalizedRequests.filter((request) => request.status !== "ARQUIVADA").length}</strong></div>
            <div class="card"><span>Compareceu</span><strong>${normalizedRequests.filter((request) => requestHasTag(request, "COMPARECEU")).length}</strong></div>
            <div class="card"><span>Emitido em</span><strong>${new Date().toLocaleDateString("pt-BR")}</strong></div>
          </section>
          <section class="tables-grid">
            <div><p class="section-title">Filtros aplicados</p><table><tbody>${filterRows}</tbody></table></div>
            <div><p class="section-title">Status</p><table><thead><tr><th>Descricao</th><th>Qtd.</th></tr></thead><tbody>${statusRows}</tbody></table></div>
            <div><p class="section-title">Resultado</p><table><thead><tr><th>Descricao</th><th>Qtd.</th></tr></thead><tbody>${resultRows}</tbody></table></div>
            <div><p class="section-title">Tipos</p><table><thead><tr><th>Descricao</th><th>Qtd.</th></tr></thead><tbody>${typeRows}</tbody></table></div>
            <div><p class="section-title">Responsaveis</p><table><thead><tr><th>Descricao</th><th>Qtd.</th></tr></thead><tbody>${userRows}</tbody></table></div>
            <div><p class="section-title">Taxas</p><table><thead><tr><th>Descricao</th><th>Qtd.</th></tr></thead><tbody>${feeRows}</tbody></table></div>
          </section>
          <table class="records">
            <thead><tr><th>Protocolo</th><th>Tutor</th><th>Tipo</th><th>Status</th><th>Resultado</th><th>Usuario</th><th>Taxa</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7">Nenhum registro encontrado</td></tr>'}</tbody>
          </table>
        </main>
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.title = "Relatorio municipal";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => iframe.remove(), 300);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 30000);
  };
  const printDocument = iframe.contentWindow?.document;
  if (!printDocument) {
    iframe.remove();
    return;
  }
  printDocument.open();
  printDocument.write(html);
  printDocument.close();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCurrentScheduleMonthKey() {
  const today = new Date();
  return `${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
}

function getScheduleMonthKey(dateText) {
  const [, month, year] = dateText.split("/");
  return `${month}/${year}`;
}

function parseScheduleDate(dateText) {
  const [day, month, year] = dateText.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function countRequestAnimals(request) {
  return Array.isArray(request.animals) && request.animals.length > 0 ? request.animals.length : 1;
}

function countUsedVacancies(requests, date) {
  return requests
    .map(normalizeRequest)
    .filter((request) => (request.preferredSchedule || request.appointment || request.schedule_date) === date)
    .reduce((sum, request) => sum + countRequestAnimals(request), 0);
}

function isPastScheduleDay(dateText) {
  const date = parseScheduleDate(dateText);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function buildScheduleMonths(days) {
  const monthSet = new Set([getCurrentScheduleMonthKey()]);

  days.forEach((day) => {
    monthSet.add(getScheduleMonthKey(day.date));
  });

  return Array.from(monthSet).sort((left, right) => {
    const [leftMonth, leftYear] = left.split("/").map(Number);
    const [rightMonth, rightYear] = right.split("/").map(Number);
    return leftYear === rightYear ? leftMonth - rightMonth : leftYear - rightYear;
  });
}

function buildMonthCalendarDays(monthKey = getCurrentScheduleMonthKey()) {
  const [month, year] = monthKey.split("/").map(Number);
  if (!month || !year) return [];
  const totalDays = new Date(year, month, 0).getDate();
  const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const offsets = Array.from({ length: firstWeekday }, (_, i) => ({
    day: null,
    date: null,
    weekday: weekdayNames[i],
    offset: true,
  }));

  const days = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, month - 1, day);
    return {
      day,
      date: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
      weekday: weekdayNames[date.getDay()],
    };
  });

  return [...offsets, ...days];
}

function FormSection({ title, action, children }) {
  return (
    <div className="form-section">
      <div className="form-section-header">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}


function Chip({ children }) {
  return <span className="chip">{children}</span>;
}

function DataBarChart({ title, items = [] }) {
  const visibleItems = topItems(items.filter((item) => Number(item.value) > 0), 6);
  const max = Math.max(...visibleItems.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="chart-card data-chart">
      <div className="chart-head">
        <strong>{title}</strong>
        <span>{sumValues(visibleItems)}</span>
      </div>
      <div className="data-bars">
        {visibleItems.length === 0 && <span className="empty-chart-note">Sem dados no período</span>}
        {visibleItems.map((item) => (
          <div className="data-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="data-bar-track">
              <i style={{ width: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%` }} />
            </div>
            <strong>{item.value}</strong>
            {item.secondary && <small>{item.secondary}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataDonutChart({ title, items = [] }) {
  const colors = ["#38a8e8", "#16a34a", "#f97316", "#be185d", "#64748b", "#b7791f"];
  const visibleItems = topItems(items.filter((item) => Number(item.value) > 0), 6);
  const total = sumValues(visibleItems);
  let start = 0;
  const gradient = total
    ? visibleItems.map((item, index) => {
      const size = (Number(item.value || 0) / total) * 100;
      const part = `${colors[index % colors.length]} ${start}% ${start + size}%`;
      start += size;
      return part;
    }).join(", ")
    : "#e2e8f0 0 100%";

  return (
    <div className="chart-card data-chart">
      <div className="chart-head">
        <strong>{title}</strong>
        <span>{total}</span>
      </div>
      <div className="data-donut-wrap">
        <div className="data-donut" style={{ background: `conic-gradient(${gradient})` }}>
          <strong>{total}</strong>
        </div>
        <div className="data-donut-legend">
          {visibleItems.length === 0 && <span className="empty-chart-note">Sem dados no período</span>}
          {visibleItems.map((item, index) => (
            <span key={item.label}>
              <i style={{ background: colors[index % colors.length] }} />
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


function ConfigTile({ icon: Icon, title, text }) {
  return (
    <article className="config-tile">
      <Icon size={22} />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function buildMetrics(requests) {
  const normalizedRequests = requests.map(normalizeRequest);
  return {
    total: normalizedRequests.length,
    pending: normalizedRequests.filter((request) => request.status !== "ARQUIVADA").length,
    done: normalizedRequests.filter((request) => requestHasTag(request, "COMPARECEU")).length,
  };
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(<App />);
