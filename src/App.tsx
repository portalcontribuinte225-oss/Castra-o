import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  Cat,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Download,
  Dog,
  Edit3,
  Eye,
  FileText,
  Filter,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  PawPrint,
  Plus,
  ClipboardList,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Shield,
  UploadCloud,
  User,
  UserCheck,
  Users,
  Building2,
  Mail,
  Phone,
  X,
  Home,
  Paperclip,
  Trash2,
  AlertCircle,
  ImagePlus,
  BadgeCheck,
} from "lucide-react";
import "./styles.css";
import petHeroImage from "./assets/caogato.avif";
import type { AnyRecord } from "./types";
import {
  CONFIG_KEYS,
  CONFIG_KEYS_LIST,
  accessRequesterTypes,
  aiProviderOptions,
  brazilStatesFallback,
  countRequestAnimals,
  countUsedVacancies,
  DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE,
  filterByMunicipalityScope,
  generateScheduleDaysFromRule,
  displayText,
  formatScheduleDate,
  formatSizeRange,
  getItemMunicipalityId,
  getNextUpcomingMutirao,
  hiddenWorkflowTags,
  initialAiSettings,
  initialDocumentTypes,
  initialMunicipalities,
  initialRequestTypes,
  initialScheduleDays,
  initialScheduleRules,
  initialSizes,
  initialSpecies,
  initialTeams,
  initialWhatsappSettings,
  WHATSAPP_TEMPLATE_VARS,
  isPastScheduleDay,
  isRequestOnScheduleDate,
  mergeTags,
  normalizeDocumentType,
  normalizeRequest,
  normalizeRequestStatus,
  normalizeRequestType,
  normalizeScheduleDateText,
  normalizeScheduleDay,
  normalizeScheduleSlots,
  parseScheduleDate,
  requestHasTag,
  requestResultLabel,
  requestResultTag,
  requestTypeDomainLabels,
  requestTypeLabel,
  RequestType,
  statusLabels,
  statuses,
  sumScheduleSlotsVacancies,
  textToCriteriaList,
  triageStatusTone,
  visibleWorkflowTags,
  workflowTagLabels,
} from "./domain";
import {
  buildMetrics,
  getRequestTypeName,
} from "./analytics";
import {
  CompactChoiceField,
  ConfigActiveToggle,
  ConfigSectionHeader,
  ConfigStatusFilter,
  EmptyState,
  Field,
  FormSection,
  InfoTile,
  Metric,
  ModalHeader,
  PanelHeader,
  StatusBadge,
  ToggleChoiceField,
  YesNoField,
  YesNoToggleField,
} from "./components/ui";
import {
  dataUrlToUint8Array,
  escapeHtml,
  formatCep,
  formatCpf,
  formatCpfOrCnpj,
  formatDateTime,
  formatPhone,
  getDataUrlMimeType,
  getDocumentPreviewSource,
  getUserUploadedProcessDocuments,
  isGlobalRole,
  isValidCpf,
  isValidPhone,
  maskCpf,
  normalizeSearchKey,
  normalizeText,
  onlyDigits,
  readFileAsDataUrl,
  uint8ArrayToDataUrl,
} from "./utils";
import { AccessRequestsView, accessStatusLabel } from "./features/accessRequests";
import { AgendaView } from "./features/agenda";
import { useRequestActions } from "./features/request-actions";
import { getSpecialRequestSection, specialRequestConfirmLabel } from "./features/request-analysis-sections";
import { DashboardView } from "./features/dashboard";
import { ReportsView } from "./features/reports";

type ConfigTabItem = {
  id: string;
  label: string;
  globalOnly?: boolean;
  aiSettingsOnly?: boolean;
};

type ConfigSidebarItem = ConfigTabItem & {
  tabs?: ConfigTabItem[];
};

const menu = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "admin", label: "Solicitações", icon: LayoutDashboard },
  { id: "credenciamento", label: "Credenciamentos", icon: ClipboardList },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "adocao", label: "Adoção", icon: HeartHandshake },
  { id: "relatorios", label: "Relatórios", icon: Activity },
  { id: "config", label: "Configurações", icon: Settings },
];

const environmentConfigTabs: ConfigTabItem[] = [
  { id: "agenda", label: "Agenda" },
  { id: "requests", label: "Tipo de Solicitação" },
  { id: "sizes", label: "Portes" },
  { id: "species", label: "Espécies" },
  { id: "documents", label: "Documentos Solicitados" },
];

const integrationsConfigTabs: ConfigTabItem[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "ai_settings", label: "Intelig\u00eancia Artificial", aiSettingsOnly: true },
];

const configSidebarItems: ConfigSidebarItem[] = [
  { id: "environment", label: "Configurar Ambiente", tabs: environmentConfigTabs },
  { id: "municipalities", label: "Dados Gerais" },
  { id: "users", label: "Criar Usuários" },
  { id: "sectors", label: "Criar Setores" },
  { id: "permissions", label: "Permissões" },
  { id: "integrations", label: "Integrações", tabs: integrationsConfigTabs },
];

const permissionMenuItems = menu.map(({ id, label }) => ({ id, label }));

const permissionConfigItems: ConfigTabItem[] = [
  { id: "environment", label: "Configurar Ambiente" },
  { id: "municipalities", label: "Dados Gerais" },
  { id: "users", label: "Criar Usuários" },
  { id: "sectors", label: "Criar Setores" },
  { id: "permissions", label: "Permissões" },
  { id: "whatsapp_settings", label: "Aba WhatsApp" },
  { id: "ai_settings", label: "Configurar IA" },
];

function filterVisibleConfigTabs(tabs: ConfigTabItem[] = [], currentUser: AnyRecord, canUsePermissions: boolean, currentPermissionGroup: AnyRecord): ConfigTabItem[] {
  return tabs.filter((tab) => {
    if (tab.globalOnly && !isGlobalRole(currentUser?.role)) return false;
    if (tab.aiSettingsOnly) {
      if (canUsePermissions) return Boolean(currentPermissionGroup?.allowedConfigItems?.includes("ai_settings"));
      return canManageAiSettings(currentUser?.role);
    }
    if (tab.id === "whatsapp" && canUsePermissions && !currentPermissionGroup?.allowedConfigItems?.includes("whatsapp_settings")) return false;
    return true;
  });
}

function scopeConfigItems(items = [], municipality: AnyRecord = {}) {
  if (!Array.isArray(items)) return [];
  const municipalityId = municipality.id || "";
  const municipalityName = getMunicipalityLabel(municipalityId, [municipality]);
  return items.map((item) => ({
    ...item,
    municipalityId: getItemMunicipalityId(item) || municipalityId,
    municipalityName: item.municipalityName || municipalityName,
    documents: Array.isArray(item.documents)
      ? item.documents.map((document) => ({
        ...document,
        municipalityId: getItemMunicipalityId(document) || municipalityId,
        municipalityName: document.municipalityName || municipalityName,
      }))
      : item.documents,
  }));
}

function mergeScopedConfigItems(current = [], nextItems = [], municipalityId = "") {
  const retained = Array.isArray(current)
    ? current.filter((item) => getItemMunicipalityId(item) !== municipalityId)
    : [];
  return [...retained, ...(Array.isArray(nextItems) ? nextItems : [])];
}

function scopeTenantConfigValue(value, municipalityId = "") {
  if (!municipalityId || value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => ({ ...item, municipalityId: getItemMunicipalityId(item) || municipalityId }));
  }
  if (value && typeof value === "object" && Array.isArray(value.sectors) && Array.isArray(value.users)) {
    return {
      ...value,
      sectors: value.sectors.map((sector) => ({ ...sector, municipalityId: getItemMunicipalityId(sector) || municipalityId })),
      users: value.users.map((user) => ({ ...user, municipalityId: getItemMunicipalityId(user) || municipalityId })),
    };
  }
  return value;
}

function dedupeMunicipalityItems(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const municipalityId = getItemMunicipalityId(item);
    const identity = item.id || item.email || item.name || "";
    const key = `${municipalityId}:${identity}`;
    if (!identity || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function App() {
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
  const [configArea, setConfigArea] = useState("");
  const [configTab, setConfigTab] = useState("agenda");
  const [requests, setRequests] = useState([]);
  const [adoptionAnimals, setAdoptionAnimals] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [speciesOptions, setSpeciesOptions] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [municipalities, setMunicipalities] = useState(initialMunicipalities);
  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [scheduleDays, setScheduleDays] = useState([]);
  const [scheduleRules, setScheduleRules] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [teams, setTeams] = useState(() => normalizeTeams(initialTeams));
  const [accessRequests, setAccessRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState(localStorage.getItem("castragestao:municipalityId") || "");
  const [globalMunicipalityFilterId, setGlobalMunicipalityFilterId] = useState(localStorage.getItem("castragestao:globalMunicipalityFilterId") || "");
  const geoTriedRef = useRef(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [topbarWhatsappQuota, setTopbarWhatsappQuota] = useState<AnyRecord | null>(null);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [tenantConfigReady, setTenantConfigReady] = useState(false);
  const [loadedConfigKeys, setLoadedConfigKeys] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [sidebarResetOpen, setSidebarResetOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarResetPassword, setSidebarResetPassword] = useState("");
  const [sidebarResetConfirm, setSidebarResetConfirm] = useState("");
  const [sidebarResetStatus, setSidebarResetStatus] = useState("");
  const [sidebarResetSaving, setSidebarResetSaving] = useState(false);

  const selected = requests.find((request) => request.id === selectedId) || requests[0] || null;
  const metrics = useMemo(() => buildMetrics(requests), [requests]);
  const quotaMunicipalityId = currentUser
    ? (isGlobalRole(currentUser.role) ? globalMunicipalityFilterId : currentUser.municipalityId || "")
    : "";

  useEffect(() => {
    api.getAdoptions().then((list) => setAdoptionAnimals(list.map(normalizeAdoptionAnimal))).catch(console.error);
    api.getMunicipalities().then((list) => {
      const active = Array.isArray(list) ? list : [];
      setMunicipalities(active);
      if (geoTriedRef.current || !active.length) return;
      geoTriedRef.current = true;
      const stored = localStorage.getItem("castragestao:municipalityId");
      if (stored && active.some((m) => m.id === stored)) {
        setSelectedMunicipalityId(stored);
        return;
      }
      const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      function applyMatch(city, state) {
        if (!city) return false;
        const stateMatch = (m) => !state || !m.state || m.state.toUpperCase() === state;
        const match =
          active.find((m) => normalize(m.name) === city && stateMatch(m)) ||
          active.find((m) => normalize(m.name).includes(city) && stateMatch(m)) ||
          active.find((m) => city.includes(normalize(m.name)) && stateMatch(m));
        if (match) {
          setSelectedMunicipalityId(match.id);
          localStorage.setItem("castragestao:municipalityId", match.id);
          return true;
        }
        return false;
      }
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt`)
              .then((r) => r.json())
              .then((data) => {
                const city = normalize(data.address?.city || data.address?.town || data.address?.municipality || data.address?.county || "");
                const state = (data.address?.state_code || data.address?.["ISO3166-2-lvl4"] || "").replace(/^BR-/, "").toUpperCase().trim();
                if (!applyMatch(city, state)) {
                  fetch("https://ipapi.co/json/")
                    .then((r) => r.json())
                    .then((d) => { if (!d.error) applyMatch(normalize(d.city), (d.region_code || "").toUpperCase()); })
                    .catch(() => {});
                }
              })
              .catch(() => {
                fetch("https://ipapi.co/json/")
                  .then((r) => r.json())
                  .then((d) => { if (!d.error) applyMatch(normalize(d.city), (d.region_code || "").toUpperCase()); })
                  .catch(() => {});
              });
          },
          () => {
            fetch("https://ipapi.co/json/")
              .then((r) => r.json())
              .then((d) => { if (!d.error) applyMatch(normalize(d.city), (d.region_code || "").toUpperCase()); })
              .catch(() => {});
          },
          { timeout: 8000 }
        );
      } else {
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((d) => { if (!d.error) applyMatch(normalize(d.city), (d.region_code || "").toUpperCase()); })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMunicipalityId) return;
    if (municipalities.some((municipality) => municipality.id === selectedMunicipalityId)) return;
    setSelectedMunicipalityId("");
    localStorage.removeItem("castragestao:municipalityId");
  }, [municipalities, selectedMunicipalityId]);

  useEffect(() => {
    if (!globalMunicipalityFilterId) return;
    if (municipalities.some((municipality) => municipality.id === globalMunicipalityFilterId)) return;
    setGlobalMunicipalityFilterId("");
    localStorage.removeItem("castragestao:globalMunicipalityFilterId");
  }, [municipalities, globalMunicipalityFilterId]);

  useEffect(() => {
    if (!currentUser) return;
    setTenantConfigReady(false);
    setLoadedConfigKeys({});
    if (isGlobalRole(currentUser.role)) {
      const loadGlobalMunicipalityConfigs = async () => {
        try {
          const municipalityList = await api.getMunicipalitiesAdmin();
          const activeMunicipalities = Array.isArray(municipalityList) ? municipalityList : [];
          setMunicipalities(activeMunicipalities);
          const configEntries = await Promise.all(activeMunicipalities.map(async (municipality) => {
            const values = await Promise.all(CONFIG_KEYS_LIST.map((key) =>
              api.getConfig(key, municipality.id).then((value) => [key, value]).catch(() => [key, null]),
            ));
            return { municipality, values: Object.fromEntries(values) };
          }));
          setRequestTypes(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.requestTypes], municipality)));
          setDocumentTypes(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.documentTypes], municipality)));
          setSpeciesOptions(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.species], municipality)));
          setSizeOptions(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.sizes], municipality)));
          setTeams({
            sectors: dedupeMunicipalityItems(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.teams]?.sectors, municipality))),
            users: dedupeMunicipalityItems(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.teams]?.users, municipality))),
          });
          setScheduleRules(configEntries.flatMap(({ municipality, values }) => (
            Array.isArray(values[CONFIG_KEYS.scheduleRules])
              ? values[CONFIG_KEYS.scheduleRules].map((rule) => {
                const slots = normalizeScheduleSlots(rule.slots, rule.time, rule.vacancies);
                return {
                  ...rule,
                  municipalityId: rule.municipalityId || municipality.id,
                  municipalityName: rule.municipalityName || getMunicipalityLabel(municipality.id, [municipality]),
                  slots,
                  time: slots[0]?.time || rule.time,
                  vacancies: sumScheduleSlotsVacancies(slots, rule.time, rule.vacancies),
                };
              })
              : []
          )));
          setPermissionGroups(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.permissionGroups], municipality)));
        } finally {
          setTenantConfigReady(true);
        }
      };
      loadGlobalMunicipalityConfigs().catch(console.error);
      return;
    }
    const configLoaders: Array<[string, (value: any) => void]> = [
      [CONFIG_KEYS.requestTypes, setRequestTypes],
      [CONFIG_KEYS.documentTypes, setDocumentTypes],
      [CONFIG_KEYS.species, setSpeciesOptions],
      [CONFIG_KEYS.sizes, setSizeOptions],
      [CONFIG_KEYS.teams, setTeams],
      [CONFIG_KEYS.permissionGroups, setPermissionGroups],
      [CONFIG_KEYS.scheduleRules, (rules) => setScheduleRules((Array.isArray(rules) ? rules : []).map((rule) => {
        const slots = normalizeScheduleSlots(rule.slots, rule.time, rule.vacancies);
        return { ...rule, slots, time: slots[0]?.time || rule.time, vacancies: sumScheduleSlotsVacancies(slots, rule.time, rule.vacancies) };
      }))],
    ];
    Promise.allSettled(configLoaders.map(([key, setter]) =>
      api.getConfig(key).then((value) => {
        if (value !== undefined && value !== null) {
          setter(scopeTenantConfigValue(value, currentUser?.municipalityId || ""));
          setLoadedConfigKeys((current) => ({ ...current, [key]: true }));
        }
      }),
    )).finally(() => setTenantConfigReady(true));
  }, [currentUser?.id, currentUser?.municipalityId]);

  const canPersistTenantConfig = currentUser && tenantConfigReady && !isGlobalRole(currentUser.role);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.requestTypes]) api.setConfig(CONFIG_KEYS.requestTypes, requestTypes).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, requestTypes]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.documentTypes]) api.setConfig(CONFIG_KEYS.documentTypes, documentTypes).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, documentTypes]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.species]) api.setConfig(CONFIG_KEYS.species, speciesOptions).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, speciesOptions]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.sizes]) api.setConfig(CONFIG_KEYS.sizes, sizeOptions).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, sizeOptions]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.teams]) api.setConfig(CONFIG_KEYS.teams, teams).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, teams]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.permissionGroups]) api.setConfig(CONFIG_KEYS.permissionGroups, permissionGroups).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, permissionGroups]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.scheduleRules]) api.setConfig(CONFIG_KEYS.scheduleRules, scheduleRules).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, scheduleRules]);

  const aiConfigMunicipalityId = currentUser
    ? (isGlobalRole(currentUser.role) ? globalMunicipalityFilterId : currentUser.municipalityId || "")
    : selectedMunicipalityId;

  useEffect(() => {
    if (!currentUser && !selectedMunicipalityId) {
      setAiSettings(initialAiSettings);
      return;
    }
    let cancelled = false;
    api.getConfig("ai", aiConfigMunicipalityId).then((saved) => {
      if (cancelled) return;
      const safeSaved = saved && typeof saved === "object" ? saved : {};
      const merged = { ...initialAiSettings, ...safeSaved, active: Boolean(safeSaved.active) };
      const validModels = aiProviderOptions[merged.provider]?.models || [];
      if (validModels.length && !validModels.includes(merged.model)) merged.model = validModels[0];
      setAiSettings(merged);
    }).catch(() => {
      if (!cancelled) setAiSettings(initialAiSettings);
    });
    return () => { cancelled = true; };
  }, [aiConfigMunicipalityId, currentUser?.id, currentUser?.role, selectedMunicipalityId]);

  useEffect(() => {
    if (!currentUser) return;
    function handleInitialLoadError(error) {
      console.error(error);
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("token")) setCurrentUser(null);
    }
    api.getRequests().then((list) => setRequests(list.map(normalizeRequest))).catch(handleInitialLoadError);
    api.getAccessRequests().then((list) => setAccessRequests(list.map(normalizeAccessRequest))).catch(handleInitialLoadError);
    api.getAdoptions().then((list) => setAdoptionAnimals(list.map(normalizeAdoptionAnimal))).catch(handleInitialLoadError);
    const municipalityId = isGlobalRole(currentUser.role) ? "" : currentUser.municipalityId || "";
    api.getSchedule(municipalityId).then((days) => {
      if (!days.length) return;
      setScheduleDays(days.map(normalizeScheduleDay).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date)));
    }).catch(console.error);
    const loadMunicipalities = isGlobalRole(currentUser.role) ? api.getMunicipalitiesAdmin : api.getMunicipalities;
    loadMunicipalities().then((list) => setMunicipalities(Array.isArray(list) ? list : [])).catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    if (currentUser || !selectedMunicipalityId) return;
    api.getAdoptions(selectedMunicipalityId)
      .then((list) => setAdoptionAnimals(list.map(normalizeAdoptionAnimal)))
      .catch(console.error);
  }, [selectedMunicipalityId, currentUser]);

  useEffect(() => {
    if (!currentUser || !quotaMunicipalityId) {
      setTopbarWhatsappQuota(null);
      return;
    }
    let activeRequest = true;
    api.getConfig(CONFIG_KEYS.whatsappQuota, quotaMunicipalityId)
      .then((quota) => {
        if (!activeRequest || !quota?.plan) {
          if (activeRequest) setTopbarWhatsappQuota(null);
          return;
        }
        const period = getCurrentMonthKey();
        const used = quota.currentPeriodStart === period ? Number(quota.currentPeriodUsed || 0) : 0;
        setTopbarWhatsappQuota({
          ...quota,
          used,
          remaining: Math.max(0, Number(quota.plan || 0) - used),
        });
      })
      .catch(() => {
        if (activeRequest) setTopbarWhatsappQuota(null);
      });
    return () => {
      activeRequest = false;
    };
  }, [currentUser?.id, quotaMunicipalityId]);

  async function patchRequest(requestId, patch, historyNote = "") {
    try {
      const updated = await api.patchRequest(requestId, historyNote ? { ...patch, history_note: historyNote } : patch);
      setRequests((current) => current.map((r) => (r.id === updated.id ? normalizeRequest(updated) : r)));
      return updated;
    } catch (err) {
      console.error("Erro ao atualizar solicitação:", err);
      throw err;
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
        municipalityId: payload.municipalityId || payload.municipality_id || currentUser?.municipalityId || "",
        schedule_date: payload.preferredSchedule || payload.schedule_date || "",
        scheduleLocationName: payload.scheduleLocationName || "",
        scheduleAddress: payload.scheduleAddress || "",
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
      throw err;
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

    const createdUserId = updated.createdUserId || updated.created_user_id;
    if (normalized.status === "APROVADO" && createdUserId) {
      const sector = (teams.sectors || []).find(
        (s: AnyRecord) => normalizeText(s.name) === normalizeText(normalized.assignedSector),
      );
      const sectorIds = sector ? [sector.id] : [];
      setTeams((current) => {
        const exists = (current.users || []).some((user) => user.id === createdUserId);
        const entry = {
          id: createdUserId,
          name: normalized.responsibleName || normalized.organizationName || "Usuário",
          email: normalized.email || "",
          sectorIds,
          sectorId: sectorIds[0] || "",
          municipalityId: normalized.municipalityId || currentUser?.municipalityId || "",
          role: normalized.requesterType === "ONG" ? "ong" : "protetor",
          matricula: "",
          cargo: "",
          permissionGroupId: "",
          active: true,
        };
        return {
          ...current,
          users: exists
            ? current.users.map((user) => (user.id === createdUserId ? { ...user, ...entry } : user))
            : [...(current.users || []), entry],
        };
      });
    }

    return normalized;
  }

  function registerCreatedRequest(newRequest, options: AnyRecord = {}) {
    const normalized = normalizeRequest(newRequest);
    setRequests((current) => (
      current.some((request) => request.id === normalized.id)
        ? current.map((request) => (request.id === normalized.id ? normalized : request))
        : [normalized, ...current]
    ));
    if (normalized.id) setSelectedId(normalized.id);
    if (options.openAdmin && canManagePublicAnimalFlows(currentUser?.role)) setActive("admin");
    return normalized;
  }

  function handleMunicipalitySelect(id) {
    setSelectedMunicipalityId(id);
    localStorage.setItem("castragestao:municipalityId", id);
  }

  function closeSidebarReset() {
    setSidebarResetOpen(false);
    setSidebarResetPassword("");
    setSidebarResetConfirm("");
    setSidebarResetStatus("");
    setSidebarResetSaving(false);
  }

  async function submitSidebarReset(event) {
    event.preventDefault();
    if (sidebarResetSaving) return;
    if (sidebarResetPassword.length < 6) {
      setSidebarResetStatus("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (sidebarResetPassword !== sidebarResetConfirm) {
      setSidebarResetStatus("As senhas não conferem.");
      return;
    }
    setSidebarResetSaving(true);
    setSidebarResetStatus("Salvando nova senha...");
    try {
      await api.upsertAuthUser({
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        municipalityId: currentUser.municipalityId || currentUser.municipality_id || "",
        password: sidebarResetPassword,
      });
      setSidebarResetStatus("Senha redefinida com sucesso.");
      setSidebarResetPassword("");
      setSidebarResetConfirm("");
    } catch (err) {
      setSidebarResetStatus(err?.message || "Não foi possível redefinir a senha.");
    } finally {
      setSidebarResetSaving(false);
    }
  }

  function handleGlobalMunicipalityFilter(id) {
    setGlobalMunicipalityFilterId(id);
    if (id) {
      localStorage.setItem("castragestao:globalMunicipalityFilterId", id);
    } else {
      localStorage.removeItem("castragestao:globalMunicipalityFilterId");
    }
    setSelectedId(null);
  }

  function handleInterestSent(updated) {
    setAdoptionAnimals((current) => current.map((a) => a.id === updated.id ? normalizeAdoptionAnimal(updated) : a));
  }

  if (!currentUser) {
    return (
      <>
        <LoginView
          onLogin={setCurrentUser}
          onAccessRequest={createAccessRequest}
          adoptionAnimals={adoptionAnimals}
          onInterestSent={handleInterestSent}
          municipalities={municipalities}
          selectedMunicipalityId={selectedMunicipalityId}
          onMunicipalitySelect={handleMunicipalitySelect}
          createRequest={createRequest}
          requests={requests}
          scheduleDays={scheduleDays}
          requestTypes={requestTypes}
          documentTypes={documentTypes}
          speciesOptions={speciesOptions}
          sizeOptions={sizeOptions}
          aiSettings={aiSettings}
          onRequestCreated={registerCreatedRequest}
        />
        <PwaInstallPrompt />
      </>
    );
  }

  const currentTeamUser = (teams.users || []).find((user) => (
    String(user.id || "") === String(currentUser?.id || "") ||
    String(user.email || "").toLowerCase() === String(currentUser?.email || "").toLowerCase()
  ));
  const currentPermissionGroup = permissionGroups.find((group) => group.id === currentTeamUser?.permissionGroupId && group.active !== false);
  const canUsePermissions = Boolean(currentPermissionGroup && !isGlobalRole(currentUser?.role));
  const visibleMenu = canUsePermissions
    ? menu.filter((item) => currentPermissionGroup.allowedMenuItems?.includes(item.id))
    : menu;
  const visibleEnvironmentTabs = filterVisibleConfigTabs(environmentConfigTabs, currentUser, canUsePermissions, currentPermissionGroup);
  const visibleIntegrationsTabs = filterVisibleConfigTabs(integrationsConfigTabs, currentUser, canUsePermissions, currentPermissionGroup);
  const visibleConfigSidebarItems = configSidebarItems
    .filter((item) => !item.globalOnly || isGlobalRole(currentUser?.role))
    .filter((item) => {
      if (!canUsePermissions) return true;
      if (item.id === "integrations") return visibleIntegrationsTabs.length > 0;
      return currentPermissionGroup.allowedConfigItems?.includes(item.id);
    });
  const activeMunicipalityId = isGlobalRole(currentUser?.role) ? globalMunicipalityFilterId : currentUser?.municipalityId || "";
  const scopedMunicipalityId = activeMunicipalityId;
  const scopedRequests = filterByMunicipalityScope(requests, scopedMunicipalityId);
  const scopedAdoptionAnimals = filterByMunicipalityScope(adoptionAnimals, scopedMunicipalityId);
  const scopedScheduleDays = filterByMunicipalityScope(scheduleDays, scopedMunicipalityId);
  const scopedRequestTypes = filterByMunicipalityScope(requestTypes, scopedMunicipalityId);
  const scopedDocumentTypes = filterByMunicipalityScope(documentTypes, scopedMunicipalityId);
  const scopedSpeciesOptions = filterByMunicipalityScope(speciesOptions, scopedMunicipalityId);
  const scopedSizeOptions = filterByMunicipalityScope(sizeOptions, scopedMunicipalityId);
  const scopedScheduleRules = filterByMunicipalityScope(scheduleRules, scopedMunicipalityId);
  const effectiveScopedScheduleDays = mergeScheduleDaysWithRules(scopedScheduleDays, scopedScheduleRules);
  const scopedPermissionGroups = filterByMunicipalityScope(permissionGroups, scopedMunicipalityId);
  const scopedTeams = {
    sectors: filterByMunicipalityScope(teams.sectors || [], scopedMunicipalityId),
    users: filterByMunicipalityScope(teams.users || [], scopedMunicipalityId),
  };
  const scopedMunicipalities = scopedMunicipalityId
    ? municipalities.filter((municipality) => municipality.id === scopedMunicipalityId)
    : municipalities;
  const scopedSelected = scopedRequests.find((request) => request.id === selectedId) || scopedRequests[0] || null;
  const scopedMetrics = buildMetrics(scopedRequests);

  const ActiveView = {
    admin: AdminDashboard,
    adocao: AdoptionView,
    agenda: AgendaView,
    credenciamento: AccessRequestsView,
    dashboard: DashboardView,
    relatorios: ReportsView,
    config: ConfigView,
  }[active];

  const pageHeadings: Record<string, { title: string; subtitle: string }> = {
    admin: {
      title: "Solicita\u00e7\u00f5es",
      subtitle: "Acompanhe triagem, agenda e atendimento.",
    },
    adocao: {
      title: "Painel de ado\u00e7\u00e3o",
      subtitle: "Acompanhe animais dispon\u00edveis, triagens, ado\u00e7\u00f5es e interessados.",
    },
    agenda: {
      title: "Agenda",
      subtitle: "Organize datas, vagas e visualiza\u00e7\u00f5es do calend\u00e1rio.",
    },
    credenciamento: {
      title: "Credenciamentos",
      subtitle: "Gerencie solicita\u00e7\u00f5es de acesso de organiza\u00e7\u00f5es e respons\u00e1veis.",
    },
    dashboard: {
      title: "Dashboard de gest\u00e3o",
      subtitle: "Leitura geral de solicita\u00e7\u00f5es, agenda, castra\u00e7\u00f5es, ado\u00e7\u00f5es e territ\u00f3rio.",
    },
    relatorios: {
      title: "Relat\u00f3rios",
      subtitle: "Consulte solicita\u00e7\u00f5es, filtros e prontu\u00e1rios por per\u00edodo.",
    },
    config: {
      title: "Configura\u00e7\u00f5es",
      subtitle: "Ajuste ambiente, usu\u00e1rios, permiss\u00f5es e integra\u00e7\u00f5es.",
    },
  };
  const activePageHeading = pageHeadings[active] || {
    title: "Sistema de castra\u00e7\u00e3o",
    subtitle: "Gest\u00e3o operacional de atendimento animal.",
  };

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className={`sidebar${mobileOpen ? " open" : ""}${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="brand">
          {(() => {
            const sideMun = !isGlobalRole(currentUser.role) ? municipalities.find((m) => m.id === currentUser.municipalityId) : null;
            return sideMun?.brasao ? (
              <img src={sideMun.brasao} alt={`Brasão ${sideMun.name}`} className="brand-brasao" />
            ) : (
              <div className="brand-mark"><PawPrint size={20} /></div>
            );
          })()}
          <div className="brand-text">
            <strong>
              {!isGlobalRole(currentUser.role)
                ? municipalities.find((m) => m.id === currentUser.municipalityId)?.name || "Sistema municipal"
                : "Plataforma"}
            </strong>
            {!isGlobalRole(currentUser.role) && municipalities.find((m) => m.id === currentUser.municipalityId)?.department_name && (
              <span className="sidebar-brand-department">
                {municipalities.find((m) => m.id === currentUser.municipalityId)?.department_name}
              </span>
            )}
          </div>
          <button
            className="sidebar-toggle-btn"
            type="button"
            onClick={() => setSidebarCollapsed(v => { const next = !v; localStorage.setItem("sidebar-collapsed", String(next)); return next; })}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            <ChevronLeft size={15} className={`sidebar-toggle-icon${sidebarCollapsed ? " rotated" : ""}`} />
          </button>
        </div>

        <nav aria-label="Menu principal">
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.id}>
                <button
                  className={`${active === item.id ? "active" : ""} ${item.id === "config" ? "sidebar-parent" : ""}`}
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => {
                    if (item.id === "config") {
                      if (active === "config" && configMenuOpen) {
                        setConfigMenuOpen(false);
                        setConfigArea("");
                      } else {
                        setConfigMenuOpen(true);
                      }
                      setActive("config");
                      return;
                    }
                    setConfigMenuOpen(false);
                    setConfigArea("");
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
                    {visibleConfigSidebarItems.map((subitem) => {
                      const subitemTabs = subitem.id === "environment"
                        ? visibleEnvironmentTabs
                        : subitem.id === "integrations"
                          ? visibleIntegrationsTabs
                          : [];
                      const hasTabs = subitemTabs.length > 0;
                      return (
                        <React.Fragment key={subitem.id}>
                          <button
                            className={`config-nav-item${configArea === subitem.id ? " active" : ""}`}
                            type="button"
                            onClick={() => {
                              setActive("config");
                              setConfigArea(configArea === subitem.id ? "" : subitem.id);
                              setMobileOpen(false);
                            }}
                          >
                            <span className="config-nav-dot" />
                            <span className="config-nav-text">
                              <span className="config-nav-label">{subitem.label}</span>
                            </span>
                            {hasTabs && (
                              <ChevronRight size={13} className={`config-nav-chevron${configArea === subitem.id ? " open" : ""}`} />
                            )}
                          </button>
                          {hasTabs && configArea === subitem.id && (
                            <div className="config-nav-children">
                              {subitemTabs.map((tab) => (
                                <button
                                  key={tab.id}
                                  className={`config-nav-child${configTab === tab.id ? " active" : ""}`}
                                  type="button"
                                  onClick={() => { setActive("config"); setConfigArea(subitem.id); setConfigTab(tab.id); setMobileOpen(false); }}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {userMenuOpen && (
            <>
              <button className="sidebar-action-item" type="button" onClick={() => { setSidebarResetOpen(true); setUserMenuOpen(false); }}>
                <KeyRound size={15} />
                <span>Alterar senha</span>
              </button>
              <button className="sidebar-action-item sidebar-action-logout" type="button" onClick={() => setCurrentUser(null)}>
                <LogOut size={15} />
                <span>Sair</span>
              </button>
            </>
          )}
          <button
            className={`sidebar-user-card${userMenuOpen ? " open" : ""}`}
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
          >
            <div className="sidebar-user-avatar">
              <ShieldCheck size={15} />
            </div>
            <div className="sidebar-user-info">
              <strong>{currentUser.name || "Usuário"}</strong>
              <span>{userRoleLabel(currentUser.role)}</span>
            </div>
            <ChevronDown size={14} className={userMenuOpen ? "sidebar-chevron open" : "sidebar-chevron"} />
          </button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div className="main-reader">
            <div className="topbar-page-heading">
              <h1>{activePageHeading.title}</h1>
              <p>{activePageHeading.subtitle}</p>
            </div>
          </div>
          <div className="topbar-actions">
            {isGlobalRole(currentUser?.role) && municipalities.length > 0 && (
              <label className="topbar-municipality-filter" aria-label="Filtrar município">
                <MapPin size={18} />
                <select value={globalMunicipalityFilterId} onChange={(event) => handleGlobalMunicipalityFilter(event.target.value)}>
                  <option value="">Todos os municípios</option>
                  {municipalities.map((municipality) => (
                    <option key={municipality.id} value={municipality.id}>
                      {[municipality.name, municipality.state].filter(Boolean).join("/")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="topbar-search" aria-label="Buscar no sistema">
              <Search size={20} />
              <input
                type="search"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Protocolo, CPF, tutor, microchip..."
              />
            </label>
            {topbarWhatsappQuota && (
              <div
                className="topbar-whatsapp-quota"
                title={`${topbarWhatsappQuota.remaining} de ${topbarWhatsappQuota.plan} mensagens WhatsApp restantes neste mês`}
                aria-label={`${topbarWhatsappQuota.remaining} mensagens WhatsApp restantes neste mês`}
              >
                <MessageCircle size={18} />
                <strong>{topbarWhatsappQuota.remaining}</strong>
              </div>
            )}
            <button className="icon-button" aria-label="Notificações">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <ActiveView
          requests={scopedRequests}
          selected={scopedSelected}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          metrics={scopedMetrics}
          patchRequest={patchRequest}
          createRequest={createRequest}
          adoptionAnimals={scopedAdoptionAnimals}
          setAdoptionAnimals={setAdoptionAnimals}
          currentUser={currentUser}
          scheduleDays={effectiveScopedScheduleDays}
          requestTypes={scopedRequestTypes}
          documentTypes={scopedDocumentTypes}
          setRequestTypes={setRequestTypes}
          setDocumentTypes={setDocumentTypes}
          speciesOptions={scopedSpeciesOptions}
          setSpeciesOptions={setSpeciesOptions}
          sizeOptions={scopedSizeOptions}
          setSizeOptions={setSizeOptions}
          municipalities={scopedMunicipalities}
          setMunicipalities={setMunicipalities}
          aiSettings={aiSettings}
          setAiSettings={setAiSettings}
          setScheduleDays={setScheduleDays}
          scheduleRules={scopedScheduleRules}
          setScheduleRules={setScheduleRules}
          permissionGroups={scopedPermissionGroups}
          setPermissionGroups={setPermissionGroups}
          teams={scopedTeams}
          setTeams={setTeams}
          accessRequests={accessRequests}
          reviewAccessRequest={reviewAccessRequest}
          setActive={setActive}
          configArea={configArea}
          configTab={configTab}
          setConfigTab={setConfigTab}
          environmentTabs={visibleEnvironmentTabs}
          integrationsTabs={visibleIntegrationsTabs}
          globalSearch={globalSearch}
          selectedMunicipalityId={activeMunicipalityId}
          onConsultAnimal={(query: AnyRecord) => api.consultAnimalByMicrochip(query)}
          onGenerateProntuario={generateAndDownloadProntuario}
        />
      </main>

      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {[menu[0], menu[1], menu[3], menu[5]].map((item) => {
          const Icon = item.icon;
          const shortLabels: Record<string, string> = {
            dashboard: "Dashboard",
            admin: "Solicitações",
            adocao: "Adoção",
            config: "Config",
          };
          return (
            <button
              key={item.id}
              className={active === item.id ? "active" : ""}
              onClick={() => { setActive(item.id); setMobileOpen(false); }}
              aria-label={item.label}
              type="button"
            >
              <Icon size={22} />
              <span>{shortLabels[item.id] ?? item.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Mais opções">
          <Menu size={22} />
          <span>Menu</span>
        </button>
      </nav>

      {sidebarResetOpen && (
        <div className="modal-backdrop">
          <form className="workflow-modal reset-form" onSubmit={submitSidebarReset} role="dialog" aria-modal="true">
            <ModalHeader title="Redefinir senha" subtitle={currentUser.email || currentUser.name} onClose={closeSidebarReset} icon={KeyRound} />
            <label className="field">
              <span>Nova senha</span>
              <input
                type="password"
                value={sidebarResetPassword}
                onChange={(event) => setSidebarResetPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Confirmar nova senha</span>
              <input
                type="password"
                value={sidebarResetConfirm}
                onChange={(event) => setSidebarResetConfirm(event.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
            </label>
            {sidebarResetStatus && <p className={sidebarResetStatus.includes("sucesso") ? "form-success" : "form-error"}>{sidebarResetStatus}</p>}
            <div className="reset-form-actions">
              <button className="ghost-button" type="button" onClick={closeSidebarReset}>Cancelar</button>
              <button className="primary-action" type="submit" disabled={sidebarResetSaving}>
                {sidebarResetSaving ? "Salvando..." : "Redefinir senha"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function normalizeTeams(value = initialTeams) {
  const sectors = Array.isArray(value.sectors) ? value.sectors : [];
  const users = Array.isArray(value.users) ? value.users.map((user) => {
    const sectorIds = getUserSectorIds(user);
    return { ...user, sectorIds, sectorId: user.sectorId || sectorIds[0] || "", municipalityId: user.municipalityId || user.municipality_id || "" };
  }) : [];
  return { sectors, users };
}

function getUserSectorIds(user: AnyRecord = {}) {
  const ids = Array.isArray(user.sectorIds) ? user.sectorIds : [];
  return [...new Set([...ids, user.sectorId].filter(Boolean))];
}

function userBelongsToSector(user: AnyRecord = {}, sectorId = "") {
  return Boolean(sectorId && getUserSectorIds(user).includes(sectorId));
}

function getUserSectorNames(user: AnyRecord = {}, sectors = []) {
  const userMunicipalityId = getItemMunicipalityId(user);
  const names = getUserSectorIds(user)
    .map((sectorId) => sectors.find((sector) => (
      sector.id === sectorId
      && (!userMunicipalityId || getItemMunicipalityId(sector) === userMunicipalityId)
    ))?.name)
    .filter(Boolean);
  return names.length ? [...new Set(names)].join(", ") : "Sem setor";
}

function getMunicipalityLabel(municipalityId = "", municipalities = []) {
  const municipality = municipalities.find((item) => item.id === municipalityId);
  return municipality ? [municipality.name, municipality.state].filter(Boolean).join("/") : "Sem município";
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultMunicipalityUserToTeamUser(user: AnyRecord = {}, municipalityId = "") {
  return {
    id: user.id || `usuario_padrao_${municipalityId}`,
    name: user.name || "Administrador municipal",
    email: user.email || "",
    defaultMunicipalityUser: true,
    sectorIds: Array.isArray(user.sectorIds) ? user.sectorIds : [],
    sectorId: user.sectorId || user.sectorIds?.[0] || "",
    municipalityId: user.municipality_id || user.municipalityId || municipalityId,
    role: "admin_municipal",
    matricula: "",
    cargo: "Administrador municipal",
    active: true,
  };
}

function normalizeAccessRequest(item: AnyRecord = {}): AnyRecord {
  const requesterType = item.requesterType || item.requester_type || "";
  const type = accessRequesterTypes.find((option) => option.id === requesterType);
  return {
    ...item,
    requesterType,
    requesterLabel: type?.label || requesterType || "Solicitante",
    organizationName: item.organizationName || item.organization_name || "",
    responsibleName: item.responsibleName || item.responsible_name || "",
    municipalityId: item.municipalityId || item.municipality_id || "",
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
    master: "Master",
    suporte: "Suporte",
    admin_municipal: "Administrador municipal",
    analista: "Analista",
    tutor: "Tutor",
    ong: "ONG",
    protetor: "Protetor",
    servidor_publico: "Servidor público",
  }[role] || role || "Usuário";
}

function canManageAiSettings(role = "") {
  return isGlobalRole(role) || normalizeText(role) === "admin_municipal";
}

function canManagePublicAnimalFlows(role = "") {
  return [
    "master",
    "suporte",
    "admin_municipal",
    "coordenador",
    "triagem",
    "analista",
    "agendador",
    "veterinario",
    "adocao",
    "auditor",
    "ong",
    "protetor",
    "servidor publico",
    "servidor_publico",
  ].includes(normalizeText(role));
}

const ADOPTION_STATUS_LABEL = { disponivel: "Disponível", em_processo: "Em processo", adotado: "Adotado" };

const publicHomeServices = [
  { id: "prontuario", label: "Consultar prontuário", icon: PawPrint },
  { id: "procedure_form", label: "Solicitar procedimento", icon: ClipboardCheck },
  { id: "transfer", label: "Trocar tutor", icon: RefreshCw },
  { id: "death", label: "Registrar óbito", icon: AlertCircle, danger: true },
  { id: "credential", label: "Credenciamento", icon: Shield },
  { id: "report", label: "Denunciar", icon: AlertCircle, danger: true },
];

function resolveConfiguredDocument(document: AnyRecord = {}, documentTypes: AnyRecord[] = []): AnyRecord {
  const documentMunicipalityId = getItemMunicipalityId(document);
  const configured = (Array.isArray(documentTypes) ? documentTypes : []).find((item) => (
    item.id === document.id
    && (!documentMunicipalityId || getItemMunicipalityId(item) === documentMunicipalityId)
  ));
  return configured ? { ...document, ...configured } : document;
}
function parseConfigDate(value: any): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const text = String(value || "").trim();
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*(\d{2}):(\d{2}))?/);
  if (brMatch) {
    const [, day, month, year, hour = "0", minute = "0"] = brMatch;
    const time = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? time : 0;
}

function wasDocumentConfiguredForRequest(document: AnyRecord = {}, request: AnyRecord = {}): boolean {
  const requestCreatedAt = parseConfigDate(request.createdAt || request.created_at);
  const documentCreatedAt = parseConfigDate(document.createdAt || document.created_at);
  return !requestCreatedAt || !documentCreatedAt || documentCreatedAt <= requestCreatedAt;
}

function ValidationKeyConsultation({ fallbackRequests = [], currentUser, onRequestCreated, onRequestProcedure, municipalityId, initialService = null, onCloseService }: AnyRecord) {
  const [microchip, setMicrochip] = useState("");
  const [cpf, setCpf] = useState(formatCpf(currentUser?.cpf || ""));
  const [validationKey, setValidationKey] = useState("");
  const [resultRequests, setResultRequests] = useState(null);
  const [resultAdoptions, setResultAdoptions] = useState([]);
  const [animalRecord, setAnimalRecord] = useState(null);
  const [status, setStatus] = useState("");
  const [searchOk, setSearchOk] = useState(false);
  const [isConsulting, setIsConsulting] = useState(false);
  const [activeServiceModal, setActiveServiceModal] = useState<string | null>(initialService);
  const [svcStep, setSvcStep] = useState(1);
  const [svcIdForm, setSvcIdForm] = useState({ microchip: "", cpf: "", key: "" });
  const [svcFoundTutor, setSvcFoundTutor] = useState<any>(null);
  const [svcFoundAnimal, setSvcFoundAnimal] = useState<any>(null);
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcError, setSvcError] = useState("");
  const [svcResult, setSvcResult] = useState("");
  const [svcTransferForm, setSvcTransferForm] = useState({
    targetName: "",
    targetCpf: "",
    targetPhone: "",
    targetEmail: "",
    targetCep: "",
    targetAddress: "",
    targetNeighborhood: "",
    targetCity: "",
    targetState: "",
    notes: "",
  });
  const [svcDeathForm, setSvcDeathForm] = useState({ date: "", cause: "", notes: "" });
  const [svcSaving, setSvcSaving] = useState(false);

  useEffect(() => {
    setActiveServiceModal(initialService);
    setSvcStep(1);
    setSvcError("");
    setSvcResult("");
  }, [initialService]);

  function closeActiveService() {
    setActiveServiceModal(null);
    onCloseService?.();
  }

  const hasSearched = resultRequests !== null;
  const visibleRequests = hasSearched ? resultRequests : fallbackRequests;
  const normalizedVisibleRequests = (Array.isArray(visibleRequests) ? visibleRequests : []).map(normalizeRequest);
  const activeRequestsCount = normalizedVisibleRequests.filter((request) => request.status === "NOVA" || request.status === "AGENDADA").length;
  const nextRequest = normalizedVisibleRequests.find((request) => request.status === "AGENDADA" && (request.appointment || request.preferredSchedule));
  const nextAppointment = nextRequest ? nextRequest.appointment || nextRequest.preferredSchedule : "Nenhum";

  async function consult(event) {
    event.preventDefault();
    const cleanCpf = onlyDigits(cpf);
    const key = validationKey.trim();
    const chip = microchip.trim();
    const hasValidCredential = cleanCpf.length === 11 && !/^0+$/.test(cleanCpf) && Boolean(key);
    if (!chip && cleanCpf.length !== 11) {
      setStatus("Informe um CPF válido.");
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
            api.consultRequestsByCredentials(cleanCpf, key, municipalityId),
            api.consultAdoptionsByCredentials(cleanCpf, key, municipalityId),
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

  function openService(type: string) {
    setActiveServiceModal(type);
    setSvcError("");
    setSvcResult("");
    setSvcSaving(false);
    setSvcTransferForm({ targetName: "", targetCpf: "", targetPhone: "", targetEmail: "", targetCep: "", targetAddress: "", targetNeighborhood: "", targetCity: "", targetState: "", notes: "" });
    setSvcDeathForm({ date: "", cause: "", notes: "" });

    const alreadyIdentified = type !== "prontuario" && animalRecord?.animal && cpf && validationKey;
    if (type === "procedure") {
      const latestReq = Array.isArray(resultRequests) && resultRequests.length > 0 ? resultRequests[0] : null;
      onRequestProcedure?.({ tutor: latestReq || { cpf, tutor_name: "" }, animal: alreadyIdentified ? animalRecord.animal : null });
      closeActiveService();
      return;
    }

    if (alreadyIdentified) {
      const latestReq = Array.isArray(resultRequests) && resultRequests.length > 0 ? resultRequests[0] : null;
      setSvcFoundTutor(latestReq || { cpf, tutor_name: "" });
      setSvcFoundAnimal(animalRecord.animal);
      setSvcStep(2);
    } else {
      setSvcStep(1);
      const preChip = (type === "transfer" || type === "death") && animalRecord?.animal?.microchip
        ? animalRecord.animal.microchip : "";
      setSvcIdForm({ microchip: preChip, cpf: "", key: "" });
      setSvcFoundTutor(null);
      setSvcFoundAnimal(null);
    }
  }

  async function handleServiceIdentify(event) {
    event.preventDefault();
    setSvcError("");
    setSvcLoading(true);
    try {
      if (activeServiceModal === "prontuario") {
        const chip = svcIdForm.microchip.trim();
        const cleanCpf = onlyDigits(svcIdForm.cpf);
        const key = svcIdForm.key.trim();
        if (!chip && cleanCpf.length !== 11) { setSvcError("Informe o microchip do animal ou o CPF do tutor."); return; }
        if (cleanCpf.length === 11 && !key) { setSvcError("Informe a chave de validação junto com o CPF."); return; }
        const hasCredentials = cleanCpf.length === 11 && Boolean(key);
        const [record, reqList] = await Promise.all([
          chip ? api.consultAnimalByMicrochip({ microchip: chip, ...(hasCredentials ? { cpf: cleanCpf, validationKey: key } : {}) }) : Promise.resolve(null),
          hasCredentials ? api.consultRequestsByCredentials(cleanCpf, key, municipalityId) : Promise.resolve([]),
        ]);
        setCpf(hasCredentials ? svcIdForm.cpf : "");
        setValidationKey(key);
        setAnimalRecord(record);
        setResultRequests(Array.isArray(reqList) ? reqList.map(normalizeRequest) : []);
        setSearchOk(Boolean(record?.animal) || (Array.isArray(reqList) && reqList.length > 0));
        setActiveServiceModal(null);
        return;
      }
      if (activeServiceModal === "transfer" || activeServiceModal === "death") {
        const chip = svcIdForm.microchip.trim();
        if (!chip) { setSvcError("Informe o microchip do animal."); return; }
        const animalResult = await api.consultAnimalByMicrochip({ microchip: chip });
        if (!animalResult?.animal) { setSvcError("Animal não encontrado para este microchip."); return; }
        setSvcFoundAnimal(animalResult.animal);
        setSvcFoundTutor(animalResult.tutor || null);
        setSvcStep(2);
        return;
      }
      const cleanCpf = onlyDigits(svcIdForm.cpf);
      const key = svcIdForm.key.trim();
      if (cleanCpf.length !== 11) { setSvcError("Informe um CPF válido."); return; }
      if (!key) { setSvcError("Informe a chave de validação."); return; }
      const reqs = await api.consultRequestsByCredentials(cleanCpf, key, municipalityId);
      const latestReq = Array.isArray(reqs) && reqs.length > 0 ? reqs[0] : null;
      setSvcFoundTutor(latestReq || { cpf: cleanCpf });
      setSvcStep(2);
    } catch (err: any) {
      setSvcError(err.message || "Erro ao identificar. Verifique seus dados.");
    } finally {
      setSvcLoading(false);
    }
  }

  async function lookupTransferCep(value: string) {
    const cleanCep = onlyDigits(value);
    const maskedCep = formatCep(value);
    setSvcTransferForm((f) => ({ ...f, targetCep: maskedCep }));

    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return;
      setSvcTransferForm((f) => ({
        ...f,
        targetCep: maskedCep,
        targetAddress: data.logradouro || f.targetAddress,
        targetNeighborhood: data.bairro || f.targetNeighborhood,
        targetCity: data.localidade || f.targetCity,
        targetState: data.uf || f.targetState,
      }));
    } catch {
      // Falha na consulta de CEP não bloqueia o preenchimento manual
    }
  }

  async function submitServiceTransfer(event) {
    event.preventDefault();
    if (!svcTransferForm.targetName.trim() || onlyDigits(svcTransferForm.targetCpf).length !== 11) { setSvcError("Informe nome e CPF válido do novo tutor."); return; }
    try {
      setSvcSaving(true);
      const created = await api.createAnimalTransferRequest((svcFoundAnimal || {}).id, {
        target_tutor_name: svcTransferForm.targetName,
        target_tutor_cpf: onlyDigits(svcTransferForm.targetCpf),
        target_tutor_phone: svcTransferForm.targetPhone,
        target_tutor_email: svcTransferForm.targetEmail,
        target_tutor_cep: svcTransferForm.targetCep,
        target_tutor_address: svcTransferForm.targetAddress,
        target_tutor_neighborhood: svcTransferForm.targetNeighborhood,
        target_tutor_city: svcTransferForm.targetCity,
        target_tutor_state: svcTransferForm.targetState,
        notes: svcTransferForm.notes,
        cpf: svcFoundTutor?.cpf || "",
        municipalityId,
      });
      setSvcResult("Solicitação de troca enviada para análise.");
      onRequestCreated?.(created, { openAdmin: true });
    } catch (err: any) {
      setSvcError(err.message || "Não foi possível solicitar a troca.");
    } finally {
      setSvcSaving(false);
    }
  }

  async function submitServiceDeath(event) {
    event.preventDefault();
    if (!svcDeathForm.date || !svcDeathForm.cause.trim()) { setSvcError("Informe data e causa do óbito."); return; }
    try {
      setSvcSaving(true);
      const created = await api.createAnimalDeathRequest((svcFoundAnimal || {}).id, {
        death_date: svcDeathForm.date,
        death_cause: svcDeathForm.cause,
        notes: svcDeathForm.notes,
        cpf: svcFoundTutor?.cpf || "",
        municipalityId,
      });
      setSvcResult("Registro de óbito enviado para análise.");
      onRequestCreated?.(created, { openAdmin: true });
    } catch (err: any) {
      setSvcError(err.message || "Não foi possível registrar o óbito.");
    } finally {
      setSvcSaving(false);
    }
  }

  return (
    <div className="cons-shell cons-shell--embedded">
      <div className="cons-results cons-results--embedded">
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

        {hasSearched && normalizedVisibleRequests.length > 0 && (
          <TutorDashboard
            requests={normalizedVisibleRequests}
            setActive={() => {}}
            currentUser={currentUser}
            compact
            cpf={onlyDigits(cpf)}
            validationKey={validationKey.trim()}
            animalRecord={animalRecord}
            onRequestCreated={(request) => {
              const normalized = onRequestCreated?.(request, { openAdmin: true }) || normalizeRequest(request);
              setResultRequests((current) => (
                Array.isArray(current) && current.some((item) => item.id === normalized.id)
                  ? current.map((item) => (item.id === normalized.id ? normalized : item))
                  : [normalized, ...(Array.isArray(current) ? current : [])]
              ));
            }}
          />
        )}
      </div>

      {activeServiceModal && (() => {
        const isPront    = activeServiceModal === "prontuario";
        const isTransfer = activeServiceModal === "transfer";
        const isDeath    = activeServiceModal === "death";

        const identifiedSubtitle = isTransfer
          ? `Tutor atual: ${svcFoundTutor?.tutor_name || "identificado"}${svcFoundAnimal ? ` · ${svcFoundAnimal.name || svcFoundAnimal.microchip}` : ""}`
          : `Animal: ${svcFoundAnimal?.name || "identificado"} · Tutor: ${svcFoundTutor?.tutor_name || "identificado"}`;

        const onSubmit = svcStep === 1 ? handleServiceIdentify
          : isTransfer ? submitServiceTransfer
          : submitServiceDeath;

        const primaryLabel = svcStep === 1
          ? (isPront ? (svcLoading ? "Consultando..." : "Consultar") : (svcLoading ? "Identificando..." : "Identificar"))
          : (isTransfer ? (svcSaving ? "Enviando..." : "Solicitar troca") : (svcSaving ? "Enviando..." : "Confirmar óbito"));

        const isDestructive = isDeath && svcStep === 2;

        return (
          <div className="svc-inline-shell">
            <form className="svc-modal svc-panel--inline" onSubmit={onSubmit} role="region">

              {/* ── Body ── */}
              <div className="svc-modal-body">
                {!svcResult && svcStep === 2 && (isTransfer || isDeath) && (
                  <p className="svc-step-context">{identifiedSubtitle}</p>
                )}
                {svcResult ? (
                  <>
                    <p className="sms-status confirmed">{svcResult}</p>
                    <div className="svc-modal-footer">
                      <button type="button" className="primary-action" onClick={closeActiveService}>Voltar ao início</button>
                    </div>
                  </>
                ) : svcStep === 1 ? (
                  <>
                    {isPront ? (
                      <div className="svc-grid-3">
                        <label className="field svc-field">
                          <span>Microchip do animal</span>
                          <input autoFocus value={svcIdForm.microchip} onChange={(e) => setSvcIdForm((f) => ({ ...f, microchip: e.target.value }))} placeholder="Número do microchip" />
                        </label>
                        <label className="field svc-field">
                          <span>CPF do tutor</span>
                          <input value={svcIdForm.cpf} onChange={(e) => setSvcIdForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))} placeholder="000.000.000-00" />
                        </label>
                        <label className="field svc-field">
                          <span>Chave de validação</span>
                          <input value={svcIdForm.key} onChange={(e) => setSvcIdForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))} placeholder="Cole ou digite sua chave" />
                        </label>
                      </div>
                    ) : (
                      <div className="svc-grid-3">
                        <label className="field svc-field">
                          <span>Microchip do animal</span>
                          <input autoFocus value={svcIdForm.microchip} onChange={(e) => setSvcIdForm((f) => ({ ...f, microchip: e.target.value }))} placeholder="Número do microchip" />
                        </label>
                      </div>
                    )}
                  </>
                ) : isTransfer ? (
                  <>
                    <div className="form-sub-card">
                      <span className="form-sub-card-title">Novo tutor</span>
                      <div className="svc-grid-2">
                        <label className="field svc-field">
                          <span>Nome</span>
                          <input value={svcTransferForm.targetName} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetName: e.target.value }))} />
                        </label>
                        <label className="field svc-field">
                          <span>CPF</span>
                          <input value={svcTransferForm.targetCpf} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetCpf: formatCpf(e.target.value) }))} placeholder="000.000.000-00" />
                        </label>
                      </div>
                      <div className="svc-grid-2">
                        <label className="field svc-field">
                          <span>Email</span>
                          <input type="email" value={svcTransferForm.targetEmail} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetEmail: e.target.value }))} />
                        </label>
                        <label className="field svc-field">
                          <span>Telefone</span>
                          <input type="tel" value={svcTransferForm.targetPhone} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetPhone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" />
                        </label>
                      </div>
                    </div>
                    <div className="form-sub-card">
                      <span className="form-sub-card-title">Endereço</span>
                      <div className="svc-grid-3">
                        <label className="field svc-field">
                          <span>CEP</span>
                          <input value={svcTransferForm.targetCep} onChange={(e) => lookupTransferCep(e.target.value)} placeholder="00000-000" />
                        </label>
                        <label className="field svc-field">
                          <span>Bairro</span>
                          <input value={svcTransferForm.targetNeighborhood} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetNeighborhood: e.target.value }))} />
                        </label>
                        <label className="field svc-field">
                          <span>UF</span>
                          <input value={svcTransferForm.targetState} maxLength={2} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetState: e.target.value.toUpperCase() }))} placeholder="UF" />
                        </label>
                      </div>
                      <label className="field svc-field">
                        <span>Endereço</span>
                        <input value={svcTransferForm.targetAddress} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetAddress: e.target.value }))} placeholder="Rua, número, complemento" />
                      </label>
                      <label className="field svc-field">
                        <span>Cidade</span>
                        <input value={svcTransferForm.targetCity} onChange={(e) => setSvcTransferForm((f) => ({ ...f, targetCity: e.target.value }))} />
                      </label>
                    </div>
                    <label className="field svc-field">
                      <span>Motivo</span>
                      <textarea rows={3} value={svcTransferForm.notes} onChange={(e) => setSvcTransferForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Descreva o motivo da transferência..." />
                    </label>
                  </>
                ) : isDeath ? (
                  <>
                    <div className="svc-grid-2">
                      <label className="field svc-field">
                        <span>Data do óbito</span>
                        <input type="date" value={svcDeathForm.date} onChange={(e) => setSvcDeathForm((f) => ({ ...f, date: e.target.value }))} />
                      </label>
                      <label className="field svc-field">
                        <span>Causa mortis</span>
                        <input value={svcDeathForm.cause} onChange={(e) => setSvcDeathForm((f) => ({ ...f, cause: e.target.value }))} placeholder="Causa informada pelo tutor" />
                      </label>
                    </div>
                    <label className="field svc-field">
                      <span>Observações</span>
                      <textarea rows={3} value={svcDeathForm.notes} onChange={(e) => setSvcDeathForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Informações adicionais sobre o óbito..." />
                    </label>
                  </>
                ) : null}

                {svcError && <p className="helper-text">{svcError}</p>}

                {!svcResult && (
                  <div className="svc-modal-footer">
                    {svcStep === 2
                      ? <button type="button" className="ghost-button" onClick={() => setSvcStep(1)}>Voltar</button>
                      : <button type="button" className="ghost-button" onClick={closeActiveService}>Cancelar</button>
                    }
                    <button type="submit" className="primary-action" style={isDestructive ? { background: "#dc2626" } : {}} disabled={svcLoading || svcSaving}>
                      {primaryLabel}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        );
      })()}
    </div>
  );
}

function ScheduleDayButton({
  hasVacancy,
  selected,
  mutirao = false,
  disabled,
  onClick,
  children,
}: AnyRecord) {
  return (
    <button
      className={[
        "calendar-day-button",
        hasVacancy ? "has-vacancy" : "",
        selected ? "selected" : "",
        mutirao ? "mutirao-day" : "",
      ].filter(Boolean).join(" ")}
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function PublicSchedulePicker({
  requests,
  scheduleDays = [],
  selectedDate = "",
  onSelect,
  pendingReservation = null,
  title = "",
}) {
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const requiredVacancies = Math.max(Number(pendingReservation?.count) || 1, 1);
  const scheduleWithUsage = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const confirmed = countUsedVacancies(requests, day.date);
    const pending = pendingReservation?.date === day.date ? (pendingReservation.count || 0) : 0;
    const used = confirmed + pending;
    const offeredSlot = getOfferedScheduleSlot(day, requests, requiredVacancies);
    const confirmedRemaining = Math.max(day.vacancies - confirmed, 0);
    return {
      ...day,
      used,
      remaining: Math.max(day.vacancies - used, 0),
      hasEnoughVacancies: confirmedRemaining >= requiredVacancies && Boolean(offeredSlot),
      offeredSlot,
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
      {title && <span className="form-sub-card-title">{title}</span>}
      <div className="sched-month-selector">
        <button
          type="button"
          className="sched-month-trigger"
          onClick={() => setMonthDropdownOpen((open) => !open)}
        >
          <CalendarDays size={14} />
          <span>{formatMonthYear(activeScheduleMonth)}</span>
          {scheduleMonths.length > 1 && <ChevronDown size={14} className={monthDropdownOpen ? "sched-chevron-open" : ""} />}
        </button>
        {scheduleMonths.length > 1 && monthDropdownOpen && (
          <div className="sched-month-dropdown">
            {scheduleMonths.map((month, i) => (
              <button
                key={month}
                type="button"
                className={`sched-month-tab${i === scheduleMonthIndex ? " is-active" : ""}`}
                onClick={() => { setScheduleMonthIndex(i); setMonthDropdownOpen(false); }}
              >
                {formatMonthYear(month)}
              </button>
            ))}
          </div>
        )}
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
              <ScheduleDayButton
                key={day.date}
                selected={selectedDate === day.date}
                mutirao={day.kind === "Mutirao"}
                hasVacancy={day.available && !day.isPast && day.hasEnoughVacancies}
                disabled={!day.available || !day.hasEnoughVacancies || day.isPast}
                onClick={() => onSelect(day.date)}
              >
                <strong>{String(day.calendarDay || day.date.slice(0, 2)).padStart(2, "0")}</strong>
                <small>{!day.available ? "Sem agenda" : day.isPast ? "Passado" : day.hasEnoughVacancies ? `${day.offeredSlot?.time || day.startTime || ""} - ${day.remaining} vagas` : "Sem vagas suficientes"}</small>
                {day.kind === "Mutirao" && <em>Mutirão</em>}
              </ScheduleDayButton>
            )
        )}
      </div>
    </section>
  );
}

function AdoptionCarousel({ adoptionAnimals, limit = 24, onInterestSent }: AnyRecord) {
  const availableAnimals = sortAdoptionsForHighlight(adoptionAnimals.filter((animal) => animal.status !== ADOPTION_STATUS_ADOPTED));
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestForm, setInterestForm] = useState({ name: "", phone: "", visit_date: "" });
  const speciesQuickFilters = [
    { value: "", label: "Todos" },
    { value: "canino", label: "Cães" },
    { value: "felino", label: "Gatos" },
  ];
  const filteredAnimals = availableAnimals
    .filter((animal) => !speciesFilter || normalizeText(animal.species).includes(speciesFilter))
    .slice(0, limit);

  function openAnimalModal(animal, openInterestForm = false) {
    setSelectedAnimal(animal);
    setShowInterestForm(openInterestForm);
    setInterestSent(false);
    setInterestForm({ name: "", phone: "", visit_date: "" });
  }

  function closeAnimalModal() {
    setSelectedAnimal(null);
    setShowInterestForm(false);
    setInterestSent(false);
    setInterestForm({ name: "", phone: "", visit_date: "" });
  }

  async function submitInterest(e) {
    e.preventDefault();
    try {
      const updated = await api.registerInterest(selectedAnimal.id, interestForm, selectedAnimal.municipality_id);
      setInterestSent(true);
      onInterestSent?.(updated);
    } catch (err) {
      console.error("Erro ao registrar interesse:", err);
    }
  }

  return (
    <>
    <section className="adoption-showcase">
      <div className="showcase-header adoption-showcase-header">
        <div>
          <h2>Quem está esperando por você</h2>
          <p className="adoption-showcase-subtitle">Cada adoção abre espaço para salvar outro animal</p>
        </div>
        <div className="showcase-filter-pills">
          {speciesQuickFilters.map((filter) => (
            <button
              key={filter.value || "all"}
              type="button"
              className={`showcase-pill-text${speciesFilter === filter.value ? " active" : ""}`}
              onClick={() => setSpeciesFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
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
          const interestCount = getAdoptionInterestList(animal).length;
          const highlighted = isAdoptionHighlighted(animal);
          return (
            <article
              className={`public-animal-card${highlighted ? " is-highlighted" : ""}`}
              key={animal.id || animal.name}
            >
              <button className="public-animal-open-area" type="button" onClick={() => openAnimalModal(animal)}>
                <div className={`public-animal-photo ${getAnimalGradient(animal)}`}>
                  {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={displayName} /> : <PawPrint size={24} />}
                </div>
              </button>
              <div className="public-animal-footer">
                <span className={interestCount > 0 ? "public-interest-count has-interest" : "public-interest-count"}>
                  <Users size={13} />
                  {interestCount} interessado{interestCount === 1 ? "" : "s"}
                </span>
                <button
                  className="public-interest-cta"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAnimalModal(animal, true);
                  }}
                >
                  <HeartHandshake size={14} />
                  Quero adotar
                </button>
              </div>
            </article>
          );
        })}
      </div>

    </section>

    {selectedAnimal && (
      <div className="modal-backdrop">
        <div className="animal-detail-modal adoption-profile-modal">
          <ModalHeader onClose={closeAnimalModal} />
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
            <div className="adoption-profile-identity">
              <h2>{selectedAnimal.name || selectedAnimal.animal_name}</h2>
              <div className="adoption-profile-tags">
                {selectedAnimal.species && <Chip>{selectedAnimal.species}</Chip>}
                {selectedAnimal.sex && <Chip>{selectedAnimal.sex}</Chip>}
                {selectedAnimal.age && <Chip>{selectedAnimal.age}</Chip>}
              </div>
              {(selectedAnimal.tone || selectedAnimal.description) && (
                <p>{selectedAnimal.tone || selectedAnimal.description}</p>
              )}
            </div>

            {!showInterestForm && !interestSent && (
              <button className="primary-action adoption-main-cta" type="button" onClick={() => setShowInterestForm(true)}>
                <HeartHandshake size={18} />
                Quero adotar
              </button>
            )}

            {showInterestForm && !interestSent && (
              <form className="adoption-interest-form" onSubmit={submitInterest}>
                <div className="interest-form-heading">
                  <HeartHandshake size={15} />
                  <span>Registrar interesse</span>
                </div>
                <div className="access-field">
                  <User size={14} className="access-field-icon" />
                  <input value={interestForm.name} onChange={(e) => setInterestForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome completo" required />
                </div>
                <div className="access-field">
                  <MessageCircle size={14} className="access-field-icon" />
                  <input type="tel" value={interestForm.phone} onChange={(e) => setInterestForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="WhatsApp (00) 00000-0000" required />
                </div>
                <div className="access-field">
                  <CalendarDays size={14} className="access-field-icon" />
                  <input type="date" value={interestForm.visit_date} onChange={(e) => setInterestForm((f) => ({ ...f, visit_date: e.target.value }))} />
                </div>
                <div className="form-actions">
                  <button className="primary-action" type="submit">
                    <HeartHandshake size={15} />
                    Enviar interesse
                  </button>
                </div>
              </form>
            )}

            {interestSent && (
              <div className="adoption-interest-success">
                <CheckCircle2 size={40} />
                <strong>Interesse registrado!</strong>
                <p>Em breve entraremos em contato pelo WhatsApp informado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Chip({ children }: AnyRecord) {
  return <span className="animal-status-chip">{children}</span>;
}

function getAnimalGradient(animal: AnyRecord = {}) {
  if (animal.gradient) return animal.gradient;
  const gradients = ["photo-teal", "photo-sky", "photo-rose"];
  const str = String(animal.id || animal.animal_name || animal.name || "");
  const code = str.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return gradients[code % gradients.length];
}

function normalizeAdoptionAnimal(animal: AnyRecord = {}): AnyRecord {
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

const ADOPTION_STATUS_AVAILABLE = "disponivel";
const ADOPTION_STATUS_IN_PROGRESS = "em_processo";
const ADOPTION_STATUS_ADOPTED = "adotado";
const ADOPTION_HIGHLIGHT_DAYS = 15;

function getAdoptionDaysInProgram(animal: AnyRecord = {}) {
  const createdAt = animal.created_at || animal.createdAt;
  if (!createdAt) return null;
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return null;
  const diff = Date.now() - createdDate.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function isAdoptionHighlighted(animal: AnyRecord = {}) {
  const days = getAdoptionDaysInProgram(animal);
  return animal.status !== ADOPTION_STATUS_ADOPTED && days !== null && days >= ADOPTION_HIGHLIGHT_DAYS;
}

function sortAdoptionsForHighlight(animals: AnyRecord[] = []) {
  return [...animals].sort((left, right) => {
    const rightHighlight = Number(isAdoptionHighlighted(right));
    const leftHighlight = Number(isAdoptionHighlighted(left));
    if (rightHighlight !== leftHighlight) return rightHighlight - leftHighlight;
    return (getAdoptionDaysInProgram(right) || 0) - (getAdoptionDaysInProgram(left) || 0);
  });
}

function getAdoptionStatusView(animal: AnyRecord = {}) {
  if (animal.status === ADOPTION_STATUS_ADOPTED) {
    return { label: "Adotado", className: "is-adopted" };
  }
  if (animal.status === ADOPTION_STATUS_IN_PROGRESS) {
    return { label: "Em triagem", className: "is-progress" };
  }
  return { label: "Disponivel", className: "is-available" };
}

function getAdoptionInterestList(animal: AnyRecord = {}) {
  return Array.isArray(animal.interests) ? animal.interests : [];
}

function formatAdoptionDate(value = "") {
  if (!value) return "";
  const parsed = new Date(String(value).includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("pt-BR");
}

function matchesAdoptionSearch(animal: AnyRecord = {}, query = "") {
  const normalizedQuery = normalizeText(query.trim());
  if (!normalizedQuery) return true;
  const searchable = [
    animal.name,
    animal.animal_name,
    animal.species,
    animal.sex,
    animal.age,
    animal.tone,
    animal.description,
    animal.animal_microchip,
    animal.microchip,
  ];
  return normalizeText(searchable.filter(Boolean).join(" ")).includes(normalizedQuery);
}
function LoginView({ onLogin, onAccessRequest, adoptionAnimals = [], onInterestSent, municipalities = [], selectedMunicipalityId = "", onMunicipalitySelect, createRequest, requests = [], scheduleDays = [], requestTypes = [], documentTypes = [], speciesOptions = [], sizeOptions = [], aiSettings = initialAiSettings, onRequestCreated }: AnyRecord) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showVetModal, setShowVetModal] = useState(false);
  const [activePublicService, setActivePublicService] = useState<string | null>(null);
  const [procedurePrefill, setProcedurePrefill] = useState<AnyRecord | null>(null);
  const [publicServiceDone, setPublicServiceDone] = useState<AnyRecord | null>(null);
  const [publicServiceDoneDownloading, setPublicServiceDoneDownloading] = useState(false);
  const [publicServiceDoneDownloadError, setPublicServiceDoneDownloadError] = useState("");
  const [publicServiceScheduleDays, setPublicServiceScheduleDays] = useState(scheduleDays);
  const [publicServiceScheduleRules, setPublicServiceScheduleRules] = useState([]);
  const [publicServiceRequestTypes, setPublicServiceRequestTypes] = useState(requestTypes);
  const [publicServiceDocumentTypes, setPublicServiceDocumentTypes] = useState(documentTypes);
  const [publicServiceSpeciesOptions, setPublicServiceSpeciesOptions] = useState(speciesOptions);
  const [publicServiceSizeOptions, setPublicServiceSizeOptions] = useState(sizeOptions);
  const adoptionSectionRef = useRef(null);
  const [resetScreen, setResetScreen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetStep, setResetStep] = useState("email");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function sendResetCode(event) {
    event.preventDefault();
    setResetError("");
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error || "Erro ao enviar código"); return; }
      setResetStep("code");
    } catch (err) {
      setResetError("Falha na conexão. Tente novamente.");
    } finally {
      setResetLoading(false);
    }
  }

  async function confirmReset(event) {
    event.preventDefault();
    setResetError("");
    if (resetPassword !== resetConfirm) { setResetError("As senhas não conferem."); return; }
    if (resetPassword.length < 6) { setResetError("A senha deve ter pelo menos 6 caracteres."); return; }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase(), code: resetCode.trim(), password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error || "Erro ao redefinir senha"); return; }
      setResetSuccess(true);
    } catch (err) {
      setResetError("Falha na conexão. Tente novamente.");
    } finally {
      setResetLoading(false);
    }
  }

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

  useEffect(() => {
    setPublicServiceScheduleDays(scheduleDays);
    setPublicServiceRequestTypes(requestTypes);
    setPublicServiceDocumentTypes(documentTypes);
    setPublicServiceSpeciesOptions(speciesOptions);
    setPublicServiceSizeOptions(sizeOptions);
  }, [scheduleDays, requestTypes, documentTypes, speciesOptions, sizeOptions]);

  useEffect(() => {
    if (!selectedMunicipalityId) return;
    api.getSchedule(selectedMunicipalityId)
      .then((days) => setPublicServiceScheduleDays(days.map(normalizeScheduleDay).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date))))
      .catch(console.error);
    api.getConfig(CONFIG_KEYS.scheduleRules, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceScheduleRules(value); }).catch(() => {});
    api.getConfig(CONFIG_KEYS.requestTypes, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceRequestTypes(value); }).catch(() => {});
    api.getConfig(CONFIG_KEYS.documentTypes, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceDocumentTypes(value); }).catch(() => {});
    api.getConfig(CONFIG_KEYS.species, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceSpeciesOptions(value); }).catch(() => {});
    api.getConfig(CONFIG_KEYS.sizes, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceSizeOptions(value); }).catch(() => {});
  }, [selectedMunicipalityId]);

  const activeMunicipality = selectedMunicipalityId ? municipalities.find((m) => m.id === selectedMunicipalityId) : null;
  const activePublicServiceDetails = publicHomeServices.find((service) => service.id === activePublicService) || null;
  const effectivePublicServiceScheduleDays = mergeScheduleDaysWithRules(publicServiceScheduleDays, publicServiceScheduleRules);
  const nextMutirao = getNextUpcomingMutirao(effectivePublicServiceScheduleDays);

  function scrollToAdoption() {
    if (activePublicService) setActivePublicService(null);
    adoptionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openPublicService(serviceId: string) {
    setProcedurePrefill(null);
    setPublicServiceDone(null);
    setActivePublicService(serviceId);
  }

  function joinMutirao() {
    setProcedurePrefill(nextMutirao ? { schedule: nextMutirao.date } : null);
    setPublicServiceDone(null);
    setActivePublicService("procedure_form");
  }

  function closePublicService() {
    setActivePublicService(null);
    setProcedurePrefill(null);
    setPublicServiceDone(null);
  }

  async function downloadPublicServiceRequerimento() {
    if (!publicServiceDone || publicServiceDoneDownloading) return;
    setPublicServiceDoneDownloading(true);
    setPublicServiceDoneDownloadError("");
    try {
      const dataUrl = await createRequestPdfDataUrl(publicServiceDone);
      const anchor = window.document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `Requerimento ${publicServiceDone.protocol || ""}.pdf`.trim();
      anchor.click();
    } catch (error) {
      console.error("Erro ao gerar requerimento:", error);
      setPublicServiceDoneDownloadError("Não foi possível gerar o requerimento agora. Tente novamente em instantes.");
    } finally {
      setPublicServiceDoneDownloading(false);
    }
  }

  function openInlineProcedure(prefill: AnyRecord = {}) {
    setProcedurePrefill(prefill);
    setPublicServiceDone(null);
    setActivePublicService("procedure_form");
  }

  const publicFooterItems = [
    { label: "Contato", value: activeMunicipality?.contact, icon: Phone },
    { label: "Email", value: activeMunicipality?.email, icon: Mail },
    { label: "Endereço", value: activeMunicipality?.address, icon: MapPin },
    { label: "CEP", value: activeMunicipality?.cep, icon: Navigation },
  ].filter((item) => String(item.value || "").trim());
  return (
    <main className="login-page">
      <div className="public-topbar">
        <div className="public-topbar-brand">
          {activeMunicipality?.brasao ? (
            <img src={activeMunicipality.brasao} alt={`Brasão ${activeMunicipality.name}`} className="brand-brasao" />
          ) : (
            <div className="brand-mark"><PawPrint size={20} /></div>
          )}
          <div>
            <strong>{activeMunicipality ? `Prefeitura de ${activeMunicipality.name}` : "Sistema municipal"}</strong>
            {activeMunicipality?.department_name && (
              <span className="public-topbar-department">{activeMunicipality.department_name}</span>
            )}
            {municipalities.length > 0 && (
              <MunicipalitySelectorChip
                municipalities={municipalities}
                selectedMunicipalityId={selectedMunicipalityId}
                onSelect={onMunicipalitySelect}
                compact={!!selectedMunicipalityId}
              />
            )}
          </div>
        </div>
        <nav className="public-topbar-nav" aria-label="Serviços públicos">
          {publicHomeServices.map((service) => {
            const Icon = service.icon;
            const active = activePublicService === service.id;
            return (
              <button
                key={service.id}
                type="button"
                className={`public-topbar-link${active ? " is-active" : ""}${service.danger ? " is-danger" : ""}`}
                onClick={() => openPublicService(service.id)}
              >
                <Icon size={14} />
                <span>{service.label}</span>
              </button>
            );
          })}
          <button type="button" className="public-topbar-enter" onClick={() => setShowVetModal(true)}>
            <User size={15} />
            Entrar
          </button>
        </nav>
      </div>

      {activePublicService ? (
        <section className="public-service-workspace">
          <aside className="public-service-rail">
            <PetWelcomeArt
              className="public-hero--compact"
              onGoToAdoption={scrollToAdoption}
              onPublicRequest={() => openPublicService("procedure_form")}
            />
          </aside>

          <section className={`public-service-panel${publicServiceDone ? " public-service-panel--success" : ""}`}>
            {activePublicService !== "procedure_form" && (
              <div className="public-service-panel-header">
                <h2>{activePublicServiceDetails?.label || "Serviço"}</h2>
                <button type="button" className="ghost-button" onClick={closePublicService}>Voltar ao início</button>
              </div>
            )}

            {publicServiceDone ? (
              <div className="public-inline-success public-service-success-card">
                <CheckCircle2 size={52} />
                <h3>Solicitação enviada!</h3>
                <p>Protocolo oficial: <strong>{publicServiceDone.protocol}</strong></p>
                <div className="success-validation-key">
                  <span>Chave de validação</span>
                  <strong>{publicServiceDone.validationKey || publicServiceDone.validation_key}</strong>
                  <small>Use CPF + chave de validação para consultar o andamento.</small>
                </div>
                <div className="public-service-success-actions">
                  <button className="primary-action" type="button" onClick={closePublicService}>Voltar ao início</button>
                  <button className="ghost-button" type="button" onClick={downloadPublicServiceRequerimento} disabled={publicServiceDoneDownloading}>
                    {publicServiceDoneDownloading ? "Gerando..." : "Baixar requerimento"}
                  </button>
                </div>
                {publicServiceDoneDownloadError && <p className="form-error">{publicServiceDoneDownloadError}</p>}
              </div>
            ) : activePublicService === "procedure_form" ? (
              <NewRequest
                createRequest={createRequest}
                currentUser={GUEST_USER}
                publicFlow
                selectedMunicipalityId={selectedMunicipalityId}
                onBack={closePublicService}
                onDone={(request) => {
                  const normalized = onRequestCreated?.(request, { openAdmin: true }) || normalizeRequest(request);
                  setPublicServiceDone(normalized);
                }}
                requests={requests}
                scheduleDays={effectivePublicServiceScheduleDays}
                initialMunicipalityId={selectedMunicipalityId}
                requestTypes={publicServiceRequestTypes}
                documentTypes={publicServiceDocumentTypes}
                aiSettings={aiSettings}
                speciesOptions={publicServiceSpeciesOptions}
                sizeOptions={publicServiceSizeOptions}
                initialType={procedurePrefill?.requestType || ""}
                initialSchedule={procedurePrefill?.schedule || ""}
              />
            ) : activePublicService === "credential" ? (
              <PublicAccessRequestInline onSubmit={onAccessRequest} municipalityId={selectedMunicipalityId} />
            ) : activePublicService === "report" ? (
              <PublicReportPanel
                municipalityName={activeMunicipality?.name || "Sistema municipal"}
                municipalityId={selectedMunicipalityId}
                onSubmit={async (payload) => {
                  const created = await createRequest({
                    ...payload,
                    request_type: RequestType.COMPLAINT,
                    municipality_id: selectedMunicipalityId,
                  });
                  const normalized = onRequestCreated?.(created, { openAdmin: true }) || normalizeRequest(created);
                  setPublicServiceDone(normalized);
                  return created;
                }}
              />
            ) : (
              <ValidationKeyConsultation
                fallbackRequests={requests}
                currentUser={GUEST_USER}
                onRequestCreated={onRequestCreated}
                onRequestProcedure={openInlineProcedure}
                municipalityId={selectedMunicipalityId || undefined}
                initialService={activePublicService}
                onCloseService={closePublicService}
              />
            )}
          </section>
        </section>
      ) : (
        <>
          <PetWelcomeArt
            onGoToAdoption={scrollToAdoption}
            onPublicRequest={() => openPublicService("procedure_form")}
          />

          {nextMutirao && <MutiraoBanner scheduleDay={nextMutirao} onJoin={joinMutirao} />}

          <div className="public-stats-row">
            <div className="public-stat-card">
              <HeartHandshake size={20} />
              <div>
                <strong>0</strong>
                <span>adotados</span>
              </div>
            </div>
            <div className="public-stat-card">
              <ClipboardCheck size={20} />
              <div>
                <strong>0</strong>
                <span>castrações</span>
              </div>
            </div>
            <div className="public-stat-card">
              <Users size={20} />
              <div>
                <strong>0</strong>
                <span>ONGs parceiras</span>
              </div>
            </div>
          </div>

          <section className="public-adoption-section" ref={adoptionSectionRef}>
            <AdoptionCarousel adoptionAnimals={adoptionAnimals} onInterestSent={onInterestSent} />
          </section>
        </>
      )}

      <footer className="public-home-footer" aria-label="Dados do município">
        <strong>{activeMunicipality ? `Prefeitura Municipal de ${activeMunicipality.name}` : "Sistema Municipal de Proteção Animal"}</strong>
        {publicFooterItems.length > 0 && (
          <div className="public-home-footer-info">
            {publicFooterItems.map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.label}>
                  <Icon size={14} />
                  <b>{item.label}</b>
                  {item.value}
                </span>
              );
            })}
          </div>
        )}
      </footer>

{showVetModal && (
        <div className="modal-backdrop">
          {!resetScreen ? (
            <form className="auth-modal compact-auth-modal" onSubmit={submit}>
              <ModalHeader title="Entrar no sistema" onClose={() => { setShowVetModal(false); setError(""); setResetScreen(false); }} />
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
              <button
                type="button"
                className="reset-password-link"
                onClick={() => { setResetScreen(true); setResetStep("email"); setResetError(""); setResetSuccess(false); setResetEmail(""); setResetCode(""); setResetPassword(""); setResetConfirm(""); }}
              >
                Esqueceu a senha?
              </button>
            </form>
          ) : (
            <div className="auth-modal compact-auth-modal">
              <ModalHeader
                title="Redefinir senha"
                onClose={() => { setShowVetModal(false); setResetScreen(false); setResetError(""); }}
              />

              {resetSuccess ? (
                <div className="reset-success-msg">
                  <p>Senha redefinida com sucesso!</p>
                  <button className="primary-action" type="button" onClick={() => { setResetScreen(false); setResetSuccess(false); }}>
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <form onSubmit={resetStep === "email" ? sendResetCode : confirmReset} className="reset-form">
                  <label className="field">
                    <span>E-mail cadastrado</span>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      disabled={resetStep === "code"}
                    />
                  </label>

                  {resetStep === "email" && (
                    <button className="primary-action" type="submit" disabled={resetLoading}>
                      {resetLoading ? "Enviando..." : "Enviar código"}
                    </button>
                  )}

                  {resetStep === "code" && (
                    <>
                      <label className="field">
                        <span>Código recebido</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Nova senha</span>
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Confirmar nova senha</span>
                        <input
                          type="password"
                          value={resetConfirm}
                          onChange={(e) => setResetConfirm(e.target.value)}
                          placeholder="Repita a nova senha"
                          required
                        />
                      </label>
                      <div className="reset-form-actions">
                        <button className="ghost-button" type="button" onClick={() => { setResetStep("email"); setResetCode(""); setResetError(""); }}>
                          Reenviar código
                        </button>
                        <button className="primary-action" type="submit" disabled={resetLoading}>
                          {resetLoading ? "Salvando..." : "Redefinir senha"}
                        </button>
                      </div>
                    </>
                  )}

                  {resetError && <p className="form-error">{resetError}</p>}
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function PublicAccessRequestInline({ onSubmit, municipalityId }: AnyRecord) {
  const [form, setForm] = useState({
    requesterType: "ONG",
    organizationName: "",
    responsibleName: "",
    email: "",
    phone: "",
    document: "",
    city: "",
    state: "",
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
        assigned_sector: selectedType.sector,
        municipality_id: municipalityId,
      });
      setSent(true);
      setStatus("");
    } catch (err) {
      setStatus(err.message || "Não foi possível enviar a solicitação.");
    }
  }

  return (
    <div className="public-inline-card public-access-inline">
      <form className="single-request-form clean-form" onSubmit={submit}>
        {sent ? (
          <div className="access-modal-success">
            <CheckCircle2 size={38} strokeWidth={1.5} />
            <h2>Solicitação enviada!</h2>
            <p>Um usuário interno vai analisar o pedido e liberar o acesso se estiver tudo certo.</p>

          </div>
        ) : (
          <>
            <div className="public-inline-heading"><span className="public-inline-icon"><Shield size={18} /></span><div><strong>Solicitar credenciamento</strong><span>Acesso ao sistema para ONGs e protetores independentes.</span></div></div>

            <div className="access-type-picker">
              {accessRequesterTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`access-type-card${form.requesterType === type.id ? " is-selected" : ""}`}
                  onClick={() => patch("requesterType", type.id)}
                >
                  <span className="access-type-icon">
                    {type.id === "ONG" ? <Building2 size={17} /> : <HeartHandshake size={17} />}
                  </span>
                  <span className="access-type-label">{type.label}</span>
                  <span className="access-type-sector">{type.sector}</span>
                </button>
              ))}
            </div>

            <div className="single-request-form clean-form">
              <label className="access-form-label">
                <span>Organização</span>
                <div className="access-field">
                  <input type="text" placeholder="Nome da ONG ou grupo (opcional para protetor)" value={form.organizationName} onChange={(e) => patch("organizationName", e.target.value)} />
                </div>
              </label>
              <label className="access-form-label">
                <span>Responsável</span>
                <div className="access-field">
                  <input type="text" placeholder="Nome completo do responsável *" value={form.responsibleName} onChange={(e) => patch("responsibleName", e.target.value)} required />
                </div>
              </label>
              <label className="access-form-label">
                <span>Email</span>
                <div className="access-field">
                  <input type="email" placeholder="Email para contato *" value={form.email} onChange={(e) => patch("email", e.target.value)} required />
                </div>
              </label>
              <div className="two-column-fields">
                <label className="access-form-label">
                  <span>Telefone</span>
                  <div className="access-field">
                    <input type="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => patch("phone", formatPhone(e.target.value))} />
                  </div>
                </label>
                <label className="access-form-label">
                  <span>CPF / CNPJ</span>
                  <div className="access-field">
                    <input type="text" placeholder="CPF, CNPJ ou matrícula" value={form.document} onChange={(e) => patch("document", /^[0-9.\-/\s]*$/.test(e.target.value) ? formatCpfOrCnpj(e.target.value) : e.target.value)} />
                  </div>
                </label>
              </div>
              <div className="two-column-fields">
                <label className="access-form-label">
                  <span>Cidade</span>
                  <div className="access-field">
                    <input type="text" placeholder="Cidade" value={form.city} onChange={(e) => patch("city", e.target.value)} />
                  </div>
                </label>
                <label className="access-form-label">
                  <span>UF</span>
                  <div className="access-field">
                    <input type="text" placeholder="UF" value={form.state} maxLength={2} onChange={(e) => patch("state", e.target.value.toUpperCase().slice(0, 2))} />
                  </div>
                </label>
              </div>
            </div>

            {status && <p className={`access-status${status.includes("Enviando") ? " is-sending" : " is-error"}`}>{status}</p>}

            <button className="primary-action" type="submit">
              <Shield size={14} />
              Enviar solicitação
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function PublicReportPanel({ municipalityName = "Sistema municipal", onSubmit }: AnyRecord) {
  const [form, setForm] = useState({
    name: "", cpf: "", contact: "", email: "", description: "", confidential: false,
    cep: "", number: "", address: "", neighborhood: "", city: "", state: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function patch(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function lookupReporterCep(value) {
    const cleanCep = value.replace(/\D/g, "");
    const maskedCep = formatCep(value);
    patch("cep", maskedCep);

    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return;

      setForm((current) => ({
        ...current,
        cep: maskedCep,
        address: data.logradouro || current.address,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
    } catch {
      // busca de CEP é apenas conveniência; falha silenciosa não bloqueia o preenchimento manual
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Informe o nome do denunciante.");
      return;
    }
    if (!isValidCpf(form.cpf)) {
      setError("Informe um CPF válido do denunciante.");
      return;
    }
    if (!isValidPhone(form.contact)) {
      setError("Informe um telefone válido em Contato.");
      return;
    }
    if (!form.description.trim()) {
      setError("Descreva a situação observada.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSubmit?.({
        tutor_name: form.name.trim(),
        tutor_email: form.email.trim(),
        cpf: form.cpf.trim(),
        phone: form.contact.trim(),
        cep: form.cep.trim(),
        address: [form.address.trim(), form.number.trim()].filter(Boolean).join(", "),
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        notes: form.description.trim(),
        is_confidential: form.confidential,
      });
    } catch (err: any) {
      setError(err.message || "Não foi possível registrar a denúncia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="public-inline-card public-report-inline">
      <form className="single-request-form clean-form" onSubmit={submitReport}>
        <div className="form-sub-card">
          <span className="form-sub-card-title">Denunciante</span>
          <div className="two-column-fields">
            <div className="access-field" data-label="Nome">
              <input type="text" value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="access-field" data-label="CPF">
              <input type="text" value={form.cpf} onChange={(e) => patch("cpf", formatCpf(e.target.value))} placeholder="000.000.000-00" />
            </div>
          </div>
          <div className="two-column-fields">
            <div className="access-field" data-label="Telefone">
              <input type="tel" value={form.contact} onChange={(e) => patch("contact", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div className="access-field" data-label="Email">
              <input type="email" value={form.email} onChange={(e) => patch("email", e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.confidential} onChange={(event) => patch("confidential", event.target.checked)} />
            Manter meus dados em sigilo
          </label>
        </div>

        <div className="form-sub-card">
          <span className="form-sub-card-title">Local da ocorrência</span>
          <div className="address-lookup-grid">
            <div className="access-field" data-label="CEP">
              <input type="text" placeholder={`00000-000 (${municipalityName})`} value={form.cep} onChange={(e) => lookupReporterCep(e.target.value)} />
            </div>
            <div className="access-field" data-label="Número">
              <input type="text" placeholder="Número" value={form.number} onChange={(e) => patch("number", e.target.value)} />
            </div>
            <div className="access-field" data-label="UF">
              <input type="text" placeholder="UF" value={form.state} maxLength={2} onChange={(e) => patch("state", e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase())} />
            </div>
          </div>
          <div className="access-field" data-label="Endereço">
            <input type="text" placeholder="Rua, complemento ou referência" value={form.address} onChange={(e) => patch("address", e.target.value)} />
          </div>
          <div className="address-city-grid">
            <div className="access-field" data-label="Bairro">
              <input type="text" placeholder="Bairro" value={form.neighborhood} onChange={(e) => patch("neighborhood", e.target.value)} />
            </div>
            <div className="access-field" data-label="Cidade">
              <input type="text" placeholder="Cidade" value={form.city} onChange={(e) => patch("city", e.target.value)} />
            </div>
          </div>
        </div>

        <label className="access-form-label">
          <span>Descrição</span>
          <div className="access-field"><textarea value={form.description} onChange={(e) => patch("description", e.target.value)} placeholder="Descreva a situação observada" rows={6} /></div>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="public-inline-actions">
          <button className="primary-action" type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar denúncia"}</button>
        </div>
      </form>
    </section>
  );
}
function PetWelcomeArt({ className = "", onGoToAdoption, onPublicRequest }: AnyRecord) {
  return (
    <section className={`public-hero ${className}`.trim()}>
      <div className="hero-art" aria-hidden="true" style={{ backgroundImage: `url(${petHeroImage})` }} />
      <div className="hero-content">
        <h1 className="hero-title">Cuidado e proteção para quem não tem voz</h1>
        <p className="hero-subtitle">Castração gratuita, adoção responsável e bem-estar animal - digital e acessível.</p>
        <div className="hero-actions">
          <button type="button" className="hero-cta primary" onClick={onGoToAdoption}>
            Quero adotar
          </button>
          <button type="button" className="hero-cta outline" onClick={onPublicRequest}>
            Agendar castração
          </button>
        </div>
      </div>
    </section>
  );
}
function MutiraoBanner({ scheduleDay, onJoin }: AnyRecord) {
  if (!scheduleDay) return null;
  const time = scheduleDay.offeredSlot?.time || scheduleDay.startTime || "";
  return (
    <section className="mutirao-banner">
      <span className="mutirao-banner-tag">Mutirão</span>
      <div className="mutirao-banner-content">
        <strong className="mutirao-banner-title">
          Mutirão de castração {scheduleDay.locationName ? `em ${scheduleDay.locationName}` : ""}
        </strong>
        <div className="mutirao-banner-details">
          <span>{scheduleDay.date}{time ? ` às ${time}` : ""}</span>
          {scheduleDay.locationAddress && (
            scheduleDay.addressUrl ? (
              <a href={scheduleDay.addressUrl} target="_blank" rel="noreferrer">{scheduleDay.locationAddress}</a>
            ) : (
              <span>{scheduleDay.locationAddress}</span>
            )
          )}
        </div>
      </div>
      <button type="button" className="mutirao-banner-cta" onClick={onJoin}>
        Quero participar
      </button>
    </section>
  );
}

function MunicipalitySelectorChip({ municipalities, selectedMunicipalityId, onSelect, compact = false }: AnyRecord) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  const selected = municipalities.find((m) => m.id === selectedMunicipalityId);
  const multiState = new Set(municipalities.map((m) => m.state).filter(Boolean)).size > 1;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? municipalities.filter((m) =>
        m.name.toLowerCase().includes(q) || (m.state || "").toLowerCase().includes(q)
      )
    : municipalities;

  function open() {
    setSearch("");
    setPopoverOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function pick(id) {
    onSelect(id);
    setPopoverOpen(false);
    setSearch("");
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className={`municipality-chip-btn${selected ? " selected" : ""}${compact ? " compact" : ""}`}
        onClick={() => (popoverOpen ? setPopoverOpen(false) : open())}
      >
        {compact && selected ? (
          <><ChevronDown size={13} />trocar</>
        ) : (
          <><MapPin size={14} />{selected ? selected.name : "Município"}<ChevronDown size={13} /></>
        )}
      </button>
      {popoverOpen && (
        <>
          <div className="municipality-popover-backdrop" onClick={() => setPopoverOpen(false)} />
          <div className="municipality-popover">
            <div className="mun-search-box">
              <Search size={14} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar município..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mun-list">
              {filtered.length === 0 && (
                <p className="mun-empty">Nenhum resultado</p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mun-list-item${m.id === selectedMunicipalityId ? " active" : ""}`}
                  onClick={() => pick(m.id)}
                >
                  <span>{m.name}</span>
                  {multiState && <small>{m.state}</small>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const GUEST_USER = { role: "guest", name: "", email: "", neighborhood: "", address: "", cpf: "", cep: "", number: "", city: "", state: "", phone: "" };

function TutorDashboard({ requests, setActive, currentUser, compact = false, cpf = "", validationKey = "", onRequestCreated, animalRecord = null }: AnyRecord) {
  const safeRequests = useMemo(() => (Array.isArray(requests) ? requests : []).map(normalizeRequest), [requests]);
  const next = safeRequests.find((request) => request.status === "AGENDADA" && (request.appointment || request.preferredSchedule));
  const [detailsRequest, setDetailsRequest] = useState(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingProntuario, setDownloadingProntuario] = useState(false);

  async function downloadProntuario() {
    if (downloadingProntuario || !animalRecord) return;
    setDownloadingProntuario(true);
    try {
      const bundle = await generateProntuarioPdf({}, animalRecord);
      if (bundle?.dataUrl) {
        const a = document.createElement("a");
        a.href = bundle.dataUrl;
        a.download = bundle.fileName || `prontuario-${animalRecord.animal?.name || "animal"}.pdf`;
        a.click();
      }
    } catch (err) {
      console.error("Erro ao gerar prontuário:", err);
    } finally {
      setDownloadingProntuario(false);
    }
  }
  const detailsAnimal = detailsRequest?.animals?.[0] || {};
  const detailsAnimalHistory = detailsRequest ? buildPublicAnimalHistory(detailsRequest, detailsAnimal) : [];

  return (
    <section className={compact ? "simple-stack consultation-results" : "content-grid"}>
      {!compact && <div className="hero-panel">
        <div>
          <h2>Olá, {currentUser.name}</h2>
        </div>
        <button className="primary-action" onClick={() => setActive("solicitacao")}>
          <Plus size={18} />
          Nova solicitação
        </button>
      </div>}

      {!compact && <div className="summary-row">
        <Metric title={compact ? "Ativas" : "Solicitações ativas"} value={safeRequests.filter((r) => r.status === "NOVA" || r.status === "AGENDADA").length} icon={ClipboardCheck} />
        <Metric title="Próximo agendamento" value={next ? next.appointment || next.preferredSchedule : "Nenhum"} icon={CalendarDays} />
        <Metric title={compact ? "Avisos" : "Notificações"} value="4" icon={Bell} />
      </div>}

      <div className="panel wide">
        <div className="panel-header">
          <h3>{compact ? "Solicitações" : "Minhas solicitações"}</h3>
          {animalRecord?.animal && (
            <button
              className="icon-btn-flat"
              type="button"
              title="Baixar prontuário do animal"
              disabled={downloadingProntuario}
              onClick={downloadProntuario}
            >
              <FileText size={15} />
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Prontuário</span>
            </button>
          )}
        </div>
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
              <div className="request-card-main">
                <strong>#{request.protocol}</strong>
                <span>{request.animals.map((animal) => animal.name).join(", ") || "Animal não informado"}</span>
                <small>{requestTypeLabel(request)}</small>
              </div>
              <div className="request-card-status">
                <StatusBadge status={request.status} className="card-status-plain" />
                <span className="request-card-date">{request.appointment || request.preferredSchedule || request.createdAt}</span>
              </div>
              <div className="request-card-actions">
                <button className="ghost-button" type="button" onClick={() => setDetailsRequest(request)}>
                  Detalhes
                  <ChevronRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {detailsRequest && (() => {
        const req = detailsRequest;
        const animal = req.animals?.[0] || {};
        const wf: AnyRecord = req.workflowData || req.workflow_data || {};
        const animalBreed = animal.breedType === "Definida" ? (animal.breedDescription || "Definida") : (animal.breedType || "—");
        const microchip = animal.microchip || req.animalMicrochip || "—";
        const performed = wf.attendanceProcedure || wf.performedProcedures || req.performedProcedures || "";
        const prescription = wf.attendancePrescription || "";
        const cancelReason = wf.cancelReason || req.rejectionReason || "";
        return (
          <div className="modal-backdrop">
            <div className="public-request-details-modal prontuario-modal" role="dialog" aria-modal="true">
              <div className="prontuario-modal-header">
                <div className="prontuario-modal-title">
                  <span className="prontuario-modal-eyebrow">Prontuário · #{req.protocol}</span>
                  <h2>{animal.name || "Animal não informado"}</h2>
                  <StatusBadge status={req.status} />
                </div>
                <div className="prontuario-modal-actions">
                  <button
                    className="icon-btn-flat"
                    type="button"
                    title="Baixar prontuário do animal"
                    disabled={downloadingId === req.id}
                    onClick={async () => {
                      setDownloadingId(req.id);
                      try {
                        const chip = (animal.microchip || req.animalMicrochip || "").trim();
                        let history = animalRecord;
                        if (!history && chip) {
                          history = await api.consultAnimalByMicrochip({ microchip: chip }).catch(() => null);
                        }
                        const bundle = await generateProntuarioPdf(req, history);
                        if (bundle?.dataUrl) {
                          const a = document.createElement("a");
                          a.href = bundle.dataUrl;
                          a.download = bundle.fileName || `prontuario-${animal.name || req.protocol}.pdf`;
                          a.click();
                        }
                      } finally { setDownloadingId(null); }
                    }}
                  >
                    <Download size={16} />
                  </button>
                  <button className="icon-btn-flat" type="button" onClick={() => setDetailsRequest(null)} aria-label="Fechar">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="prontuario-modal-body">
                <div className="prontuario-section">
                  <span className="prontuario-section-label">Animal</span>
                  <div className="prontuario-grid">
                    <InfoTile label="Nome" value={animal.name || "—"} />
                    <InfoTile label="Espécie" value={animal.species || "—"} />
                    <InfoTile label="Sexo" value={animal.sex || "—"} />
                    <InfoTile label="Porte" value={animal.size || "—"} />
                    <InfoTile label="Raça" value={animalBreed} />
                    <InfoTile label="Microchip" value={microchip} />
                    <InfoTile label="Nascimento / Idade" value={animal.birthDate || animal.age || "—"} />
                    <InfoTile label="Peso" value={animal.weight ? `${animal.weight} kg` : "—"} />
                    <InfoTile label="Vermifugado" value={animal.dewormed || "—"} />
                    <InfoTile label="Vacinado" value={animal.vaccinated || "—"} />
                  </div>
                </div>

                <div className="prontuario-section">
                  <span className="prontuario-section-label">Tutor</span>
                  <div className="prontuario-grid">
                    <InfoTile label="Nome" value={req.tutor || currentUser?.name || "—"} />
                    <InfoTile label="CPF" value={maskCpf(req.cpf || cpf)} />
                    <InfoTile label="Telefone" value={req.phone || "—"} />
                    <InfoTile label="Endereço" value={[req.address, req.neighborhood, req.city, req.state].filter(Boolean).join(", ") || "—"} />
                  </div>
                </div>

                <div className="prontuario-section">
                  <span className="prontuario-section-label">Solicitação</span>
                  <div className="prontuario-grid">
                    <InfoTile label="Protocolo" value={`#${req.protocol}`} />
                    <InfoTile label="Tipo" value={requestTypeLabel(req)} />
                    <InfoTile label="Aberta em" value={req.createdAt ? formatDateTime(req.createdAt) : "—"} />
                    <InfoTile label="Agendamento" value={req.appointment || req.preferredSchedule || "Sem agenda"} />
                    {req.scheduleLocationName && <InfoTile label="Local" value={req.scheduleLocationName} />}
                  </div>
                </div>

                {(performed || prescription || cancelReason) && (
                  <div className="prontuario-section">
                    <span className="prontuario-section-label">Atendimento</span>
                    <div className="prontuario-grid">
                      {performed && <InfoTile label="Procedimento realizado" value={performed} />}
                      {wf.attendanceMicrochip && <InfoTile label="Microchip aplicado" value={wf.attendanceMicrochip} />}
                      {prescription && <InfoTile label="Receita / Prescrição" value={prescription} />}
                      {cancelReason && <InfoTile label="Motivo cancelamento" value={cancelReason} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

function buildPublicAnimalHistory(request: AnyRecord = {}, animal: AnyRecord = {}) {
  const performed = request.performedProcedures || request.workflow_data?.performedProcedures || request.workflowData?.performedProcedures || "";
  const procedureStatus = request.status === "REALIZADA"
    ? performed || animal.procedure || requestTypeLabel(request)
    : animal.procedure || requestTypeLabel(request);
  return [
    { label: "Espécie", value: displayText(animal.species || "Não informado") },
    { label: "Sexo", value: displayText(animal.sex || "Não informado") },
    { label: "Porte", value: displayText(animal.size || "Não informado") },
    { label: "Raça", value: displayText(animal.breedType === "Definida" ? (animal.breedDescription || "Definida") : (animal.breedType || "Não informado")) },
    { label: "Nascimento / idade", value: animal.birthDate || animal.age || "Não informado" },
    { label: "Peso", value: animal.weight ? `${animal.weight} kg` : "Não informado" },
    { label: "Microchip", value: animal.microchip || request.animalMicrochip || "Não informado" },
    { label: request.status === "REALIZADA" ? "Procedimento realizado" : "Procedimento solicitado", value: displayText(procedureStatus || "Não informado") },
    { label: "Vermifugado", value: displayText(animal.dewormed || "Não informado") },
    { label: "Vacinas em dia", value: displayText(animal.vaccinated || "Não informado") },
    { label: "Histórico de doenças", value: displayText(animal.illnessHistory || "Não informado") },
    { label: "Alimentação", value: displayText(animal.food || "Não informado") },
  ].filter((item) => item.value);
}

function NewRequest({
  createRequest,
  currentUser,
  compact = false,
  internalSimple = false,
  publicFlow = false,
  selectedMunicipalityId = "",
  onBack,
  onDone,
  requests = [],
  scheduleDays = [],
  requestTypes = initialRequestTypes,
  aiSettings = initialAiSettings,
  speciesOptions = initialSpecies,
  sizeOptions = initialSizes,
  documentTypes = initialDocumentTypes,
  initialSchedule = "",
  initialType = "",
  initialMunicipalityId = "",
}: AnyRecord) {
  const activeSpecies = Array.from(new Set(
    speciesOptions
      .filter((item) => item.active !== false)
      .map((item) => item.name)
      .filter(Boolean),
  ));
  const activeSizes = sizeOptions.filter((item) => item.active !== false);
  const sizeChoiceOptions = activeSizes.map((s) => {
    const unit = s.weightUnit || "kg";
    const start = parseFloat(s.weightStart ?? "");
    const end = parseFloat(s.weightEnd ?? "");
    let subtitle = "";
    if (!isNaN(start) && !isNaN(end)) subtitle = `${s.weightStart}–${s.weightEnd} ${unit}`;
    else if (!isNaN(start)) subtitle = `A partir de ${s.weightStart} ${unit}`;
    else if (!isNaN(end)) subtitle = `Até ${s.weightEnd} ${unit}`;
    return { value: s.name, label: s.name, subtitle };
  });
  const skipTutorStep = currentUser.role === "tutor" && currentUser.profileComplete;
  const [requestData, setRequestData] = useState({
    tutor: canManagePublicAnimalFlows(currentUser.role) ? "" : currentUser.name,
    neighborhood: currentUser.neighborhood || "",
    address: currentUser.address || "",
    cpf: currentUser.cpf || "",
    email: currentUser.email,
    cep: currentUser.cep || "",
    number: currentUser.number || "",
    city: currentUser.city || "",
    state: currentUser.state || "",
    cadUnico: currentUser.cadUnico || "",
    cadUnicoNotApplicable: currentUser.cadUnico ? false : Boolean(currentUser.cadUnicoNotApplicable ?? true),
    isFarmer: Boolean(currentUser.isFarmer || currentUser.is_farmer),
    latitude: "",
    longitude: "",
    type: initialType,
    phone: currentUser.phone || "",
    notes: "",
    schedule: initialSchedule,
    municipalityId: initialMunicipalityId || currentUser.municipalityId || "",
  });
  const [animals, setAnimals] = useState<AnyRecord[]>([
    {
      name: "",
      species: "",
      procedureType: "",
      sex: "",
      breedType: "",
      breedDescription: "",
      size: "",
      weight: "",
      age: "",
      birthDate: "",
      coat: "",
      hasChip: "",
      microchip: "",
      dewormed: "",
      vaccinated: "",
      illnessHistory: "",
      food: "",
    },
  ]);
  const [expandedAnimal, setExpandedAnimal] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [documentUploads, setDocumentUploads] = useState<AnyRecord>({});
  const [formStep, setFormStep] = useState(internalSimple ? 0 : 1);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    if (initialSchedule) {
      setRequestData((current) => ({ ...current, schedule: initialSchedule }));
    }
  }, [initialSchedule]);

  useEffect(() => {
    if (initialMunicipalityId) {
      setRequestData((current) => ({ ...current, municipalityId: initialMunicipalityId }));
    }
  }, [initialMunicipalityId]);

  useEffect(() => {
    if (initialType) {
      setRequestData((current) => ({ ...current, type: initialType }));
    }
  }, [initialType]);

  const configuredRequestTypes = requestTypes
    .filter((type) => type.name.trim() && type.active !== false)
    .filter((type, index, items) => items.findIndex((item) => item.name === type.name) === index);
  const selectedRequestType = configuredRequestTypes.find((type) => type.name === requestData.type) || null;
  const typeStepTutor = selectedRequestType?.stepTutor !== false;
  const typeStepAgenda = selectedRequestType?.stepAgenda !== false;
  const typeStepDocuments = selectedRequestType?.stepDocuments !== false;
  const selectedTypeDocuments = (selectedRequestType?.documents || [])
    .map((document) => resolveConfiguredDocument(document, documentTypes))
    .map(normalizeDocumentType)
    .filter((document) => document.active !== false);
  const acceptableUploadStatuses = ["approved", "attached"];
  const requiredDocsApproved = selectedTypeDocuments
    .filter((document) => document.required)
    .every((document) => acceptableUploadStatuses.includes(documentUploads[document.id]?.status));
  const hasUploadNeedingReplacement = Object.values(documentUploads)
    .some((upload: AnyRecord) => upload?.status === "attached" && upload?.aiVerdict === "rejected");
  const requiredIssues = getRequestValidationIssues();
  const canSubmit = requiredIssues.length === 0;
  const formSteps = (internalSimple
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
        { step: 1, label: "Animal" },
        { step: 0, label: "Tutor" },
        { step: 2, label: "Agenda" },
        { step: 3, label: "Documentos" },
      ]).filter((item) => !(internalSimple && item.step === 3))
    .filter((item) => !(!internalSimple && item.step === 0 && !typeStepTutor))
    .filter((item) => !(!internalSimple && item.step === 2 && !typeStepAgenda))
    .filter((item) => !(!internalSimple && item.step === 3 && !typeStepDocuments));
  const currentStepIndex = Math.max(formSteps.findIndex((item) => item.step === formStep), 0);
  function selectedScheduleHasCapacity() {
    if (!requestData.schedule) return false;
    const selectedDay = scheduleDays.find((day) => day.date === requestData.schedule && day.active !== false);
    if (!selectedDay || isPastScheduleDay(selectedDay.date)) return false;
    return Boolean(getOfferedScheduleSlot(selectedDay, requests, Math.max(animals.length, 1)));
  }

  function addAnimal() {
    setAnimals((current) => {
      const next = [
        ...current,
        {
          name: "",
          species: "",
          procedureType: "",
          sex: "",
          breedType: "",
          breedDescription: "",
          size: "",
          weight: "",
          age: "",
          birthDate: "",
          coat: "",
          hasChip: "",
          microchip: "",
          dewormed: "",
          vaccinated: "",
          illnessHistory: "",
          food: "",
        },
      ];
      setExpandedAnimal(next.length - 1);
      return next;
    });
  }

  function detectSizeFromWeight(weight) {
    const w = parseFloat(String(weight).replace(",", "."));
    if (isNaN(w) || w <= 0) return "";
    const match = activeSizes.find((s) => {
      const start = parseFloat(s.weightStart ?? "");
      const end = parseFloat(s.weightEnd ?? "");
      if (!isNaN(start) && !isNaN(end)) return w >= start && w <= end;
      if (!isNaN(start)) return w >= start;
      if (!isNaN(end)) return w <= end;
      return false;
    });
    return match?.name || "";
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
      cadUnicoNotApplicable: !checked,
      cadUnico: !checked ? "" : current.cadUnico,
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
  }

  function getRequestValidationIssues() {
    const issues = [];
    const filledAnimals = animals.length > 0 ? animals : [{}];

    if (!internalSimple && !accepted) issues.push("Leia e aceite a declaração para encerrar o cadastro.");
    if (!internalSimple && typeStepAgenda && !requestData.schedule) issues.push("Escolha uma data disponível.");
    else if (!internalSimple && typeStepAgenda && !selectedScheduleHasCapacity()) issues.push("Escolha uma data com vagas suficientes para todos os animais.");
    if (configuredRequestTypes.length > 0 && !requestData.type) issues.push("Selecione o tipo de solicitação.");
    filledAnimals.forEach((animal, index) => {
      const label = filledAnimals.length > 1 ? ` do animal ${index + 1}` : " do animal";
      if (!animal.species) issues.push(`Selecione a espécie${label}.`);
      if (!animal.sex) issues.push(`Selecione o sexo${label}.`);
      if (!animal.size) issues.push(`Selecione o porte${label}.`);
      if (!animal.breedType) issues.push(`Informe se a raça é definida ou indefinida${label}.`);
    });
    if (!internalSimple && typeStepDocuments && !requiredDocsApproved) issues.push("Todos os documentos obrigatórios precisam estar aprovados pela validação.");
    if (!internalSimple && typeStepDocuments && hasUploadNeedingReplacement) issues.push("Um dos arquivos anexados não corresponde ao documento solicitado. Anexe o comprovante correto antes de enviar.");
    if (requestData.cpf && !isValidCpf(requestData.cpf)) issues.push("Informe um CPF válido.");
    if (requestData.phone && !isValidPhone(requestData.phone)) issues.push("Informe um telefone válido com DDD.");

    return issues;
  }

  function getStepIssues(step = formStep) {
    if (step === 0) {
      return [];
    }

    if (step === 1) {
      return animals
        .flatMap((animal, index) => [
          index === 0 && configuredRequestTypes.length > 0 && !requestData.type,
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
      return [typeStepDocuments && !requiredDocsApproved, typeStepDocuments && !accepted, typeStepDocuments && hasUploadNeedingReplacement].filter(Boolean);
    }

    return [];
  }

  function showInvalid(field) {
    if (!submitAttempted) return false;
    const firstAnimal: AnyRecord = animals[0] || {};
    const checks = {
      email: Boolean(requestData.email.trim()) && !requestData.email.includes("@"),
      type: configuredRequestTypes.length > 0 && !requestData.type,
      species: !firstAnimal.species,
      sex: !firstAnimal.sex,
      size: !firstAnimal.size,
      breedType: !firstAnimal.breedType,
      documents: !requiredDocsApproved,
      accepted: !accepted,
    };
    return Boolean(checks[field]);
  }

  function navigateToStep(targetStep) {
    const targetIndex = formSteps.findIndex((item) => item.step === targetStep);
    if (targetIndex < 0 || targetIndex === currentStepIndex) return;

    if (targetIndex < currentStepIndex) {
      setSubmitAttempted(false);
      setFormStep(targetStep);
      return;
    }

    for (let index = currentStepIndex; index < targetIndex; index += 1) {
      const step = formSteps[index].step;
      if (getStepIssues(step).length > 0) {
        setSubmitAttempted(true);
        setFormStep(step);
        return;
      }
    }

    setSubmitAttempted(false);
    setFormStep(targetStep);
  }
  async function lookupCep(value) {
    const cleanCep = value.replace(/\D/g, "");
    const maskedCep = formatCep(value);
    updateRequestField("cep", maskedCep);

    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) return;

      setRequestData((current) => ({
        ...current,
        cep: maskedCep,
        address: data.logradouro || current.address,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
    } catch {
      // busca de CEP é apenas conveniência; falha silenciosa não bloqueia o preenchimento manual
    }
  }

  async function handleDocumentFile(document: AnyRecord, file?: File) {
    if (!file) return;

    try {
      const normalizedDocument = normalizeDocumentType(document);
      const documentUsesAi = normalizedDocument.analysisRules?.useAi !== false;
      const shouldAnalyzeWithAi = aiSettings.active && documentUsesAi;
      const dataUrl = await readFileAsDataUrl(file);
      setDocumentUploads((current) => ({
        ...current,
        [normalizedDocument.id]: {
          documentId: normalizedDocument.id,
          documentName: normalizedDocument.name,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          dataUrl,
          status: "checking",
          message: shouldAnalyzeWithAi ? "Analisando documento e critérios cadastrados..." : "Arquivo anexado...",
        },
      }));
      const documentMunicipalityId = requestData.municipalityId || selectedMunicipalityId || initialMunicipalityId || currentUser?.municipalityId || "";
      const result = await validateDocumentWithAI(normalizedDocument, file, aiSettings, dataUrl, documentMunicipalityId);
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
          message: "Arquivo anexado.",
          confidence: null,
          error: true,
        },
      }));
    }
  }

  async function handleAnimalPhotoFile(file?: File) {
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
    setSubmissionError("");
    if (submitting) return;
    if (!canSubmit) {
      const firstInvalidStep = formSteps.find((item) => getStepIssues(item.step).length > 0);
      const nextMessage = requiredIssues[0] || "Revise os dados obrigatórios antes de enviar.";
      setSubmissionError(nextMessage);
      if (firstInvalidStep && firstInvalidStep.step !== formStep) {
        setFormStep(firstInvalidStep.step);
      }
      return;
    }
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
    const selectedScheduleSlot = selectedScheduleDay ? getOfferedScheduleSlot(selectedScheduleDay, requests, Math.max(animals.length, 1)) : null;
    const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    const addressString = [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state, requestData.cep].filter(Boolean).join(", ");
    const hasGpsCoords = requestData.latitude && requestData.longitude;
    const { latitude, longitude } = hasGpsCoords
      ? { latitude: requestData.latitude, longitude: requestData.longitude }
      : (mapsApiKey && addressString ? await geocodeAddress(addressString, mapsApiKey) : { latitude: "", longitude: "" });
    const localPayload = {
      tutor: requestData.tutor || currentUser.name,
      neighborhood: requestData.neighborhood || "Bairro não informado",
      address:
        [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state]
          .filter(Boolean)
          .join(", ") || "Endereço não informado",
      type: requestData.type || "Cadastro animal",
      requestTypeId: selectedRequestType?.id || "",
      fee: selectedRequestType?.fee || "",
      phone: requestData.phone || "",
      cpf: requestData.cpf || "",
      email: requestData.email || "",
      cep: requestData.cep || "",
      preferredSchedule: requestData.schedule || "",
      municipalityId: requestData.municipalityId || selectedScheduleDay?.municipalityId || "",
      scheduleTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
      scheduleSlotTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
      scheduleLocationName: selectedScheduleDay?.locationName || "",
      scheduleAddress: selectedScheduleDay?.locationAddress || "",
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
        scheduleTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
        scheduleSlotTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
      },
      animals: animals.map((animal, index) => ({
        ...animal,
        name: animal.name || "",
        age: animal.birthDate || animal.age || "",
      })),
      documents: Object.values(documentUploads).filter((upload) => upload?.documentId === "animal_photo"),
      signedAt: "",
      tags: [],
      origin: "INTERNA",
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
    const selectedScheduleSlot = selectedScheduleDay ? getOfferedScheduleSlot(selectedScheduleDay, requests, Math.max(animals.length, 1)) : null;
    const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    const addressString = [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state, requestData.cep].filter(Boolean).join(", ");
    const hasGpsCoords = requestData.latitude && requestData.longitude;
    const { latitude, longitude } = hasGpsCoords
      ? { latitude: requestData.latitude, longitude: requestData.longitude }
      : (mapsApiKey && addressString ? await geocodeAddress(addressString, mapsApiKey) : { latitude: "", longitude: "" });
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
      type: requestData.type || "Cadastro animal",
      requestTypeId: selectedRequestType?.id || "",
      fee: selectedRequestType?.fee || "",
      phone: requestData.phone || "",
      cpf: requestData.cpf || "",
      email: requestData.email || "",
      cep: requestData.cep || "",
      preferredSchedule: requestData.schedule || "",
      municipalityId: requestData.municipalityId || selectedScheduleDay?.municipalityId || "",
      scheduleTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
      scheduleSlotTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
      scheduleLocationName: selectedScheduleDay?.locationName || "",
      scheduleAddress: selectedScheduleDay?.locationAddress || "",
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
        scheduleTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
        scheduleSlotTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
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
        setSubmissionError("Não foi possível concluir: protocolo/chave de validação não foram gerados. Tente novamente.");
        return;
      }

      onDone?.(normalizeRequest({ ...localPayload, ...newRequest, protocol: generatedProtocol, validation_key: generatedValidationKey }));
    } catch (err) {
      setSubmissionError(err?.message || "Falha ao enviar solicitação. Tente novamente.");
    }
  }

  const stepperNode = (
    <div className="nr-stepper" aria-label="Etapas da solicitação">
      {formSteps.map((item, index) => {
        const isDone = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const hasIssue = submitAttempted && isCurrent && getStepIssues(item.step).length > 0;
        return (
          <React.Fragment key={item.step}>
            <button
              type="button"
              className={`nr-step${isCurrent ? " nr-step--current" : ""}${isDone ? " nr-step--done" : ""}${hasIssue ? " nr-step--invalid" : ""}`}
              disabled
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="nr-step-circle">
                {isDone ? <CheckCircle2 size={13} strokeWidth={2.5} /> : <span>{index + 1}</span>}
              </span>
              <span className="nr-step-label">{item.label}</span>
            </button>
            {index < formSteps.length - 1 && <span className="nr-step-connector" aria-hidden="true" />}
          </React.Fragment>
        );
      })}
    </div>
  );
  const inlineAnimalPhotoUpload = (
    <div className="animal-photo-upload-card animal-photo-upload-card--inline">
      <div>
        <strong>Foto de registro</strong>
        <span>{documentUploads.animal_photo?.fileName || "Opcional"}</span>
      </div>
      {documentUploads.animal_photo?.dataUrl && (
        <button className="animal-photo-preview" type="button" onClick={() => setPreviewDocument(documentUploads.animal_photo)} aria-label="Ver foto de registro">
          <img src={documentUploads.animal_photo.dataUrl} alt="Foto de registro animal" />
        </button>
      )}
      <div className="animal-photo-actions">
        <label className="icon-button file-button" title="Enviar foto" aria-label="Enviar foto">
          <UploadCloud size={17} />
          <input type="file" accept="image/*" onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} />
        </label>
        <label className="icon-button file-button" title="Abrir câmera" aria-label="Abrir câmera">
          <Camera size={17} />
          <input type="file" accept="image/*" capture="environment" onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} />
        </label>
        {documentUploads.animal_photo && (
          <button className="icon-button danger-action" type="button" onClick={() => removeDocumentFile("animal_photo")} title="Remover foto" aria-label="Remover foto">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );

  const internalCompact = compact && !publicFlow;
  const requestShellClassName = [
    "nr-shell",
    internalCompact ? "nr-shell--internal" : "",
    publicFlow ? "nr-shell--public" : "",
  ].filter(Boolean).join(" ");
  const externalLikeRegistration = publicFlow || internalSimple;
  const HealthField = externalLikeRegistration ? YesNoToggleField : YesNoField;
  const FoodField = externalLikeRegistration ? ToggleChoiceField : CompactChoiceField;

  return (
      <div className={requestShellClassName}>
        <div className={internalCompact ? "nr-topbar nr-topbar--internal" : "nr-topbar"}>
          {!internalCompact && !publicFlow && (
            <button className="nr-home-btn" type="button" onClick={onBack} aria-label="Início">
              <Home size={20} />
            </button>
          )}
          <div className="nr-topbar-stepper">{stepperNode}</div>
          {publicFlow && onBack && (
            <button className="nr-topbar-continue nr-topbar-home primary-action" type="button" onClick={onBack}>
              Voltar ao início
            </button>
          )}
        </div>

        <div className="nr-body">

          {submissionError && <p className="form-error">{submissionError}</p>}
          <div className="single-request-form clean-form">
          {formStep === 0 && <FormSection title="Tutor">
            {publicFlow ? (
              <>
                <div className="form-sub-card">
                  <span className="form-sub-card-title">Responsável e contato</span>
                  <div className="access-field" data-label="Nome completo">
                    <input type="text" placeholder="Nome do tutor ou responsável" value={requestData.tutor} onChange={(e) => updateRequestField("tutor", e.target.value)} />
                  </div>
                  <div className="two-column-fields">
                    <div className="access-field" data-label="CPF">
                      <input type="text" placeholder="000.000.000-00" value={requestData.cpf} onChange={(e) => updateMaskedRequestField("cpf", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="CadÚnico (se aplica)">
                      <div className="access-field-action-row">
                        <input type="text" placeholder="Número" value={requestData.cadUnico} onChange={(e) => updateRequestField("cadUnico", e.target.value)} readOnly={requestData.cadUnicoNotApplicable} />
                        <label className={`cadunico-square-toggle${!requestData.cadUnicoNotApplicable ? " is-checked" : ""}`}>
                          <input type="checkbox" checked={!requestData.cadUnicoNotApplicable} onChange={(event) => toggleCadUnicoNotApplicable(event.target.checked)} />
                          <span className="cadunico-check-box" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="two-column-fields">
                    <div className={`access-field${showInvalid("email") ? " is-invalid" : ""}`} data-label="Email">
                      <input type="email" placeholder="Email" value={requestData.email} onChange={(e) => updateRequestField("email", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="Telefone">
                      <input type="tel" placeholder="WhatsApp / celular" value={requestData.phone} onChange={(e) => updateMaskedRequestField("phone", e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="form-sub-card">
                  <span className="form-sub-card-title">Endereço</span>
                  <div className="address-lookup-grid">
                    <div className="access-field" data-label="CEP">
                      <input type="text" placeholder="00000-000" value={requestData.cep} onChange={(e) => lookupCep(e.target.value)} />
                    </div>
                    <div className="access-field" data-label="Número">
                      <input type="text" placeholder="Número" value={requestData.number} onChange={(e) => updateRequestField("number", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="UF">
                      <input type="text" placeholder="UF" value={requestData.state} maxLength={2} onChange={(e) => updateMaskedRequestField("state", e.target.value)} />
                    </div>
                  </div>
                  <div className="access-field" data-label="Endereço">
                    <input type="text" placeholder="Rua, complemento" value={requestData.address} onChange={(e) => updateRequestField("address", e.target.value)} />
                  </div>
                  <div className="address-city-grid">
                    <div className="access-field" data-label="Bairro">
                      <input type="text" placeholder="Bairro" value={requestData.neighborhood} onChange={(e) => updateRequestField("neighborhood", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="Cidade">
                      <input type="text" placeholder="Cidade" value={requestData.city} onChange={(e) => updateRequestField("city", e.target.value)} />
                    </div>
                  </div>
                  {requestData.latitude && requestData.longitude && <p className="map-selected-place">Localização registrada: {requestData.latitude}, {requestData.longitude}.</p>}
                </div>
              </>
            ) : (
              <>
                <div className="form-sub-card">
                  <span className="form-sub-card-title">Identificação</span>
                  <div className="two-column-fields">
                    <div className="access-field" data-label="Tutor">
                      <input type="text" placeholder="Nome do tutor ou responsável" value={requestData.tutor} onChange={(e) => updateRequestField("tutor", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="CPF">
                      <input type="text" placeholder="CPF (000.000.000-00)" value={requestData.cpf} onChange={(e) => updateMaskedRequestField("cpf", e.target.value)} />
                    </div>
                  </div>
                  <div className="cadunico-row">
                    <div className="access-field" data-label="CadÚnico">
                      <input type="text" placeholder="Número do CadÚnico" value={requestData.cadUnico} onChange={(e) => updateRequestField("cadUnico", e.target.value)} readOnly={requestData.cadUnicoNotApplicable} />
                    </div>
                    <label className="checkbox-row cadunico-checkbox">
                      <input type="checkbox" checked={!requestData.cadUnicoNotApplicable} onChange={(event) => toggleCadUnicoNotApplicable(event.target.checked)} />
                      Se aplica
                    </label>
                  </div>
                </div>

                <div className="form-sub-card">
                  <span className="form-sub-card-title">Endereço</span>
                  <div className="address-lookup-grid">
                    <div className="access-field" data-label="CEP">
                      <input type="text" placeholder="CEP (00000-000)" value={requestData.cep} onChange={(e) => lookupCep(e.target.value)} />
                    </div>
                    <div className="access-field" data-label="Número">
                      <input type="text" placeholder="Número" value={requestData.number} onChange={(e) => updateRequestField("number", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="UF">
                      <input type="text" placeholder="UF" value={requestData.state} maxLength={2} onChange={(e) => updateMaskedRequestField("state", e.target.value)} />
                    </div>
                  </div>
                  <div className="access-field" data-label="Endereço">
                    <input type="text" placeholder="Endereço (Rua, complemento)" value={requestData.address} onChange={(e) => updateRequestField("address", e.target.value)} />
                  </div>
                  <div className="address-city-grid">
                    <div className="access-field" data-label="Bairro">
                      <input type="text" placeholder="Bairro" value={requestData.neighborhood} onChange={(e) => updateRequestField("neighborhood", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="Cidade">
                      <input type="text" placeholder="Cidade" value={requestData.city} onChange={(e) => updateRequestField("city", e.target.value)} />
                    </div>
                  </div>
                  {requestData.latitude && requestData.longitude && <p className="map-selected-place">Localização registrada: {requestData.latitude}, {requestData.longitude}.</p>}
                </div>

                <div className="form-sub-card">
                  <span className="form-sub-card-title">Contato</span>
                  <div className="two-column-fields">
                    <div className={`access-field${showInvalid("email") ? " is-invalid" : ""}`} data-label="Email">
                      <input type="email" placeholder="Email" value={requestData.email} onChange={(e) => updateRequestField("email", e.target.value)} />
                    </div>
                    <div className="access-field" data-label="Telefone">
                      <input type="tel" placeholder="WhatsApp / celular" value={requestData.phone} onChange={(e) => updateMaskedRequestField("phone", e.target.value)} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </FormSection>}

          {formStep === 1 && <FormSection title="Dados do animal">

            {animals.map((animal, index) => {
              const isOpen = animals.length === 1 || expandedAnimal === index;
              const summary = [animal.species, animal.sex].filter(Boolean).join(" · ") || "Preencha os dados";
              const showTypeSelector = externalLikeRegistration && index === 0 && configuredRequestTypes.length > 0;
              return (
                <div className={`animal-form${isOpen ? " is-open" : " is-collapsed"}`} key={`animal-${index}`}>
                  {animals.length > 1 && (
                    <button
                      type="button"
                      className="animal-form-header animal-accordion-toggle animal-form-header--card"
                      onClick={() => setExpandedAnimal(isOpen ? -1 : index)}
                    >
                      <div className="animal-title-badge">{index + 1}</div>
                      <div className="animal-accordion-title">
                        <strong>Animal {index + 1}</strong>
                        <span className="animal-accordion-summary">{summary}</span>
                      </div>
                      <ChevronRight size={17} className={`animal-accordion-chevron${isOpen ? " is-open" : ""}`} />
                    </button>
                  )}

                  {isOpen && <>
                    <div className="form-sub-card">
                      <span className="form-sub-card-title">{showTypeSelector ? "Tipo e identificação" : "Identificação do animal"}</span>

                      <div className="animal-choice-grid species-row">
                        <CompactChoiceField label="Tipo de Procedimento" value={animal.procedureType} options={["Castração", "Microchipagem", "Ambos"]} onChange={(value) => updateAnimal(index, "procedureType", value)} />
                      </div>

                      {showTypeSelector && (
                        <div className={`anm-type-picker${showInvalid("type") ? " is-invalid" : ""}`}>
                          <span className="anm-type-label">Tipo de solicitação<span className="required-asterisk">*</span></span>
                          <div className="anm-type-cards">
                            {configuredRequestTypes.map((type) => (
                              <button
                                key={type.id || type.name}
                                type="button"
                                className={`anm-type-card${requestData.type === type.name ? " is-selected" : ""}`}
                                onClick={() => updateRequestField("type", type.name)}
                              >
                                {type.name}
                              </button>
                            ))}
                          </div>
                          {showInvalid("type") && <small className="field-error-message">Campo obrigatório</small>}
                        </div>
                      )}

                      <div className="animal-choice-grid three-col">
                        <CompactChoiceField label="Espécie" value={animal.species} options={activeSpecies} onChange={(value) => updateAnimal(index, "species", value)} invalid={submitAttempted && !animal.species} required />
                        <CompactChoiceField label="Sexo" value={animal.sex} options={["Macho", "Fêmea"]} onChange={(value) => updateAnimal(index, "sex", value)} invalid={submitAttempted && !animal.sex} required />
                        <CompactChoiceField label="Raça" value={animal.breedType} options={["Indefinida", "Definida"]} onChange={(value) => updateAnimal(index, "breedType", value)} invalid={submitAttempted && !animal.breedType} required />
                      </div>
                      {animal.breedType === "Definida" && (
                        <div className="access-field" data-label="Raça">
                          <input type="text" placeholder="Descreva a raça (Ex: Poodle, Siamês)" value={animal.breedDescription} onChange={(e) => updateAnimal(index, "breedDescription", e.target.value)} />
                        </div>
                      )}
                      {externalLikeRegistration ? (
                        <>
                          <CompactChoiceField label="Porte" value={animal.size} options={sizeChoiceOptions} onChange={(value) => updateAnimal(index, "size", value)} invalid={submitAttempted && !animal.size} required />
                          <div className="animal-choice-grid name-coat-age-row">
                            <div className="access-field" data-label="Nome">
                              <input type="text" placeholder="Ex: Bidu" value={animal.name} onChange={(e) => updateAnimal(index, "name", e.target.value)} />
                            </div>
                            <div className="access-field" data-label="Pelagem">
                              <input type="text" placeholder="Cor" value={animal.coat} onChange={(e) => updateAnimal(index, "coat", e.target.value)} />
                            </div>
                            <div className="access-field" data-label="Idade">
                              <input type="text" placeholder="Ex: 2 anos" value={animal.age || ""} onChange={(e) => updateAnimal(index, "age", e.target.value)} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="two-column-fields">
                            <div className="access-field" data-label="Nome">
                              <input type="text" placeholder="Nome do animal" value={animal.name} onChange={(e) => updateAnimal(index, "name", e.target.value)} />
                            </div>
                            <div className="access-field" data-label="Pelagem">
                              <input type="text" placeholder="Cor da pelagem" value={animal.coat} onChange={(e) => updateAnimal(index, "coat", e.target.value)} />
                            </div>
                          </div>
                          <div className="two-column-fields">
                            <div className="access-field" data-label="Idade">
                              <input type="text" placeholder="Idade aprox. (ex: 2 anos)" value={animal.age || ""} onChange={(e) => updateAnimal(index, "age", e.target.value)} />
                            </div>
                            <div className={`access-field${submitAttempted && !animal.size ? " is-invalid" : ""}`} data-label="Peso">
                              <input type="number" min="0" step="0.1" placeholder="Peso (kg)" value={animal.weight || ""} onChange={(event) => { const w = event.target.value; updateAnimal(index, "weight", w); updateAnimal(index, "size", detectSizeFromWeight(w)); }} />
                            </div>
                          </div>
                        </>
                      )}
                      {internalSimple && (
                        <div className="internal-microchip-row">
                          <div className="access-field" data-label="Microchip">
                            <input
                              type="text"
                              placeholder={animal.hasChip === "Sim" ? "Código do microchip" : "Microchip não informado"}
                              value={animal.microchip}
                              onChange={(event) => updateAnimal(index, "microchip", event.target.value)}
                              readOnly={animal.hasChip !== "Sim"}
                            />
                          </div>
                          <label className="doc-accept-check internal-chip-check">
                            <input
                              type="checkbox"
                              checked={animal.hasChip === "Sim"}
                              onChange={(event) => {
                                updateAnimal(index, "hasChip", event.target.checked ? "Sim" : "Nao");
                                if (!event.target.checked) updateAnimal(index, "microchip", "");
                              }}
                            />
                            <span className="doc-check-box" />
                            <span>Microchipado</span>
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="form-sub-card">
                      <span className="form-sub-card-title">Saúde e cuidados</span>
                      <div className="health-grid">
                        <HealthField label={externalLikeRegistration ? "Vermifugado" : "Vermifugado?"} value={animal.dewormed} onChange={(value) => updateAnimal(index, "dewormed", value)} />
                        <HealthField label={externalLikeRegistration ? "Vacinas em dia" : "Vacinas em dia?"} value={animal.vaccinated} onChange={(value) => updateAnimal(index, "vaccinated", value)} />
                        <HealthField label={externalLikeRegistration ? "Histórico de doenças" : "Histórico de doenças?"} value={animal.illnessHistory} onChange={(value) => updateAnimal(index, "illnessHistory", value)} />
                        <FoodField label={externalLikeRegistration ? "Alimentação exclusiva com ração" : "Alimentação"} value={animal.food} options={["Ração", "Diversos"]} onChange={(value) => updateAnimal(index, "food", value)} />
                      </div>
                    </div>
                    {internalSimple && inlineAnimalPhotoUpload}
                    {!externalLikeRegistration && animals.length > 1 && (
                      <button className="animal-remove-inline" type="button" onClick={() => { removeAnimal(index); setExpandedAnimal(Math.max(0, index - 1)); }}>
                        Remover animal {index + 1}
                      </button>
                    )}
                  </>}
                </div>
              );
            })}
            <div className={externalLikeRegistration ? "anm-actions-row" : undefined}>
              {externalLikeRegistration && animals.length > 1 && (
                <button
                  className="animal-remove-inline"
                  type="button"
                  onClick={() => {
                    const idx = expandedAnimal >= 0 ? expandedAnimal : animals.length - 1;
                    removeAnimal(idx);
                    setExpandedAnimal(Math.max(0, idx - 1));
                  }}
                >
                  Remover animal
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
              title={publicFlow ? "Escolha data e horário" : ""}
            />
            {internalSimple && (
              <label className="field internal-notes-field">
                <span>Observações internas</span>
                <textarea
                  value={requestData.notes}
                  onChange={(event) => updateRequestField("notes", event.target.value)}
                  placeholder="Registre orientações, atendimento no balcão ou ponto de atenção para a equipe."
                />
              </label>
            )}
          </FormSection>}

          {!internalSimple && formStep === 3 && <FormSection title="Documentos e termo">
            <div className="form-sub-card documents-step-card">
              <div className="documents-step-header">
                <span className="form-sub-card-title">Documentos e termo</span>
                <small>Anexe os comprovantes solicitados e confirme a declaração.</small>
              </div>

              <div className="documents-step-grid">
                <aside className="documents-photo-column">
                  <label className="doc-photo-zone doc-photo-zone--compact">
                    {documentUploads.animal_photo?.dataUrl ? (
                      <img className="doc-photo-preview" src={documentUploads.animal_photo.dataUrl} alt="Foto do animal" onClick={(e) => { e.preventDefault(); setPreviewDocument(documentUploads.animal_photo); }} />
                    ) : (
                      <div className="doc-photo-placeholder">
                        <ImagePlus size={22} />
                        <span>Foto do animal</span>
                        <small>Opcional</small>
                      </div>
                    )}
                    <input type="file" accept="image/*" onClick={(e) => { e.currentTarget.value = ""; }} onChange={(e) => handleAnimalPhotoFile(e.target.files?.[0])} />
                    {documentUploads.animal_photo && (
                      <button className="doc-photo-remove" type="button" onClick={(e) => { e.preventDefault(); removeDocumentFile("animal_photo"); }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </label>
                </aside>

                <div className="documents-main-column">
                  <div className="documents-list-card">
                    {!selectedRequestType && (
                      <div className="doc-empty-note">
                        <BadgeCheck size={16} />
                        <span>Nenhum documento obrigatório para este cadastro.</span>
                      </div>
                    )}
                    {selectedTypeDocuments.map((document) => {
                      const upload = documentUploads[document.id];
                      return (
                        <DocumentScannerUpload
                          key={document.id}
                          document={document}
                          upload={upload}
                          aiActive={aiSettings.active && document.analysisRules?.useAi !== false}
                          onUpload={(file) => handleDocumentFile(document, file)}
                          onRemove={() => removeDocumentFile(document.id)}
                        />
                      );
                    })}
                  </div>

                  <div className="doc-declaration">
                    <p>
                      O tutor declara ciência dos cuidados pré e pós-cirúrgicos e autoriza o registro do procedimento.{" "}
                      <button className="inline-link-button" type="button" onClick={openDeclarationPdf}>Ler declaração completa</button>
                    </p>
                    <label className={`doc-accept-check${showInvalid("accepted") ? " is-invalid" : ""}`}>
                      <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                      <span className="doc-check-box" />
                      <span>Li e concordo com os termos<span className="required-asterisk">*</span></span>
                    </label>
                    {showInvalid("accepted") && <small className="field-error-message">Campo obrigatório</small>}
                  </div>
                </div>
              </div>
            </div>
          </FormSection>}
          </div>
          {submissionError && <p className="form-error nr-bottom-error">{submissionError}</p>}
          <div className={`nr-nav-row${currentStepIndex === formSteps.length - 1 ? " nr-nav-row--final" : ""}`}>
            {currentStepIndex > 0 && (
              <button
                className="nr-back-btn primary-action"
                type="button"
                onClick={() => navigateToStep(formSteps[currentStepIndex - 1].step)}
              >
                Voltar
              </button>
            )}
            {formStep === 1 && (
              <button className="anm-add-btn" type="button" onClick={addAnimal}>
                Adicionar animal
              </button>
            )}
            {currentStepIndex < formSteps.length - 1 ? (
              <button
                className="nr-topbar-continue primary-action"
                type="button"
                onClick={() => navigateToStep(formSteps[currentStepIndex + 1].step)}
              >
                Próximo
                {publicFlow && <ChevronRight size={15} />}
              </button>
            ) : (
              <button
                className="nr-topbar-continue primary-action"
                type="button"
                disabled={submitting}
                onClick={submit}
              >
                {submitting ? "Enviando..." : internalSimple ? "Encerrar" : "Enviar"}
                {publicFlow && <ChevronRight size={15} />}
              </button>
            )}
          </div>
        </div>

        {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />}
      </div>
  );
}

const REQUEST_DECLARATION_ITEMS = [
  "A total responsabilidade pela realização da captura e acondicionamento dos animais até a condução para o centro de castração onde serão realizados os procedimentos operatórios de castração.",
  "Para fins de ordem legal, autorizo a prática dos procedimentos veterinário e declaro que estou ciente dos riscos inerentes a qualquer prática Anestésico-Cirúrgica Médico Veterinária, a ser procedida em meu animal.",
  "A total responsabilidade pela realização dos cuidados pré e pós-operatório dos procedimentos de castração.",
  "A total responsabilidade pela realização exames pré e pós-operatório dos procedimentos de castração que forem julgados como necessários pelos médicos veterinários do centro de castração, sem ônus para a FUNDAI.",
  "Que não utilizarei os encaminhamentos para procedimentos cirúrgicos para favorecer animais de terceiros ou não pertencentes ao município de Içara, assim como não cobrarei pelos serviços de encaminhamento.",
  "Que tenho como residência fixa o endereço acima informado.",
  "As informações descritas na solicitação serão conferidas com o animal no dia da cirurgia, caso essas informações não descrevam o animal, ele não passará pelo procedimento cirúrgico.",
  "Da solicitação cirúrgica para animais de raça de agricultores será realizado o procedimento após pagamento da taxa.",
  "Declaro que todas as informações prestadas e documentos anexos são verdadeiros e assumo a responsabilidade pelos mesmos sob as penas da lei e afirmo ter conhecimento da legislação pertinente ao objetivo deste requerimento.",
  "Declaro ainda, a inteira responsabilidade pelas informações contidas nessa declaração, estando ciente de que a omissão ou a apresentação de informações e/ou documentos falsos ou divergentes implicam na infração do art. 299 do Código Penal, além das medidas judiciais cabíveis.",
];

const REQUEST_RECOMMENDATION_ITEMS = [
  "Jejum hídrico e alimentar de 8 horas;",
  "Felinos levar em caixa de transporte;",
  "Levar roupinha cirúrgica se tiver ou colar Elizabetano.",
];

function buildDeclarationPdfHtml(requestData, animals = []) {
  const value = (input) => escapeHtml(String(input ?? "-"));
  const yesNo = (input) => input === true ? "Sim" : input === false ? "Não" : String(input || "-");
  const renderDataItem = (label, input) => `<div class="data-item"><span>${escapeHtml(label)}</span><strong>${value(input || "-")}</strong></div>`;
  const tutorFields = [
    ["Nome completo", requestData.tutor],
    ["CPF", requestData.cpf],
    ["Celular", requestData.phone],
    ["Email", requestData.email],
    ["CEP", requestData.cep],
    ["Endereço", requestData.address],
    ["Número", requestData.number],
    ["Bairro", requestData.neighborhood],
    ["Cidade", requestData.city],
    ["UF", requestData.state],
    ["CadÚnico", requestData.cadUnicoNotApplicable ? "Não se aplica" : requestData.cadUnico],
    ["Agricultor", yesNo(requestData.isFarmer)],
    ["Tipo de solicitação", requestData.type],
    ["Data da agenda", requestData.schedule],
    ["Observações", requestData.notes],
  ];
  const animalFieldLabels = [
    ["Nome", "name"],
    ["Espécie", "species"],
    ["Procedimento", "procedureType"],
    ["Sexo", "sex"],
    ["Raça", "breedType"],
    ["Descrição da raça", "breedDescription"],
    ["Porte", "size"],
    ["Peso", "weight"],
    ["Idade", "age"],
    ["Data de nascimento", "birthDate"],
    ["Pelagem", "coat"],
    ["Possui microchip", "hasChip"],
    ["Microchip", "microchip"],
    ["Vermifugado", "dewormed"],
    ["Vacinas em dia", "vaccinated"],
    ["Histórico de doenças", "illnessHistory"],
    ["Alimentação", "food"],
  ];
  const animalRows = (animals.length ? animals : [{}]).map((animal, index) => `
    <div class="animal-card">
      <div class="animal-card-title">Animal ${index + 1}</div>
      <div class="data-grid compact-four">
        ${animalFieldLabels.map(([label, key]) => renderDataItem(label, animal?.[key])).join("")}
      </div>
    </div>
  `).join("");
  const declarationItems = REQUEST_DECLARATION_ITEMS;
  const recommendationItems = REQUEST_RECOMMENDATION_ITEMS;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Declaração da solicitação</title>
    <style>${PDF_BASE_STYLES}</style>
  </head>
  <body>
    <main class="pdf-page pdf-page--compact">
      <header class="pdf-header compact-header">
        <div>
          <h1>Dados informados para castração animal</h1>
        </div>
        <div class="header-box"><span>Data</span><strong>${new Date().toLocaleDateString("pt-BR")}</strong></div>
      </header>
      <section class="section compact-section">
        <div class="section-title">Dados do tutor</div>
        <div class="data-grid compact-four">
          ${tutorFields.map(([label, input]) => renderDataItem(label, input)).join("")}
        </div>
      </section>
      <section class="section compact-section">
        <div class="section-title">Dados do animal</div>
        ${animalRows}
      </section>
      <footer class="footer"><span>Sistema municipal de castração animal</span><span>Página 1 de 2</span></footer>
    </main>

    <main class="pdf-page declaration-page">
      <section class="declaration-document">
        <h1>DECLARAÇÃO DE RESPONSABILIDADES</h1>
        <h2>CASTRAÇÃO ANIMAL</h2>
        <p class="declaration-lead">Declaro para fins civis, penais e administrativos:</p>
        <ul class="responsibility-list">
          ${declarationItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          <li>
            Recomendações:
            <ul class="recommendation-list">
              ${recommendationItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </li>
        </ul>
      </section>
      <footer class="footer"><span>Sistema municipal de castração animal</span><span>Página 2 de 2</span></footer>
    </main>
  </body>
</html>`;
}
function DocumentPreviewModal({ document, onClose }: AnyRecord) {
  const dataUrl = getDocumentPreviewSource(document);
  const mimeType = document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl);
  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const canPreview = Boolean(dataUrl) && (isImage || isPdf);

  return (
    <div className="modal-backdrop">
      <div className="document-preview-modal" role="dialog" aria-modal="true">
        <ModalHeader title={document.documentName || document.fileName} subtitle={document.fileName !== (document.documentName || document.fileName) ? document.fileName : undefined} onClose={onClose} />
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

export function ToastContainer({ toasts, onDismiss }: AnyRecord) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" role="region" aria-live="polite">
      {toasts.map((toast: AnyRecord) => (
        <div key={toast.id} className={`toast toast--${toast.type}`} onClick={() => onDismiss(toast.id)}>
          <span className="toast-msg">{toast.message}</span>
          <button className="toast-close" type="button" aria-label="Fechar" onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}>×</button>
        </div>
      ))}
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
  municipalities = [],
  globalSearch = "",
  accessRequests = [],
  setActive,
}) {
  const [requestFilter, setRequestFilter] = useState("inbox");
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [toasts, setToasts] = useState<AnyRecord[]>([]);

  function showToast(message: string, type: "success" | "error" | "info" | "warning" = "success") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), type === "error" ? 6000 : 4000);
  }

  const {
    previewRequest,
    openRequest: openRequestPreview,
    closePreview: closeRequestPreview,
    activeSectors,
    activeUsers,
    activeScheduleDays,
    approveRequest,
    archiveWithTag,
    rescheduleFromPreview,
    assignFromPreview,
    assumeFromPreview,
    rejectRequestFromProcess,
    confirmAttendanceFromProcess,
    confirmSpecialRequest,
  } = useRequestActions({ patchRequest, currentUser, teams, requests, scheduleDays, showToast, setSelectedId });

  const visibleRequests = useMemo(
    () => (Array.isArray(requests) ? requests : [])
      .map(normalizeRequest)
      .filter((request) => matchesRequestSearch(request, globalSearch)),
    [requests, globalSearch],
  );
  const visibleAccessRequests = useMemo(
    () => (Array.isArray(accessRequests) ? accessRequests : [])
      .filter((item) => matchesRequestSearch({ tutor: item.responsibleName, animals: [] }, globalSearch))
      .map((item) => ({
        __source: "access_request",
        id: item.id,
        protocol: String(item.id || "").slice(0, 8).toUpperCase() || "SEM-ID",
        tutor: item.responsibleName || item.organizationName || "Solicitante",
        animals: [{ name: item.organizationName || item.requesterLabel || "Credenciamento" }],
        responsible: item.assignedSector || "",
        preferredSchedule: "",
        appointment: "",
        status: item.status === "APROVADO" ? "REALIZADA" : item.status === "RECUSADO" ? "CANCELADA" : "NOVA",
        tags: [],
        rescheduleCount: 0,
      })),
    [accessRequests, globalSearch],
  );
  const today = formatScheduleDate(new Date());
  const filterTabs = [
    {
      id: "inbox",
      label: "Novas",
      requests: [
        ...visibleRequests.filter((r) => r.status === "NOVA" && !r.tags.includes("ATRIBUIDA")),
        ...visibleAccessRequests.filter((r) => r.status === "NOVA"),
      ],
    },
    {
      id: "analysis",
      label: "Em análise",
      requests: visibleRequests.filter(
        (r) => r.status === "NOVA" && r.tags.includes("ATRIBUIDA"),
      ),
    },
    {
      id: "scheduled",
      label: "Agendadas",
      requests: visibleRequests.filter(
        (r) => r.status === "AGENDADA" && !r.tags.includes("REAGENDADA"),
      ),
    },
    {
      id: "rescheduled",
      label: "Reagendadas",
      requests: visibleRequests.filter(
        (r) => r.status === "AGENDADA" && r.tags.includes("REAGENDADA"),
      ),
    },
    {
      id: "done",
      label: "Realizadas",
      requests: visibleRequests.filter(
        (r) => r.status === "REALIZADA",
      ),
    },
    {
      id: "canceled",
      label: "Canceladas",
      requests: visibleRequests.filter(
        (r) => r.status === "CANCELADA",
      ),
    },
    { id: "all", label: "Todas", requests: visibleRequests },
  ];
  const todayRequests = visibleRequests.filter((r) => isRequestOnScheduleDate(r, today));
  const activeTab = filterTabs.find((tab) => tab.id === requestFilter) || filterTabs[0];
  const activeRequests = todayOnly ? todayRequests : activeTab.requests;
  async function notAttendedRequest(request) {
    const patch = { status: "CANCELADA", workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason: "Não compareceu" } };
    try {
      await patchRequest?.(request.id, patch, `Não comparecimento registrado por ${currentUser.name}`);
      showToast("Não comparecimento registrado", "info");
    } catch { showToast("Erro ao registrar não comparecimento", "error"); }
  }

  return (
    <section className="request-workspace triage-workspace clean-requests-workspace">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((t) => t.id !== id))} />
      <div className="page-toolbar request-page-controls">
          <div className="page-actions workspace-heading-actions">
            <button className="primary-action" type="button" onClick={() => setCreateRequestOpen(true)}>
              <Plus size={18} />
              Criar Solicitação
            </button>
          </div>

          <nav className="request-nav" aria-label="Filtros de solicitações">
            <div className="request-filter-tabs">
              {filterTabs.map((tab) => (
                <button key={tab.id} type="button" data-tab={tab.id} className={!todayOnly && requestFilter === tab.id ? "selected" : ""} onClick={() => { setRequestFilter(tab.id); setTodayOnly(false); }}>
                  {tab.label}<span>{tab.requests.length}</span>
                </button>
              ))}
            </div>
            <div className="request-today-segment">
              <button
                type="button"
                className={todayOnly ? "selected" : ""}
                aria-pressed={todayOnly}
                onClick={() => setTodayOnly((current) => !current)}
              >
                <CalendarDays size={14} />
                Hoje
                <span>{todayRequests.length}</span>
              </button>
            </div>
          </nav>
      </div>
      <div className="triage-card-grid">
        {activeRequests.length === 0 && <EmptyState title={todayOnly ? "Nenhuma agenda para hoje" : "Nenhuma solicitação nesta etapa"} text={todayOnly ? "Solicitações sem agendamento para hoje não entram neste recorte." : "Quando houver registros, eles aparecerão aqui."} />}
        {activeRequests.map((request) => {
          const isAccessRequest = request.__source === "access_request";
          function openCard() {
            if (isAccessRequest) setActive?.("credenciamento");
            else openRequestPreview(request);
          }
          return (
          <article
            className="triage-card clickable-triage-card"
            key={request.id}
            role="button"
            tabIndex={0}
            aria-label={`Abrir solicitação #${request.protocol}`}
            onClick={openCard}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCard();
              }
            }}
          >
            <div className="tc-row">
              <div className="tc-col tc-col--protocol">
                <span className="tc-label">Protocolo</span>
                <span className="tc-value tc-protocol">#{request.protocol}</span>
              </div>
              <div className="tc-col tc-col--tutor">
                <span className="tc-label">Tutor</span>
                <span className="tc-value">{displayText(request.tutor)}</span>
              </div>
              <div className="tc-col tc-col--animal">
                <span className="tc-label">Animal</span>
                <span className="tc-value">{request.animals.map((a) => displayText(a.name)).join(", ") || "-"}</span>
              </div>
              <div className="tc-col tc-col--tipo">
                <span className="tc-label">Tipo</span>
                <span className="tc-value">{isAccessRequest ? "Credenciamento" : requestTypeLabel(request)}</span>
              </div>
              <div className="tc-col tc-col--responsavel">
                <span className="tc-label">Responsável</span>
                <span className="tc-value">{displayText(request.responsible) || "-"}</span>
              </div>
              <div className="tc-col tc-col--agenda">
                <span className="tc-label">Agenda</span>
                <span className="tc-value">{request.preferredSchedule || request.appointment || "-"}</span>
              </div>
              <div className="tc-col tc-col--status">
                {(request.status === "REALIZADA" || request.status === "CANCELADA") ? (
                  <span className={`tc-result-badge tc-result-badge--${request.status === "REALIZADA" ? "success" : "canceled"}`}>
                    {request.status === "REALIZADA" ? "Realizada" : "Cancelada"}
                  </span>
                ) : (
                  <StatusBadge status={request.status} className={`triage-status-badge ${triageStatusTone(request)}`} />
                )}
                {request.rescheduleCount > 0 && (
                  <span className="prm-reschedule-badge">
                    {request.rescheduleCount === 1 ? "Reagendado" : `Reagendado ${request.rescheduleCount}x`}
                  </span>
                )}
              </div>
            </div>
          </article>
          );
        })}
      </div>

      {previewRequest && (
        <RequestPreviewModal
          request={previewRequest}
          requestTypes={requestTypes}
          scheduleDays={activeScheduleDays}
          sectors={activeSectors}
          users={activeUsers}
          municipalities={municipalities}
          onClose={closeRequestPreview}
          onApprove={approveRequest}
          onReject={rejectRequestFromProcess}
          onArchive={archiveWithTag}
          onAttendance={confirmAttendanceFromProcess}
          onReschedule={rescheduleFromPreview}
          onAssign={assignFromPreview}
          onAssume={assumeFromPreview}
          onConfirmSpecial={confirmSpecialRequest}
          patchRequest={patchRequest}
        />
      )}

      {createRequestOpen && (
        <div className="modal-backdrop">
          <div className="config-modal internal-request-modal" role="dialog" aria-modal="true">
            <div className="irm-header">
              <div className="irm-header-text">
                <strong>Nova solicitação</strong>
              </div>
              <button className="irm-close-btn" type="button" aria-label="Fechar" onClick={() => setCreateRequestOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <NewRequest
              createRequest={async (payload) => {
                const result = await createRequest?.(payload);
                if (result?.protocol) showToast(`Cadastro criado — Protocolo #${result.protocol}`, "success");
                return result;
              }}
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

    </section>
  );
}

function isAnimalPhotoDocument(d: AnyRecord = {}) {
  return d.documentId === "animal_photo" || d.documentName === "Foto de registro animal";
}

export function RequestPreviewModal({ request, onClose, onApprove, onReject, onArchive, onAttendance, onReschedule, onAssign, onAssume, onConfirmSpecial, patchRequest, requestTypes = [], scheduleDays = [], sectors = [], users = [], municipalities = [] }: AnyRecord) {
  const normalizedRequest = normalizeRequest(request);
  const isInternal = normalizedRequest.origin === "INTERNA" || normalizedRequest.origin === "BALCAO";
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState("");
  const [downloadLoadingId, setDownloadLoadingId] = useState("");
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);
  const [activePanel, setActivePanel] = useState<"reject" | "reschedule" | "assign" | "confirmComplaint" | null>(null);
  const [rejectData, setRejectData] = useState({ category: "", note: "" });
  const [complaintResolutionNote, setComplaintResolutionNote] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [docDecisions, setDocDecisions] = useState<AnyRecord>({});
  const [modalTab, setModalTab] = useState<"procedimento" | "anexos">(
    normalizedRequest.status === "AGENDADA" ? "procedimento" : "anexos",
  );
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState("");
  const [manualRescheduleDate, setManualRescheduleDate] = useState("");
  const [attendanceData, setAttendanceData] = useState({
    microchip: normalizedRequest.animalMicrochip || normalizedRequest.animals?.find((animal) => animal.microchip)?.microchip || "",
    receita: normalizedRequest.workflow_data?.attendancePrescription || normalizedRequest.workflowData?.attendancePrescription || "",
    note: normalizedRequest.attendanceNote || "",
  });
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [assignData, setAssignData] = useState({
    sectorId: normalizedRequest.assignedSectorId || sectors[0]?.id || "",
    userId: normalizedRequest.assignedUserId || "",
  });

  const canAnalyze = normalizedRequest.status === "NOVA";
  const isScheduleConfirmed = normalizedRequest.status === "AGENDADA";
  const specialSection = getSpecialRequestSection(normalizedRequest);
  const isSpecialType = Boolean(specialSection);
  const isComplaint = normalizeRequestType(normalizedRequest.request_type || normalizedRequest.type) === RequestType.COMPLAINT;
  const canUseProcedureTab = isScheduleConfirmed || (isSpecialType && canAnalyze);
  const canUseAttendanceActions = isScheduleConfirmed;
  const procedureTabLabel = isSpecialType ? requestTypeLabel(normalizedRequest) : "Procedimento e saúde";
  const procedureTabBlockReason = canUseProcedureTab ? procedureTabLabel : "Disponível após confirmar a agenda";
  const hasProcessAssignment = Boolean(normalizedRequest.assignedSectorId && normalizedRequest.assignedUserId);
  const blockWithoutAssignment = !hasProcessAssignment && !isInternal;
  const assignmentRequiredTitle = isInternal ? "" : "Atribua um setor e um usuário ao processo antes de analisar";
  const assumeDisabledTitle = "Assumir este processo";

  const uploadedDocs = getUserUploadedProcessDocuments(request.documents);
  const requestTypeConfig = requestTypes.find(
    (t) => (t.id && t.id === request.requestTypeId) || t.name === request.type,
  );
  const requiredDocTypes = (requestTypeConfig?.documents || [])
    .map(normalizeDocumentType)
    .filter((dt) => dt.active !== false && wasDocumentConfiguredForRequest(dt, normalizedRequest));

  const normalizedRequestTypeValue = normalizeRequestType(normalizedRequest.request_type || normalizedRequest.type);
  const requestDocumentKindByType: AnyRecord = {
    [RequestType.TUTOR_TRANSFER]: "tutor-transfer-request",
    [RequestType.ANIMAL_DEATH]: "death-registration-request",
    [RequestType.COMPLAINT]: "complaint-request",
  };
  const requestDocumentKind = requestDocumentKindByType[normalizedRequestTypeValue] || "request";
  const requestDocumentLabel = requestTypeDomainLabels[normalizedRequestTypeValue] || "Requerimento municipal";

  const requerimento = {
    id: `requerimento-${request.protocol || request.id || "processo"}`,
    kind: requestDocumentKind,
    nome: `${requestDocumentLabel} ${request.protocol || ""}.pdf`.trim(),
    tipo: requestDocumentLabel,
    status: "Gerado",
    available: true,
    required: false,
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

  const animalPhotoUpload = uploadedDocs.find(isAnimalPhotoDocument);
  const animalPhotoRow = animalPhotoUpload ? {
    id: animalPhotoUpload.documentId || animalPhotoUpload.fileName || "animal_photo",
    kind: "photo",
    nome: animalPhotoUpload.fileName || animalPhotoUpload.documentName || "Foto de registro animal",
    tipo: animalPhotoUpload.documentName || "Foto de registro animal",
    status: "Anexado",
    message: "Foto de identificação do animal — usada como identidade 3x4 nos documentos de prontuário. Não requer validação.",
    available: true,
    document: animalPhotoUpload,
  } : null;

  const extraDocs = uploadedDocs
    .filter((d) => !isAnimalPhotoDocument(d) && !requiredDocTypes.find((dt) => d.documentName === dt.name || d.documentId === dt.id))
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

  const anexos = [requerimento, ...(animalPhotoRow ? [animalPhotoRow] : []), ...requiredRows, ...extraDocs];

  const rejectionReasons = [
    "Documentação incompleta",
    "Animal inelegível",
    "Fora da área de atendimento",
    "Solicitação duplicada",
    "Tutor não localizado",
    "Outro",
  ];

  const principalAnimal = normalizedRequest.animals?.[0] || {};
  const wf = normalizedRequest.workflowData || normalizedRequest.workflow_data || {};
  const [animalData, setAnimalData] = useState({
    doencas: principalAnimal.doencas || wf.doencas || "",
    alergias: principalAnimal.alergias || wf.alergias || "",
  });

  function statusClass(status) {
    if (status === "Aprovado") return "approved";
    if (status === "Recusado") return "rejected";
    if (status === "Não enviado") return "missing";
    if (status === "Gerado" || status === "Anexado") return "generated";
    return "pending";
  }

  function getAiStatusLabel(anexo, decision) {
    if (decision === "approved") return "Documento: aprovado manual";
    if (decision === "rejected") return "Documento: recusado manual";
    if (anexo.status === "Aprovado") return "Análise: aprovado";
    if (anexo.status === "Recusado") return "Análise: recusado";
    if (anexo.status === "Gerado") return "Sistema";
    if (anexo.status === "Anexado") return "Sem validação necessária";
    if (anexo.status === "Não enviado") return "Pendente";
    return "Aguardando";
  }

  function getAttachmentConfidenceText(anexo) {
    const numericConfidence = Number(anexo.document?.confidence);
    if (!Number.isFinite(numericConfidence)) return "";
    return `${Math.round(numericConfidence > 1 ? numericConfidence : numericConfidence * 100)}%`;
  }

  function getAttachmentDecision(anexo) {
    return docDecisions[anexo.id] || "";
  }

  function isSystemDocument(anexo) {
    return anexo.kind === "request" || anexo.status === "Gerado";
  }

  function isAnimalPhotoAttachment(anexo) {
    return anexo.kind === "photo";
  }

  function isAttachmentAiApproved(anexo) {
    return statusClass(anexo.status) === "approved" || anexo.document?.status === "approved";
  }

  function isAttachmentRejected(anexo) {
    return statusClass(anexo.status) === "rejected" || anexo.document?.status === "rejected";
  }

  function isRequiredAttachment(anexo) {
    return anexo.required === true || requiredRows.some((row) => row.id === anexo.id);
  }

  function isAttachmentAccepted(anexo) {
    const decision = getAttachmentDecision(anexo);
    if (decision === "approved") return true;
    if (decision === "rejected") return false;
    return isSystemDocument(anexo) || isAnimalPhotoAttachment(anexo) || isAttachmentAiApproved(anexo);
  }

  function requiresManualDocumentDecision(anexo) {
    return canAnalyze
      && anexo.available
      && isRequiredAttachment(anexo)
      && !isSystemDocument(anexo)
      && !isAnimalPhotoAttachment(anexo)
      && !isAttachmentAiApproved(anexo)
      && !isAttachmentRejected(anexo);
  }

  function isAttachmentBlockingSchedule(anexo) {
    if (!isRequiredAttachment(anexo) || isSystemDocument(anexo) || isAnimalPhotoAttachment(anexo)) return false;
    const decision = getAttachmentDecision(anexo);
    if (decision === "approved") return false;
    if (decision === "rejected") return true;
    return !isAttachmentAccepted(anexo);
  }

  function getAttachmentReviewMessage(anexo, decision) {
    if (!anexo.available) return "Documento não enviado.";
    if (decision === "approved") return "Documento aprovado manualmente na conferência.";
    if (decision === "rejected") return "Documento recusado manualmente na conferência.";
    if (isSystemDocument(anexo)) return "Documento gerado pelo sistema.";
    if (isAnimalPhotoAttachment(anexo)) return "Anexo informativo, sem validação necessária.";
    if (isAttachmentAiApproved(anexo)) return "IA aprovou este documento pelos critérios cadastrados. Revisão manual opcional.";
    if (isAttachmentRejected(anexo)) return "Documento recusado pela análise automática.";
    if (requiresManualDocumentDecision(anexo)) return "Documento precisa de conferência antes de confirmar agenda.";
    return anexo.message || "Documento disponível para consulta.";
  }

  const blockingAttachments = canAnalyze ? anexos.filter(isAttachmentBlockingSchedule) : [];
  const canConfirmSchedule = canAnalyze && !blockWithoutAssignment && blockingAttachments.length === 0;
  const scheduleBlockReason = blockWithoutAssignment
    ? assignmentRequiredTitle
    : blockingAttachments.length
      ? "Resolva os anexos obrigatórios: " + blockingAttachments.map((item) => item.tipo).join(", ")
      : "Confirmar agenda";

  useEffect(() => {
    setModalTab(canUseProcedureTab ? "procedimento" : "anexos");
  }, [canUseProcedureTab, normalizedRequest.id]);

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

  function describeAttachmentBlock(anexo) {
    if (!anexo.available) return `${anexo.tipo}: documento não enviado`;
    const decision = getAttachmentDecision(anexo);
    if (decision === "rejected" || isAttachmentRejected(anexo)) return `${anexo.tipo}: documento recusado`;
    return `${anexo.tipo}: aguardando conferência`;
  }

  function buildDocumentRejectionNote(items = blockingAttachments) {
    const targets = (items.length ? items : blockingAttachments).map(describeAttachmentBlock);
    return targets.length
      ? `Indeferimento por documentação obrigatória: ${targets.join("; ")}.`
      : "Indeferimento por documentação obrigatória.";
  }

  function openDocumentRejectPanel(items = blockingAttachments) {
    setRejectData((current) => ({
      category: current.category || "Documentação incompleta",
      note: current.note || buildDocumentRejectionNote(items),
    }));
    setActivePanel("reject");
  }

  function confirmRejectInline(event) {
    event.preventDefault();
    if (blockWithoutAssignment) return;
    onReject?.(request, rejectData);
  }

  function confirmComplaintInline(event) {
    event.preventDefault();
    if (blockWithoutAssignment) return;
    onConfirmSpecial?.(request, { note: complaintResolutionNote });
  }

  function confirmAttendanceInline(event) {
    event.preventDefault();
    onAttendance?.(request, { ...attendanceData, animalData });
  }

  async function handleEvidenceUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !patchRequest) return;
    setUploadingEvidence(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const currentDocuments = Array.isArray(request.documents) ? request.documents : [];
      const newDocument = {
        documentId: `evidencia-${Date.now()}`,
        documentName: "Evidência da apuração",
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        dataUrl,
        status: "approved",
        message: "Anexado pela equipe durante a apuração.",
      };
      await patchRequest(request.id, { documents: [...currentDocuments, newDocument] }, `Evidência anexada: ${file.name}`);
    } catch {
      // erro de upload é reportado via estado de disabled/loading; a lista de anexos não é atualizada em caso de falha
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function confirmSchedule() {
    if (!canConfirmSchedule || confirmingSchedule) return;
    setConfirmingSchedule(true);
    try {
      const decisions = Object.entries(docDecisions).filter(([, decision]) => decision === "approved" || decision === "rejected");
      if (decisions.length && patchRequest) {
        const currentDocuments = Array.isArray(request.documents) ? request.documents : [];
        const updatedDocuments = currentDocuments.map((document) => {
          const row = anexos.find((anexo) => anexo.document === document
            || anexo.document?.documentId === document.documentId
            || anexo.document?.fileName === document.fileName
            || anexo.id === document.documentId
            || anexo.id === document.fileName);
          const decision = row ? docDecisions[row.id] : "";
          if (decision !== "approved" && decision !== "rejected") return document;
          return {
            ...document,
            status: decision,
            message: document.message || (decision === "approved" ? "Documento aprovado manualmente na conferência." : "Documento recusado manualmente na conferência."),
          };
        });
        await patchRequest(request.id, { documents: updatedDocuments }, "Documentos conferidos antes da agenda");
      }
      onApprove?.(request);
    } finally {
      setConfirmingSchedule(false);
    }
  }

  function renderAttachments() {
    return (
      <div className="process-attachments-list">
        {anexos.map((anexo) => {
          const decision = getAttachmentDecision(anexo);
          const canManuallyDecide = requiresManualDocumentDecision(anexo);
          const canRejectByAttachment = canAnalyze && isAttachmentBlockingSchedule(anexo);
          const statusKind = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : statusClass(anexo.status);
          const confidenceText = getAttachmentConfidenceText(anexo);
          const reviewMessage = getAttachmentReviewMessage(anexo, decision);
          const canOpenAttachment = anexo.available;
          const rowClassName = `process-attachment-row process-attachment-row--${statusKind}${canRejectByAttachment ? " is-blocking" : ""}`;
          return (
            <article className={rowClassName} key={`${anexo.kind}-${anexo.id}`}>
              <div className="process-attachment-main">
                <span className="process-attachment-icon-box">
                  <FileText size={15} className="process-attachment-icon" />
                </span>
                <div className="process-attachment-info">
                  <div className="process-attachment-heading">
                    <strong>{anexo.tipo}</strong>
                    <span className={`attachment-status attachment-status--${statusKind}`}>
                      {getAiStatusLabel(anexo, decision)}
                    </span>
                    {confidenceText && <span className="attachment-confidence">{confidenceText} confiança</span>}
                  </div>
                  <p className="attachment-ai-message">{reviewMessage}</p>
                  {Boolean(anexo.document?.provider) && !anexo.document?.error && (
                    <div className="attachment-ai-details">
                      <AiAnalysisDetails
                        show
                        provider={anexo.document?.provider}
                        model={anexo.document?.model}
                        confidence={anexo.document?.confidence}
                        criteriaResults={anexo.document?.criteriaResults}
                        showMeta={false}
                        criteriaClassName="doc-criteria-results attachment-ai-criteria"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="process-attachment-actions">
                {canManuallyDecide && (
                  <div className="process-attachment-decision-actions" aria-label={`Conferência de ${anexo.tipo}`}>
                    <button
                      className={`doc-decision-btn doc-decision-btn--approve${decision === "approved" ? " doc-decision-btn--active-ok" : ""}`}
                      type="button"
                      title={blockWithoutAssignment ? assignmentRequiredTitle : "Aprovar documento"}
                      disabled={blockWithoutAssignment}
                      onClick={() => setDocDecisions((d) => ({ ...d, [anexo.id]: decision === "approved" ? undefined : "approved" }))}
                    ><CheckCircle2 size={15} /></button>
                    <button
                      className={`doc-decision-btn doc-decision-btn--reject${decision === "rejected" ? " doc-decision-btn--active-reject" : ""}`}
                      type="button"
                      title={blockWithoutAssignment ? assignmentRequiredTitle : "Recusar documento"}
                      disabled={blockWithoutAssignment}
                      onClick={() => setDocDecisions((d) => ({ ...d, [anexo.id]: decision === "rejected" ? undefined : "rejected" }))}
                    ><X size={15} /></button>
                  </div>
                )}
                {canOpenAttachment ? (
                  <div className="process-attachment-file-actions" aria-label={`Ações de ${anexo.tipo}`}>
                    <button className="icon-action" title="Visualizar" type="button" disabled={previewLoadingId === anexo.id} onClick={() => handlePreview(anexo)}>
                      <Eye size={16} />
                    </button>
                    <button className="icon-action" title="Baixar" type="button" disabled={downloadLoadingId === anexo.id} onClick={() => handleDownload(anexo)}>
                      <Download size={16} />
                    </button>
                  </div>
                ) : (
                  <span className="attachment-unavailable"><X size={14} />Não enviado</span>
                )}
                {canRejectByAttachment && (
                  <button
                    className="prm-attachment-reject-btn"
                    type="button"
                    title={blockWithoutAssignment ? assignmentRequiredTitle : `Indeferir por ${anexo.tipo}`}
                    disabled={blockWithoutAssignment}
                    onClick={() => openDocumentRejectPanel([anexo])}
                  >
                    Indeferir
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  }
  function renderAssignModal() {
    const sectorUsers = users.filter((u) => !assignData.sectorId || userBelongsToSector(u, assignData.sectorId));
    return (
      <div className="assign-modal-overlay" onClick={() => setActivePanel(null)}>
        <div className="assign-modal" onClick={(e) => e.stopPropagation()}>
          <div className="assign-modal-header">
            <strong><ClipboardList size={15} /> Atribuir responsável</strong>
            <button className="assign-modal-close" type="button" onClick={() => setActivePanel(null)} aria-label="Fechar"><X size={16} /></button>
          </div>
          <label className="field">
            <span>Setor</span>
            <select value={assignData.sectorId} onChange={(e) => setAssignData((d) => ({ ...d, sectorId: e.target.value, userId: "" }))}>
              <option value="">Selecione o setor...</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Usuário</span>
            <select value={assignData.userId} onChange={(e) => setAssignData((d) => ({ ...d, userId: e.target.value }))}>
              <option value="">Selecione o usuário...</option>
              {sectorUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <div className="assign-modal-actions">
            <button className="ghost-button" type="button" onClick={() => setActivePanel(null)}>Cancelar</button>
            <button
              className="primary-action"
              type="button"
              disabled={!assignData.sectorId || !assignData.userId}
              onClick={() => { onAssign?.(request, assignData); setActivePanel(null); }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderInlineReschedule() {
    function maskScheduleDateInput(value: string) {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
      if (digits.length <= 2) return digits;
      if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    function isValidManualScheduleDate(value: string) {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
      const [day, month, year] = value.split("/").map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
        && !isPastScheduleDay(value);
    }

    function selectRescheduleDate(date: string) {
      setSelectedRescheduleDate(date);
      setManualRescheduleDate(date);
    }

    function updateManualRescheduleDate(value: string) {
      const nextDate = maskScheduleDateInput(value);
      setManualRescheduleDate(nextDate);
      setSelectedRescheduleDate(isValidManualScheduleDate(nextDate) ? nextDate : "");
    }

    function cancelReschedule() {
      setSelectedRescheduleDate("");
      setManualRescheduleDate("");
      setRescheduleReason("");
      setActivePanel(null);
    }

    function confirmReschedule() {
      if (!selectedRescheduleDate) return;
      onReschedule?.(request, selectedRescheduleDate, rescheduleReason);
      setSelectedRescheduleDate("");
      setManualRescheduleDate("");
      setRescheduleReason("");
      setActivePanel(null);
    }

    return (
      <div className="prm-inline-panel">
        <div className="prm-inline-panel-heading">
          <strong className="prm-inline-panel-title"><CalendarDays size={14} /> Reagendar atendimento</strong>
          <div className="prm-reschedule-date-group">
            <span className="prm-reschedule-current">Atual: {normalizedRequest.preferredSchedule || normalizedRequest.appointment || "-"}</span>
            <input
              className="prm-reschedule-date-input"
              value={manualRescheduleDate}
              onChange={(event) => updateManualRescheduleDate(event.target.value)}
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              aria-label="Data especifica"
            />
          </div>
        </div>
        <label className="field prm-reschedule-reason">
          <textarea
            value={rescheduleReason}
            onChange={(event) => setRescheduleReason(event.target.value)}
            placeholder="Motivo operacional"
            aria-label="Motivo do reagendamento"
          />
        </label>
        {scheduleDays.length === 0
          ? <p className="prm-muted-note">Nenhuma data disponível. Configure em Configurações › Agenda.</p>
          : (
            <div className="reschedule-grid">
              {scheduleDays.map((day) => (
                <ScheduleDayButton
                  key={day.date}
                  selected={selectedRescheduleDate === day.date}
                  hasVacancy={day.remaining > 0}
                  disabled={day.remaining <= 0}
                  onClick={() => selectRescheduleDate(day.date)}
                >
                  <span>{day.weekday}</span>
                  <strong>{day.date}</strong>
                  <small>{day.remaining} vagas</small>
                </ScheduleDayButton>
              ))}
            </div>
          )
        }
        <div className="prm-inline-actions">
          <button className="ghost-button" type="button" onClick={cancelReschedule}>Cancelar</button>
          <button className="primary-action" type="button" disabled={!selectedRescheduleDate} onClick={confirmReschedule}>
            Confirmar reagendamento
          </button>
        </div>
      </div>
    );
  }

  const isRescheduleMode = activePanel === "reschedule";

  return (
    <div className="modal-backdrop">
      {activePanel === "assign" && renderAssignModal()}
      <div className={`prm-modal${isRescheduleMode ? " prm-modal--reschedule" : ""}`} role="dialog" aria-modal="true">

        <header className="prm-header">
          <div className="prm-header-identity">
            <div className="prm-header-identity-text">
              <span className="prm-eyebrow">Processo #{normalizedRequest.protocol || request.protocol || "-"}</span>
              <h2 className="prm-headline-name">{principalAnimal.name || "Animal sem nome"}</h2>
              <p className="prm-animal-summary">
                {[principalAnimal.species, principalAnimal.sex].filter(Boolean).join(" · ") || "Espécie não informada"}
                <span className="prm-tutor-inline"> · Tutor: {displayText(normalizedRequest.tutor)}</span>
              </p>
            </div>
            <div className="prm-header-actions">
              <StatusBadge status={normalizedRequest.status} />
              <button className="prm-close-btn" type="button" aria-label="Fechar" onClick={onClose}>
                <X size={17} />
              </button>
            </div>
          </div>
          {!isRescheduleMode && (
            <div className="prm-header-meta" aria-label="Resumo do processo">
              <span><strong>Tipo</strong>{requestTypeLabel(normalizedRequest)}</span>
              {!isComplaint && <span><strong>Agenda</strong>{normalizedRequest.preferredSchedule || normalizedRequest.appointment || "-"}</span>}
              <span><strong>Responsável</strong>{displayText(normalizedRequest.responsible) || "-"}</span>
            </div>
          )}
        </header>

        <div className="prm-body">

          {canAnalyze && activePanel === "reject" && (
            <div className="prm-inline-panel prm-inline-panel--reject">
                <strong className="prm-inline-panel-title">Indeferir solicitação</strong>
                <label className="field">
                  <span>Motivo</span>
                  <select value={rejectData.category} onChange={(e) => setRejectData((d) => ({ ...d, category: e.target.value }))}>
                    <option value="">Selecione o motivo...</option>
                    {rejectionReasons.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Observação</span>
                  <textarea value={rejectData.note} onChange={(e) => setRejectData((d) => ({ ...d, note: e.target.value }))} placeholder="Detalhe o motivo se necessário..." />
                </label>
                <div className="prm-inline-actions">
                  <button className="ghost-button" type="button" onClick={() => setActivePanel(null)}>Cancelar</button>
                  <button className="secondary-action danger-action" type="button" disabled={!rejectData.category} onClick={confirmRejectInline}>Confirmar indeferimento</button>
                </div>
              </div>
          )}

          {canAnalyze && activePanel === "confirmComplaint" && (
            <div className="prm-inline-panel">
                <strong className="prm-inline-panel-title">Deferir denúncia</strong>
                <label className="field">
                  <span>Conclusão da apuração</span>
                  <textarea value={complaintResolutionNote} onChange={(e) => setComplaintResolutionNote(e.target.value)} placeholder="Descreva o que foi apurado..." />
                </label>
                <div className="prm-inline-actions">
                  <button className="ghost-button" type="button" onClick={() => setActivePanel(null)}>Cancelar</button>
                  <button className="secondary-action" type="button" onClick={confirmComplaintInline}>Confirmar deferimento</button>
                </div>
              </div>
          )}

          {isRescheduleMode && renderInlineReschedule()}

          {!isRescheduleMode && (
            <div className="prm-tabs">
              <button
                type="button"
                className={`prm-tab${modalTab === "procedimento" ? " prm-tab--active" : ""}${!canUseProcedureTab ? " prm-tab--disabled" : ""}`}
                disabled={!canUseProcedureTab}
                aria-disabled={!canUseProcedureTab}
                title={procedureTabBlockReason}
                onClick={() => { if (canUseProcedureTab) setModalTab("procedimento"); }}
              >
                <FileText size={13} /> {procedureTabLabel}
              </button>
              <button
                type="button"
                className={`prm-tab${modalTab === "anexos" ? " prm-tab--active" : ""}`}
                onClick={() => setModalTab("anexos")}
              >
                <Paperclip size={13} /> Anexos
              </button>
            </div>
          )}

          {!isRescheduleMode && canUseProcedureTab && modalTab === "procedimento" && isSpecialType && specialSection && (
            specialSection({ request: normalizedRequest })
          )}
          {!isRescheduleMode && canUseProcedureTab && modalTab === "procedimento" && !isSpecialType && (
            <div className="prm-section prm-section--procedure">
              <div className="prm-section-block">
                <p className="prm-section-title">Procedimento</p>
                <div className="prm-procedure-fields">
                  <label className="field">
                    <span>Microchip</span>
                    <input
                      value={attendanceData.microchip}
                      onChange={(e) => setAttendanceData((d) => ({ ...d, microchip: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                      placeholder="Código aplicado ou lido"
                    />
                  </label>
                  <label className="field">
                    <span>Observação</span>
                    <input
                      type="text"
                      value={attendanceData.note}
                      onChange={(e) => setAttendanceData((d) => ({ ...d, note: e.target.value }))}
                      placeholder="Observações do atendimento"
                    />
                  </label>
                </div>
              </div>
              <div className="prm-section-block">
                <p className="prm-section-title">Saúde do animal</p>
                <div className="prm-animal-data-grid">
                  <label className="field">
                    <span>Doenças pré-existentes</span>
                    <textarea
                      value={animalData.doencas}
                      onChange={(e) => setAnimalData((d) => ({ ...d, doencas: e.target.value }))}
                      placeholder="Ex: diabetes, displasia, cardiopatia..."
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    <span>Alergias conhecidas</span>
                    <textarea
                      value={animalData.alergias}
                      onChange={(e) => setAnimalData((d) => ({ ...d, alergias: e.target.value }))}
                      placeholder="Ex: alergia a penicilina, sensibilidade a frango..."
                      rows={2}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
          {!isRescheduleMode && modalTab === "anexos" && (
            <div className="prm-section prm-section--documents">
              <div className="prm-section-head">
                <p className="prm-section-label">Documentos</p>
                <span className="prm-section-count">{anexos.length} {anexos.length === 1 ? "item" : "itens"}</span>
              </div>
              <label className="ghost-button prm-evidence-upload-btn">
                <input type="file" onChange={handleEvidenceUpload} disabled={uploadingEvidence} hidden />
                {uploadingEvidence ? "Anexando..." : "Anexar evidência"}
              </label>
              {anexos.length > 0 ? (
                <>
                  {renderAttachments()}
                  {canAnalyze && blockingAttachments.length > 0 && (
                    <p className="prm-documents-warning">{scheduleBlockReason}</p>
                  )}
                </>
              ) : (
                <p className="prm-muted-note" style={{ padding: "20px" }}>Nenhum documento anexado.</p>
              )}
            </div>
          )}
        </div>

        {!isRescheduleMode && (
          <footer className="prm-footer">
          {canAnalyze && (
            <>
              <div className="prm-footer-start">
                <button
                  className={`prm-action-btn prm-action-btn--secondary${activePanel === "assign" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setActivePanel(activePanel === "assign" ? null : "assign")}
                >
                  <User size={15} />{hasProcessAssignment ? "Reatribuir" : "Atribuir"}
                </button>
                {onAssume && (
                  <button
                    className="prm-action-btn prm-action-btn--secondary"
                    type="button"
                    title={assumeDisabledTitle}
                    onClick={() => onAssume?.(request)}
                  >
                    <UserCheck size={15} /> Assumir
                  </button>
                )}
                {activePanel !== "reject" && (
                  <button
                    className="prm-action-btn prm-action-btn--danger"
                    type="button"
                    disabled={blockWithoutAssignment}
                    title={blockWithoutAssignment ? assignmentRequiredTitle : "Indeferir solicitação"}
                    onClick={() => openDocumentRejectPanel(blockingAttachments)}
                  >
                    <AlertCircle size={15} /> Indeferir
                  </button>
                )}
              </div>
              {activePanel !== "reject" && activePanel !== "confirmComplaint" && isSpecialType && (
                <button
                  className="prm-action-btn prm-action-btn--primary"
                  type="button"
                  disabled={blockWithoutAssignment}
                  title={blockWithoutAssignment ? assignmentRequiredTitle : specialRequestConfirmLabel(normalizedRequest)}
                  onClick={() => (isComplaint ? setActivePanel("confirmComplaint") : onConfirmSpecial?.(request))}
                >
                  <CheckCircle2 size={15} /> {specialRequestConfirmLabel(normalizedRequest)}
                </button>
              )}
              {activePanel !== "reject" && !isSpecialType && (
                <button
                  className="prm-action-btn prm-action-btn--primary"
                  type="button"
                  disabled={!canConfirmSchedule || confirmingSchedule}
                  title={scheduleBlockReason}
                  onClick={confirmSchedule}
                >
                  <CheckCircle2 size={15} /> {confirmingSchedule ? "Confirmando..." : "Confirmar agenda"}
                </button>
              )}
            </>
          )}
          {canUseAttendanceActions && (
            <>
              {onAssume && (
                <button
                  className="prm-action-btn prm-action-btn--secondary"
                  type="button"
                  title={assumeDisabledTitle}
                  onClick={() => onAssume?.(request)}
                >
                  <UserCheck size={15} /> Assumir
                </button>
              )}
              <button
                className="prm-action-btn prm-action-btn--warning"
                type="button"
                onClick={() => onArchive?.(request, "NAO_COMPARECEU", "Não comparecimento registrado")}
              >
                Não compareceu
              </button>
              <button
                className="prm-action-btn prm-action-btn--ghost"
                type="button"
                onClick={() => setActivePanel("reschedule")}
              >
                <RefreshCw size={15} /> Reagendar
              </button>
              <button
                className="prm-action-btn prm-action-btn--secondary"
                type="button"
                onClick={() => setPrescriptionModalOpen(true)}
              >
                <FileText size={15} /> Emitir Receita{attendanceData.receita && <CheckCircle2 size={13} style={{ marginLeft: 5, color: "#15803d" }} />}
              </button>
              <button
                className="prm-action-btn prm-action-btn--primary"
                type="button"
                disabled={blockWithoutAssignment}
                title={blockWithoutAssignment ? assignmentRequiredTitle : "Confirmar atendimento"}
                onClick={confirmAttendanceInline}
              >
                <CheckCircle2 size={15} /> Confirmar atendimento
              </button>
            </>
          )}
          {!canAnalyze && !canUseAttendanceActions && (
            <p className="prm-muted-note">Nenhuma ação pendente.</p>
          )}
          </footer>
        )}

        {previewAttachment && (
          <DocumentPreviewModal
            document={previewAttachment}
            onClose={() => setPreviewAttachment(null)}
          />
        )}
      </div>

      {prescriptionModalOpen && (
        <PrescriptionModal
          request={request}
          municipality={getPrescriptionMunicipality(request, municipalities)}
          initialText={attendanceData.receita}
          onSave={(text) => setAttendanceData((d) => ({ ...d, receita: text }))}
          onClose={() => setPrescriptionModalOpen(false)}
        />
      )}
    </div>
  );
}

function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("castragestao:pwa-dismissed") === "1");
  const [installed, setInstalled] = useState(false);

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /Android/i.test(userAgent);
  const isIos = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafari = isIos && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as any).standalone === true
  );

  useEffect(() => {
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      localStorage.removeItem("castragestao:pwa-dismissed");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [isStandalone]);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setInstallEvent(null);
    }
  }

  function dismiss() {
    localStorage.setItem("castragestao:pwa-dismissed", "1");
    setDismissed(true);
  }

  if (dismissed || installed || isStandalone) return null;
  if (!installEvent && !isSafari) return null;

  return (
    <aside className="pwa-install-banner" role="dialog" aria-label="Instalar aplicativo">
      <button className="pwa-dismiss-button" type="button" onClick={dismiss} aria-label="Fechar aviso de instalação">
        <X size={16} />
      </button>
      <div className="pwa-install-copy">
        <strong>{isAndroid ? "Instale o aplicativo" : "Adicione à tela inicial"}</strong>
        {installEvent ? (
          <span>Tenha acesso rápido e uma experiência melhor no celular.</span>
        ) : (
          <span>Para instalar no iPhone, toque em Compartilhar e depois em Adicionar à Tela Inicial.</span>
        )}
      </div>
      {installEvent && (
        <button className="primary-action pwa-install-action" type="button" onClick={install}>
          Instalar aplicativo
        </button>
      )}
    </aside>
  );
}


function getPrescriptionMunicipality(request: AnyRecord = {}, municipalities: AnyRecord[] = []) {
  const normalizedRequest = normalizeRequest(request);
  const municipalityId = normalizedRequest.municipalityId || getItemMunicipalityId(request);
  const municipalityName = normalizedRequest.municipalityName || normalizedRequest.scheduleMunicipality || "";
  return municipalities.find((item) => String(item.id || "") === String(municipalityId || ""))
    || municipalities.find((item) => normalizeText(item.name || "") === normalizeText(municipalityName))
    || { name: municipalityName };
}

function buildPrescriptionInstitutionName(municipality: AnyRecord = {}, request: AnyRecord = {}) {
  const normalizedRequest = normalizeRequest(request);
  const name = displayText(municipality.name || normalizedRequest.municipalityName || normalizedRequest.scheduleMunicipality || "");
  if (!name) return "Sistema Municipal de Bem-Estar Animal";
  return /^prefeitura/i.test(name) ? name : `Prefeitura Municipal de ${name}`;
}

function buildPrescriptionFooterLines(municipality: AnyRecord = {}) {
  const location = [municipality.address, municipality.cep ? `CEP ${formatCep(municipality.cep)}` : ""].filter(Boolean).join(" - ");
  const contact = [municipality.contact, municipality.email].filter(Boolean).join(" | ");
  return [location, contact].filter(Boolean);
}

function buildPrescriptionPrintHtml(request: AnyRecord = {}, prescriptionText = "", municipality: AnyRecord = {}) {
  const normalizedRequest = normalizeRequest(request);
  const animal = normalizedRequest.animals?.[0] || {};
  const microchip = normalizedRequest.animalMicrochip || animal.microchip || "";
  const institutionName = buildPrescriptionInstitutionName(municipality, normalizedRequest);
  const municipalityName = displayText(municipality.name || normalizedRequest.municipalityName || normalizedRequest.scheduleMunicipality || "");
  const footerLines = buildPrescriptionFooterLines(municipality);
  const logo = municipality.brasao
    ? `<img class="rx-logo" src="${escapeHtml(municipality.brasao)}" alt="Brasão" />`
    : `<div class="rx-logo-fallback">SM</div>`;
  const animalLine = [animal.name || "Animal sem nome", animal.species, animal.sex, microchip ? `Chip: ${microchip}` : ""].filter(Boolean).join(" · ");
  const prescriptionHtml = escapeHtml(prescriptionText).replace(/\n/g, "<br />");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receita Veterinária${normalizedRequest.protocol ? ` - ${escapeHtml(normalizedRequest.protocol)}` : ""}</title>
    <style>
      ${PDF_BASE_STYLES}
      body { padding: 26px; }
      .rx-page { min-height: calc(100vh - 52px); display: flex; flex-direction: column; }
      .rx-header { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid #dbeaf3; }
      .rx-logo, .rx-logo-fallback { width: 56px; height: 56px; object-fit: contain; }
      .rx-logo-fallback { display: grid; place-items: center; border: 1px solid #dbeaf3; border-radius: 12px; color: #0f5132; font-weight: 800; background: #f8fafc; }
      .rx-heading h1 { margin: 0; font-size: 21px; color: #172026; }
      .rx-heading p { margin: 4px 0 0; color: #64748b; font-size: 11px; }
      .rx-protocol { min-width: 132px; border: 1px solid #c9efd7; background: #eefbf3; border-radius: 10px; padding: 9px 11px; text-align: right; color: #0f5132; }
      .rx-protocol span { display: block; font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
      .rx-protocol strong { display: block; margin-top: 3px; font-size: 13px; }
      .rx-patient { margin-top: 18px; color: #334155; font-size: 12px; line-height: 1.5; }
      .rx-patient strong { color: #172026; }
      .rx-symbol { margin-top: 30px; font-family: Georgia, serif; font-size: 38px; font-weight: 800; font-style: italic; color: #15803d; line-height: 1; }
      .rx-prescription { margin-top: 8px; padding-top: 16px; border-top: 1px solid #dbeaf3; color: #172026; font-size: 14px; line-height: 1.75; white-space: normal; }
      .rx-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #dbeaf3; display: flex; justify-content: space-between; gap: 16px; color: #64748b; font-size: 10px; }
      .rx-footer span { display: block; }
      @media print { body { padding: 0; } .rx-page { min-height: 100vh; } }
    </style>
  </head>
  <body>
    <main class="rx-page">
      <header class="rx-header">
        ${logo}
        <div class="rx-heading">
          <h1>${escapeHtml(institutionName)}</h1>
          <p>Receita Veterinária${municipalityName ? ` · ${escapeHtml(municipalityName)}` : ""}</p>
        </div>
        <div class="rx-protocol"><span>Protocolo</span><strong>${escapeHtml(normalizedRequest.protocol ? `#${normalizedRequest.protocol}` : "-")}</strong></div>
      </header>

      <section class="rx-patient">
        <div><strong>Paciente:</strong> ${escapeHtml(animalLine || "Animal sem nome")}</div>
        <div><strong>Tutor:</strong> ${escapeHtml(normalizedRequest.tutor || "-")}</div>
      </section>

      <section>
        <div class="rx-symbol">Rx</div>
        <div class="rx-prescription">${prescriptionHtml || "-"}</div>
      </section>

      <footer class="rx-footer">
        <div>
          <span>${escapeHtml(footerLines[0] || "Sistema Municipal de Bem-Estar Animal")}</span>
          <span>${escapeHtml(footerLines[1] || "Receita emitida pelo sistema municipal")}</span>
        </div>
        <span>Emitido em ${new Date().toLocaleDateString("pt-BR")}</span>
      </footer>
    </main>
  </body>
</html>`;
}

function PrescriptionModal({ request, municipality, initialText, onSave, onClose }: AnyRecord) {
  const normalizedRequest = normalizeRequest(request);
  const principalAnimal = normalizedRequest.animals?.[0] || {};
  const [text, setText] = useState(initialText || "");

  function handleGenerate() {
    if (!text.trim()) return;
    onSave?.(text);
    printHtmlViaIframe(buildPrescriptionPrintHtml(request, text, municipality));
  }

  const animalLabel = [displayText(principalAnimal.name) || "Animal sem nome", principalAnimal.species, principalAnimal.sex]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="modal-backdrop">
      <div className="prescription-modal" role="dialog" aria-modal="true">
        <header className="prescription-modal-header">
          <div className="prescription-modal-title">
            <h2>Receita Veterinária</h2>
            <p>{[animalLabel, displayText(normalizedRequest.tutor) && `Tutor: ${displayText(normalizedRequest.tutor)}`].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="prm-close-btn" type="button" aria-label="Fechar" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <div className="prescription-modal-body">
          <div className="prescription-rx-area">
            <span className="prescription-rx-symbol">Rx</span>
            <label className="field prescription-field">
              <span>Prescrição</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"1. Amoxicilina 50mg - 1 comprimido a cada 8h por 7 dias\n2. Meloxicam 0,5mg/kg - 1x ao dia por 3 dias\n\nOrientações: manter em repouso nas primeiras 24h..."}
                rows={12}
                autoFocus
              />
            </label>
          </div>
        </div>

        <footer className="prescription-modal-footer">
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button
            className="prm-action-btn prm-action-btn--primary"
            type="button"
            disabled={!text.trim()}
            onClick={handleGenerate}
          >
            <FileText size={15} />
            Gerar PDF
          </button>
        </footer>
      </div>
    </div>
  );
}
function AdoptionView({
  adoptionAnimals,
  setAdoptionAnimals,
  currentUser,
  speciesOptions = initialSpecies,
  selectedMunicipalityId = "",
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
  const [adoptionStatusFilter, setAdoptionStatusFilter] = useState(ADOPTION_STATUS_AVAILABLE);
  const [adoptionFilters, setAdoptionFilters] = useState({ species: "", sex: "" });
  const [adoptionViewMode, setAdoptionViewMode] = useState("grid");
  const [editingAnimalId, setEditingAnimalId] = useState(null);
  const [selectedAdoptionAnimal, setSelectedAdoptionAnimal] = useState<AnyRecord | null>(null);
  const emptyAdoptionModalForm = {
    tutor: "", cpf: "", cep: "", number: "", address: "", neighborhood: "", city: "", state: "", email: "", phone: "",
    procedimentos: "", adopted_at: new Date().toISOString().slice(0, 10),
    doencas: "", alergias: "", comportamento: "", vacinas: "",
  };
  const [adoptionConfirmModal, setAdoptionConfirmModal] = useState(null);
  const [adoptionModalForm, setAdoptionModalForm] = useState(emptyAdoptionModalForm);
  const [adoptionModalStep, setAdoptionModalStep] = useState(0);
  const [adoptionModalCepStatus, setAdoptionModalCepStatus] = useState("");
  const [isSavingAdoption, setIsSavingAdoption] = useState(false);
  const canManageAdoptions = canManagePublicAnimalFlows(currentUser.role);
  const availableAnimals = adoptionAnimals.filter((animal) => !animal.status || animal.status === ADOPTION_STATUS_AVAILABLE);
  const inProgressAnimals = adoptionAnimals.filter((animal) => animal.status === ADOPTION_STATUS_IN_PROGRESS);
  const adoptedAnimals = adoptionAnimals.filter((animal) => animal.status === ADOPTION_STATUS_ADOPTED);
  const speciesFilterOptions = [...new Set(["Felino", "Canino", ...adoptionAnimals.map((animal) => animal.species).filter(Boolean)])];
  const sexFilterOptions = [...new Set(["Femea", "Macho", ...adoptionAnimals.map((animal) => animal.sex).filter(Boolean)])];
  const displayedAnimals = sortAdoptionsForHighlight(adoptionAnimals)
    .filter((animal) => {
      if (adoptionStatusFilter === ADOPTION_STATUS_AVAILABLE) return !animal.status || animal.status === ADOPTION_STATUS_AVAILABLE;
      return animal.status === adoptionStatusFilter;
    })
    .filter((animal) => !adoptionFilters.species || animal.species === adoptionFilters.species)
    .filter((animal) => !adoptionFilters.sex || animal.sex === adoptionFilters.sex);
  const activeFilterCount =
    Number(adoptionStatusFilter !== ADOPTION_STATUS_AVAILABLE) +
    Number(Boolean(adoptionFilters.species)) +
    Number(Boolean(adoptionFilters.sex));
  const statusQuickFilters = [
    { value: ADOPTION_STATUS_AVAILABLE, label: `Disponiveis (${availableAnimals.length})`, icon: HeartHandshake },
    { value: ADOPTION_STATUS_IN_PROGRESS, label: `Triagem (${inProgressAnimals.length})`, icon: Clock },
    { value: ADOPTION_STATUS_ADOPTED, label: `Adotados (${adoptedAnimals.length})`, icon: CheckCircle2 },
  ];
  const speciesQuickFilters = [
    { value: "", label: "Todas", icon: PawPrint },
    ...speciesFilterOptions.map((species) => ({
      value: species,
      label: normalizeText(species).includes("fel") ? "Gatos" : normalizeText(species).includes("can") ? "Caes" : species,
      icon: normalizeText(species).includes("fel") ? Cat : normalizeText(species).includes("can") ? Dog : PawPrint,
    })),
  ];
  const sexQuickFilters = [
    { value: "", label: "Todos", icon: Users },
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
    const files = Array.from(event.target.files || []) as File[];
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
      setFormError(`Cada imagem pode ter no máximo ${Math.floor(MAX_ADOPTION_PHOTO_BYTES / (1024 * 1024))} MB.`);
      selectedInput.value = "";
      return;
    }

    const currentTotalBytes = animalForm.photos.reduce((total, photo) => total + estimatePhotoBytes(photo), 0);
    const incomingBytes = files.reduce((total, file) => total + file.size, 0);
    if (currentTotalBytes + incomingBytes > MAX_ADOPTION_TOTAL_BYTES) {
      setFormError(`Total de imagens excedido. Limite: ${Math.floor(MAX_ADOPTION_TOTAL_BYTES / (1024 * 1024))} MB.`);
      selectedInput.value = "";
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
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
      setFormError("Preencha nome, idade, espécie, sexo e descrição antes de publicar.");
      return;
    }

    const adoptionMunicipalityId = selectedMunicipalityId || currentUser?.municipalityId || currentUser?.municipality_id || "";
    if (!adoptionMunicipalityId) {
      setFormError("Selecione um município no topo antes de cadastrar o animal.");
      return;
    }

    const payload = {
      animal_name: animalForm.name.trim(),
      species: animalForm.species,
      sex: animalForm.sex,
      age: animalForm.age.trim(),
      description: animalForm.tone.trim(),
      municipalityId: adoptionMunicipalityId,
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
      const normalized = normalizeAdoptionAnimal(updated);
      setAdoptionAnimals((current) => current.map((item) => item.id === animal.id ? { ...item, ...normalized } : item));
      setSelectedAdoptionAnimal((current) => current && current.id === animal.id ? { ...current, ...normalized } : current);
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  }

  async function deleteAnimal(animal) {
    try {
      await api.deleteAdoption(animal.id);
      setAdoptionAnimals((current) => current.filter((item) => item.id !== animal.id));
      setSelectedAdoptionAnimal((current) => current && current.id === animal.id ? null : current);
    } catch (err) {
      console.error("Erro ao excluir animal:", err);
    }
  }

  async function openInterestsModal(animal) {
    try {
      const list = await api.getInterests(animal.id);
      setSelectedAdoptionAnimal({ ...animal, interests: list });
    } catch (err) {
      console.error("Erro ao carregar interessados:", err);
      setSelectedAdoptionAnimal(animal);
    }
  }

  async function removeInterest(animalId, index) {
    try {
      const updated = await api.removeInterest(animalId, index);
      const normalized = normalizeAdoptionAnimal(updated);
      setAdoptionAnimals((current) => current.map((a) => a.id === animalId ? normalized : a));
      setSelectedAdoptionAnimal((current) => current && current.id === animalId ? { ...current, ...normalized } : current);
    } catch (err) {
      console.error("Erro ao remover interesse:", err);
    }
  }

  function openAdoptionConfirmModal(animal) {
    setAdoptionConfirmModal(animal);
    setAdoptionModalForm({ ...emptyAdoptionModalForm, adopted_at: new Date().toISOString().slice(0, 10) });
    setAdoptionModalStep(0);
    setAdoptionModalCepStatus("");
  }

  function closeAdoptionConfirmModal() {
    if (isSavingAdoption) return;
    setAdoptionConfirmModal(null);
  }

  function updateAdoptionModalForm(field, value) {
    setAdoptionModalForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateAdoptionModalMasked(field, value) {
    const masks = { cpf: formatCpf, phone: formatPhone, cep: (v) => formatCep(v) };
    updateAdoptionModalForm(field, masks[field] ? masks[field](value) : value);
    if (field === "cep") lookupAdoptionCep(value);
  }

  async function lookupAdoptionCep(value) {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 8) { setAdoptionModalCepStatus(""); return; }
    setAdoptionModalCepStatus("Buscando endereço...");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) { setAdoptionModalCepStatus("CEP não encontrado."); return; }
      setAdoptionModalForm((prev) => ({
        ...prev,
        cep: formatCep(value),
        address: data.logradouro || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      setAdoptionModalCepStatus("Endereço preenchido.");
    } catch {
      setAdoptionModalCepStatus("Não foi possível buscar o CEP.");
    }
  }

  async function submitAdoptionConfirm() {
    if (isSavingAdoption) return;
    setIsSavingAdoption(true);
    try {
      const patch = {
        status: "adotado",
        adopted_at: adoptionModalForm.adopted_at ? new Date(adoptionModalForm.adopted_at + "T12:00:00").toISOString() : new Date().toISOString(),
        adoption_tutor: {
          tutor: adoptionModalForm.tutor,
          cpf: adoptionModalForm.cpf,
          cep: adoptionModalForm.cep,
          number: adoptionModalForm.number,
          address: adoptionModalForm.address,
          neighborhood: adoptionModalForm.neighborhood,
          city: adoptionModalForm.city,
          state: adoptionModalForm.state,
          email: adoptionModalForm.email,
          phone: adoptionModalForm.phone,
        },
        adoption_notes: adoptionModalForm.procedimentos,
      };
      const updated = await api.updateAdoption(adoptionConfirmModal.id, patch);
      const normalized = normalizeAdoptionAnimal(updated);
      setAdoptionAnimals((current) => current.map((item) => item.id === adoptionConfirmModal.id ? { ...item, ...normalized } : item));
      setSelectedAdoptionAnimal((current) => current && current.id === adoptionConfirmModal.id ? { ...current, ...normalized } : current);
      setAdoptionConfirmModal(null);
    } catch (err) {
      console.error("Erro ao confirmar adoção:", err);
    } finally {
      setIsSavingAdoption(false);
    }
  }

  return (
    <section className="content-grid adoption-workspace">
      <div className="adoption-shell">
        <div className="page-toolbar adoption-command-controls">
          {canManageAdoptions && (
            <nav className="adoption-nav adoption-nav-modern" aria-label="Filtros de adocao">
              <div className="adoption-filter-group" aria-label="Filtrar por status">
                {statusQuickFilters.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <button key={filter.value} className={adoptionStatusFilter === filter.value ? "selected" : ""} type="button" onClick={() => setAdoptionStatusFilter(filter.value)}>
                      <Icon size={15} />
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="adoption-filter-sep" />
              <div className="adoption-filter-group" aria-label="Filtrar por especie">
                {speciesQuickFilters.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <button key={`species-${filter.value || "all"}`} className={adoptionFilters.species === filter.value ? "selected" : ""} type="button" onClick={() => setAdoptionFilters((current) => ({ ...current, species: filter.value }))}>
                      <Icon size={15} />
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="adoption-filter-sep" />
              <div className="adoption-filter-group" aria-label="Filtrar por sexo">
                {sexQuickFilters.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <button key={`sex-${filter.value || "all"}`} className={adoptionFilters.sex === filter.value ? "selected" : ""} type="button" onClick={() => setAdoptionFilters((current) => ({ ...current, sex: filter.value }))}>
                      <Icon size={15} />
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
              </div>
              {activeFilterCount > 0 && (
                <button className="ghost-button adoption-clear-btn" type="button" onClick={() => { setAdoptionStatusFilter(ADOPTION_STATUS_AVAILABLE); setAdoptionFilters({ species: "", sex: "" }); }}>
                  Limpar filtros
                </button>
              )}
            </nav>
          )}

          <div className="adoption-toolbar-actions">
            <div className="adoption-view-toggle" aria-label="Modo de visualizacao">
              <button className={adoptionViewMode === "grid" ? "selected" : ""} type="button" onClick={() => setAdoptionViewMode("grid")} title="Grade" aria-label="Grade">
                <LayoutDashboard size={15} />
              </button>
              <button className={adoptionViewMode === "list" ? "selected" : ""} type="button" onClick={() => setAdoptionViewMode("list")} title="Lista" aria-label="Lista">
                <ListChecks size={15} />
              </button>
            </div>
            {canManageAdoptions && (
              <div className="page-actions adoption-command-actions">
                <button className="primary-action adoption-create-button" type="button" onClick={openAnimalForm}>
                  <Plus size={16} />
                  Cadastrar animal
                </button>
              </div>
            )}
          </div>
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
                      <img src={animalForm.photos[animalForm.mainPhotoIndex]} alt="Prévia principal do animal" />
                    ) : (
                      <span>
                        <UploadCloud size={28} />
                        Fotos do animal
                      </span>
                    )}
                    <input type="file" accept="image/*" multiple onChange={handlePhotoChange} />
                  </label>
                  <small>Máximo: 5 imagens, 2 MB por imagem, 8 MB no total.</small>
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
                          <button className="animal-photo-remove" type="button" onClick={() => removeAnimalPhoto(index)} aria-label="Excluir foto">
                            <X size={14} />
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
                      label="Espécie"
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
                    <span>Descrição para a página pública</span>
                    <textarea
                      value={animalForm.tone}
                      placeholder="Temperamento, história, cuidados e perfil do adotante indicado"
                      onChange={(event) => updateAnimalForm("tone", event.target.value)}
                    />
                  </label>
                </div>
              </div>
              {formError && <p className="form-error">{formError}</p>}
              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={() => closeAnimalForm()}>
                  Cancelar
                </button>
                <button className="primary-action" type="submit" disabled={isSavingAnimal}>
                  {isSavingAnimal ? "Salvando..." : editingAnimalId ? "Salvar alterações" : "Publicar na galeria"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="adoption-board-layout">
          <div className="adoption-results-panel">
            {displayedAnimals.length === 0 && (
              <EmptyState
                title={adoptionStatusFilter === ADOPTION_STATUS_ADOPTED ? "Nenhum animal adotado" : "Nenhum animal encontrado"}
                text={activeFilterCount > 0 ? "Ajuste ou limpe os filtros para ver os animais do programa." : "Cadastre o primeiro animal para liberar a galeria publica."}
              />
            )}

            {displayedAnimals.length > 0 && adoptionViewMode === "grid" && (
              <div className="adoption-grid adoption-grid-modern">
                {displayedAnimals.map((animal) => {
                  const interestCount = getAdoptionInterestList(animal).length;
                  const displayName = animal.name || animal.animal_name || "Animal";
                  return (
                    <article className="adoption-card adoption-card-modern" key={animal.id || animal.name}>
                      <button
                        type="button"
                        className={`animal-photo ${getAnimalGradient(animal)}`}
                        onClick={() => setSelectedAdoptionAnimal(animal)}
                        aria-label={`Abrir ficha de ${displayName}`}
                      >
                        {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={displayName} /> : <PawPrint size={44} />}
                        <h3 className="adoption-card-name">{displayName}</h3>
                      </button>

                      {canManageAdoptions && (
                        <>
                          <button className="adoption-card-delete-top" type="button" aria-label="Excluir" onClick={() => deleteAnimal(animal)}>
                            <X size={14} />
                          </button>
                          <button
                            className={interestCount > 0 ? "adoption-interest-indicator has-interest interest-button" : "adoption-interest-indicator interest-button"}
                            type="button"
                            onClick={() => openInterestsModal(animal)}
                            title="Interessados"
                            aria-label="Interessados"
                          >
                            <Users size={13} />
                            <span>{interestCount}</span>
                          </button>
                          <div className="adoption-card-photo-actions">
                            <button className="ghost-button" type="button" onClick={() => editAnimal(animal)} title="Editar" aria-label="Editar">
                              <Edit3 size={15} />
                            </button>
                            {animal.status === ADOPTION_STATUS_ADOPTED ? (
                              <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(animal, ADOPTION_STATUS_AVAILABLE)} title="Reativar" aria-label="Reativar">
                                <RefreshCw size={15} />
                              </button>
                            ) : (
                              <button className="secondary-action" type="button" onClick={() => openAdoptionConfirmModal(animal)} title="Concluir adoção" aria-label="Concluir adoção">
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {displayedAnimals.length > 0 && adoptionViewMode === "list" && (
              <div className="adoption-list-modern">
                {displayedAnimals.map((animal) => {
                  const statusView = getAdoptionStatusView(animal);
                  const interestCount = getAdoptionInterestList(animal).length;
                  const daysInProgram = getAdoptionDaysInProgram(animal);
                  const displayName = animal.name || animal.animal_name || "Animal";
                  return (
                    <article className="adoption-list-row" key={animal.id || animal.name}>
                      <button className={`adoption-list-thumb ${getAnimalGradient(animal)}`} type="button" onClick={() => setSelectedAdoptionAnimal(animal)} aria-label={`Abrir ficha de ${displayName}`}>
                        {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={displayName} /> : <PawPrint size={22} />}
                      </button>
                      <div className="adoption-list-info">
                        <strong>{displayName}</strong>
                        <span>{[animal.species, animal.sex, animal.age].filter(Boolean).join(" - ") || "Dados basicos nao informados"}</span>
                      </div>
                      <span className={`adoption-card-status ${statusView.className}`}>{statusView.label}</span>
                      <span className="adoption-list-muted"><Users size={13} /> {interestCount}</span>
                      <span className="adoption-list-muted">{daysInProgram !== null ? `${daysInProgram} dias` : "Sem data"}</span>
                      {canManageAdoptions && (
                        <div className="adoption-list-actions">
                          <button className="ghost-button" type="button" onClick={() => setSelectedAdoptionAnimal(animal)} title="Ver ficha" aria-label="Ver ficha"><Eye size={15} /></button>
                          <button className="ghost-button" type="button" onClick={() => editAnimal(animal)} title="Editar" aria-label="Editar"><Edit3 size={15} /></button>
                          {animal.status === ADOPTION_STATUS_ADOPTED ? (
                            <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(animal, ADOPTION_STATUS_AVAILABLE)} title="Reativar" aria-label="Reativar"><RefreshCw size={15} /></button>
                          ) : (
                            <button className="secondary-action" type="button" onClick={() => openAdoptionConfirmModal(animal)} title="Concluir adoção" aria-label="Concluir adoção"><CheckCircle2 size={15} /></button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAdoptionAnimal && (() => {
        const statusView = getAdoptionStatusView(selectedAdoptionAnimal);
        const interestList = getAdoptionInterestList(selectedAdoptionAnimal);
        const daysInProgram = getAdoptionDaysInProgram(selectedAdoptionAnimal);
        const displayName = selectedAdoptionAnimal.name || selectedAdoptionAnimal.animal_name || "Animal";
        return (
          <div className="adoption-drawer-layer">
            <button className="adoption-drawer-scrim" type="button" aria-label="Fechar ficha" onClick={() => setSelectedAdoptionAnimal(null)} />
            <aside className="adoption-drawer" role="dialog" aria-modal="true" aria-label={`Ficha de ${displayName}`}>
              <div className={`adoption-drawer-photo ${getAnimalGradient(selectedAdoptionAnimal)}`}>
                {getAnimalMainPhoto(selectedAdoptionAnimal) ? <img src={getAnimalMainPhoto(selectedAdoptionAnimal)} alt={displayName} /> : <PawPrint size={48} />}
                <button className="adoption-drawer-close" type="button" onClick={() => setSelectedAdoptionAnimal(null)} aria-label="Fechar ficha"><X size={16} /></button>
                <span className={`adoption-card-status ${statusView.className}`}>{statusView.label}</span>
              </div>
              <div className="adoption-drawer-body">
                <h2>{displayName}</h2>
                <p>{[selectedAdoptionAnimal.species, selectedAdoptionAnimal.sex, selectedAdoptionAnimal.age].filter(Boolean).join(" - ") || "Dados basicos nao informados"}</p>
                <div className="adoption-drawer-facts">
                  <span><small>Interesses</small><strong>{interestList.length}</strong></span>
                  <span><small>No programa</small><strong>{daysInProgram !== null ? `${daysInProgram} dias` : "--"}</strong></span>
                  <span><small>Microchip</small><strong>{selectedAdoptionAnimal.animal_microchip || selectedAdoptionAnimal.microchip || "--"}</strong></span>
                  <span><small>Status</small><strong>{statusView.label}</strong></span>
                </div>
                {(selectedAdoptionAnimal.tone || selectedAdoptionAnimal.description) && (
                  <div className="adoption-drawer-section">
                    <h3>Perfil</h3>
                    <p>{selectedAdoptionAnimal.tone || selectedAdoptionAnimal.description}</p>
                  </div>
                )}
                <div className="adoption-drawer-section">
                  <div className="adoption-drawer-section-header">
                    <h3>Interessados</h3>
                    <span>{interestList.length}</span>
                  </div>
                  <div className="adoption-drawer-interests">
                    {interestList.length === 0 && <p>Nenhum interessado ainda.</p>}
                    {interestList.map((item, index) => (
                      <div className="adoption-drawer-interest" key={`${item.name || "interest"}-${index}`}>
                        <strong>{item.name || "Interessado"}</strong>
                        <span>{item.phone || "Telefone nao informado"}</span>
                        {item.visit_date && <small>Visita: {formatAdoptionDate(item.visit_date)}</small>}
                        {canManageAdoptions && (
                          <button className="ghost-button danger-action" type="button" onClick={() => removeInterest(selectedAdoptionAnimal.id, index)}>
                            Remover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {canManageAdoptions && (
                <div className="adoption-drawer-actions">
                  <button className="ghost-button" type="button" onClick={() => editAnimal(selectedAdoptionAnimal)}><Edit3 size={15} /> Editar ficha</button>
                  {selectedAdoptionAnimal.status === ADOPTION_STATUS_ADOPTED ? (
                    <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(selectedAdoptionAnimal, ADOPTION_STATUS_AVAILABLE)}><RefreshCw size={15} /> Reativar</button>
                  ) : (
                    <button className="primary-action" type="button" onClick={() => openAdoptionConfirmModal(selectedAdoptionAnimal)}><CheckCircle2 size={15} /> Concluir adoção</button>
                  )}
                </div>
              )}
            </aside>
          </div>
        );
      })()}
      {adoptionConfirmModal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAdoptionConfirmModal(); }}>
          <div className="auth-modal adoption-confirm-modal" role="dialog" aria-modal="true">
            <ModalHeader
              title={`Confirmar adoção - ${adoptionConfirmModal.name || adoptionConfirmModal.animal_name}`}
              onClose={closeAdoptionConfirmModal}
            />

            <div className="adoption-confirm-tabs">
              <button
                className={`adoption-confirm-tab${adoptionModalStep === 0 ? " active" : ""}`}
                type="button"
                onClick={() => setAdoptionModalStep(0)}
              >
                Tutor
              </button>
              <button
                className={`adoption-confirm-tab${adoptionModalStep === 1 ? " active" : ""}`}
                type="button"
                onClick={() => setAdoptionModalStep(1)}
              >
                Procedimentos
              </button>
              <button
                className={`adoption-confirm-tab${adoptionModalStep === 2 ? " active" : ""}`}
                type="button"
                onClick={() => setAdoptionModalStep(2)}
              >
                Dados do Animal
              </button>
            </div>

            <div className="adoption-confirm-body">
              {adoptionModalStep === 0 && (
                <div className="adoption-confirm-panel">
                  <Field label="Nome" value={adoptionModalForm.tutor} onChange={(v) => updateAdoptionModalForm("tutor", v)} placeholder="Nome do tutor ou responsável" />
                  <Field label="CPF" value={adoptionModalForm.cpf} onChange={(v) => updateAdoptionModalMasked("cpf", v)} placeholder="000.000.000-00" />
                  <div className="address-lookup-grid">
                    <Field label="CEP" value={adoptionModalForm.cep} onChange={(v) => updateAdoptionModalMasked("cep", v)} placeholder="00000-000" />
                    <Field label="Número" value={adoptionModalForm.number} onChange={(v) => updateAdoptionModalForm("number", v)} placeholder="123" />
                  </div>
                  {adoptionModalCepStatus && <p className="cep-status">{adoptionModalCepStatus}</p>}
                  <Field label="Endereço completo" value={adoptionModalForm.address} onChange={(v) => updateAdoptionModalForm("address", v)} placeholder="Rua, complemento" />
                  <Field label="Bairro" value={adoptionModalForm.neighborhood} onChange={(v) => updateAdoptionModalForm("neighborhood", v)} placeholder="Informe o bairro" />
                  <div className="two-column-fields">
                    <Field label="Cidade" value={adoptionModalForm.city} onChange={(v) => updateAdoptionModalForm("city", v)} placeholder="Cidade" />
                    <Field label="UF" value={adoptionModalForm.state} onChange={(v) => updateAdoptionModalForm("state", v.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase())} placeholder="SP" />
                  </div>
                  <Field label="Email" value={adoptionModalForm.email} onChange={(v) => updateAdoptionModalForm("email", v)} placeholder="email@exemplo.com" />
                  <Field label="Celular" value={adoptionModalForm.phone} onChange={(v) => updateAdoptionModalMasked("phone", v)} placeholder="(00) 00000-0000" />
                </div>
              )}

              {adoptionModalStep === 1 && (
                <div className="adoption-confirm-panel">
                  <Field label="Data da adoção" value={adoptionModalForm.adopted_at} onChange={(v) => updateAdoptionModalForm("adopted_at", v)} type="date" />
                  <label className="field-label">
                    Procedimentos realizados
                    <textarea
                      className="adoption-notes-textarea"
                      value={adoptionModalForm.procedimentos}
                      onChange={(e) => updateAdoptionModalForm("procedimentos", e.target.value)}
                      placeholder="Descreva os procedimentos realizados, observações e encaminhamentos..."
                      rows={6}
                    />
                  </label>
                </div>
              )}

              {adoptionModalStep === 2 && (
                <div className="adoption-confirm-panel">
                  <label className="field-label">
                    Doenças pré-existentes
                    <textarea
                      className="adoption-notes-textarea"
                      value={adoptionModalForm.doencas}
                      onChange={(e) => updateAdoptionModalForm("doencas", e.target.value)}
                      placeholder="Ex: diabetes, displasia, cardiopatia..."
                      rows={2}
                    />
                  </label>
                  <label className="field-label">
                    Alergias conhecidas
                    <textarea
                      className="adoption-notes-textarea"
                      value={adoptionModalForm.alergias}
                      onChange={(e) => updateAdoptionModalForm("alergias", e.target.value)}
                      placeholder="Ex: alergia a penicilina, sensibilidade a frango..."
                      rows={2}
                    />
                  </label>
                  <label className="field-label">
                    Vacinas aplicadas
                    <textarea
                      className="adoption-notes-textarea"
                      value={adoptionModalForm.vacinas}
                      onChange={(e) => updateAdoptionModalForm("vacinas", e.target.value)}
                      placeholder="Ex: V8, antirrábica, giárdia..."
                      rows={2}
                    />
                  </label>
                  <label className="field-label">
                    Comportamento
                    <textarea
                      className="adoption-notes-textarea"
                      value={adoptionModalForm.comportamento}
                      onChange={(e) => updateAdoptionModalForm("comportamento", e.target.value)}
                      placeholder="Ex: sociável com crianças, não convive com outros animais, tímido..."
                      rows={2}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="adoption-confirm-footer">
              <button className="primary-action" type="button" onClick={submitAdoptionConfirm} disabled={isSavingAdoption}>
                {isSavingAdoption ? "Salvando..." : "Confirmar adoção"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
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

function AgendaKindSelector({ value, onChange }: AnyRecord) {
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

const documentCriteriaVariants = {
  required: { label: "Obrigatórios", accent: "green" },
  rejection: { label: "Recusa", accent: "red" },
} as const;

function DocumentCriteriaColumn({ variant, value, onChange, placeholder }: AnyRecord) {
  const { label, accent } = documentCriteriaVariants[variant as keyof typeof documentCriteriaVariants];
  const count = textToCriteriaList(value).length;
  return (
    <section className={`document-criteria-column document-criteria-column--${accent}`}>
      <header className="document-criteria-column-header">
        <span>{label}</span>
        <span className="document-criteria-count">{count}</span>
      </header>
      <textarea
        className="document-criteria-textarea"
        value={value}
        placeholder={placeholder || "Um crit\u00e9rio por linha\u2026"}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}

function DocumentConfidenceSlider({ value, onChange }: AnyRecord) {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const bubblePosition = `clamp(20px, ${value}%, calc(100% - 20px))`;

  return (
    <div className={`document-confidence-slider${isAdjusting ? " is-adjusting" : ""}`}>
      <div className="document-confidence-track-row">
        <div className="document-confidence-track-wrap">
          <span className="document-confidence-value-bubble" style={{ left: bubblePosition }}>{value}%</span>
          <div className="document-confidence-track">
            <div className="document-confidence-fill" style={{ width: `${value}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            onFocus={() => setIsAdjusting(true)}
            onBlur={() => setIsAdjusting(false)}
            onPointerDown={() => setIsAdjusting(true)}
            onPointerUp={() => setIsAdjusting(false)}
            onPointerCancel={() => setIsAdjusting(false)}
            className="document-confidence-range"
            aria-label="Percentual m\u00ednimo"
          />
        </div>
        <span className="document-confidence-static-value">{value}%</span>
      </div>
      <p>Abaixo deste valor, o documento \u00e9 enviado para revis\u00e3o manual em vez de decidido automaticamente.</p>
    </div>
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
  scheduleDays = [],
  setScheduleDays,
  scheduleRules = [],
  setScheduleRules,
  permissionGroups = [],
  setPermissionGroups,
  teams = initialTeams,
  setTeams,
  setActive,
  currentUser = null,
  configArea = "environment",
  configTab = "agenda",
  setConfigTab = (_value: string | ((current: string) => string)) => {},
  environmentTabs = environmentConfigTabs,
  integrationsTabs = integrationsConfigTabs,
  selectedMunicipalityId = "",
  aiSettings = initialAiSettings,
  setAiSettings,
}) {
  const emptyRequestType = { name: "", charged: false, fee: "Gratuito", billingDescription: "", billingAmount: "", billingDueDate: "", active: true, overrideDailyLimit: false, stepTutor: true, stepAgenda: true, stepDocuments: true };
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
    slots: [{ time: "08:00", vacancies: "10" }],
    municipalityId: "",
    locationName: "",
    locationAddress: "",
    addressUrl: "",
    latitude: "",
    longitude: "",
    occurrences: [{ id: "occ_1", date: "", locationName: "", locationAddress: "", addressUrl: "", latitude: "", longitude: "", slots: [{ time: "08:00", vacancies: "10" }] }],
  };
  const [configModal, setConfigModal] = useState(null);
  const [configStatusFilters, setConfigStatusFilters] = useState({});
  const [editingScheduleRuleId, setEditingScheduleRuleId] = useState(null);
  const [agendaSaving, setAgendaSaving] = useState(false);
  const [agendaSaveStatus, setAgendaSaveStatus] = useState("");
  const [editingSpeciesId, setEditingSpeciesId] = useState(null);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [agendaLocationStatus, setAgendaLocationStatus] = useState("");
  const [newRequestType, setNewRequestType] = useState<AnyRecord>(emptyRequestType);
  const [editingRequestTypeId, setEditingRequestTypeId] = useState(null);
  const [editingSizeId, setEditingSizeId] = useState(null);
  const [newSpecies, setNewSpecies] = useState({ name: "", active: true });
  const [newSize, setNewSize] = useState({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true });
  const emptyDocumentForm = {
    name: "",
    expectedDocument: "",
    minimumConfidence: Math.round(DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE * 100),
    useAi: true,
    required: true,
    active: true,
  };
  const [newDocument, setNewDocument] = useState(emptyDocumentForm);
  const [newRequiredCriterion, setNewRequiredCriterion] = useState("");
  const [newRejectionCriterion, setNewRejectionCriterion] = useState("");
  const [newSectorName, setNewSectorName] = useState("");
  const [newSectorActive, setNewSectorActive] = useState(true);
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [editingSectorMunicipalityId, setEditingSectorMunicipalityId] = useState("");
  const [sectorModal, setSectorModal] = useState(false);
  const [pendingSectorUserIds, setPendingSectorUserIds] = useState([]);
  const emptyPermissionGroup = { name: "", active: true, allowedMenuItems: ["dashboard", "admin"], allowedConfigItems: [] };
  const [newPermissionGroup, setNewPermissionGroup] = useState<AnyRecord>(emptyPermissionGroup);
  const [editingPermissionGroupId, setEditingPermissionGroupId] = useState(null);
  const [permissionModal, setPermissionModal] = useState(false);
  const [permissionOpenSections, setPermissionOpenSections] = useState({ menus: false, config: false });
  const permissionMenuById = Object.fromEntries(permissionMenuItems.map((item) => [item.id, item]));
  const visiblePermissionConfigItems = permissionConfigItems.filter((item) => !item.globalOnly || isGlobalRole(currentUser?.role));
  const permissionCatalogSections = [
    {
      key: "attendance",
      title: "Atendimento",
      tone: "blue",
      items: ["dashboard", "admin", "credenciamento", "agenda"].map((id) => ({ field: "allowedMenuItems", id, label: permissionMenuById[id]?.label || id })),
    },
    {
      key: "adoption",
      title: "Adoção",
      tone: "green",
      items: [{ field: "allowedMenuItems", id: "adocao", label: permissionMenuById.adocao?.label || "Adoção" }],
    },
    {
      key: "reports",
      title: "Relatórios",
      tone: "sky",
      items: [{ field: "allowedMenuItems", id: "relatorios", label: permissionMenuById.relatorios?.label || "Relatórios" }],
    },
    {
      key: "settings",
      title: "Configurações",
      tone: "violet",
      items: [
        { field: "allowedMenuItems", id: "config", label: permissionMenuById.config?.label || "Configurações" },
        ...visiblePermissionConfigItems.map((item) => ({ field: "allowedConfigItems", id: item.id, label: item.label })),
      ],
    },
  ].map((section) => ({ ...section, items: section.items.filter((item) => item.label) }));
  const emptyTeamUser = { name: "", email: "", sectorIds: [], municipalityId: "", role: "Analista", matricula: "", cargo: "", senha: "", active: true, permissionGroupId: "" };
  const [newTeamUser, setNewTeamUser] = useState(emptyTeamUser);
  const emptyMunicipalityForm = { name: "", state: "", active: true, brasao: "", contact: "", email: "", address: "", cep: "", departmentName: "" };
  const [newMunicipality, setNewMunicipality] = useState(emptyMunicipalityForm);
  const [editingMunicipalityId, setEditingMunicipalityId] = useState(null);
  const [municipalitySaving, setMunicipalitySaving] = useState(false);
  const [municipalitySaveStatus, setMunicipalitySaveStatus] = useState("");
  const [brazilStates, setBrazilStates] = useState(brazilStatesFallback);
  const [brazilMunicipalities, setBrazilMunicipalities] = useState([]);
  const [brazilLocationStatus, setBrazilLocationStatus] = useState("");
  const [editingTeamUserId, setEditingTeamUserId] = useState(null);
  const [userModal, setUserModal] = useState(false);
  const [sectorPickerOpen, setSectorPickerOpen] = useState(false);
  const [municipalityStateFilter, setMunicipalityStateFilter] = useState("");
  const [userSaveError, setUserSaveError] = useState("");
  const [agendaForm, setAgendaForm] = useState(emptyAgendaForm);
  const [whatsappSettings, setWhatsappSettings] = useState(initialWhatsappSettings);
  const [whatsappSaveStatus, setWhatsappSaveStatus] = useState("");
  const [aiSaveStatus, setAiSaveStatus] = useState("");
  const initialQuotaSettings = { plan: "", contractStart: "", contractEnd: "" };
  const [quotaSettings, setQuotaSettings] = useState(initialQuotaSettings);
  const [quotaSaveStatus, setQuotaSaveStatus] = useState("");
  const [whatsappQuotaLive, setWhatsappQuotaLive] = useState<AnyRecord | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testSendStatus, setTestSendStatus] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [confirmEndContract, setConfirmEndContract] = useState(false);
  const [singleDate, setSingleDate] = useState("");
  const [singleVacancies, setSingleVacancies] = useState("20");
  const [recurringStart, setRecurringStart] = useState("");
  const [recurringEnd, setRecurringEnd] = useState("");
  const [recurringVacancies, setRecurringVacancies] = useState("20");
  const [recurringWeekdays, setRecurringWeekdays] = useState([]);
  const configCurrentTeamUser = (teams.users || []).find((user) => (
    String(user.id || "") === String(currentUser?.id || "")
    || String(user.email || "").toLowerCase() === String(currentUser?.email || "").toLowerCase()
  ));
  const configCurrentPermissionGroup = permissionGroups.find((group) =>
    group.id === configCurrentTeamUser?.permissionGroupId && group.active !== false
  );
  const canUseConfigPermissions = configCurrentPermissionGroup && !isGlobalRole(currentUser?.role);

  useEffect(() => {
    if (configArea === "environment") {
      setConfigTab((current) => (environmentTabs.some((tab) => tab.id === current) ? current : "agenda"));
      return;
    }
    if (configArea === "integrations") {
      setConfigTab((current) => (integrationsTabs.some((tab) => tab.id === current) ? current : "whatsapp"));
      return;
    }
    setConfigTab(configArea);
  }, [configArea]);

  useEffect(() => {
    if (configModal !== "municipality") return;
    let cancelled = false;
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((response) => {
        if (!response.ok) throw new Error("Estados indisponíveis");
        return response.json();
      })
      .then((states) => {
        if (!cancelled && Array.isArray(states) && states.length) {
          setBrazilStates(states);
        }
      })
      .catch(() => {
        if (!cancelled) setBrazilStates(brazilStatesFallback);
      });
    return () => { cancelled = true; };
  }, [configModal]);

  useEffect(() => {
    if (configModal !== "municipality") return;
    if (!newMunicipality.state) {
      setBrazilMunicipalities([]);
      setBrazilLocationStatus("");
      return;
    }
    let cancelled = false;
    setBrazilLocationStatus("Carregando municípios...");
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(newMunicipality.state)}/municipios?orderBy=nome`)
      .then((response) => {
        if (!response.ok) throw new Error("Municípios indisponíveis");
        return response.json();
      })
      .then((cities) => {
        if (!cancelled) {
          setBrazilMunicipalities(Array.isArray(cities) ? cities : []);
          setBrazilLocationStatus("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBrazilMunicipalities([]);
          setBrazilLocationStatus("Não foi possível carregar os municípios. Digite manualmente.");
        }
      });
    return () => { cancelled = true; };
  }, [configModal, newMunicipality.state]);

  const configMunicipalityScopeId = selectedMunicipalityId || currentUser?.municipalityId || "";

  const selectedAiProvider = aiSettings.provider || "OpenAI";
  const selectedAiProviderConfig = aiProviderOptions[selectedAiProvider] || aiProviderOptions.OpenAI;
  const selectedAiModels = selectedAiProviderConfig.models || [];
  const selectedAiModel = selectedAiModels.includes(aiSettings.model) ? aiSettings.model : selectedAiModels[0] || "";

  useEffect(() => {
    if (!setAiSettings || !selectedAiModel) return;
    if (aiSettings.provider === selectedAiProvider && aiSettings.model === selectedAiModel) return;
    setAiSettings((current: AnyRecord) => ({
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
      apiKey: aiSettings.apiKey || "",
    };
    setAiSaveStatus(nextSettings.active ? "Testando chave e salvando configuração..." : "Salvando configuração...");
    try {
      const saved = await api.setConfig("ai", nextSettings, configMunicipalityScopeId);
      const publicSettings = {
        ...nextSettings,
        ...(saved?.value || {}),
        apiKey: "",
        hasApiKey: Boolean(saved?.value?.hasApiKey),
      };
      setAiSettings?.(publicSettings);
      setAiSaveStatus("Configuração salva com sucesso.");
    } catch (err: any) {
      setAiSaveStatus(`Não foi possível salvar: ${err.message}`);
    }
  }

  async function clearAiCredentials() {
    setAiSaveStatus("Removendo chave...");
    try {
      await api.setConfig("ai", { provider: selectedAiProvider, model: selectedAiModel, apiKey: "", clearApiKey: true }, configMunicipalityScopeId);
      const reloaded = await api.getConfig("ai", configMunicipalityScopeId);
      const safeReloaded = reloaded && typeof reloaded === "object" ? reloaded : {};
      setAiSettings?.({ ...initialAiSettings, ...safeReloaded, active: Boolean(safeReloaded.active) });
      setAiSaveStatus("Chave removida.");
    } catch (err: any) {
      setAiSaveStatus(`Não foi possível remover a chave: ${err.message}`);
    }
  }

  useEffect(() => {
    if (configArea !== "integrations" || configTab !== "whatsapp") return;
    setTestPhone("");
    setTestSendStatus("");
    setConfirmEndContract(false);
    if (!configMunicipalityScopeId) {
      setWhatsappSettings(initialWhatsappSettings);
      setWhatsappSaveStatus("Selecione um município para configurar o WhatsApp.");
      setQuotaSettings(initialQuotaSettings);
      setQuotaSaveStatus("");
      setWhatsappQuotaLive(null);
      return;
    }
    let cancelled = false;
    setWhatsappSaveStatus("Carregando configuração...");
    Promise.all([
      api.getConfig(CONFIG_KEYS.whatsapp, configMunicipalityScopeId).catch(() => null),
      api.getConfig(CONFIG_KEYS.whatsappQuota, configMunicipalityScopeId).catch(() => null),
      api.getWhatsappQuotaStatus(configMunicipalityScopeId).catch(() => null),
    ]).then(([whatsapp, quota, quotaLive]) => {
      if (cancelled) return;
      setWhatsappSettings({ ...initialWhatsappSettings, ...(whatsapp || {}) });
      setWhatsappSaveStatus("");
      setQuotaSettings({
        plan: String(quota?.plan ?? ""),
        contractStart: quota?.contractStart ?? "",
        contractEnd: quota?.contractEnd ?? "",
      });
      setQuotaSaveStatus("");
      setWhatsappQuotaLive(quotaLive);
    });
    return () => { cancelled = true; };
  }, [configArea, configTab, configMunicipalityScopeId]);

  function matchesScopedConfigItem(item: AnyRecord = {}, itemId = "") {
    if (item.id !== itemId) return false;
    if (!configMunicipalityScopeId) return true;
    return getItemMunicipalityId(item) === configMunicipalityScopeId;
  }

  const currentConfigKey = configArea === "environment" || configArea === "integrations" ? configTab : configArea;
  const configStatusFilter = configStatusFilters[currentConfigKey] || "active";
  const filterByConfigStatus = (items = []) =>
    items.filter((item) => {
      if (configStatusFilter === "all") return true;
      return configStatusFilter === "active" ? item.active !== false : item.active === false;
    });

  function setConfigStatusFilter(value) {
    setConfigStatusFilters((current) => ({ ...current, [currentConfigKey]: value }));
  }

  function createRequestType(payload: AnyRecord = {}) {
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
        municipalityId: payload.municipalityId || configMunicipalityScopeId,
        documents: selectedDocuments,
        stepTutor: payload.stepTutor !== false,
        stepAgenda: payload.stepAgenda !== false,
        stepDocuments: true,
      },
    ]);
  }

  async function saveWhatsappSettings() {
    if (!configMunicipalityScopeId) {
      setWhatsappSaveStatus("Selecione um município antes de salvar.");
      return;
    }
    const hasCredentials = Boolean(
      (whatsappSettings.accessToken || whatsappSettings.hasAccessToken) &&
      whatsappSettings.phoneNumberId
    );
    const nextSettings = {
      ...whatsappSettings,
      // Ativa automaticamente quando credenciais estão preenchidas; só salva false se explicitamente desativado pelo toggle
      active: hasCredentials ? (whatsappSettings.active !== false) : false,
      provider: whatsappSettings.provider || "cloud_api",
      phoneNumberId: whatsappSettings.phoneNumberId || "",
      confirmationTemplate: whatsappSettings.confirmationTemplate || "confirmacao_agenda_castracao",
      languageCode: whatsappSettings.languageCode || "pt_BR",
      templateVariables: Array.isArray(whatsappSettings.templateVariables)
        ? whatsappSettings.templateVariables.map((variable) => String(variable || "").trim()).filter(Boolean)
        : initialWhatsappSettings.templateVariables,
      accessToken: whatsappSettings.accessToken || "",
    };
    setWhatsappSaveStatus("Salvando configuração...");
    try {
      const saved = await api.setConfig(CONFIG_KEYS.whatsapp, nextSettings, configMunicipalityScopeId);
      setWhatsappSettings({
        ...nextSettings,
        ...(saved?.value || {}),
        accessToken: "",
        hasAccessToken: Boolean(saved?.value?.hasAccessToken || nextSettings.accessToken || whatsappSettings.hasAccessToken),
      });
      setWhatsappSaveStatus("Configuração salva com sucesso.");
    } catch (err) {
      setWhatsappSaveStatus(`Não foi possível salvar: ${err.message}`);
    }
  }

  async function saveQuotaSettings() {
    if (!configMunicipalityScopeId) {
      setQuotaSaveStatus("Selecione um município antes de salvar.");
      return;
    }
    if (!quotaSettings.plan || Number(quotaSettings.plan) <= 0) {
      setQuotaSaveStatus("Informe um limite mensal válido.");
      return;
    }
    setQuotaSaveStatus("Salvando...");
    try {
      await api.setConfig(CONFIG_KEYS.whatsappQuota, {
        plan: Number(quotaSettings.plan),
        contractStart: quotaSettings.contractStart || "",
        contractEnd: quotaSettings.contractEnd || "",
      }, configMunicipalityScopeId);
      setQuotaSaveStatus("Cota salva com sucesso.");
      api.getWhatsappQuotaStatus(configMunicipalityScopeId).then(setWhatsappQuotaLive).catch(() => {});
    } catch (err) {
      setQuotaSaveStatus(`Não foi possível salvar: ${err.message}`);
    }
  }

  async function endContractToday() {
    if (!configMunicipalityScopeId) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.setConfig(CONFIG_KEYS.whatsappQuota, {
        plan: Number(quotaSettings.plan),
        contractStart: quotaSettings.contractStart || "",
        contractEnd: today,
      }, configMunicipalityScopeId);
      setQuotaSettings((c) => ({ ...c, contractEnd: today }));
      setConfirmEndContract(false);
      setQuotaSaveStatus("Contrato encerrado hoje.");
      api.getWhatsappQuotaStatus(configMunicipalityScopeId).then(setWhatsappQuotaLive).catch(() => {});
    } catch (err) {
      setQuotaSaveStatus(`Erro ao encerrar contrato: ${err.message}`);
    }
  }

  async function resetQuotaUsed() {
    if (!configMunicipalityScopeId) return;
    try {
      await api.resetWhatsappQuota(configMunicipalityScopeId);
      setQuotaSaveStatus("Cota do mês zerada.");
      api.getWhatsappQuotaStatus(configMunicipalityScopeId).then(setWhatsappQuotaLive).catch(() => {});
    } catch (err) {
      setQuotaSaveStatus(`Erro ao zerar cota: ${err.message}`);
    }
  }

  async function sendWhatsappTest() {
    if (!testPhone.trim()) { setTestSendStatus("Informe um número para o teste."); return; }
    setTestSending(true);
    setTestSendStatus("Enviando...");
    try {
      const result = await api.sendWhatsappTest(configMunicipalityScopeId, testPhone.trim());
      if (result.status === "sent") setTestSendStatus("Mensagem de teste enviada com sucesso!");
      else setTestSendStatus(`Não enviado: ${result.reason || "erro desconhecido"}`);
    } catch (err) {
      setTestSendStatus(`Erro: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  }

  function patchRequestType(typeId, patch) {
    setRequestTypes?.((current) => current.map((type) => (matchesScopedConfigItem(type, typeId) ? { ...type, ...patch } : type)));
  }

  function toggleRequestDocument(typeId, document) {
    setRequestTypes?.((current) =>
      current.map((type) => {
        if (!matchesScopedConfigItem(type, typeId)) return type;
        const documents = type.documents || [];
        const exists = documents.some((item) => item.id === document.id);
        return {
          ...type,
          documents: exists ? documents.filter((item) => item.id !== document.id) : [...documents, document],
        };
      }),
    );
  }

  function buildDocumentPayload(payload: AnyRecord = {}, existing: AnyRecord = {}) {
    const minimumConfidencePercent = Number.isFinite(Number(payload.minimumConfidence))
      ? Number(payload.minimumConfidence)
      : Math.round(DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE * 100);
    const existingAnalysisRules = { ...(existing.analysisRules || {}) };
    delete existingAnalysisRules.manualReviewCriteria;
    delete existingAnalysisRules.allowAutomaticApproval;
    delete existingAnalysisRules.allowAutomaticRejection;
    return {
      ...existing,
      id: existing.id || `doc_${Date.now()}`,
      name: payload.name || "",
      required: payload.required !== false,
      active: payload.active !== false,
      accept: existing.accept || ["image/jpeg", "image/png", "application/pdf"],
      maxSizeMb: existing.maxSizeMb || 5,
      analysisRules: {
        ...existingAnalysisRules,
        expectedDocument: String(payload.expectedDocument || "").trim().toUpperCase(),
        requiredCriteria: Array.isArray(payload.requiredCriteria) ? payload.requiredCriteria : [],
        rejectionCriteria: Array.isArray(payload.rejectionCriteria) ? payload.rejectionCriteria : [],
        minimumConfidence: Math.max(0, Math.min(1, minimumConfidencePercent / 100)),
        useAi: payload.useAi !== false,
      },
      municipalityId: payload.municipalityId || existing.municipalityId || configMunicipalityScopeId,
    };
  }

  function createDocumentType(payload: AnyRecord = {}) {
    if (editingDocumentId) {
      setDocumentTypes?.((current) =>
        current.map((document) => {
          if (!matchesScopedConfigItem(document, editingDocumentId)) return document;
          return normalizeDocumentType(buildDocumentPayload(payload, document));
        }),
      );
      setRequestTypes?.((current) =>
        current.map((type) => ({
          ...type,
          documents: (type.documents || []).map((document) =>
            matchesScopedConfigItem(document, editingDocumentId)
              ? normalizeDocumentType(buildDocumentPayload(payload, document))
              : document,
          ),
        })),
      );
      return;
    }
    setDocumentTypes?.((current) => [...current, normalizeDocumentType(buildDocumentPayload({ ...payload, createdAt: new Date().toISOString() }))]);
  }
  function patchDocumentType(documentId, patch) {
    setDocumentTypes?.((current) => current.map((document) => (matchesScopedConfigItem(document, documentId) ? normalizeDocumentType({ ...document, ...patch }) : document)));
    setRequestTypes?.((current) =>
      current.map((type) => ({
        ...type,
        documents: (type.documents || []).map((document) => (matchesScopedConfigItem(document, documentId) ? normalizeDocumentType({ ...document, ...patch }) : document)),
      })),
    );
  }

  function deleteDocumentType(documentId) {
    setDocumentTypes?.((current) => current.filter((document) => !matchesScopedConfigItem(document, documentId)));
    setRequestTypes?.((current) =>
      current.map((type) => ({
        ...type,
        documents: (type.documents || []).filter((document) => !matchesScopedConfigItem(document, documentId)),
      })),
    );
  }

  function createSpecies(payload: AnyRecord = {}) {
    const nextSpecies = {
      id: `especie_${Date.now()}`,
      name: payload.name || "",
      active: payload.active !== false,
      municipalityId: payload.municipalityId || configMunicipalityScopeId,
    };
    setSpeciesOptions?.((current) => editingSpeciesId
      ? current.map((species) => (matchesScopedConfigItem(species, editingSpeciesId) ? { ...species, ...nextSpecies, id: species.id } : species))
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
      const normalized = normalizeDocumentType(document);
      const rules = normalized.analysisRules || {};
      setEditingDocumentId(normalized.id);
      setNewDocument({
        name: normalized.name || "",
        expectedDocument: rules.expectedDocument || "",
        minimumConfidence: Math.round((Number(rules.minimumConfidence ?? DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE)) * 100),
        useAi: rules.useAi !== false,
        required: normalized.required !== false,
        active: normalized.active !== false,
      });
      setNewRequiredCriterion((Array.isArray(rules.requiredCriteria) ? rules.requiredCriteria : []).join("\n"));
      setNewRejectionCriterion((Array.isArray(rules.rejectionCriteria) ? rules.rejectionCriteria : []).join("\n"));
    } else {
      setEditingDocumentId(null);
      setNewDocument(emptyDocumentForm);
      setNewRequiredCriterion("");
      setNewRejectionCriterion("");
    }
    setConfigModal("document");
  }
  function createSize(payload: AnyRecord = {}) {
    const nextSize = {
      id: `porte_${Date.now()}`,
      name: payload.name || "",
      weightStart: payload.weightStart || "",
      weightEnd: payload.weightEnd || "",
      weightUnit: payload.weightUnit || "kg",
      active: payload.active !== false,
      municipalityId: payload.municipalityId || configMunicipalityScopeId,
    };
    setSizeOptions?.((current) => [
      ...current,
      { ...nextSize, description: formatSizeRange(nextSize) },
    ]);
  }

  function saveSize(payload: AnyRecord = {}) {
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
          matchesScopedConfigItem(size, editingSizeId) ? { ...size, ...nextSize, description: formatSizeRange(nextSize) } : size,
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
    setter?.((current) => current.map((item) => (matchesScopedConfigItem(item, itemId) ? { ...item, ...patch } : item)));
  }

  function deleteListItem(setter, itemId) {
    setter?.((current) => current.filter((item) => !matchesScopedConfigItem(item, itemId)));
  }

  function openMunicipalityModal(municipality = null) {
    if (municipality) {
      setEditingMunicipalityId(municipality.id);
      setNewMunicipality({
        name: municipality.name || "",
        state: municipality.state || "",
        active: municipality.active !== false,
        brasao: municipality.brasao || "",
        contact: municipality.contact || "",
        email: municipality.email || "",
        address: municipality.address || "",
        cep: municipality.cep || "",
        departmentName: municipality.department_name || municipality.departmentName || "",
      });
    } else {
      setEditingMunicipalityId(null);
      setNewMunicipality(emptyMunicipalityForm);
    }
    setConfigModal("municipality");
  }

  async function saveMunicipality() {
    if (!newMunicipality.name.trim()) {
      setMunicipalitySaveStatus("Selecione ou informe o município.");
      return;
    }
    if (municipalitySaving) return;
    setMunicipalitySaving(true);
    setMunicipalitySaveStatus(editingMunicipalityId ? "Salvando município..." : "Criando município e usuário padrão...");
    try {
      if (editingMunicipalityId) {
        await patchMunicipality(editingMunicipalityId, newMunicipality);
        setEditingMunicipalityId(null);
        setNewMunicipality(emptyMunicipalityForm);
        setMunicipalitySaveStatus("");
        setConfigModal(null);
        return;
      }
      const created = await api.createMunicipality(newMunicipality);
      const refreshed = await api.getMunicipalitiesAdmin().catch(() => null);
      setMunicipalities?.((current) => (
        Array.isArray(refreshed)
          ? refreshed
          : [created, ...current.filter((item) => item.id !== created.id)]
      ));
      if (created.defaultUser?.email) {
        const defaultTeamUser = defaultMunicipalityUserToTeamUser(created.defaultUser, created.id);
        const defaultSector = created.defaultSector
          ? { ...created.defaultSector, municipalityId: created.defaultSector.municipalityId || created.id }
          : null;
        setTeams?.((current) => ({
          ...current,
          sectors: defaultSector
            ? [
              defaultSector,
              ...(current.sectors || []).filter((sector) => !(sector.id === defaultSector.id && getItemMunicipalityId(sector) === created.id)),
            ]
            : current.sectors,
          users: [
            defaultTeamUser,
            ...(current.users || []).filter((user) => user.email !== defaultTeamUser.email),
          ],
        }));
      }
      const createdConfigEntries = await Promise.all(CONFIG_KEYS_LIST.map(async (key) => {
        const value = await api.getConfig(key, created.id).catch(() => null);
        return [key, value];
      }));
      const createdConfigs = Object.fromEntries(createdConfigEntries);
      const createdMunicipalityScope = Array.isArray(refreshed)
        ? refreshed.find((municipality) => municipality.id === created.id) || created
        : created;

      setRequestTypes?.((current) => mergeScopedConfigItems(
        current,
        scopeConfigItems(createdConfigs[CONFIG_KEYS.requestTypes], createdMunicipalityScope),
        created.id,
      ));
      setDocumentTypes?.((current) => mergeScopedConfigItems(
        current,
        scopeConfigItems(createdConfigs[CONFIG_KEYS.documentTypes], createdMunicipalityScope),
        created.id,
      ));
      setSpeciesOptions?.((current) => mergeScopedConfigItems(
        current,
        scopeConfigItems(createdConfigs[CONFIG_KEYS.species], createdMunicipalityScope),
        created.id,
      ));
      setSizeOptions?.((current) => mergeScopedConfigItems(
        current,
        scopeConfigItems(createdConfigs[CONFIG_KEYS.sizes], createdMunicipalityScope),
        created.id,
      ));
      setPermissionGroups?.((current) => mergeScopedConfigItems(
        current,
        scopeConfigItems(createdConfigs[CONFIG_KEYS.permissionGroups], createdMunicipalityScope),
        created.id,
      ));
      setScheduleRules?.((current) => {
        const scopedRules = (Array.isArray(createdConfigs[CONFIG_KEYS.scheduleRules])
          ? createdConfigs[CONFIG_KEYS.scheduleRules]
          : []).map((rule) => {
            const slots = normalizeScheduleSlots(rule.slots, rule.time, rule.vacancies);
            return {
              ...rule,
              municipalityId: rule.municipalityId || created.id,
              municipalityName: rule.municipalityName || getMunicipalityLabel(created.id, [createdMunicipalityScope]),
              slots,
              time: slots[0]?.time || rule.time,
              vacancies: sumScheduleSlotsVacancies(slots, rule.time, rule.vacancies),
            };
          });
        return mergeScopedConfigItems(current, scopedRules, created.id);
      });
      setNewMunicipality(emptyMunicipalityForm);
      setMunicipalitySaveStatus("");
      setConfigModal(null);
    } catch (err) {
      console.error("Erro ao criar municipio:", err);
      setMunicipalitySaveStatus(err.message || "Não foi possível salvar o município.");
    } finally {
      setMunicipalitySaving(false);
    }
  }

  async function patchMunicipality(municipalityId, patch) {
    try {
      const updated = await api.updateMunicipality(municipalityId, patch);
      setMunicipalities?.((current) => current.map((item) => (
        item.id === municipalityId ? { ...item, ...patch, ...updated } : item
      )));
      return updated;
    } catch (err) {
      console.error("Erro ao atualizar municipio:", err);
      throw err;
    }
  }

  function createSector() {
    if (!newSectorName.trim()) return;
    const sectorMunicipalityId = editingSectorMunicipalityId || configMunicipalityScopeId;
    if (editingSectorId) {
      setTeams?.((current) => ({
        ...current,
        sectors: (current.sectors || []).map((sector) =>
          sector.id === editingSectorId && getItemMunicipalityId(sector) === sectorMunicipalityId
            ? { ...sector, name: newSectorName.trim(), active: newSectorActive }
            : sector,
        ),
        users: (current.users || []).map((u) => {
          if (sectorMunicipalityId && getItemMunicipalityId(u) !== sectorMunicipalityId) return u;
          const nextSectorIds = pendingSectorUserIds.includes(u.id)
            ? [...new Set([...getUserSectorIds(u), editingSectorId])]
            : getUserSectorIds(u).filter((sectorId) => sectorId !== editingSectorId);
          return { ...u, sectorIds: nextSectorIds, sectorId: nextSectorIds[0] || "" };
        }),
      }));
      setEditingSectorId(null);
      setEditingSectorMunicipalityId("");
      setNewSectorName("");
      setNewSectorActive(true);
      setPendingSectorUserIds([]);
      return;
    }
    const newId = `setor_${Date.now()}`;
    setTeams?.((current) => ({
      ...current,
      sectors: [...(current.sectors || []), { id: newId, name: newSectorName.trim(), active: newSectorActive, municipalityId: configMunicipalityScopeId }],
      users: (current.users || []).map((u) => {
        if (configMunicipalityScopeId && getItemMunicipalityId(u) !== configMunicipalityScopeId) return u;
        if (!pendingSectorUserIds.includes(u.id)) return u;
        const nextSectorIds = [...new Set([...getUserSectorIds(u), newId])];
        return { ...u, sectorIds: nextSectorIds, sectorId: nextSectorIds[0] || "" };
      }),
    }));
    setNewSectorName("");
    setNewSectorActive(true);
    setPendingSectorUserIds([]);
  }

  function openSectorModal(sector = null) {
    if (sector) {
      const municipalityId = getItemMunicipalityId(sector) || configMunicipalityScopeId;
      setEditingSectorId(sector.id);
      setEditingSectorMunicipalityId(municipalityId);
      setNewSectorName(sector.name || "");
      setNewSectorActive(sector.active !== false);
      setPendingSectorUserIds((teams.users || [])
        .filter((u) => getItemMunicipalityId(u) === municipalityId && userBelongsToSector(u, sector.id))
        .map((u) => u.id));
    } else {
      setEditingSectorId(null);
      setEditingSectorMunicipalityId(configMunicipalityScopeId);
      setNewSectorName("");
      setNewSectorActive(true);
      setPendingSectorUserIds([]);
    }
    setSectorModal(true);
  }

  function patchSector(sectorId, patch) {
    setTeams?.((current) => ({
      ...current,
      sectors: (current.sectors || []).map((sector) => (matchesScopedConfigItem(sector, sectorId) ? { ...sector, ...patch } : sector)),
    }));
  }

  function deleteSector(sectorId) {
    setTeams?.((current) => ({
      ...current,
      sectors: (current.sectors || []).filter((sector) => !matchesScopedConfigItem(sector, sectorId)),
      users: (current.users || []).map((user) => {
        if (configMunicipalityScopeId && getItemMunicipalityId(user) !== configMunicipalityScopeId) return user;
        const nextSectorIds = getUserSectorIds(user).filter((id) => id !== sectorId);
        return { ...user, sectorIds: nextSectorIds, sectorId: nextSectorIds[0] || "" };
      }),
    }));
  }

  function createPermissionGroup() {
    const name = newPermissionGroup.name?.trim();
    if (!name) return;
    const nextGroup = {
      ...newPermissionGroup,
      name,
      active: newPermissionGroup.active !== false,
      allowedMenuItems: Array.isArray(newPermissionGroup.allowedMenuItems) ? newPermissionGroup.allowedMenuItems : [],
      allowedConfigItems: Array.isArray(newPermissionGroup.allowedConfigItems) ? newPermissionGroup.allowedConfigItems : [],
      municipalityId: newPermissionGroup.municipalityId || configMunicipalityScopeId,
    };
    if (editingPermissionGroupId) {
      setPermissionGroups?.((current) => current.map((group) => (
        matchesScopedConfigItem(group, editingPermissionGroupId) ? { ...group, ...nextGroup } : group
      )));
      setEditingPermissionGroupId(null);
    } else {
      setPermissionGroups?.((current) => [...current, { ...nextGroup, id: `grupo_${Date.now()}` }]);
    }
    setNewPermissionGroup(emptyPermissionGroup);
    setPermissionModal(false);
  }

  function openPermissionModal(group = null) {
    if (group) {
      setEditingPermissionGroupId(group.id);
      setNewPermissionGroup({
        ...emptyPermissionGroup,
        ...group,
        allowedMenuItems: Array.isArray(group.allowedMenuItems) ? group.allowedMenuItems : [],
        allowedConfigItems: Array.isArray(group.allowedConfigItems) ? group.allowedConfigItems : [],
      });
    } else {
      setEditingPermissionGroupId(null);
      setNewPermissionGroup({ ...emptyPermissionGroup, municipalityId: configMunicipalityScopeId });
    }
    setPermissionOpenSections({ menus: false, config: false });
    setPermissionModal(true);
  }

  function patchPermissionGroup(groupId, patch) {
    setPermissionGroups?.((current) => current.map((group) => (matchesScopedConfigItem(group, groupId) ? { ...group, ...patch } : group)));
  }

  function togglePermissionList(key, value) {
    setNewPermissionGroup((current) => {
      const list = Array.isArray(current[key]) ? current[key] : [];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  }

  async function createTeamUser() {
    if (!newTeamUser.name.trim() || !newTeamUser.email.trim()) return false;
    const sectorIds = Array.isArray(newTeamUser.sectorIds) ? newTeamUser.sectorIds : [];
    const municipalityId = isGlobalRole(currentUser?.role)
      ? newTeamUser.municipalityId
      : currentUser?.municipalityId || newTeamUser.municipalityId;
    if (!municipalityId) return false;
    let authUser = null;
    try {
      authUser = await api.upsertAuthUser({
        name: newTeamUser.name.trim(),
        email: newTeamUser.email.trim(),
        password: newTeamUser.senha,
        role: newTeamUser.role,
        municipalityId,
      });
    } catch (err) {
      setUserSaveError(err.message || "Erro ao salvar usuário. Verifique os dados e tente novamente.");
      return false;
    }
    if (editingTeamUserId) {
      setTeams?.((current) => ({
        ...current,
        users: (current.users || []).map((user) => user.id === editingTeamUserId ? {
          ...user,
          id: authUser?.id || user.id,
          name: newTeamUser.name.trim(),
          email: newTeamUser.email.trim(),
          sectorIds,
          sectorId: sectorIds[0] || "",
          municipalityId,
          role: newTeamUser.role,
          matricula: newTeamUser.matricula.trim(),
          cargo: newTeamUser.cargo.trim(),
          permissionGroupId: newTeamUser.permissionGroupId,
          active: newTeamUser.active !== false,
        } : user),
      }));
      setEditingTeamUserId(null);
      setNewTeamUser(emptyTeamUser);
      return true;
    }
    setTeams?.((current) => ({
      ...current,
      users: [
        ...(current.users || []),
        {
          id: authUser?.id || `usuario_${Date.now()}`,
          name: newTeamUser.name.trim(),
          email: newTeamUser.email.trim(),
          sectorIds,
          sectorId: sectorIds[0] || "",
          municipalityId,
          role: newTeamUser.role,
          matricula: newTeamUser.matricula.trim(),
          cargo: newTeamUser.cargo.trim(),
          permissionGroupId: newTeamUser.permissionGroupId,
          active: newTeamUser.active !== false,
        },
      ],
    }));
    setNewTeamUser(emptyTeamUser);
    return true;
  }

  function openTeamUserModal(user = null) {
    const getMunState = (munId) => municipalities.find((m) => m.id === munId)?.state || "";
    const defaultMunId = isGlobalRole(currentUser?.role)
      ? (user?.municipalityId || selectedMunicipalityId || currentUser?.municipalityId || municipalities[0]?.id || "")
      : (currentUser?.municipalityId || "");
    if (user) {
      setEditingTeamUserId(user.id);
      setNewTeamUser({
        name: user.name || "",
        email: user.email || "",
        sectorIds: getUserSectorIds(user),
        municipalityId: defaultMunId,
        role: user.role || "Analista",
        matricula: user.matricula || "",
        cargo: user.cargo || "",
        senha: "",
        active: user.active !== false,
        permissionGroupId: user.permissionGroupId || "",
      });
    } else {
      setEditingTeamUserId(null);
      const defaultGroup = permissionGroups.find((group) => getItemMunicipalityId(group) === defaultMunId && group.active !== false) || permissionGroups.find((group) => group.active !== false);
      setNewTeamUser({ ...emptyTeamUser, municipalityId: defaultMunId, permissionGroupId: defaultGroup?.id || "" });
    }
    setMunicipalityStateFilter(getMunState(defaultMunId));
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
    const value = String(dateText);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const [day, month, year] = value.split("/");
    if (!day || !month || !year) return "";
    return `${year}-${month}-${day}`;
  }

  function toScheduleDate(dateValue) {
    if (!dateValue) return "";
    const value = String(dateValue);
    if (value.includes("/")) return normalizeScheduleDateText(value);
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return "";
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
      return (Array.from(byDate.values()) as AnyRecord[]).sort((l, r) => parseScheduleDate(l.date) - parseScheduleDate(r.date));
    });
  }

  function normalizeAgendaOccurrenceForForm(occurrence: AnyRecord = {}, fallback: AnyRecord = agendaForm) {
    const rawDate = occurrence.date || occurrence.start || fallback.start || "";
    const rawSlots = Array.isArray(occurrence.slots) && occurrence.slots.length
      ? occurrence.slots
      : Array.isArray(fallback.slots) && fallback.slots.length ? fallback.slots : [{ time: "08:00", vacancies: "10" }];
    const slots = rawSlots.map((slot) => ({
      time: String(slot?.time || ""),
      vacancies: String(slot?.vacancies ?? ""),
    }));

    return {
      id: occurrence.id || `occ_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: toInputDate(rawDate) || "",
      locationName: occurrence.locationName || fallback.locationName || "",
      locationAddress: occurrence.locationAddress || fallback.locationAddress || "",
      addressUrl: occurrence.addressUrl || fallback.addressUrl || "",
      latitude: occurrence.latitude || fallback.latitude || "",
      longitude: occurrence.longitude || fallback.longitude || "",
      slots: slots.length ? slots : [{ time: "08:00", vacancies: "10" }],
    };
  }

  function getAgendaOccurrenceList(source: AnyRecord = agendaForm) {
    const sourceList = Array.isArray(source.occurrences) && source.occurrences.length ? source.occurrences : [source];
    return sourceList.map((occurrence) => normalizeAgendaOccurrenceForForm(occurrence, source));
  }

  function patchAgendaForm(field, value) {
    setAgendaForm((current) => {
      if (field === "kind") {
        const next = { ...current, kind: value };
        if (normalizeText(value) === "mutirao") {
          return { ...next, type: "Dia específico", occurrences: getAgendaOccurrenceList(current) };
        }
        return next;
      }
      return { ...current, [field]: value };
    });
  }

  function patchAgendaSlot(index, field, value) {
    setAgendaForm((current) => ({
      ...current,
      slots: (current.slots || []).map((slot, slotIndex) => (
        slotIndex === index ? { ...slot, [field]: value } : slot
      )),
    }));
  }

  function addAgendaSlot() {
    setAgendaForm((current) => ({
      ...current,
      slots: [...(current.slots || []), { time: "", vacancies: "" }],
    }));
  }

  function removeAgendaSlot(index) {
    setAgendaForm((current) => {
      const nextSlots = (current.slots || []).filter((_, slotIndex) => slotIndex !== index);
      return { ...current, slots: nextSlots.length ? nextSlots : [{ time: "08:00", vacancies: "10" }] };
    });
  }

  function patchAgendaOccurrence(index, field, value) {
    setAgendaForm((current) => ({
      ...current,
      occurrences: getAgendaOccurrenceList(current).map((occurrence, occurrenceIndex) => (
        occurrenceIndex === index ? { ...occurrence, [field]: value } : occurrence
      )),
    }));
  }

  function patchAgendaOccurrenceSlot(occurrenceIndex, slotIndex, field, value) {
    setAgendaForm((current) => ({
      ...current,
      occurrences: getAgendaOccurrenceList(current).map((occurrence, currentOccurrenceIndex) => {
        if (currentOccurrenceIndex !== occurrenceIndex) return occurrence;
        return {
          ...occurrence,
          slots: (occurrence.slots || []).map((slot, currentSlotIndex) => (
            currentSlotIndex === slotIndex ? { ...slot, [field]: value } : slot
          )),
        };
      }),
    }));
  }

  function addAgendaOccurrenceSlot(occurrenceIndex) {
    setAgendaForm((current) => ({
      ...current,
      occurrences: getAgendaOccurrenceList(current).map((occurrence, currentOccurrenceIndex) => (
        currentOccurrenceIndex === occurrenceIndex
          ? { ...occurrence, slots: [...(occurrence.slots || []), { time: "", vacancies: "" }] }
          : occurrence
      )),
    }));
  }

  function removeAgendaOccurrenceSlot(occurrenceIndex, slotIndex) {
    setAgendaForm((current) => ({
      ...current,
      occurrences: getAgendaOccurrenceList(current).map((occurrence, currentOccurrenceIndex) => {
        if (currentOccurrenceIndex !== occurrenceIndex) return occurrence;
        const nextSlots = (occurrence.slots || []).filter((_, currentSlotIndex) => currentSlotIndex !== slotIndex);
        return { ...occurrence, slots: nextSlots.length ? nextSlots : [{ time: "08:00", vacancies: "10" }] };
      }),
    }));
  }

  function addAgendaOccurrence() {
    setAgendaForm((current) => ({
      ...current,
      occurrences: [
        ...getAgendaOccurrenceList(current),
        normalizeAgendaOccurrenceForForm({ id: `occ_${Date.now()}`, date: "", locationName: "", locationAddress: "", addressUrl: "" }, current),
      ],
    }));
  }

  function removeAgendaOccurrence(index) {
    setAgendaForm((current) => {
      const nextOccurrences = getAgendaOccurrenceList(current).filter((_, occurrenceIndex) => occurrenceIndex !== index);
      return { ...current, occurrences: nextOccurrences.length ? nextOccurrences : [normalizeAgendaOccurrenceForForm({}, current)] };
    });
  }
  function useAgendaCurrentLocation() {
    if (!navigator.geolocation) {
      setAgendaLocationStatus("Localização atual indisponível neste navegador.");
      return;
    }

    setAgendaLocationStatus("Solicitando localização atual...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAgendaForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          locationName: current.locationName || "Localização atual",
        }));
        setAgendaLocationStatus("Localização atual registrada.");
      },
      () => setAgendaLocationStatus("Não foi possível obter a localização atual."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function openAgendaModal(rule = null) {
    if (rule) {
      const startDate = toInputDate(rule.start);
      const fallbackWeekday = startDate ? new Date(`${startDate}T12:00:00`).getDay() : 1;
      const isRuleMutirao = normalizeText(rule.kind || "") === "mutirao";
      const ruleOccurrences = Array.isArray(rule.occurrences) && rule.occurrences.length
        ? rule.occurrences
        : [{ ...rule, date: rule.start }];
      setEditingScheduleRuleId(rule.id);
      setAgendaForm({
        ...emptyAgendaForm,
        description: rule.description || "",
        active: rule.active !== false,
        unavailable: rule.unavailable || false,
        kind: rule.kind || "Agenda",
        type: isRuleMutirao ? "Dia específico" : rule.type || "Recorrência",
        repeatEvery: String(rule.repeatEvery || "1"),
        weekdays: Array.isArray(rule.weekdays) && rule.weekdays.length ? rule.weekdays : [fallbackWeekday],
        start: startDate,
        end: toInputDate(rule.end || rule.start),
        time: rule.time || "08:00",
        vacancies: String(rule.vacancies || "20"),
        slots: normalizeScheduleSlots(rule.slots, rule.time, rule.vacancies).map((slot) => ({ ...slot, vacancies: String(slot.vacancies) })),
        municipalityId: rule.municipalityId || currentUser?.municipalityId || municipalities[0]?.id || "",
        locationName: rule.locationName || "",
        locationAddress: rule.locationAddress || "",
        addressUrl: rule.addressUrl || "",
        latitude: rule.latitude || "",
        longitude: rule.longitude || "",
        occurrences: ruleOccurrences.map((occurrence) => normalizeAgendaOccurrenceForForm(occurrence, rule)),
      });
    } else {
      setEditingScheduleRuleId(null);
      const municipalityId = currentUser?.municipalityId || municipalities[0]?.id || "";
      setAgendaForm({
        ...emptyAgendaForm,
        municipalityId,
        occurrences: emptyAgendaForm.occurrences.map((occurrence) => ({ ...occurrence, id: `occ_${Date.now()}` })),
      });
    }
    setAgendaSaveStatus("");
    setConfigModal("agenda");
  }

  async function createScheduleFromModal(event) {
    event.preventDefault();
    if (agendaSaving) return;

    const isMutirao = normalizeText(agendaForm.kind) === "mutirao";
    const isRecurring = !isMutirao && normalizeText(agendaForm.type) === "recorrencia";
    const mutiraoOccurrencesForForm = isMutirao ? getAgendaOccurrenceList(agendaForm) : [];

    if (!agendaForm.description.trim() || !agendaForm.municipalityId) {
      setAgendaSaveStatus("Informe a descrição e o município da agenda.");
      return;
    }

    if (isMutirao) {
      const invalidOccurrence = mutiraoOccurrencesForForm.some((occurrence) => !occurrence.date || !String(occurrence.locationName || "").trim());
      if (!mutiraoOccurrencesForForm.length || invalidOccurrence) {
        setAgendaSaveStatus("Para mutirão, informe data e local de atendimento em cada ocorrência.");
        return;
      }
      const occurrenceDates = mutiraoOccurrencesForForm.map((occurrence) => toScheduleDate(occurrence.date)).filter(Boolean);
      if (new Set(occurrenceDates).size !== occurrenceDates.length) {
        setAgendaSaveStatus("Cada ocorrência do mutirão precisa ter uma data diferente.");
        return;
      }
    } else if (!agendaForm.start || (isRecurring && (!agendaForm.end || agendaForm.weekdays.length === 0))) {
      setAgendaSaveStatus("Preencha os dados obrigatórios da agenda antes de salvar.");
      return;
    }

    setAgendaSaving(true);
    setAgendaSaveStatus("Salvando agenda...");
    const municipality = municipalities.find((item) => item.id === agendaForm.municipalityId);
    const currentEditingRuleId = editingScheduleRuleId;
    const scheduleRuleId = currentEditingRuleId || `agenda_${Date.now()}`;
    const existingRule = scheduleRules.find((rule) => rule.id === scheduleRuleId);
    const slots = normalizeScheduleSlots(agendaForm.slots, agendaForm.time, agendaForm.vacancies);
    const vacancies = sumScheduleSlotsVacancies(slots);
    const startTime = slots[0]?.time || agendaForm.time;
    const repeatEvery = Math.max(Number(agendaForm.repeatEvery) || 1, 1);
    const nextDays = [];

    const mutiraoOccurrences = mutiraoOccurrencesForForm
      .map((occurrence, index) => {
        const occurrenceSlots = normalizeScheduleSlots(occurrence.slots, agendaForm.time, agendaForm.vacancies);
        const occurrenceVacancies = sumScheduleSlotsVacancies(occurrenceSlots, agendaForm.time, agendaForm.vacancies);
        return {
          id: occurrence.id || `${scheduleRuleId}_occ_${index + 1}`,
          date: toScheduleDate(occurrence.date),
          start: toScheduleDate(occurrence.date),
          time: occurrenceSlots[0]?.time || agendaForm.time,
          vacancies: occurrenceVacancies,
          slots: occurrenceSlots,
          active: agendaForm.active && !agendaForm.unavailable,
          locationName: String(occurrence.locationName || "").trim(),
          locationAddress: String(occurrence.locationAddress || "").trim(),
          addressUrl: String(occurrence.addressUrl || "").trim(),
          latitude: occurrence.latitude || "",
          longitude: occurrence.longitude || "",
        };
      })
      .sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));

    if (isMutirao) {
      mutiraoOccurrences.forEach((occurrence) => {
        nextDays.push({
          date: occurrence.date,
          weekday: getWeekdayLabel(toInputDate(occurrence.date)),
          vacancies: occurrence.vacancies,
          slots: occurrence.slots,
          active: occurrence.active,
          scheduleRuleId,
          occurrenceId: occurrence.id,
          description: agendaForm.description.trim(),
          startTime: occurrence.time,
          kind: agendaForm.kind,
          municipalityId: agendaForm.municipalityId,
          municipalityName: municipality ? `${municipality.name}/${municipality.state}` : "",
          locationName: occurrence.locationName,
          locationAddress: occurrence.locationAddress,
          addressUrl: occurrence.addressUrl,
          latitude: occurrence.latitude,
          longitude: occurrence.longitude,
        });
      });
    } else {
      const start = new Date(`${agendaForm.start}T12:00:00`);
      const end = new Date(`${isRecurring ? agendaForm.end : agendaForm.start}T12:00:00`);
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const weekDistance = Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const matchesRepeat = weekDistance % repeatEvery === 0;
        const matchesWeekday = isRecurring ? agendaForm.weekdays.includes(date.getDay()) : true;
        if (matchesRepeat && matchesWeekday) {
          const value = date.toISOString().slice(0, 10);
          nextDays.push({
            date: toScheduleDate(value),
            weekday: getWeekdayLabel(value),
            vacancies,
            slots,
            active: agendaForm.active && !agendaForm.unavailable,
            scheduleRuleId,
            description: agendaForm.description.trim(),
            startTime,
            kind: agendaForm.kind,
            municipalityId: agendaForm.municipalityId,
            municipalityName: municipality ? `${municipality.name}/${municipality.state}` : "",
            locationName: agendaForm.locationName,
            locationAddress: agendaForm.locationAddress,
            addressUrl: agendaForm.addressUrl,
            latitude: agendaForm.latitude,
            longitude: agendaForm.longitude,
          });
        }
      }
    }

    const firstMutiraoOccurrence = mutiraoOccurrences[0] || null;
    const lastMutiraoOccurrence = mutiraoOccurrences[mutiraoOccurrences.length - 1] || firstMutiraoOccurrence;
    const nextRule = {
      id: scheduleRuleId,
      description: agendaForm.description.trim(),
      createdAt: existingRule?.createdAt || new Date().toLocaleString("pt-BR"),
      active: agendaForm.active && !agendaForm.unavailable,
      unavailable: agendaForm.unavailable,
      type: isMutirao ? "Dia específico" : agendaForm.type,
      kind: agendaForm.kind,
      repeatEvery,
      weekdays: isMutirao
        ? mutiraoOccurrences.map((occurrence) => new Date(`${toInputDate(occurrence.date)}T12:00:00`).getDay())
        : isRecurring ? agendaForm.weekdays : [new Date(`${agendaForm.start}T12:00:00`).getDay()],
      start: isMutirao ? firstMutiraoOccurrence?.date || "" : toScheduleDate(agendaForm.start),
      end: isMutirao ? lastMutiraoOccurrence?.date || "" : toScheduleDate(isRecurring ? agendaForm.end : agendaForm.start),
      time: isMutirao ? firstMutiraoOccurrence?.time || startTime : startTime,
      vacancies: isMutirao ? mutiraoOccurrences.reduce((sum, occurrence) => sum + occurrence.vacancies, 0) : vacancies,
      slots: isMutirao ? firstMutiraoOccurrence?.slots || slots : slots,
      occurrences: isMutirao ? mutiraoOccurrences : [],
      municipalityId: agendaForm.municipalityId,
      municipalityName: municipality ? `${municipality.name}/${municipality.state}` : "",
      locationName: isMutirao ? firstMutiraoOccurrence?.locationName || "" : agendaForm.locationName,
      locationAddress: isMutirao ? firstMutiraoOccurrence?.locationAddress || "" : agendaForm.locationAddress,
      addressUrl: isMutirao ? firstMutiraoOccurrence?.addressUrl || "" : agendaForm.addressUrl,
      latitude: isMutirao ? firstMutiraoOccurrence?.latitude || "" : agendaForm.latitude,
      longitude: isMutirao ? firstMutiraoOccurrence?.longitude || "" : agendaForm.longitude,
    };

    const nextScheduleRules = currentEditingRuleId
      ? scheduleRules.map((rule) => (rule.id === currentEditingRuleId ? nextRule : rule))
      : [nextRule, ...scheduleRules];
    const scopedNextScheduleRules = nextScheduleRules.filter((rule) => getItemMunicipalityId(rule) === agendaForm.municipalityId);

    let saved = [];
    try {
      await api.setConfig(CONFIG_KEYS.scheduleRules, scopedNextScheduleRules, agendaForm.municipalityId);
      const createdDays = await api.bulkCreateScheduleDays({
        municipalityId: agendaForm.municipalityId,
        replaceRuleId: scheduleRuleId,
        days: nextDays,
      });
      saved = (Array.isArray(createdDays) ? createdDays : []).map((day) => ({ ...normalizeScheduleDay(day), scheduleRuleId }));
    } catch (err) {
      console.error("Erro ao salvar dias da regra em lote:", err);
      setAgendaSaveStatus(err?.message || "Não foi possível salvar a agenda.");
      setAgendaSaving(false);
      return;
    }

    setScheduleRules?.(nextScheduleRules);
    setScheduleDays?.((current) => {
      const keptDays = currentEditingRuleId ? current.filter((day) => day.scheduleRuleId !== currentEditingRuleId) : current;
      const byDate = new Map((keptDays as AnyRecord[]).map((day) => [day.date, day]));
      saved.forEach((day) => byDate.set(day.date, day));
      return (Array.from(byDate.values()) as AnyRecord[]).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));
    });
    setEditingScheduleRuleId(scheduleRuleId);
    setActive?.("config");
    setConfigTab("agenda");
    setConfigModal(null);
    setAgendaSaving(false);
    setAgendaSaveStatus("");
  }
  function formatScheduleWeekdays(weekdays) {
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return weekdays.map((weekday) => names[weekday]).join(", ");
  }

  function formatAgendaRuleSummary(rule: AnyRecord = {}) {
    const isMutirao = normalizeText(rule.kind || "") === "mutirao";
    if (isMutirao) {
      const occurrences = Array.isArray(rule.occurrences) ? rule.occurrences : [];
      const totalVacancies = occurrences.length
        ? occurrences.reduce((sum, occurrence) => sum + sumScheduleSlotsVacancies(occurrence.slots, occurrence.time, occurrence.vacancies), 0)
        : Number(rule.vacancies) || 0;
      const datesLabel = occurrences.length === 1 ? "1 data" : `${occurrences.length || 1} datas`;
      return `${datesLabel} de mutirão · ${totalVacancies} vagas totais${rule.municipalityName ? ` · ${rule.municipalityName}` : ""}`;
    }
    return `${rule.start} a ${rule.end} · ${sumScheduleSlotsVacancies(rule.slots, rule.time, rule.vacancies)} vagas/dia${rule.municipalityName ? ` · ${rule.municipalityName}` : ""}`;
  }

  const agendaFormIsMutirao = normalizeText(agendaForm.kind) === "mutirao";
  const filteredRequestTypes = filterByConfigStatus(requestTypes);
  const filteredMunicipalities = filterByConfigStatus(municipalities);
  const filteredScheduleRules = filterByConfigStatus(scheduleRules);
  const filteredSizes = filterByConfigStatus(sizeOptions);
  const filteredSpecies = filterByConfigStatus(speciesOptions);
  const filteredDocumentTypes = filterByConfigStatus(documentTypes);
  const filteredSectors = filterByConfigStatus(dedupeMunicipalityItems(teams.sectors || []));
  const filteredTeamUsers = filterByConfigStatus(dedupeMunicipalityItems(teams.users || []));
  const filteredPermissionGroups = filterByConfigStatus(permissionGroups);
  const currentConfigItems = {
    requests: requestTypes,
    municipalities,
    agenda: scheduleRules,
    sizes: sizeOptions,
    species: speciesOptions,
    users: teams.users || [],
    sectors: teams.sectors || [],
    permissions: permissionGroups,
    documents: documentTypes,
  }[currentConfigKey] || [];
  const activeMunicipalities = municipalities.filter((municipality) => municipality.active !== false);
  const selectedMunicipality = activeMunicipalities.find((municipality) => municipality.id === newTeamUser.municipalityId);
  const activeTeamSectors = dedupeMunicipalityItems(teams.sectors || []).filter((sector) =>
    sector.active !== false
    && (!newTeamUser.municipalityId || getItemMunicipalityId(sector) === newTeamUser.municipalityId)
  );
  const selectedTeamSectorIds = newTeamUser.sectorIds || [];
  const selectedTeamSectors = activeTeamSectors.filter((sector) => selectedTeamSectorIds.includes(sector.id));
  const availableTeamSectors = activeTeamSectors.filter((sector) => !selectedTeamSectorIds.includes(sector.id));
  const sectorModalMunicipalityId = editingSectorMunicipalityId || configMunicipalityScopeId;
  const sectorModalUsers = dedupeMunicipalityItems(teams.users || []).filter((user) =>
    user.active !== false
    && (!sectorModalMunicipalityId || getItemMunicipalityId(user) === sectorModalMunicipalityId)
  );
  const configAreaTitle = {
    environment: "Configurar Ambiente",
    municipalities: "Dados Gerais",
    users: "Criar Usuários",
    sectors: "Criar Setores",
    permissions: "Permissões",
  }[configArea] || "Configurações";

  return (
    <section className="config-workspace">

      {configArea === "municipalities" && (() => {
        const isGlobal = isGlobalRole(currentUser?.role);
        const municipalityRows = isGlobal ? filteredMunicipalities : municipalities;
        return (
          <div className="config-panel wide">
            <ConfigSectionHeader
              title="Dados Gerais"
              createLabel={isGlobal ? "Cadastrar município" : undefined}
              onCreate={isGlobal ? () => openMunicipalityModal() : undefined}
            >
              {isGlobal && (
                <ConfigStatusFilter
                  value={configStatusFilter}
                  onChange={setConfigStatusFilter}
                  activeCount={municipalities.filter((item) => item.active !== false).length}
                  inactiveCount={municipalities.filter((item) => item.active === false).length}
                />
              )}
            </ConfigSectionHeader>
            <div className="config-editor-grid">
              {municipalityRows.length === 0 && <EmptyState title="Nenhum município cadastrado" text="Cadastre um município para liberar um ambiente próprio." />}
              {municipalityRows.map((municipality, index) => (
                <article className="config-list-row" key={municipality.id} onClick={() => openMunicipalityModal(municipality)} role="button" tabIndex={0}>
                  <span className="config-list-index">{index + 1}</span>
                  <div className="config-list-main">
                    <strong>{municipality.name}</strong>
                    <span>{municipality.state || "UF não informada"}</span>
                  </div>
                  <small className={municipality.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {municipality.active === false ? "Inativo" : "Ativo"}
                  </small>
                </article>
              ))}
            </div>
          </div>
        );
      })()}

      {configArea === "integrations" && configTab === "ai_settings" && integrationsTabs.some((tab) => tab.id === "ai_settings") && (
        <div className="config-panel wide">
          <PanelHeader title="IA externa para documentos" />
          <div className="ai-settings-layout">
            <article className="ai-settings-card">
              <div className="config-modal-options">
                <ConfigActiveToggle
                  checked={Boolean(aiSettings.active)}
                  onChange={(checked) => setAiSettings?.((current: AnyRecord) => ({ ...current, active: checked }))}
                  onText="Ativa"
                  offText="Inativa"
                />
              </div>
              <p className={aiSettings.hasApiKey && aiSettings.keyValid ? "sms-status confirmed" : "sms-status"}>
                {!aiSettings.hasApiKey
                  ? "Token não configurado."
                  : aiSettings.keyValid && aiSettings.lastValidatedAt
                    ? `Chave válida — testada em ${new Date(aiSettings.lastValidatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                    : "Chave ainda não testada."}
              </p>
              {Boolean(aiSettings.callCount) && aiSettings.lastUsedAt && (
                <p className="sms-status">
                  {aiSettings.callCount} validações realizadas — última em {new Date(aiSettings.lastUsedAt).toLocaleDateString("pt-BR")}
                </p>
              )}
              <label className="field">
                <span>Provedor</span>
                <select
                  value={selectedAiProvider}
                  onChange={(event) => {
                    const provider = event.target.value;
                    setAiSettings?.((current: AnyRecord) => ({
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
                <select value={selectedAiModel} onChange={(event) => setAiSettings?.((current: AnyRecord) => ({ ...current, model: event.target.value }))}>
                  {selectedAiModels.map((model: string) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
            </article>
            <article className="ai-rules-card">
              <strong>Como a IA será usada</strong>
              <p>
                Ao anexar um documento, a IA usa os critérios cadastrados no tipo de documento (obrigatórios e de recusa)
                para decidir se o arquivo condiz com o solicitado.
              </p>
              <p>
                Com a IA inativa, o arquivo fica apenas anexado e segue para conferência manual, sem análise automática.
              </p>
              <label className="field">
                <span>Token / chave API</span>
                <input
                  value={aiSettings.apiKey}
                  type="password"
                  name="ai-provider-api-key"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  placeholder={`Cole a chave da ${selectedAiProvider}`}
                  onChange={(event) => setAiSettings?.((current: AnyRecord) => ({ ...current, apiKey: event.target.value }))}
                />
              </label>
              {selectedAiProviderConfig.keyUrl && (
                <a className="external-provider-link" href={selectedAiProviderConfig.keyUrl} target="_blank" rel="noreferrer">
                  Criar ou acessar chave da {selectedAiProvider}
                </a>
              )}
              <div className="ai-settings-actions">
                <button className="primary-action ai-save-key-action" type="button" onClick={saveAiCredentials}>
                  Salvar configuração
                </button>
                {aiSettings.hasApiKey && (
                  <button className="ghost-button" type="button" onClick={clearAiCredentials}>
                    Remover chave
                  </button>
                )}
              </div>
              {aiSaveStatus && <p className={aiSaveStatus.includes("sucesso") || aiSaveStatus === "Chave removida." ? "sms-status confirmed" : "sms-status"}>{aiSaveStatus}</p>}
            </article>
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "requests" && (
        <div className="config-panel wide">
          <ConfigSectionHeader title="Tipos de solicitação" createLabel="Criar tipo" onCreate={() => setConfigModal("requestType")}>
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={requestTypes.filter((item) => item.active !== false).length}
              inactiveCount={requestTypes.filter((item) => item.active === false).length}
            />
          </ConfigSectionHeader>
          <div className="config-editor-grid">
            {filteredRequestTypes.length === 0 && (
              <EmptyState title="Nenhum tipo configurado" text="Crie os tipos de solicitação que o tutor poderá escolher. Cada tipo define taxa e documentos exigidos." />
            )}
            {filteredRequestTypes.map((type, index) => (
              <article className="config-list-row" key={type.id} onClick={() => { setEditingRequestTypeId(type.id); setNewRequestType({ ...emptyRequestType, ...type }); setConfigModal("requestType"); }} role="button" tabIndex={0}>
                <span className="config-list-index">{index + 1}</span>
                <div className="config-list-main">
                  <strong>{type.name}</strong>
                  <span>{type.charged ? `Taxa: ${type.billingAmount || type.fee || "-"}` : "Gratuito"} · {(type.documents?.length || 0)} documento(s)</span>
                </div>
                <small className={type.active === false ? "schedule-status inactive" : "schedule-status active"}>
                  {type.active === false ? "Inativo" : "Ativo"}
                </small>
              </article>
            ))}
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "agenda" && (
        <div className="config-panel wide">
          <ConfigSectionHeader title="Agenda" createLabel="Criar agenda" onCreate={() => openAgendaModal()}>
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={scheduleRules.filter((item) => item.active !== false).length}
              inactiveCount={scheduleRules.filter((item) => item.active === false).length}
            />
          </ConfigSectionHeader>
          <div className="config-editor-grid">
            {filteredScheduleRules.length === 0 && (
              <EmptyState title="Nenhuma agenda cadastrada" text="Crie uma agenda para gerar dias disponíveis para castração." />
            )}
            {filteredScheduleRules.map((rule, index) => (
              <article className="config-list-row" key={rule.id} onClick={() => openAgendaModal(rule)} role="button" tabIndex={0}>
                <span className="config-list-index">{index + 1}</span>
                <div className="config-list-main">
                  <strong>{rule.description}</strong>
                  <span>{formatAgendaRuleSummary(rule)}</span>
                </div>
                <small className={rule.active ? "schedule-status active" : "schedule-status inactive"}>
                  {rule.active ? "Ativo" : "Inativo"}
                </small>
              </article>
            ))}
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "sizes" && (
        <SimpleConfigList title="Portes" items={filteredSizes} allItems={sizeOptions} filterValue={configStatusFilter} onFilterChange={setConfigStatusFilter} onCreate={() => openSizeModal()} onEdit={openSizeModal} onPatch={(id, patch) => patchListItem(setSizeOptions, id, patch)} showDescription />
      )}

      {configArea === "environment" && configTab === "species" && (
        <SimpleConfigList title="Espécies" items={filteredSpecies} allItems={speciesOptions} filterValue={configStatusFilter} onFilterChange={setConfigStatusFilter} onCreate={() => openSpeciesModal()} onEdit={openSpeciesModal} onPatch={(id, patch) => patchListItem(setSpeciesOptions, id, patch)} />
      )}

      {configArea === "sectors" && (
        <div className="config-panel wide">
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
              {filteredSectors.map((sector, index) => {
                const sectorMunicipalityId = getItemMunicipalityId(sector);
                const sectorUsers = dedupeMunicipalityItems(teams.users || []).filter((u) =>
                  getItemMunicipalityId(u) === sectorMunicipalityId && userBelongsToSector(u, sector.id)
                );
                return (
                  <article className="config-list-row" key={`${sectorMunicipalityId}:${sector.id}`} onClick={() => openSectorModal(sector)} role="button" tabIndex={0}>
                    <span className="config-list-index">{index + 1}</span>
                    <div className="config-list-main">
                      <strong>{sector.name || "Setor sem nome"}</strong>
                      <span>{sectorUsers.length} usuário(s) vinculado(s){sectorUsers.length > 0 ? ` · ${sectorUsers.map((u) => u.name).join(", ")}` : ""}</span>
                    </div>
                    <small className={sector.active === false ? "schedule-status inactive" : "schedule-status active"}>
                      {sector.active === false ? "Inativo" : "Ativo"}
                    </small>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {sectorModal && (
        <div className="modal-backdrop">
          <form className="workflow-modal config-sector-modal" onSubmit={(e) => { e.preventDefault(); createSector(); setSectorModal(false); }}>
            <header className="sector-modal-header">
              <div className="sector-modal-titleblock">
                <h2>{editingSectorId ? "Editar setor" : "Criar setor"}</h2>
                <p>Organize vínculos internos e responsáveis por etapa.</p>
              </div>
              <div className="permission-modal-head-actions">
                <label className="permission-inline-toggle">
                  <span>Ativo</span>
                  <input
                    type="checkbox"
                    checked={newSectorActive}
                    onChange={(event) => setNewSectorActive(event.target.checked)}
                  />
                  <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
                </label>
                <button className="modal-header-close" type="button" onClick={() => { setSectorModal(false); setEditingSectorId(null); setEditingSectorMunicipalityId(""); }} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="sector-modal-body">
              <label className="field sector-name-field">
                <span>Nome do setor</span>
                <input
                  value={newSectorName}
                  placeholder="Ex: Triagem documental"
                  onChange={(event) => setNewSectorName(event.target.value)}
                />
              </label>

              <section className="sector-links-panel">
                <div className="sector-links-head">
                  <strong>Vincular usuários</strong>
                  <small>{pendingSectorUserIds.length} de {sectorModalUsers.length} selecionados</small>
                </div>
                <div className="sector-link-list">
                  {sectorModalUsers.length === 0 && (
                    <span className="helper-text">Nenhum usuário cadastrado ainda.</span>
                  )}
                  {sectorModalUsers.length > 0 && (
                    <label className="sector-link-row sector-link-row--all">
                      <span>Todos</span>
                      <input
                        className="sector-switch-input"
                        type="checkbox"
                        checked={sectorModalUsers.every((u) => pendingSectorUserIds.includes(u.id))}
                        onChange={(event) => setPendingSectorUserIds(event.target.checked ? sectorModalUsers.map((u) => u.id) : [])}
                      />
                      <span className="sector-row-toggle" aria-hidden="true"><span /></span>
                    </label>
                  )}
                  {sectorModalUsers.map((u) => (
                    <label key={`${getItemMunicipalityId(u)}:${u.id}`} className="sector-link-row">
                      <span>{u.name}{getUserSectorIds(u).length ? ` (setores atuais: ${getUserSectorNames(u, teams.sectors || [])})` : ""}</span>
                      <input
                        className="sector-switch-input"
                        type="checkbox"
                        checked={pendingSectorUserIds.includes(u.id)}
                        onChange={() => setPendingSectorUserIds((current) =>
                          current.includes(u.id) ? current.filter((id) => id !== u.id) : [...current, u.id]
                        )}
                      />
                      <span className="sector-row-toggle" aria-hidden="true"><span /></span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <footer className="sector-modal-footer">
              <button className="primary-action" type="submit" disabled={!newSectorName.trim()}>{editingSectorId ? "Salvar" : "Criar setor"}</button>
            </footer>
          </form>
        </div>
      )}
      {configArea === "permissions" && (
        <div className="config-panel wide">
          <ConfigSectionHeader title={configAreaTitle} createLabel="Criar grupo" onCreate={() => openPermissionModal()}>
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={permissionGroups.filter((item) => item.active !== false).length}
              inactiveCount={permissionGroups.filter((item) => item.active === false).length}
            />
          </ConfigSectionHeader>
          <div className="config-editor-grid">
            {filteredPermissionGroups.length === 0 && (
              <EmptyState title="Nenhum grupo de permissão" text="Crie grupos para controlar menus e áreas de configuração de cada usuário." />
            )}
            {filteredPermissionGroups.map((group, index) => {
              const linkedUsers = (teams.users || []).filter((user) => user.permissionGroupId === group.id);
              return (
                <article className="config-list-row" key={group.id} onClick={() => openPermissionModal(group)} role="button" tabIndex={0}>
                  <span className="config-list-index">{index + 1}</span>
                  <div className="config-list-main">
                    <strong>{group.name || "Grupo sem nome"}</strong>
                    <span>{linkedUsers.length} usuário(s) · Menus: {(group.allowedMenuItems || []).length || 0} · Config: {(group.allowedConfigItems || []).length || 0}</span>
                  </div>
                  <small className={group.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {group.active === false ? "Inativo" : "Ativo"}
                  </small>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {configArea === "users" && (
        <div className="config-panel wide">
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
              {filteredTeamUsers.map((user, index) => (
                <article className="config-list-row" key={`${getItemMunicipalityId(user)}:${user.id}`} onClick={() => openTeamUserModal(user)} role="button" tabIndex={0}>
                  <span className="config-list-index">{index + 1}</span>
                  <div className="config-list-main">
                    <strong>{user.name || "Usuário sem nome"}</strong>
                    <span>{user.email || "Sem e-mail"} · {getMunicipalityLabel(user.municipalityId, municipalities)}</span>
                  </div>
                  <small className={user.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {user.active === false ? "Inativo" : "Ativo"}
                  </small>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {permissionModal && (
        <div className="modal-backdrop">
          <form className="workflow-modal config-permission-modal" onSubmit={(event) => { event.preventDefault(); createPermissionGroup(); }}>
            <header className="permission-modal-header">
              <div className="permission-modal-titleblock">
                <h2>{newPermissionGroup.name || (editingPermissionGroupId ? "Grupo de permissão" : "Novo grupo")}</h2>
                <p>Grupo padrão com todas as permissões do catálogo habilitadas.</p>
                <span>Criado em: {newPermissionGroup.createdAt || "sem registro"}</span>
              </div>
              <div className="permission-modal-head-actions">
                <label className="permission-inline-toggle">
                  <span>Ativo</span>
                  <input
                    type="checkbox"
                    checked={newPermissionGroup.active !== false}
                    onChange={(event) => setNewPermissionGroup((current) => ({ ...current, active: event.target.checked }))}
                  />
                  <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
                </label>
                <button className="modal-header-close" type="button" onClick={() => { setPermissionModal(false); setEditingPermissionGroupId(null); setNewPermissionGroup(emptyPermissionGroup); }} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="permission-modal-body">
              <label className="field permission-name-field">
                <span>Nome do grupo</span>
                <input
                  value={newPermissionGroup.name}
                  placeholder="Ex: Triagem documental"
                  onChange={(event) => setNewPermissionGroup((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <section className="permission-catalog-panel">
                <div className="permission-catalog-head">
                  <strong>Permissões</strong>
                </div>

                <div className="permission-group-list">
                  {permissionCatalogSections.map((section) => {
                    const selectedCount = section.items.filter((item) => (newPermissionGroup[item.field] || []).includes(item.id)).length;
                    const isOpen = permissionOpenSections[section.key] === true;
                    return (
                      <section className={`permission-group-card permission-group-card--${section.tone}`} key={section.key}>
                        <button
                          className="permission-group-header"
                          type="button"
                          onClick={() => setPermissionOpenSections((current) => ({ ...current, [section.key]: !isOpen }))}
                        >
                          <span>
                            <strong>{section.title}</strong>
                            <small>{selectedCount} de {section.items.length} permissões</small>
                          </span>
                          <span className={`permission-group-toggle${isOpen ? " is-open" : ""}`}>
                            {isOpen ? "Ocultar" : "Expandir"}
                            <ChevronDown size={14} />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="permission-checklist">
                            {section.items.map((item) => (
                              <label key={`${item.field}:${item.id}`} className="permission-check-row">
                                <span>{item.label}</span>
                                <input
                                  className="permission-switch-input"
                                  type="checkbox"
                                  checked={(newPermissionGroup[item.field] || []).includes(item.id)}
                                  onChange={() => togglePermissionList(item.field, item.id)}
                                />
                                <span className="permission-row-toggle" aria-hidden="true"><span /></span>
                              </label>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </section>
            </div>

            <footer className="permission-modal-footer">
              <button className="primary-action" type="submit" disabled={!newPermissionGroup.name?.trim()}>
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}
      {userModal && (
        <div className="modal-backdrop">
          <form className="workflow-modal config-user-modal" onSubmit={async (e) => { e.preventDefault(); setUserSaveError(""); if (await createTeamUser()) setUserModal(false); }}>
            <ModalHeader
              title={editingTeamUserId ? "Editar usuário" : "Criar usuário"}
              onClose={() => { setUserModal(false); setEditingTeamUserId(null); setSectorPickerOpen(false); setUserSaveError(""); }}
              actions={
                <label className="permission-inline-toggle">
                  <span>Ativo</span>
                  <input
                    type="checkbox"
                    checked={newTeamUser.active !== false}
                    onChange={(event) => setNewTeamUser((c) => ({ ...c, active: event.target.checked }))}
                  />
                  <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
                </label>
              }
            />
            <div className="config-management-body">
              <Field label="Nome" value={newTeamUser.name} placeholder="Nome completo" onChange={(value) => setNewTeamUser((c) => ({ ...c, name: value }))} />
            <Field label="Email" value={newTeamUser.email} placeholder="email@dominio.com" onChange={(value) => setNewTeamUser((c) => ({ ...c, email: value }))} />
            {isGlobalRole(currentUser?.role) && (() => {
              const munStates = [...new Set(activeMunicipalities.map((m) => m.state).filter(Boolean))].sort();
              const filteredMuns = municipalityStateFilter
                ? activeMunicipalities.filter((m) => m.state === municipalityStateFilter)
                : activeMunicipalities;
              return (
                <div className="municipality-selects">
                  <label className="field">
                    <span>Estado</span>
                    <select
                      value={municipalityStateFilter}
                      onChange={(e) => {
                        setMunicipalityStateFilter(e.target.value);
                        setNewTeamUser((c) => ({ ...c, municipalityId: "", sectorIds: [], permissionGroupId: "" }));
                      }}
                    >
                      <option value="">Selecione o estado</option>
                      {munStates.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Município</span>
                    <select
                      value={newTeamUser.municipalityId}
                      onChange={(e) => {
                        const munId = e.target.value;
                        const mun = activeMunicipalities.find((m) => String(m.id) === munId);
                        const defaultGroup = permissionGroups.find((group) =>
                          getItemMunicipalityId(group) === munId && group.active !== false
                        );
                        setMunicipalityStateFilter(mun?.state || "");
                        setNewTeamUser((c) => ({
                          ...c,
                          municipalityId: munId,
                          sectorIds: [],
                          permissionGroupId: defaultGroup?.id || "",
                        }));
                      }}
                    >
                      <option value="">Selecione o município</option>
                      {filteredMuns.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })()}
            <label className="field">
              <span>Setores vinculados</span>
              <div className="sector-input-box">
                {selectedTeamSectors.map((sector) => (
                  <span className="sector-tag" key={`${getItemMunicipalityId(sector)}:${sector.id}`}>
                    {sector.name}
                    <button
                      type="button"
                      aria-label={`Remover ${sector.name}`}
                      onClick={() => setNewTeamUser((current) => ({
                        ...current,
                        sectorIds: (current.sectorIds || []).filter((id) => id !== sector.id),
                      }))}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <button type="button" className="sector-add-btn" aria-label="Adicionar setor" onClick={() => setSectorPickerOpen(true)}>
                  <Plus size={14} />
                </button>
              </div>
            </label>
            <Field label="N° Matrícula" value={newTeamUser.matricula} placeholder="Ex: 00123" onChange={(value) => setNewTeamUser((c) => ({ ...c, matricula: value }))} />
            <Field label="Cargo" value={newTeamUser.role} placeholder="Ex: Veterinário, Coordenador..." onChange={(value) => setNewTeamUser((c) => ({ ...c, role: value }))} />
            <label className="field">
              <span>Grupo de permissão</span>
              <select
                value={newTeamUser.permissionGroupId || ""}
                onChange={(event) => setNewTeamUser((current) => ({ ...current, permissionGroupId: event.target.value }))}
              >
                <option value="">Sem grupo</option>
                {permissionGroups
                  .filter((group) => group.active !== false)
                  .filter((group) => !newTeamUser.municipalityId || !getItemMunicipalityId(group) || getItemMunicipalityId(group) === newTeamUser.municipalityId)
                  .map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Senha de login</span>
              <input type="password" value={newTeamUser.senha} placeholder={editingTeamUserId ? "Preencha apenas se quiser alterar" : "Senha inicial"} onChange={(e) => setNewTeamUser((c) => ({ ...c, senha: e.target.value }))} />
            </label>
            {userSaveError && <p className="form-error-msg">{userSaveError}</p>}
            </div>
            <footer className="form-actions config-management-footer">
              <button className="primary-action" type="submit" disabled={!newTeamUser.name.trim() || !newTeamUser.email.trim() || !newTeamUser.municipalityId || (!editingTeamUserId && !newTeamUser.senha)}>
              {editingTeamUserId ? "Salvar" : "Criar usuário"}
            </button>
            </footer>
          </form>
        </div>
      )}

      {userModal && sectorPickerOpen && (
        <div className="modal-backdrop">
          <div className="sector-picker-modal">
            <ModalHeader title="Adicionar setor" onClose={() => setSectorPickerOpen(false)} />
            <div className="sector-picker-list">
              {availableTeamSectors.length === 0 && <small>Todos os setores ativos já estão vinculados.</small>}
              {availableTeamSectors.map((sector) => (
                <button
                  key={`${getItemMunicipalityId(sector)}:${sector.id}`}
                  type="button"
                  onClick={() => {
                    setNewTeamUser((current) => ({ ...current, sectorIds: [...(current.sectorIds || []), sector.id] }));
                    setSectorPickerOpen(false);
                  }}
                >
                  {sector.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {configArea === "integrations" && configTab === "whatsapp" && (() => {
        const templateVars: string[] = Array.isArray(whatsappSettings.templateVariables)
          ? whatsappSettings.templateVariables
          : initialWhatsappSettings.templateVariables;
        const hasCredentials = Boolean(
          (whatsappSettings.accessToken || whatsappSettings.hasAccessToken) && whatsappSettings.phoneNumberId,
        );
        const isActive = hasCredentials && whatsappSettings.active !== false;
        const contractEnd = whatsappQuotaLive?.contractEnd || quotaSettings.contractEnd;
        const contractEndLabel = contractEnd
          ? new Date(contractEnd + "T00:00:00").toLocaleDateString("pt-BR")
          : null;
        return (
          <div className="config-panel wide">
            <PanelHeader title="WhatsApp por município" />

            {configMunicipalityScopeId && (
              <div className="whatsapp-statusbar">
                <span className={`whatsapp-dot ${isActive ? "whatsapp-dot--on" : "whatsapp-dot--off"}`} />
                <span className={`whatsapp-statusbar-state ${isActive ? "whatsapp-status-ok" : "whatsapp-status-err"}`}>
                  {isActive ? "Ativo" : "Inativo"}
                </span>
                {whatsappQuotaLive?.plan ? (
                  <>
                    <span className="whatsapp-statusbar-sep">·</span>
                    <span className="whatsapp-statusbar-text">
                      <strong>{whatsappQuotaLive.used ?? 0}/{whatsappQuotaLive.plan}</strong> mensagens este mês
                    </span>
                    <span className="whatsapp-statusbar-sep">·</span>
                    <span className={`whatsapp-statusbar-text ${whatsappQuotaLive.active ? "" : "whatsapp-status-err"}`}>
                      Contrato {whatsappQuotaLive.active ? "vigente" : "encerrado"}
                      {contractEndLabel ? ` até ${contractEndLabel}` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="whatsapp-statusbar-sep">·</span>
                    <span className="whatsapp-statusbar-text">Cota não configurada</span>
                  </>
                )}
              </div>
            )}

            <div className="whatsapp-settings-grid">
              <section className="whatsapp-section">
                <div className="whatsapp-section-header">
                  <span className="whatsapp-section-label">Credenciais</span>
                  <ConfigActiveToggle
                    checked={Boolean(whatsappSettings.active)}
                    onChange={(checked) => setWhatsappSettings((current) => ({ ...current, active: checked }))}
                  />
                </div>
                <div className="whatsapp-fields-row">
                  <label className="field">
                    <span>Provedor</span>
                    <select
                      value={whatsappSettings.provider || "cloud_api"}
                      onChange={(event) => setWhatsappSettings((current) => ({ ...current, provider: event.target.value }))}
                    >
                      <option value="cloud_api">WhatsApp Cloud API</option>
                    </select>
                  </label>
                  <Field
                    label="Idioma"
                    value={whatsappSettings.languageCode || ""}
                    placeholder="pt_BR"
                    onChange={(value) => setWhatsappSettings((current) => ({ ...current, languageCode: value }))}
                  />
                </div>
                <div className="whatsapp-fields-row">
                  <Field
                    label="ID do número remetente"
                    value={whatsappSettings.phoneNumberId || ""}
                    placeholder="Phone Number ID da Meta"
                    onChange={(value) => setWhatsappSettings((current) => ({ ...current, phoneNumberId: value }))}
                  />
                  <Field
                    label="Template de confirmação"
                    value={whatsappSettings.confirmationTemplate || ""}
                    placeholder="confirmacao_agenda_castracao"
                    onChange={(value) => setWhatsappSettings((current) => ({ ...current, confirmationTemplate: value }))}
                  />
                </div>
                <div className="field">
                  <span>Variáveis do template</span>
                  <div className="whatsapp-vars-chips">
                    {WHATSAPP_TEMPLATE_VARS.map(({ key, label }) => {
                      const idx = templateVars.indexOf(key);
                      const selected = idx >= 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`var-chip${selected ? " var-chip--on" : ""}`}
                          onClick={() => {
                            const next = selected
                              ? templateVars.filter((v) => v !== key)
                              : [...templateVars, key];
                            setWhatsappSettings((c) => ({ ...c, templateVariables: next }));
                          }}
                        >
                          {selected && <code className="var-chip-pos">{"{{" + (idx + 1) + "}}"}</code>}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="field">
                  <span>Token de acesso</span>
                  <input
                    value={whatsappSettings.accessToken || ""}
                    type="password"
                    placeholder={whatsappSettings.hasAccessToken ? "Token já salvo" : "Cole o token da Cloud API"}
                    onChange={(event) => setWhatsappSettings((current) => ({ ...current, accessToken: event.target.value }))}
                  />
                </label>
                <div className="whatsapp-save-row">
                  <button className="primary-action" type="button" onClick={saveWhatsappSettings} disabled={!configMunicipalityScopeId}>
                    Salvar credenciais
                  </button>
                  {whatsappSaveStatus && <span className={whatsappSaveStatus.includes("sucesso") ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{whatsappSaveStatus}</span>}
                </div>

                <div className="whatsapp-section-heading"><span>Teste de envio</span></div>
                <div className="whatsapp-test-row">
                  <Field
                    label="Número"
                    value={testPhone}
                    placeholder="(00) 00000-0000"
                    onChange={(value) => { setTestPhone(value); setTestSendStatus(""); }}
                  />
                  <button
                    className="primary-action"
                    type="button"
                    onClick={sendWhatsappTest}
                    disabled={testSending || !configMunicipalityScopeId || !hasCredentials}
                  >
                    {testSending ? "Enviando..." : "Enviar teste"}
                  </button>
                </div>
                {testSendStatus && (
                  <p className={testSendStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{testSendStatus}</p>
                )}
              </section>

              <section className="whatsapp-section">
                <div className="whatsapp-section-header">
                  <span className="whatsapp-section-label">Contrato e cota</span>
                </div>
                <div className="whatsapp-fields-row">
                  <Field
                    label="Limite mensal"
                    value={quotaSettings.plan}
                    placeholder="Ex: 500"
                    onChange={(value) => setQuotaSettings((current) => ({ ...current, plan: value }))}
                  />
                  <label className="field">
                    <span>Início</span>
                    <input
                      type="date"
                      value={quotaSettings.contractStart}
                      onChange={(event) => setQuotaSettings((current) => ({ ...current, contractStart: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Fim</span>
                    <input
                      type="date"
                      value={quotaSettings.contractEnd}
                      onChange={(event) => setQuotaSettings((current) => ({ ...current, contractEnd: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="whatsapp-save-row">
                  <button className="primary-action" type="button" onClick={saveQuotaSettings} disabled={!configMunicipalityScopeId}>
                    Salvar cota
                  </button>
                  {quotaSaveStatus && (
                    <span className={quotaSaveStatus.includes("sucesso") || quotaSaveStatus.includes("zerada") || quotaSaveStatus.includes("encerrado") ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>
                      {quotaSaveStatus}
                    </span>
                  )}
                </div>

                <div className="whatsapp-section-heading"><span>Ações</span></div>
                {confirmEndContract ? (
                  <div className="whatsapp-confirm-block">
                    <p>Encerrar contrato hoje ({new Date().toLocaleDateString("pt-BR")})?</p>
                    <div className="whatsapp-confirm-actions">
                      <button className="whatsapp-btn-danger-solid" type="button" onClick={endContractToday}>Confirmar</button>
                      <button className="btn-secondary" type="button" onClick={() => setConfirmEndContract(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="whatsapp-actions-row">
                    <button
                      className="whatsapp-btn-danger"
                      type="button"
                      onClick={() => setConfirmEndContract(true)}
                      disabled={!quotaSettings.plan || !configMunicipalityScopeId}
                    >
                      Encerrar contrato
                    </button>
                    <button
                      className="whatsapp-btn-warning"
                      type="button"
                      onClick={resetQuotaUsed}
                      disabled={!whatsappQuotaLive?.plan || !configMunicipalityScopeId}
                    >
                      Zerar cota do mês
                    </button>
                  </div>
                )}
                <p className="whatsapp-note">Encerrar bloqueia novos envios imediatamente. Zerar reinicia a contagem deste mês.</p>
              </section>
            </div>
          </div>
        );
      })()}

      {configArea === "environment" && configTab === "documents" && (
        <div className="config-panel wide">
          <ConfigSectionHeader title="Tipos de documentos" createLabel="Criar documento" onCreate={() => openDocumentModal()}>
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={documentTypes.filter((item) => item.active !== false).length}
              inactiveCount={documentTypes.filter((item) => item.active === false).length}
            />
          </ConfigSectionHeader>
          <div className="config-editor-grid">
            {filteredDocumentTypes.length === 0 && (
              <EmptyState title="Nenhum documento cadastrado" text="Crie documentos para vincular aos tipos de solicitação." />
            )}
            {filteredDocumentTypes.map((document, index) => (
              <article className="config-list-row" key={document.id} onClick={() => openDocumentModal(document)} role="button" tabIndex={0}>
                <span className="config-list-index">{index + 1}</span>
                <div className="config-list-main">
                  <strong>{document.name || "Documento sem nome"}</strong>
                  <span>
                    {document.required === false ? "Opcional" : "Obrigatório"}
                    {document.analysisRules?.expectedDocument ? ` · ${document.analysisRules.expectedDocument}` : ""}
                    {document.analysisRules?.requiredCriteria?.length ? " · Critérios configurados" : ""}
                  </span>
                </div>
                <small className={document.active === false ? "schedule-status inactive" : "schedule-status active"}>
                  {document.active === false ? "Inativo" : "Ativo"}
                </small>
              </article>
            ))}
          </div>
        </div>
      )}

      {configModal === "municipality" && (
        <div className="modal-backdrop">
          <form
            className="config-modal compact config-environment-modal"
            onSubmit={async (event) => {
              event.preventDefault();
              await saveMunicipality();
            }}
          >
            <ModalHeader
              title={editingMunicipalityId ? "Editar município" : "Cadastrar município"}
              onClose={() => {
                setConfigModal(null);
                setEditingMunicipalityId(null);
                setMunicipalitySaveStatus("");
                setNewMunicipality(emptyMunicipalityForm);
              }}
            />
            {isGlobalRole(currentUser?.role) && (
              <div className="config-modal-options">
                <ConfigActiveToggle
                  checked={newMunicipality.active !== false}
                  onChange={(checked) => setNewMunicipality((current) => ({ ...current, active: checked }))}
                />
              </div>
            )}
            {isGlobalRole(currentUser?.role) ? (
              <>
                <label className="field">
                  <span>Estado</span>
                  <select
                    value={newMunicipality.state}
                    onChange={(event) => {
                      const state = event.target.value;
                      setNewMunicipality((current) => ({
                        ...current,
                        state,
                        name: state === current.state ? current.name : "",
                      }));
                    }}
                  >
                    <option value="">Selecione o estado</option>
                    {brazilStates.map((state) => (
                      <option key={state.id || state.sigla} value={state.sigla}>
                        {state.sigla} - {state.nome}
                      </option>
                    ))}
                  </select>
                </label>
                {brazilLocationStatus.startsWith("Não foi possível") ? (
                  <Field
                    label="Município"
                    value={newMunicipality.name}
                    placeholder="Digite o município"
                    onChange={(value) => setNewMunicipality((current) => ({ ...current, name: value }))}
                  />
                ) : (
                  <label className="field">
                    <span>Município</span>
                    <select
                      value={newMunicipality.name}
                      disabled={!newMunicipality.state || brazilLocationStatus.startsWith("Carregando")}
                      onChange={(event) => setNewMunicipality((current) => ({ ...current, name: event.target.value }))}
                    >
                      <option value="">
                        {newMunicipality.state ? "Selecione o município" : "Selecione um estado primeiro"}
                      </option>
                      {newMunicipality.name && !brazilMunicipalities.some((city) => city.nome === newMunicipality.name) && (
                        <option value={newMunicipality.name}>{newMunicipality.name}</option>
                      )}
                      {brazilMunicipalities.map((city) => (
                        <option key={city.id || city.nome} value={city.nome}>
                          {city.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {brazilLocationStatus && <p className="helper-text">{brazilLocationStatus}</p>}
              </>
            ) : (
              <p className="helper-text">
                {[newMunicipality.name, newMunicipality.state].filter(Boolean).join(" / ")}
              </p>
            )}

            <Field
              label="Nome do órgão / secretaria"
              value={newMunicipality.departmentName}
              placeholder="Ex: Secretaria de Meio Ambiente"
              onChange={(value) => setNewMunicipality((current) => ({ ...current, departmentName: value }))}
            />
            <div className="modal-form-grid">
              <Field label="Contato" value={newMunicipality.contact} placeholder="Telefone, WhatsApp ou setor responsável" onChange={(value) => setNewMunicipality((current) => ({ ...current, contact: value }))} />
              <label className="field">
                <span>Email</span>
                <input type="email" value={newMunicipality.email} placeholder="contato@municipio.gov.br" onChange={(event) => setNewMunicipality((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <Field label="Endereço" value={newMunicipality.address} placeholder="Rua, número, bairro" onChange={(value) => setNewMunicipality((current) => ({ ...current, address: value }))} />
              <Field label="CEP" value={newMunicipality.cep} placeholder="00000-000" onChange={(value) => setNewMunicipality((current) => ({ ...current, cep: value }))} />
            </div>
            <div className="field">
              <span>Brasão do município</span>
              <label className="brasao-upload-label">
                {newMunicipality.brasao ? (
                  <div className="brasao-preview-wrap">
                    <img src={newMunicipality.brasao} alt="Brasão" className="brasao-preview-img" />
                    <button
                      type="button"
                      className="brasao-remove-btn"
                      onClick={() => setNewMunicipality((c) => ({ ...c, brasao: "" }))}
                      aria-label="Remover brasão"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="brasao-dropzone">
                    <ImagePlus size={22} strokeWidth={1.4} />
                    <span>Clique para selecionar imagem</span>
                    <small>PNG ou JPG · recomendado 256×256px</small>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setNewMunicipality((c) => ({ ...c, brasao: String(reader.result || "") }));
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {municipalitySaveStatus && (
              <p className={municipalitySaveStatus.includes("Não") || municipalitySaveStatus.includes("Selecione") ? "form-error" : "helper-text"}>
                {municipalitySaveStatus}
              </p>
            )}
            <div className="form-actions">
              <button className="primary-action" type="submit" disabled={municipalitySaving || !newMunicipality.name.trim() || !newMunicipality.state.trim()}>
                {municipalitySaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {configModal === "agenda" && (
        <div className="modal-backdrop">
          <form className="config-modal agenda-config-modal config-environment-modal" onSubmit={createScheduleFromModal} role="dialog" aria-modal="true">
            <ModalHeader
              title={editingScheduleRuleId ? "Editar agenda" : "Criar agenda"}
              onClose={() => { setConfigModal(null); setEditingScheduleRuleId(null); setAgendaForm(emptyAgendaForm); setAgendaSaving(false); setAgendaSaveStatus(""); }}
            />

            <div className="agenda-modal-head">
              <div>
                <span>{agendaFormIsMutirao ? "Mutirão" : "Agenda"}</span>
                <strong>{agendaForm.description || "Nova agenda"}</strong>
              </div>
              <ConfigActiveToggle
                checked={agendaForm.active}
                onChange={(checked) => patchAgendaForm("active", checked)}
              />
            </div>

            <div className="agenda-modal-layout agenda-modal-layout--modern">
              <section className="agenda-modal-block agenda-modal-block--identity">
                <div className="agenda-block-title">
                  <div>
                    <strong>Identificação</strong>
                    <small>Nome, município e tipo de agenda.</small>
                  </div>
                </div>
                <Field label="Descrição" value={agendaForm.description} placeholder="Ex: Mutirão bairro Centro" onChange={(value) => patchAgendaForm("description", value)} />
                <div className="modal-form-grid">
                  <label className="field">
                    <span>Município</span>
                    <select value={agendaForm.municipalityId} onChange={(event) => patchAgendaForm("municipalityId", event.target.value)} disabled={!isGlobalRole(currentUser?.role) && Boolean(currentUser?.municipalityId)}>
                      <option value="">Selecione</option>
                      {municipalities.map((municipality) => (
                        <option key={municipality.id} value={municipality.id}>
                          {[municipality.name, municipality.state].filter(Boolean).join("/")}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!agendaFormIsMutirao && (
                    <label className="field">
                      <span>Tipo de período</span>
                      <select value={agendaForm.type} onChange={(event) => patchAgendaForm("type", event.target.value)}>
                        <option value="Recorrência">Recorrência</option>
                        <option value="Dia específico">Dia específico</option>
                      </select>
                    </label>
                  )}
                </div>
                <AgendaKindSelector value={agendaForm.kind} onChange={(value) => patchAgendaForm("kind", value)} />
                {agendaFormIsMutirao && (
                  <p className="agenda-mode-note">Mutirão usa datas específicas. Cadastre cada data com seu local e suas faixas de horário.</p>
                )}
              </section>

              {!agendaFormIsMutirao && (
                <>
                  <section className="agenda-modal-block">
                    <div className="agenda-block-title">
                      <div>
                        <strong>Local</strong>
                        <small>Dados exibidos para o tutor no agendamento.</small>
                      </div>
                    </div>
                    <div className="modal-form-grid">
                      <Field label="Local de atendimento" value={agendaForm.locationName} placeholder="Ex: Centro de zoonoses" onChange={(value) => patchAgendaForm("locationName", value)} />
                      <Field label="Endereço do local" value={agendaForm.locationAddress} placeholder="Ex: Rua Araranguá, 333 - Centro" onChange={(value) => patchAgendaForm("locationAddress", value)} />
                      <Field label="Link do endereço" value={agendaForm.addressUrl} placeholder="Cole o link do Google Maps" onChange={(value) => patchAgendaForm("addressUrl", value)} />
                    </div>
                  </section>

                  <section className="agenda-modal-block">
                    <div className="agenda-block-title">
                      <div>
                        <strong>Período e capacidade</strong>
                        <small>Defina datas e vagas disponíveis.</small>
                      </div>
                    </div>
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
                      {normalizeText(agendaForm.type) === "recorrencia" && (
                        <Field label="Repetir a cada semana(s)" value={agendaForm.repeatEvery} onChange={(value) => patchAgendaForm("repeatEvery", value)} />
                      )}
                    </div>
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
                    <div className="agenda-slots-field">
                      <div className="agenda-slots-header">
                        <div>
                          <span>Faixas de horário</span>
                          <small>Total diário: {sumScheduleSlotsVacancies(agendaForm.slots)} vagas</small>
                        </div>
                        <button className="secondary-action" type="button" onClick={addAgendaSlot}>
                          <Plus size={16} />
                          Adicionar faixa
                        </button>
                      </div>
                      <div className="agenda-slots-list">
                        {(agendaForm.slots || []).map((slot, index) => (
                          <div className="agenda-slot-row" key={`${index}-${slot.time}`}>
                            <label className="field">
                              <span>Hora de início</span>
                              <input type="time" value={slot.time} onChange={(event) => patchAgendaSlot(index, "time", event.target.value)} />
                            </label>
                            <Field label="Vagas" value={slot.vacancies} onChange={(value) => patchAgendaSlot(index, "vacancies", value)} />
                            <button className="icon-button danger-action" type="button" onClick={() => removeAgendaSlot(index)} aria-label="Remover faixa" title="Remover faixa">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </>
              )}

              {agendaFormIsMutirao && (
                <section className="agenda-modal-block agenda-mutirao-block">
                  <div className="agenda-block-title">
                    <div>
                      <strong>Datas e locais do mutirão</strong>
                      <small>Adicione uma ocorrência para cada dia de atendimento.</small>
                    </div>
                    <button className="secondary-action" type="button" onClick={addAgendaOccurrence}>
                      <Plus size={16} />
                      Adicionar data
                    </button>
                  </div>

                  <div className="agenda-occurrence-list">
                    {getAgendaOccurrenceList(agendaForm).map((occurrence, occurrenceIndex) => (
                      <article className="agenda-occurrence-card" key={occurrence.id || occurrenceIndex}>
                        <div className="agenda-occurrence-header">
                          <div>
                            <span>Ocorrência {occurrenceIndex + 1}</span>
                            <strong>{occurrence.date ? toScheduleDate(occurrence.date) : "Nova data"}</strong>
                          </div>
                          <button
                            className="icon-button danger-action"
                            type="button"
                            onClick={() => removeAgendaOccurrence(occurrenceIndex)}
                            disabled={getAgendaOccurrenceList(agendaForm).length === 1}
                            aria-label="Remover data do mutirão"
                            title="Remover data"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="modal-form-grid">
                          <label className="field">
                            <span>Data do mutirão</span>
                            <input type="date" value={occurrence.date} onChange={(event) => patchAgendaOccurrence(occurrenceIndex, "date", event.target.value)} />
                          </label>
                          <Field label="Local de atendimento" value={occurrence.locationName} placeholder="Ex: Escola municipal do bairro" onChange={(value) => patchAgendaOccurrence(occurrenceIndex, "locationName", value)} />
                          <Field label="Endereço do local" value={occurrence.locationAddress} placeholder="Rua, número e bairro" onChange={(value) => patchAgendaOccurrence(occurrenceIndex, "locationAddress", value)} />
                          <Field label="Link do endereço" value={occurrence.addressUrl} placeholder="Cole o link do Google Maps" onChange={(value) => patchAgendaOccurrence(occurrenceIndex, "addressUrl", value)} />
                        </div>

                        <div className="agenda-slots-field agenda-slots-field--compact">
                          <div className="agenda-slots-header">
                            <div>
                              <span>Faixas de horário</span>
                              <small>Total: {sumScheduleSlotsVacancies(occurrence.slots)} vagas</small>
                            </div>
                            <button className="secondary-action" type="button" onClick={() => addAgendaOccurrenceSlot(occurrenceIndex)}>
                              <Plus size={16} />
                              Adicionar faixa
                            </button>
                          </div>
                          <div className="agenda-slots-list">
                            {(occurrence.slots || []).map((slot, slotIndex) => (
                              <div className="agenda-slot-row" key={`${occurrence.id}-${slotIndex}-${slot.time}`}>
                                <label className="field">
                                  <span>Hora de início</span>
                                  <input type="time" value={slot.time} onChange={(event) => patchAgendaOccurrenceSlot(occurrenceIndex, slotIndex, "time", event.target.value)} />
                                </label>
                                <Field label="Vagas" value={slot.vacancies} onChange={(value) => patchAgendaOccurrenceSlot(occurrenceIndex, slotIndex, "vacancies", value)} />
                                <button className="icon-button danger-action" type="button" onClick={() => removeAgendaOccurrenceSlot(occurrenceIndex, slotIndex)} aria-label="Remover faixa" title="Remover faixa">
                                  <X size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="form-actions">
              <button className="primary-action" type="submit" disabled={agendaSaving}>
                {agendaSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
            {agendaSaveStatus && <p className="form-error">{agendaSaveStatus}</p>}
          </form>
        </div>
      )}
      {configModal === "requestType" && (
        <div className="modal-backdrop">
          <form
            className="config-modal compact request-type-modal config-environment-modal"
            onSubmit={(event) => {
              event.preventDefault();
              if (editingRequestTypeId) {
                patchRequestType(editingRequestTypeId, { ...newRequestType, stepDocuments: true });
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
            <div className="request-type-steps-section">
              <span className="request-type-steps-label">Etapas do cadastro</span>
              <div className="request-type-steps-toggles">
                <label className="toggle-switch config-active-toggle request-type-step-toggle">
                  <input
                    type="checkbox"
                    checked={newRequestType.stepTutor !== false}
                    onChange={(e) => setNewRequestType((current) => ({ ...current, stepTutor: e.target.checked }))}
                  />
                  <span className="toggle-track"><span className="toggle-thumb" /></span>
                  <span className="request-type-step-toggle-text">
                    <span>Dados do tutor</span>
                    <small>Desativar oculta esta etapa no cadastro público.</small>
                  </span>
                </label>
                <label className="toggle-switch config-active-toggle request-type-step-toggle">
                  <input
                    type="checkbox"
                    checked={newRequestType.stepAgenda !== false}
                    onChange={(e) => setNewRequestType((current) => ({ ...current, stepAgenda: e.target.checked }))}
                  />
                  <span className="toggle-track"><span className="toggle-thumb" /></span>
                  <span className="request-type-step-toggle-text">
                    <span>Agenda</span>
                    <small>Desativar oculta esta etapa no cadastro público.</small>
                  </span>
                </label>
              </div>
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
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "species" && (
        <div className="modal-backdrop">
          <form className="config-modal compact config-environment-modal" onSubmit={(event) => { event.preventDefault(); createSpecies(newSpecies); setNewSpecies({ name: "", active: true }); setEditingSpeciesId(null); setConfigModal(null); }}>
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
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "size" && (
        <div className="modal-backdrop">
          <form className="config-modal compact config-environment-modal" onSubmit={(event) => { event.preventDefault(); saveSize(newSize); setNewSize({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true }); setEditingSizeId(null); setConfigModal(null); }}>
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
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "document" && (
        <div className="modal-backdrop">
          <form
            className="config-modal document-analysis-modal config-environment-modal"
            onSubmit={(event) => {
              event.preventDefault();
              createDocumentType({
                ...newDocument,
                requiredCriteria: textToCriteriaList(newRequiredCriterion),
                rejectionCriteria: textToCriteriaList(newRejectionCriterion),
              });
              setNewDocument(emptyDocumentForm);
              setNewRequiredCriterion("");
              setNewRejectionCriterion("");
              setEditingDocumentId(null);
              setConfigModal(null);
            }}
          >
            <ModalHeader
              title={editingDocumentId ? "Editar documento" : "Criar documento"}
              onClose={() => { setConfigModal(null); setEditingDocumentId(null); setNewDocument(emptyDocumentForm); setNewRequiredCriterion(""); setNewRejectionCriterion(""); }}
            />

            <div className="document-settings-card">
              <div className="document-settings-item">
                <span>Ativo</span>
                <ConfigActiveToggle
                  checked={newDocument.active !== false}
                  onChange={(checked) => setNewDocument((current) => ({ ...current, active: checked }))}
                  onText=""
                  offText=""
                />
              </div>
              <div className="document-settings-item">
                <span>Obrigatório</span>
                <ConfigActiveToggle
                  checked={newDocument.required !== false}
                  onChange={(checked) => setNewDocument((current) => ({ ...current, required: checked }))}
                  onText=""
                  offText=""
                />
              </div>
              <div className="document-settings-item">
                <span>Usar Análise por IA</span>
                <ConfigActiveToggle
                  checked={newDocument.useAi !== false}
                  onChange={(checked) => setNewDocument((current) => ({ ...current, useAi: checked }))}
                  onText=""
                  offText=""
                />
              </div>
            </div>
            <div className="document-modal-body">
              <div className="document-identity-grid">
                <Field label="Nome" value={newDocument.name} placeholder="Ex: Comprovante de residencia" onChange={(value) => setNewDocument((current) => ({ ...current, name: value }))} />
                <label className="field document-sigla-field">
                  <span>Sigla</span>
                  <input
                    value={newDocument.expectedDocument}
                    placeholder="EX: CR"
                    onChange={(event) => setNewDocument((current) => ({ ...current, expectedDocument: event.target.value.toUpperCase() }))}
                  />
                </label>
              </div>

              <section className="document-modal-panel document-modal-panel--criteria">
                <div className="document-section-heading">
                  <span><ListChecks size={15} /> Critérios de análise</span>
                  <small>Digite um critério por linha. As alterações são salvas junto com o botão Salvar deste documento.</small>
                </div>
                <DocumentCriteriaColumn
                  variant="required"
                  value={newRequiredCriterion}
                  onChange={setNewRequiredCriterion}
                  placeholder={"Ex: documento leg\u00edvel\nFoto do condutor vis\u00edvel"}
                />
                <DocumentCriteriaColumn
                  variant="rejection"
                  value={newRejectionCriterion}
                  onChange={setNewRejectionCriterion}
                  placeholder={"Ex: documento ileg\u00edvel\nRasura vis\u00edvel no documento"}
                />
              </section>
              {newDocument.useAi !== false && (
                <section className="document-modal-panel document-modal-panel--decision">
                  <div className="document-section-heading">
                    <span><ShieldCheck size={15} /> Decisão automática</span>
                  </div>
                  <DocumentConfidenceSlider
                    value={newDocument.minimumConfidence}
                    onChange={(value: number) => setNewDocument((current) => ({ ...current, minimumConfidence: value }))}
                  />
                </section>
              )}
            </div>

            <div className="form-actions document-modal-actions">
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );

}

function SimpleConfigList({ title, items, allItems = items, filterValue = "active", onFilterChange, onCreate, onEdit, onPatch, showDescription = false }: AnyRecord) {
  return (
    <div className="config-panel wide">
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
        {items.map((item, index) => (
          <article className="config-list-row" key={item.id} onClick={() => onEdit?.(item)} role="button" tabIndex={0}>
            <span className="config-list-index">{index + 1}</span>
            <div className="config-list-main">
              <strong>{item.name || "Item sem nome"}</strong>
              {showDescription && <span>{formatSizeRange(item) || "Faixa de peso não informada"}</span>}
            </div>
            <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
              {item.active === false ? "Inativo" : "Ativo"}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}

function AnimalRecordPanel({ record, cpf, validationKey, onRequestCreated }: AnyRecord) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [deathOpen, setDeathOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
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

  const latestHistoryItem = history[0] || null;
  const nextScheduledHistoryItem = history.find((item) => (
    (item.status === "AGENDADA" || item.status === "AGUARDANDO_CIRURGIA")
    && getAnimalHistorySchedule(item)
  ));
  const latestProcedureItem = history.find((item) => (
    ["CIRURGIA_REALIZADA", "SOLICITACAO_PROCEDIMENTO"].includes(item.type)
  ));
  const historyMunicipalities = [...new Set(history.map(getAnimalHistoryMunicipality).filter(Boolean))];
  const animalSummary = [animal.species, animal.sex, animal.size].filter(Boolean).join(" · ") || "Dados do animal em atualização";
  const AnimalIcon = String(animal.species || "").toLowerCase().includes("gat") ? Cat : Dog;
  const tutorName = tutor.tutor_name || tutor.name || "Não informado";
  const tutorContact = [tutor.phone, tutor.tutor_email].filter(Boolean).join(" · ") || "Não informado";

  const historyDocuments = history.flatMap((entry: AnyRecord) => entry?.data?.registration?.documents || []);
  const animalPhotoDoc = getUserUploadedProcessDocuments(historyDocuments).find(isAnimalPhotoDocument);
  const animalPhotoDataUrl = animalPhotoDoc ? getDocumentPreviewSource(animalPhotoDoc) : "";

  return (
    <section className="animal-record-panel">
      <div className="animal-record-header">
        <div className="animal-record-identity">
          {animalPhotoDataUrl ? (
            <img className="animal-record-avatar animal-record-avatar-photo" src={animalPhotoDataUrl} alt={animal.name || "Foto do animal"} />
          ) : (
            <div className="animal-record-avatar" aria-hidden="true">
              <AnimalIcon size={28} />
            </div>
          )}
          <div>
            <h3>{animal.name || "Animal sem nome"}</h3>
            <p>{animalSummary}</p>
            <div className="animal-record-meta">
              <span><ScanLine size={14} /> {animal.microchip || "Microchip não informado"}</span>
              {historyMunicipalities.length > 0 && <span><MapPin size={14} /> {historyMunicipalities.join(", ")}</span>}
            </div>
          </div>
        </div>
        <div className="animal-record-header-tools">
          <span className="animal-status-chip">{animal.status || "ativo"}</span>
          <button
            className="icon-btn-flat"
            type="button"
            title="Baixar prontuário PDF"
            disabled={downloadingPdf}
            onClick={async () => {
              setDownloadingPdf(true);
              try {
                const bundle = await generateProntuarioPdf({}, record);
                if (bundle?.dataUrl) {
                  const a = document.createElement("a");
                  a.href = bundle.dataUrl;
                  a.download = bundle.fileName || `prontuario-${animal.name || "animal"}.pdf`;
                  a.click();
                }
              } catch (err) { console.error(err); } finally { setDownloadingPdf(false); }
            }}
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      <div className="animal-record-summary">
        <div className="animal-record-summary-card">
          <span><User size={14} /> Tutor atual</span>
          <strong>{tutorName}</strong>
          <small>{maskCpf(tutor.cpf || cpf)}</small>
        </div>
        <div className="animal-record-summary-card">
          <span><Phone size={14} /> Contato</span>
          <strong>{tutorContact}</strong>
          <small>{[tutor.address, tutor.neighborhood, tutor.city, tutor.state].filter(Boolean).join(", ") || "Endereço não informado"}</small>
        </div>
        <div className="animal-record-summary-card">
          <span><Clock size={14} /> Situação</span>
          <strong>{latestHistoryItem ? animalHistoryTitle(latestHistoryItem) : "Sem eventos"}</strong>
          <small>{latestHistoryItem?.occurred_at ? formatDateTime(latestHistoryItem.occurred_at) : "Sem data registrada"}</small>
        </div>
      </div>

      <div className="animal-record-grid">
        <InfoTile label="Microchip" value={animal.microchip || "Não informado"} />
        <InfoTile label="Espécie / sexo / porte" value={animalSummary} />
        <InfoTile label="Próxima agenda" value={nextScheduledHistoryItem ? getAnimalHistorySchedule(nextScheduledHistoryItem) : "Sem agenda"} />
        <InfoTile label="Último procedimento" value={latestProcedureItem ? animalHistoryTitle(latestProcedureItem) : "Não informado"} />
        <InfoTile label="Municípios" value={historyMunicipalities.join(", ") || "Não informado"} />
        <InfoTile label="Eventos" value={`${history.length} registro(s)`} />
      </div>


      {deathOpen && (
        <div className="modal-backdrop">
          <form className="workflow-modal animal-action-modal" onSubmit={submitDeath} role="dialog" aria-modal="true">
            <ModalHeader title="Registrar óbito" subtitle={animal.name || undefined} onClose={() => setDeathOpen(false)} />
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
            <ModalHeader title="Solicitar troca de tutor" subtitle={animal.name || undefined} onClose={() => setTransferOpen(false)} />
            <div className="detail-grid compact-detail-grid">
              <p><span>Microchip</span>{animal.microchip || "Não informado"}</p>
              <p><span>Tutor atual</span>{tutor.tutor_name || tutor.name || "Não informado"}</p>
            </div>
            <label className="field"><span>Novo tutor</span><input value={transferForm.target_tutor_name} onChange={(event) => setTransferForm((current) => ({ ...current, target_tutor_name: event.target.value }))} /></label>
            <label className="field"><span>CPF do novo tutor</span><input value={transferForm.target_tutor_cpf} onChange={(event) => setTransferForm((current) => ({ ...current, target_tutor_cpf: formatCpf(event.target.value) }))} placeholder="000.000.000-00" /></label>
            <div className="two-column-fields">
              <label className="field"><span>Telefone</span><input type="tel" value={transferForm.target_tutor_phone} onChange={(event) => setTransferForm((current) => ({ ...current, target_tutor_phone: formatPhone(event.target.value) }))} /></label>
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
        <div className="animal-history-heading">
          <div>
            <h4>Histórico do animal</h4>
            <p>{history.length} evento(s) registrado(s) para este microchip</p>
          </div>
        </div>
        {history.length === 0 && <p className="helper-text">Nenhum evento registrado para este microchip.</p>}
        {history.slice(0, 8).map((item, index) => (
          <article className={`animal-history-item ${animalHistoryTone(item)}`} key={`${item.source || "history"}-${item.request_id || item.id || index}`}>
            <div className="animal-history-marker">
              {animalHistoryIcon(item)}
            </div>
            <div className="animal-history-content">
            <div className="animal-history-topline">
              <span>{formatDateTime(item.occurred_at) || "Sem data"}</span>
              {getAnimalHistoryMunicipality(item) && <em>{getAnimalHistoryMunicipality(item)}</em>}
            </div>
            <strong>{animalHistoryTitle(item)}</strong>
            {(item.protocol || item.status || item.notes) && (
              <p>{[item.protocol ? `#${item.protocol}` : "", item.status ? statusLabels[item.status] || item.status : "", item.notes].filter(Boolean).join(" · ")}</p>
            )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}


function animalHistoryTitle(item: AnyRecord = {}) {
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

function getAnimalHistoryRegistration(item: AnyRecord = {}) {
  return item.data?.registration || {};
}

function getAnimalHistoryMunicipality(item: AnyRecord = {}) {
  const registration = getAnimalHistoryRegistration(item);
  return registration.municipality || registration.schedule_municipality || "";
}

function getAnimalHistorySchedule(item: AnyRecord = {}) {
  const registration = getAnimalHistoryRegistration(item);
  return registration.schedule_date || "";
}

function animalHistoryTone(item: AnyRecord = {}) {
  if (["ANIMAL_OBITO", "SOLICITACAO_OBITO"].includes(item.type)) return "danger";
  if (["TROCA_TUTOR", "SOLICITACAO_TROCA_TUTOR"].includes(item.type)) return "transfer";
  if (item.type === "CIRURGIA_REALIZADA") return "success";
  if (item.status === "AGENDADA" || item.status === "AGUARDANDO_CIRURGIA") return "scheduled";
  return "neutral";
}

function animalHistoryIcon(item: AnyRecord = {}) {
  if (["ANIMAL_OBITO", "SOLICITACAO_OBITO"].includes(item.type)) return <AlertCircle size={15} />;
  if (["TROCA_TUTOR", "SOLICITACAO_TROCA_TUTOR"].includes(item.type)) return <RefreshCw size={15} />;
  if (item.type === "CIRURGIA_REALIZADA") return <CheckCircle2 size={15} />;
  if (item.status === "AGENDADA" || item.status === "AGUARDANDO_CIRURGIA") return <CalendarDays size={15} />;
  return <ClipboardList size={15} />;
}











function DocumentButtonPicker({ documents, selectedDocuments, onToggle }: AnyRecord) {
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

function DocumentScannerUpload({ document, upload, aiActive, onUpload, onRemove }: AnyRecord) {
  const documentUsesAi = document.analysisRules?.useAi !== false;
  const needsReplacement = upload?.status === "attached" && upload?.aiVerdict === "rejected";
  const statusLabel = needsReplacement ? "Não confirmado" : ({
    checking: aiActive ? "Em análise" : "Recebendo arquivo",
    approved: aiActive ? "Aprovado pela análise" : "Aprovado",
    attached: documentUsesAi ? "Conferência manual" : "Anexado",
    rejected: aiActive ? "Recusado pela análise" : "Recusado",
  }[upload?.status] || "Aguardando arquivo");
  const publicMessage = needsReplacement
    ? "Este arquivo não parece ser o documento solicitado. Anexe o comprovante correto para continuar."
    : upload?.status === "attached"
    ? documentUsesAi ? "Arquivo recebido para conferência da nossa equipe." : "Arquivo anexado."
    : upload?.status === "approved"
    ? "Documento confirmado automaticamente."
    : upload?.status === "rejected"
    ? "Documento recusado: não atende aos critérios solicitados. Anexe o arquivo correto."
    : upload?.message;

  const statusIcon = needsReplacement ? <AlertCircle size={16} className="doc-status-icon is-err" /> : ({
    approved: <BadgeCheck size={16} className="doc-status-icon is-ok" />,
    rejected: <AlertCircle size={16} className="doc-status-icon is-err" />,
    checking: <RefreshCw size={14} className="doc-status-icon is-spin" />,
    attached: <Paperclip size={15} className="doc-status-icon is-att" />,
  }[upload?.status] || <FileText size={15} className="doc-status-icon is-empty" />);

  return (
    <>
      <article className={`doc-row ${upload?.status || "empty"}${needsReplacement ? " needs-replacement" : ""}`}>
        <div className="doc-row-icon">{statusIcon}</div>
        <div className="doc-row-info">
          <strong>{document.name}{document.required && <span className="doc-required">*</span>}</strong>
          {upload?.fileName
            ? <small>{upload.fileName}</small>
            : <small className="doc-row-hint">{statusLabel}</small>
          }
          {publicMessage && <small className="doc-row-msg">{publicMessage}</small>}
        </div>
        <div className="doc-row-actions">
          <label className="doc-attach-btn" title={upload ? "Substituir arquivo" : "Anexar arquivo"}>
            <Paperclip size={15} />
            <input
              type="file"
              accept={(document.accept || []).join(",")}
              onClick={(event) => { event.currentTarget.value = ""; }}
              onChange={(event) => onUpload(event.target.files?.[0])}
            />
          </label>
          {upload && (
            <button className="doc-remove-btn" type="button" onClick={onRemove} title="Remover">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </article>
      {upload?.status === "checking" && upload?.dataUrl && (
        <DocumentScanningPreview dataUrl={upload.dataUrl} fileType={upload.fileType} />
      )}
    </>
  );
}

function AiAnalysisDetails({ show, provider, model, confidence, criteriaResults, metaClassName = "doc-row-meta", criteriaClassName = "doc-criteria-results", showMeta = true }: AnyRecord) {
  if (!show) return null;
  const numericConfidence = Number(confidence);
  const hasConfidence = Number.isFinite(numericConfidence);
  const providerLabel = [provider, model].filter(Boolean).join(" / ");
  const results = Array.isArray(criteriaResults) ? criteriaResults : [];

  return (
    <>
      {showMeta && (providerLabel || hasConfidence) && (
        <small className={metaClassName}>
          {[providerLabel, hasConfidence ? `${Math.round(numericConfidence * 100)}% de confiança` : ""].filter(Boolean).join(" · ")}
        </small>
      )}
      {results.length > 0 && (
        <div className={criteriaClassName}>
          {results.map((item: AnyRecord, index: number) => (
            <span key={`${item.criterion}-${index}`} className={item.met ? "is-met" : "is-missing"} title={item.reason || ""}>
              {item.criterion}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function DocumentScanningPreview({ dataUrl, fileType }: AnyRecord) {
  const isImage = String(fileType || "").startsWith("image/");
  return (
    <div className="doc-scan-preview">
      <div className="doc-scan-frame">
        {isImage ? (
          <img src={dataUrl} alt="Pré-visualização do documento em análise" />
        ) : (
          <div className="doc-scan-generic"><FileText size={26} /></div>
        )}
        <span className="doc-scan-line" />
        <span className="doc-scan-marker doc-scan-marker--1" />
        <span className="doc-scan-marker doc-scan-marker--2" />
        <span className="doc-scan-marker doc-scan-marker--3" />
      </div>
      <p className="doc-scan-caption">Lendo documento e verificando critérios cadastrados…</p>
    </div>
  );
}

async function validateDocumentWithAI(document: AnyRecord, file: File, aiSettings: AnyRecord = initialAiSettings, dataUrl = "", municipalityId = ""): Promise<AnyRecord> {
  const localResult = await validateDocumentLocally(document, file);
  if (localResult.status === "rejected" || !aiSettings?.active || document.analysisRules?.useAi === false) return localResult;

  try {
    return await api.validateDocument({
      document: {
        id: document.id,
        name: document.name,
        analysisRules: document.analysisRules,
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
      },
      municipalityId,
    });
  } catch (err) {
    console.error("Erro ao validar documento com IA externa:", err);
    return {
      status: "attached",
      message: "Arquivo anexado para conferência manual.",
      confidence: null,
      provider: aiSettings.provider || "IA externa",
      error: true,
    };
  }
}

function validateDocumentLocally(document: AnyRecord, file: File): Promise<AnyRecord> {
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

    resolve({
      status: "attached",
      message: "Arquivo anexado para conferência manual conforme critérios configurados.",
      confidence: 0,
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

function getRequestMicrochips(request: AnyRecord = {}) {
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

function printAnimalRecordPdf(animal: AnyRecord = {}, tutor: AnyRecord = {}, history = []) {
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
    NOVA: "Nova",
    AGENDADA: "Agendada",
    REALIZADA: "Realizada",
    CANCELADA: "Cancelada",
    // Legacy
    EM_ANALISE: "Em análise",
    AGUARDANDO_CIRURGIA: "Agendada",
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
          : "-";
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
    <title>Prontuário - ${escapeHtml(animal.name || animal.microchip || "Animal")}</title>
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
        <h1>${escapeHtml(animal.name || "Animal não identificado")}</h1>
        <span style="font-size:11px;opacity:.8">${[animal.species, animal.sex, animal.size].filter(Boolean).join(" · ")}</span>
      </div>
      <div class="header-box">
        <span>Microchip</span>
        <strong style="font-size:13px">${escapeHtml(animal.microchip || "-")}</strong>
      </div>
    </header>

    <section class="section">
      <div class="section-title">Dados do animal</div>
      <div class="data-grid four">
        <div class="data-item"><span>Espécie</span><strong>${escapeHtml(animal.species || "-")}</strong></div>
        <div class="data-item"><span>Sexo</span><strong>${escapeHtml(animal.sex || "-")}</strong></div>
        <div class="data-item"><span>Porte</span><strong>${escapeHtml(animal.size || "-")}</strong></div>
        <div class="data-item"><span>Raça</span><strong>${escapeHtml(animal.breed || "-")}</strong></div>
        ${animal.color ? `<div class="data-item"><span>Cor / pelagem</span><strong>${escapeHtml(animal.color)}</strong></div>` : ""}
        ${animal.status ? `<div class="data-item"><span>Status</span><strong>${escapeHtml(animal.status)}</strong></div>` : ""}
      </div>
    </section>

    <section class="section">
      <div class="section-title">Dados do tutor</div>
      <div class="data-grid three">
        <div class="data-item"><span>Nome</span><strong>${escapeHtml(tutor.tutor_name || tutor.name || "-")}</strong></div>
        <div class="data-item"><span>CPF</span><strong>${escapeHtml(maskCpf(tutor.cpf || ""))}</strong></div>
        <div class="data-item"><span>Telefone</span><strong>${escapeHtml(tutor.phone || "-")}</strong></div>
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

const PDF_BASE_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; color: #172026; font-family: Arial, sans-serif; background: #ffffff; }
  .pdf-header { background: #10364f; color: #ffffff; border-radius: 14px; padding: 18px; display: flex; justify-content: space-between; gap: 18px; }
  .section-title, .header-box span, .data-item span { font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  h1 { margin: 4px 0 0; font-size: 22px; }
  .header-box { min-width: 130px; border: 1px solid rgba(255,255,255,.28); border-radius: 10px; padding: 10px; text-align: right; }
  .header-box strong { display: block; margin-top: 4px; font-size: 16px; }
  .section { margin-top: 14px; border: 1px solid #dbeaf3; border-radius: 12px; padding: 14px; }
  .section-title { color: #10364f; margin-bottom: 10px; }
  .data-grid { display: grid; gap: 8px; }
  .data-grid.three { grid-template-columns: repeat(3, 1fr); }
  .data-grid.four { grid-template-columns: repeat(4, 1fr); }
  .data-item { border: 1px solid #e8f1f5; border-radius: 8px; background: #f8fbfd; padding: 8px; }
  .data-item span { display: block; color: #64748b; margin-bottom: 4px; }
  .data-item strong { font-size: 12px; }
  .animal-card { margin-top: 10px; border: 1px solid #fed7aa; border-radius: 10px; padding: 10px; background: #fff7ed; }
  .animal-card-title { color: #9a3412; font-weight: 800; margin-bottom: 8px; }
  .footer { margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #64748b; font-size: 10px; }
  @page { size: A4; margin: 12mm; }
  .pdf-page { page-break-after: always; min-height: 250mm; display: flex; flex-direction: column; }
  .pdf-page:last-child { page-break-after: auto; }
  .compact-header { padding: 13px 14px; border-radius: 10px; }
  .compact-header h1 { font-size: 18px; }
  .compact-header .header-box { padding: 8px; }
  .compact-section { margin-top: 8px; padding: 9px; border-radius: 9px; }
  .compact-four { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
  .compact-four .data-item { min-height: 36px; padding: 5px 6px; border-radius: 6px; }
  .compact-four .data-item span { margin-bottom: 2px; font-size: 7px; }
  .compact-four .data-item strong { font-size: 9px; line-height: 1.18; word-break: break-word; }
  .pdf-page--compact .animal-card { margin-top: 6px; padding: 7px; border-radius: 8px; }
  .pdf-page--compact .animal-card-title { margin-bottom: 5px; font-size: 10px; }
  .declaration-page { justify-content: space-between; }
  .declaration-document { color: #111827; font-size: 12px; line-height: 1.45; }
  .declaration-document h1, .declaration-document h2 { margin: 0; text-align: center; font-weight: 800; letter-spacing: .02em; }
  .declaration-document h1 { margin-top: 12px; font-size: 18px; }
  .declaration-document h2 { margin-top: 4px; font-size: 16px; }
  .declaration-lead { margin: 28px 0 14px; font-weight: 700; }
  .responsibility-list { margin: 0; padding-left: 22px; }
  .responsibility-list > li { margin-bottom: 8px; }
  .recommendation-list { margin-top: 7px; padding-left: 18px; }
  .recommendation-list > li { margin-bottom: 4px; }
`;

async function prepareProcessDocumentPreview(item: AnyRecord, request: AnyRecord) {
  if (item.kind === "request") {
    return {
      documentName: "Requerimento municipal",
      fileName: `Requerimento ${request.protocol || ""}.pdf`.trim(),
      fileType: "application/pdf",
      eyebrow: "Requerimento",
      dataUrl: await createRequestPdfDataUrl(request),
    };
  }
  if (item.kind === "tutor-transfer-request") {
    return {
      documentName: "Troca de tutor",
      fileName: `Troca de tutor ${request.protocol || ""}.pdf`.trim(),
      fileType: "application/pdf",
      eyebrow: "Troca de tutor",
      dataUrl: await createTutorTransferPdfDataUrl(request),
    };
  }
  if (item.kind === "death-registration-request") {
    return {
      documentName: "Registro de óbito",
      fileName: `Registro de obito ${request.protocol || ""}.pdf`.trim(),
      fileType: "application/pdf",
      eyebrow: "Óbito",
      dataUrl: await createDeathRegistrationPdfDataUrl(request),
    };
  }
  if (item.kind === "complaint-request") {
    return {
      documentName: "Denúncia",
      fileName: `Denuncia ${request.protocol || ""}.pdf`.trim(),
      fileType: "application/pdf",
      eyebrow: "Denúncia",
      dataUrl: await createComplaintPdfDataUrl(request),
    };
  }

  const document = item.document || {};
  const dataUrl = getDocumentPreviewSource(document);
  const fileType = document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl);
  return {
    ...document,
    documentName: document.documentName || document.name || "Documento anexado",
    fileName: document.fileName || document.name || "Arquivo anexado",
    fileType,
    eyebrow: item.eyebrow || "Anexo",
    dataUrl,
  };
}

function drawProntuarioHeader(page, protocol, statusLabel, statusColor, ctx, microchip = "", docTitle = "PRONTUÁRIO DO ANIMAL", idOverride = "") {
  const { font, bold, colors, margin } = ctx;
  const pageW = page.getWidth();
  const pageH = page.getHeight();
  const topY = pageH - margin;

  page.drawRectangle({ x: margin, y: topY - 58, width: 4, height: 58, color: colors.blue });

  page.drawText("PROGRAMA MUNICIPAL DE CASTRAÇÃO ANIMAL", {
    x: margin + 12, y: topY - 12, size: 7, font: bold, color: colors.muted,
  });
  page.drawText(pdfText(docTitle), {
    x: margin + 12, y: topY - 29, size: 16, font: bold, color: colors.ink,
  });
  const idLabel = idOverride
    ? pdfText(idOverride)
    : microchip
      ? pdfText(`Microchip: ${microchip}`)
      : pdfText(`Ref. protocolo: #${protocol || "-"}  (animal sem microchip)`);
  page.drawText(idLabel, {
    x: margin + 12, y: topY - 48, size: 8, font, color: colors.ink,
  });

  // issue date (right)
  const rightX = pageW - margin - 140;
  page.drawText("EMITIDO EM", { x: rightX, y: topY - 12, size: 7, font: bold, color: colors.muted });
  page.drawText(pdfText(new Date().toLocaleDateString("pt-BR")), {
    x: rightX, y: topY - 26, size: 11, font: bold, color: colors.ink,
  });

  // status pill
  const pillText = pdfText(statusLabel);
  const pillW = Math.max(58, pillText.length * 6 + 20);
  const pillH = 16;
  const pillX = pageW - margin - pillW;
  const pillY = topY - 56;
  page.drawRectangle({ x: pillX, y: pillY, width: pillW, height: pillH, color: statusColor });
  page.drawText(pillText, {
    x: pillX + Math.round((pillW - pillText.length * 5.5) / 2),
    y: pillY + 5, size: 8, font: bold, color: colors.white,
  });

  // divider
  const divY = topY - 66;
  page.drawLine({ start: { x: margin, y: divY }, end: { x: pageW - margin, y: divY }, thickness: 0.5, color: colors.line });

  return divY - 14;
}

function drawProntuarioSectionTitle(page, title, y, ctx) {
  const { bold, colors, margin } = ctx;
  page.drawRectangle({ x: margin, y: y - 13, width: 3, height: 13, color: colors.blue });
  page.drawText(pdfText(title), { x: margin + 9, y: y - 11, size: 8, font: bold, color: colors.ink });
  return y - 22;
}

function drawProntuarioFields(page, rows, y, ctx, contentWidthOverride = 0) {
  // rows: array of { label, value }[] — each inner array is one row of columns
  const { font, bold, colors, margin } = ctx;
  const contentW = contentWidthOverride || (page.getWidth() - margin * 2);
  const rowH = 30;
  rows.forEach((cols, ri) => {
    const colW = contentW / cols.length;
    cols.forEach(({ label, value }, ci) => {
      const x = margin + ci * colW;
      const fy = y - ri * rowH;
      page.drawText(pdfText(String(label || "")), { x, y: fy, size: 7, font: bold, color: colors.muted });
      const val = pdfText(String(value || "-"));
      const wrapped = wrapPdfText(val, Math.floor(colW / 5.5));
      wrapped.slice(0, 2).forEach((line, li) => {
        page.drawText(line, { x, y: fy - 12 - li * 11, size: 9, font: bold, color: colors.ink });
      });
    });
  });
  return y - rows.length * rowH;
}

function drawProntuarioSummaryCards(page, cards, y, ctx) {
  // cards: { label, primary, secondary }[] — espelha .animal-record-summary-card da tela
  const { font, bold, colors, margin } = ctx;
  const contentW = page.getWidth() - margin * 2;
  const gap = 10;
  const colW = (contentW - gap * (cards.length - 1)) / cards.length;
  const cardH = 48;

  cards.forEach(({ label, primary, secondary }, ci) => {
    const x = margin + ci * (colW + gap);
    page.drawRectangle({ x, y: y - cardH, width: colW, height: cardH, borderColor: colors.line, borderWidth: 0.6, color: colors.white });
    page.drawText(pdfText(String(label || "")), { x: x + 8, y: y - 14, size: 6.5, font: bold, color: colors.muted });
    const primaryLines = wrapPdfText(pdfText(String(primary || "-")), Math.floor(colW / 5.5));
    page.drawText(primaryLines[0] || "-", { x: x + 8, y: y - 27, size: 9, font: bold, color: colors.ink });
    const secondaryLines = wrapPdfText(pdfText(String(secondary || "-")), Math.floor(colW / 5));
    page.drawText(secondaryLines[0] || "-", { x: x + 8, y: y - 39, size: 7.5, font, color: colors.muted });
  });

  return y - cardH;
}

// Desenha a timeline em fluxo contínuo: quando o evento não cabe mais na
// página atual, abre uma página de continuação (sem repetir o cabeçalho
// grande do documento) e segue desenhando a partir do topo.
function drawProntuarioTimeline(output, page, events, y, ctx, pageSize) {
  const { font, bold, colors, margin } = ctx;
  const lineX = margin + 70;
  const contentX = lineX + 16;
  const eventH = 36;
  const r = 4;
  const bottomLimit = margin + 40;
  const topStart = pageSize[1] - margin - 20;

  let currentPage = page;

  events.forEach((ev, i) => {
    if (y - eventH < bottomLimit) {
      currentPage = output.addPage(pageSize);
      y = topStart;
    }
    const nodeY = y - 8;
    const isLastOnPage = i === events.length - 1 || y - eventH - eventH < bottomLimit;
    if (i < events.length - 1 && !isLastOnPage) {
      currentPage.drawLine({
        start: { x: lineX, y: nodeY - r - 1 },
        end: { x: lineX, y: nodeY - eventH + r + 1 },
        thickness: 1,
        color: ev.done ? colors.blue : colors.line,
      });
    }
    currentPage.drawCircle({ x: lineX, y: nodeY, size: r + 1.5, color: colors.white });
    currentPage.drawCircle({ x: lineX, y: nodeY, size: r, color: ev.done ? colors.blue : colors.line });

    if (ev.date) {
      currentPage.drawText(pdfText(ev.date), { x: margin, y: nodeY + 3, size: 7.5, font, color: colors.muted });
    }
    currentPage.drawText(pdfText(ev.title), { x: contentX, y: nodeY + 4, size: 9, font: bold, color: ev.done ? colors.ink : colors.muted });
    (ev.details || []).forEach((detail, di) => {
      currentPage.drawText(pdfText(String(detail)), { x: contentX, y: nodeY - 8 - di * 11, size: 8, font, color: colors.muted });
    });

    y -= eventH;
  });

  return { page: currentPage, y };
}

function drawProntuarioSectionBand(page, title, y, _bg, _text, ctx, _right = "") {
  return drawProntuarioSectionTitle(page, title, y, ctx);
}

const prmHistoryEventLabel = (type: string) => ({
  SOLICITACAO: "Solicitação de procedimento",
  IMPORTACAO_SOLICITACAO: "Cadastro importado",
  CIRURGIA_REALIZADA: "Cirurgia realizada",
  SOLICITACAO_OBITO: "Solicitação de óbito",
  ANIMAL_OBITO: "Óbito registrado",
  SOLICITACAO_TROCA_TUTOR: "Solicitação de troca de tutor",
  TROCA_TUTOR: "Troca de tutor",
  SOLICITACAO_PROCEDIMENTO: "Procedimento solicitado",
  ADOCAO: "Adoção confirmada",
} as AnyRecord)[type] || type || "Evento";

// Resolve animal/tutor/status/histórico numa fonte única, sem passar por
// normalizeRequest (que sintetiza um animal "Não informado" quando não há
// request.animals — isso mascarava os dados reais vindos de fullHistory).
// Prioriza a request quando ela tem dados reais de uma solicitação específica;
// senão usa fullHistory (fluxo de consulta por microchip).
function resolveProntuarioData(request: AnyRecord = {}, fullHistory: AnyRecord | null = null) {
  const hasRealRequest = Boolean(request?.id || request?.protocol || (Array.isArray(request?.animals) && request.animals.length));
  const req = hasRealRequest ? normalizeRequest(request) : {};
  const wf: AnyRecord = request.workflowData || request.workflow_data || {};

  const histAnimal: AnyRecord = fullHistory?.animal || {};
  const histTutor: AnyRecord = fullHistory?.tutor || {};
  const historyList: AnyRecord[] = Array.isArray(fullHistory?.history) ? fullHistory.history : [];

  const animal: AnyRecord = (Array.isArray(req.animals) && req.animals[0]) || histAnimal;

  const tutorName = hasRealRequest
    ? (req.tutor || "Não informado")
    : (histTutor.tutor_name || histTutor.name || "Não informado");
  const tutorCpf = hasRealRequest ? req.cpf : histTutor.cpf;
  const tutorPhone = hasRealRequest ? req.phone : (histTutor.phone || histTutor.celular);
  const tutorEmail = hasRealRequest ? req.email : (histTutor.tutor_email || histTutor.email);
  const tutorAddressLine = hasRealRequest
    ? [
        [req.address, req.number].filter(Boolean).join(", "),
        req.neighborhood,
        req.city && req.state ? `${req.city}/${req.state}` : (req.city || req.state || ""),
        req.cep ? `CEP ${req.cep}` : "",
      ].filter(Boolean).join(" - ")
    : [histTutor.address, histTutor.neighborhood, histTutor.city, histTutor.state].filter(Boolean).join(", ");

  const animalMicrochip = (histAnimal.microchip || req.animalMicrochip || animal.microchip || "").trim();
  const statusLabel = String(animal.status || "ativo").toUpperCase();

  const latestHistoryItem = historyList[0] || null;
  const nextScheduledHistoryItem = historyList.find((item) => (
    (item.status === "AGENDADA" || item.status === "AGUARDANDO_CIRURGIA") && getAnimalHistorySchedule(item)
  )) || null;
  const latestProcedureItem = historyList.find((item) => (
    ["CIRURGIA_REALIZADA", "SOLICITACAO_PROCEDIMENTO"].includes(item.type)
  )) || null;
  const historyMunicipalitiesList = [...new Set(historyList.map(getAnimalHistoryMunicipality).filter(Boolean))];

  const historyDocuments = historyList.flatMap((entry) => entry?.data?.registration?.documents || []);
  const animalPhotoDoc = getUserUploadedProcessDocuments(req.documents || []).find(isAnimalPhotoDocument)
    || getUserUploadedProcessDocuments(historyDocuments).find(isAnimalPhotoDocument);
  const animalPhotoDataUrl = animalPhotoDoc ? getDocumentPreviewSource(animalPhotoDoc) : "";

  return {
    req, wf, animal, historyList, hasRealRequest,
    tutorName,
    tutorCpfMasked: maskCpf(tutorCpf || "") || "-",
    tutorContact: [tutorPhone, tutorEmail].filter(Boolean).join(" · ") || "Não informado",
    tutorAddressLine: tutorAddressLine || "Endereço não informado",
    animalMicrochip,
    statusLabel,
    animalSummary: [animal.species, animal.sex, animal.size].filter(Boolean).join(" · ") || "Dados do animal em atualização",
    latestHistoryItem,
    nextScheduledHistoryItem,
    latestProcedureItem,
    historyMunicipalitiesList,
    animalPhotoDataUrl,
  };
}

async function generateProntuarioPdf(request: AnyRecord = {}, fullHistory: AnyRecord | null = null) {
  const { PDFDocument, rgb } = await importPdfLib();
  const output = await PDFDocument.create();
  const { font, bold, colors, margin, pageSize } = await createPdfDocContext(output, rgb);
  const ctx = { font, bold, colors, rgb, margin };

  const data = resolveProntuarioData(request, fullHistory);
  const {
    req, wf, animal, historyList, hasRealRequest,
    tutorName, tutorCpfMasked, tutorContact, tutorAddressLine,
    animalMicrochip, statusLabel, animalSummary,
    latestHistoryItem, nextScheduledHistoryItem, latestProcedureItem,
    historyMunicipalitiesList, animalPhotoDataUrl,
  } = data;

  const isRealizada = req.status === "REALIZADA";
  const isCancelada = req.status === "CANCELADA";

  // Badge do topo mostra o status do animal (igual ao chip "ATIVO" da tela),
  // não o status da solicitação.
  const animalStatusColorMap: AnyRecord = {
    ATIVO: rgb(0.07, 0.44, 0.22),
    OBITO: rgb(0.75, 0.18, 0.18),
    INATIVO: rgb(0.45, 0.52, 0.57),
  };
  const statusColor = animalStatusColorMap[statusLabel] || animalStatusColorMap.ATIVO;

  const contentW = 595.28 - margin * 2;

  const scheduleAddress = [req.scheduleLocationName, req.scheduleAddress, req.scheduleMunicipality]
    .filter(Boolean).join(" - ");
  const microchipApplied = String(wf.attendanceMicrochip || "").trim();
  const prescription = String(wf.attendancePrescription || "").trim();
  const attendanceNote = String(req.attendanceNote || "").trim();
  const cancelReason = String(wf.cancelReason || req.rejectionReason || "").trim();
  const cancelNote = String(wf.cancelNote || req.rejectionNote || "").trim();

  const page = output.addPage(pageSize);
  let y = drawProntuarioHeader(page, req.protocol, statusLabel, statusColor, ctx, animalMicrochip);
  y -= 10;

  // ── CABEÇALHO DO ANIMAL (espelha .animal-record-header da tela) ──
  const photoBoxW = 72;
  const photoBoxH = 72;
  const photoGap = 14;
  const identityTopY = y;
  const identityTextW = animalPhotoDataUrl ? contentW - photoBoxW - photoGap : contentW;
  page.drawText(pdfText(wrapPdfText(pdfText(animal.name || "Animal sem nome"), Math.floor(identityTextW / 8))[0] || "-"), { x: margin, y, size: 14, font: bold, color: colors.ink });
  y -= 16;
  page.drawText(pdfText(wrapPdfText(pdfText(animalSummary), Math.floor(identityTextW / 5.5))[0] || "-"), { x: margin, y, size: 9, font, color: colors.muted });
  y -= 14;
  const microchipLine = `Microchip: ${animal.microchip || req.animalMicrochip || "não informado"}${historyMunicipalitiesList.length ? "   ·   " + historyMunicipalitiesList.join(", ") : ""}`;
  page.drawText(pdfText(wrapPdfText(pdfText(microchipLine), Math.floor(identityTextW / 5))[0] || "-"), { x: margin, y, size: 8, font, color: colors.muted });
  if (animalPhotoDataUrl) {
    await drawProntuarioPhotoBox(output, page, animalPhotoDataUrl, margin + identityTextW + photoGap, identityTopY - 10, photoBoxW, photoBoxH, ctx);
  }
  y -= 18;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 16;

  // ── 3 CARDS DE RESUMO (espelha .animal-record-summary da tela) ──
  y = drawProntuarioSummaryCards(page, [
    { label: "TUTOR ATUAL", primary: tutorName, secondary: tutorCpfMasked },
    { label: "CONTATO", primary: tutorContact, secondary: tutorAddressLine },
    {
      label: "SITUAÇÃO",
      primary: latestHistoryItem ? prmHistoryEventLabel(latestHistoryItem.type) : "Sem eventos",
      secondary: latestHistoryItem?.occurred_at ? formatDateTime(latestHistoryItem.occurred_at) : "Sem data registrada",
    },
  ], y, ctx);
  y -= 10;

  // ── GRID DE 6 INFO-TILES (espelha .animal-record-grid da tela) ──
  y = drawProntuarioFields(page, [
    [
      { label: "MICROCHIP", value: animal.microchip || "Não informado" },
      { label: "ESPÉCIE / SEXO / PORTE", value: animalSummary },
      { label: "PRÓXIMA AGENDA", value: nextScheduledHistoryItem ? getAnimalHistorySchedule(nextScheduledHistoryItem) : "Sem agenda" },
    ],
    [
      { label: "ÚLTIMO PROCEDIMENTO", value: latestProcedureItem ? prmHistoryEventLabel(latestProcedureItem.type) : "Não informado" },
      { label: "MUNICÍPIOS", value: historyMunicipalitiesList.join(", ") || "Não informado" },
      { label: "EVENTOS", value: `${historyList.length} registro(s)` },
    ],
  ], y, ctx);
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 16;

  // ── HISTÓRICO DO ANIMAL (espelha .animal-history da tela, mesma continuidade) ──
  const historyTitle = historyList.length
    ? "HISTÓRICO DO ANIMAL"
    : "HISTÓRICO DO PROCESSO";
  y = drawProntuarioSectionTitle(page, historyTitle, y, ctx);
  page.drawText(pdfText(`${historyList.length} evento(s) registrado(s) para este microchip`), { x: margin, y: y + 8, size: 7.5, font, color: colors.muted });
  y -= 8;

  const tlEvents: { date: string; title: string; details: string[]; done: boolean }[] = [];

  if (historyList.length) {
    // histórico completo via /animals/consult — todos os eventos do animal
    const sortedHistory = [...historyList].sort((a, b) => {
      const da = new Date(a.occurred_at || a.created_at || 0).getTime();
      const db = new Date(b.occurred_at || b.created_at || 0).getTime();
      return da - db;
    });
    for (const item of sortedHistory) {
      const eventDate = item.occurred_at || item.created_at
        ? new Date(item.occurred_at || item.created_at).toLocaleDateString("pt-BR")
        : "-";
      const details: string[] = [];
      if (item.protocol) details.push(`Protocolo: ${item.protocol}`);
      if (item.status) details.push(`Status: ${statusLabels[item.status] || item.status}`);
      if (item.notes) details.push(pdfText(String(item.notes)).slice(0, 80));
      tlEvents.push({
        date: eventDate,
        title: prmHistoryEventLabel(item.type),
        details,
        done: true,
      });
    }
  } else if (hasRealRequest) {
    // fallback: apenas o processo atual (sem histórico agregado do animal)
    const openDate = req.createdAt ? new Date(req.createdAt).toLocaleDateString("pt-BR") : "-";
    const openTime = req.createdAt ? new Date(req.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    const scheduleDate = req.preferredSchedule || req.appointment || "-";

    tlEvents.push({
      date: openDate,
      title: "Abertura da solicitação",
      details: [[requestTypeLabel(req), openTime].filter(Boolean).join("  ·  "), `Protocolo: ${req.protocol || "-"}`],
      done: true,
    });
    tlEvents.push({
      date: scheduleDate,
      title: "Agendamento",
      details: [scheduleAddress || "Local não informado", req.responsible ? `Responsável: ${req.responsible}` : ""].filter(Boolean),
      done: req.status === "AGENDADA" || isRealizada,
    });
    if (isRealizada) {
      const realizadaDate = wf.attendedAt ? new Date(wf.attendedAt).toLocaleDateString("pt-BR") : scheduleDate;
      tlEvents.push({
        date: realizadaDate,
        title: "Procedimento realizado",
        details: [
          microchipApplied ? `Microchip aplicado: ${microchipApplied}` : "Microchip: não registrado",
          attendanceNote ? `Obs.: ${attendanceNote}` : "",
        ].filter(Boolean),
        done: true,
      });
      if (prescription) {
        tlEvents.push({ date: "", title: "Receita prescrita", details: wrapPdfText(pdfText(prescription), 72).slice(0, 4), done: true });
      }
    }
    if (isCancelada) {
      tlEvents.push({
        date: "",
        title: "Processo cancelado / indeferido",
        details: [cancelReason || "Motivo não informado", cancelNote].filter(Boolean),
        done: true,
      });
    }
    if (!isRealizada && !isCancelada) {
      tlEvents.push({ date: "-", title: "Realização · aguardando", details: ["Procedimento ainda não realizado"], done: false });
    }
  }

  const timelineResult = drawProntuarioTimeline(output, page, tlEvents, y, ctx, pageSize);
  const finalPage = timelineResult.page;

  // nota de rodapé quando sem microchip
  if (!animalMicrochip) {
    finalPage.drawText("* Histórico parcial — animal sem microchip registrado. Dados referentes ao protocolo acima.", {
      x: margin, y: margin + 40, size: 7, font, color: colors.muted,
    });
  }

  const allPages = output.getPages();
  allPages.forEach((pg, index) => {
    drawRequestPdfFooter(pg, "Prontuário emitido pelo sistema municipal", `Página ${index + 1} de ${allPages.length}`, ctx);
  });

  const bytes = await output.save();
  const animalName = animal.name || "";
  const fileName = ["Prontuário", animalName, animalMicrochip || req.protocol || ""]
    .filter(Boolean).join(" ").trim() + ".pdf";
  return {
    documentName: "Prontuário do animal",
    fileName,
    fileType: "application/pdf",
    eyebrow: "Prontuário",
    dataUrl: uint8ArrayToDataUrl(bytes, "application/pdf"),
  };
}

async function generateAndDownloadProntuario(fullHistory: AnyRecord) {
  const bundle = await generateProntuarioPdf({}, fullHistory);
  if (bundle?.dataUrl) {
    const anchor = window.document.createElement("a");
    anchor.href = bundle.dataUrl;
    anchor.download = bundle.fileName || "Prontuário.pdf";
    anchor.click();
  }
}

async function createTutorTransferPdfDataUrl(request: AnyRecord = {}) {
  const { PDFDocument, rgb } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const { font, bold, colors, margin, pageSize } = await createPdfDocContext(pdf, rgb);
  const ctx = { font, bold, colors, rgb, margin };
  const contentW = 595.28 - margin * 2;

  const req = normalizeRequest(request);
  const animal: AnyRecord = (Array.isArray(req.animals) ? req.animals : [])[0] || {};
  const docLabel = requestTypeDomainLabels[RequestType.TUTOR_TRANSFER];

  const page = pdf.addPage(pageSize);
  let y = drawProntuarioHeader(
    page, req.protocol, docLabel, rgb(0.05, 0.45, 0.69), ctx, "",
    "TROCA DE TUTOR",
    pdfText(`Protocolo: #${req.protocol || "-"}`)
  );
  y -= 10;

  y = drawProntuarioSectionTitle(page, "DADOS DA SOLICITAÇÃO", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "TIPO DE SOLICITAÇÃO", value: docLabel },
      { label: "DATA DA SOLICITAÇÃO", value: req.createdAt ? formatDateTime(req.createdAt) : "-" },
    ],
    [
      { label: "MOTIVO", value: req.notes || "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "TUTOR ATUAL", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "NOME COMPLETO", value: req.tutor || "-" },
      { label: "CPF", value: req.cpf || "-" },
      { label: "CELULAR", value: req.phone || "-" },
      { label: "EMAIL", value: req.email || "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "NOVO TUTOR", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "NOME COMPLETO", value: req.targetTutorName || "-" },
      { label: "CPF", value: req.targetTutorCpf || "-" },
      { label: "CELULAR", value: req.targetTutorPhone || "-" },
      { label: "EMAIL", value: req.targetTutorEmail || "-" },
    ],
    [
      { label: "CEP", value: req.targetTutorCep || "-" },
      { label: "ENDEREÇO", value: req.targetTutorAddress || "-" },
      { label: "BAIRRO", value: req.targetTutorNeighborhood || "-" },
    ],
    [
      { label: "CIDADE", value: req.targetTutorCity || "-" },
      { label: "UF", value: req.targetTutorState || "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "DADOS DO ANIMAL", y, ctx);
  y -= 6;
  drawProntuarioFields(page, [
    [
      { label: "NOME", value: animal.name || "-" },
      { label: "ESPÉCIE", value: animal.species || "-" },
      { label: "MICROCHIP", value: animal.microchip || req.animalMicrochip || "-" },
    ],
  ], y, ctx);

  drawRequestPdfFooter(page, "Troca de tutor", "Página 1 de 1", ctx);
  return uint8ArrayToDataUrl(await pdf.save(), "application/pdf");
}

async function createDeathRegistrationPdfDataUrl(request: AnyRecord = {}) {
  const { PDFDocument, rgb } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const { font, bold, colors, margin, pageSize } = await createPdfDocContext(pdf, rgb);
  const ctx = { font, bold, colors, rgb, margin };
  const contentW = 595.28 - margin * 2;

  const req = normalizeRequest(request);
  const animal: AnyRecord = (Array.isArray(req.animals) ? req.animals : [])[0] || {};
  const docLabel = requestTypeDomainLabels[RequestType.ANIMAL_DEATH];

  const page = pdf.addPage(pageSize);
  let y = drawProntuarioHeader(
    page, req.protocol, docLabel, rgb(0.05, 0.45, 0.69), ctx, "",
    "REGISTRO DE ÓBITO",
    pdfText(`Protocolo: #${req.protocol || "-"}`)
  );
  y -= 10;

  y = drawProntuarioSectionTitle(page, "DADOS DA SOLICITAÇÃO", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "TIPO DE SOLICITAÇÃO", value: docLabel },
      { label: "DATA DA SOLICITAÇÃO", value: req.createdAt ? formatDateTime(req.createdAt) : "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "TUTOR", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "NOME COMPLETO", value: req.tutor || "-" },
      { label: "CPF", value: req.cpf || "-" },
      { label: "CELULAR", value: req.phone || "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "DADOS DO ANIMAL", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "NOME", value: animal.name || "-" },
      { label: "ESPÉCIE", value: animal.species || "-" },
      { label: "MICROCHIP", value: animal.microchip || req.animalMicrochip || "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "REGISTRO DE ÓBITO", y, ctx);
  y -= 6;
  drawProntuarioFields(page, [
    [
      { label: "DATA DO ÓBITO", value: req.deathDate || "-" },
      { label: "CAUSA MORTIS", value: req.deathCause || "-" },
    ],
    [
      { label: "OBSERVAÇÕES", value: req.notes || "-" },
    ],
  ], y, ctx);

  drawRequestPdfFooter(page, "Registro de óbito", "Página 1 de 1", ctx);
  return uint8ArrayToDataUrl(await pdf.save(), "application/pdf");
}

async function createComplaintPdfDataUrl(request: AnyRecord = {}) {
  const { PDFDocument, rgb } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const { font, bold, colors, margin, pageSize } = await createPdfDocContext(pdf, rgb);
  const ctx = { font, bold, colors, rgb, margin };
  const contentW = 595.28 - margin * 2;

  const req = normalizeRequest(request);
  const docLabel = requestTypeDomainLabels[RequestType.COMPLAINT];
  const occurrenceAddress = [req.address, req.neighborhood, req.city, req.state].filter(Boolean).join(" - ");

  const page = pdf.addPage(pageSize);
  let y = drawProntuarioHeader(
    page, req.protocol, docLabel, rgb(0.05, 0.45, 0.69), ctx, "",
    "DENÚNCIA",
    pdfText(`Protocolo: #${req.protocol || "-"}`)
  );
  y -= 10;

  y = drawProntuarioSectionTitle(page, "DADOS DA SOLICITAÇÃO", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "TIPO DE SOLICITAÇÃO", value: docLabel },
      { label: "DATA DA SOLICITAÇÃO", value: req.createdAt ? formatDateTime(req.createdAt) : "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "DADOS DO DENUNCIANTE", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page, [
    [
      { label: "NOME COMPLETO", value: req.tutor || "-" },
      { label: "CPF", value: req.cpf || "-" },
      { label: "CELULAR", value: req.phone || "-" },
      { label: "EMAIL", value: req.email || "-" },
    ],
    [
      { label: "ENDEREÇO DA OCORRÊNCIA", value: occurrenceAddress || "-" },
    ],
  ], y, ctx);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page, "RELATO", y, ctx);
  y -= 6;
  drawProntuarioFields(page, [
    [
      { label: "DESCRIÇÃO", value: req.complaintDescription || "-" },
    ],
  ], y, ctx);

  drawRequestPdfFooter(page, "Denúncia", "Página 1 de 1", ctx);
  return uint8ArrayToDataUrl(await pdf.save(), "application/pdf");
}

async function createRequestPdfDataUrl(request: AnyRecord = {}) {
  const { PDFDocument, rgb } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const { font, bold, colors, margin, pageSize } = await createPdfDocContext(pdf, rgb);
  const ctx = { font, bold, colors, rgb, margin };
  const contentW = 595.28 - margin * 2;

  const req = normalizeRequest(request);
  const workflowData = req.workflowData || req.workflow_data || {};
  const animals = Array.isArray(req.animals) ? req.animals : [];
  const validationKey = req.validationKey || req.validation_key || "A definir";
  const signedAt = req.signedAt || req.signed_at || req.createdAt || req.created_at || new Date().toISOString();
  const scheduleAddress = [
    req.scheduleLocationName || req.locationName,
    req.scheduleAddress || req.schedule_address,
    req.scheduleMunicipality || req.municipalityName || req.city,
  ].filter(Boolean).join(" - ");
  const scheduleMapUrl = req.scheduleAddressUrl || req.schedule_address_url || "";
  const fullAddr = [
    [req.address, req.number || workflowData.number].filter(Boolean).join(", "),
    req.neighborhood,
    req.city && req.state ? `${req.city}/${req.state}` : (req.city || req.state || ""),
    req.cep ? `CEP ${req.cep}` : "",
  ].filter(Boolean).join(" - ");

  // ── PÁGINA 1: dados ──────────────────────────────────────────────
  const page1 = pdf.addPage(pageSize);
  let y = drawProntuarioHeader(
    page1, req.protocol, "Requerimento", rgb(0.05, 0.45, 0.69), ctx, "",
    "REQUERIMENTO DE SERVIÇO",
    pdfText(`Protocolo: #${req.protocol || "-"}`)
  );
  y -= 10;

  y = drawProntuarioSectionTitle(page1, "DADOS DA SOLICITAÇÃO", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page1, [
    [
      { label: "TIPO DE SOLICITAÇÃO", value: requestTypeLabel(req) || req.type || "-" },
      { label: "DATA DA AGENDA", value: req.preferredSchedule || req.appointment || "-" },
      { label: "HORÁRIO", value: workflowData.scheduleSlotTime || workflowData.scheduleTime || req.scheduleSlotTime || req.scheduleTime || "-" },
      { label: "MUNICÍPIO", value: req.scheduleMunicipality || req.municipalityName || req.city || "-" },
    ],
    [
      { label: "LOCAL / POSTO", value: scheduleAddress || "A confirmar" },
      { label: "UNIDADE RESPONSÁVEL", value: req.responsibleUnit || "-" },
      { label: "VETERINÁRIO", value: req.veterinarian || "-" },
    ],
    [
      { label: "LINK DO MAPA", value: scheduleMapUrl || "-" },
      { label: "OBSERVAÇÕES", value: req.notes || "-" },
    ],
  ], y, ctx);
  y -= 10;
  page1.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page1, "DADOS DO TUTOR", y, ctx);
  y -= 6;
  y = drawProntuarioFields(page1, [
    [
      { label: "NOME COMPLETO", value: req.tutor || "-" },
      { label: "CPF", value: req.cpf || "-" },
      { label: "CELULAR", value: req.phone || "-" },
      { label: "EMAIL", value: req.email || "-" },
    ],
    [
      { label: "CEP", value: req.cep || "-" },
      { label: "ENDEREÇO", value: req.address || "-" },
      { label: "NÚMERO", value: req.number || workflowData.number || "-" },
      { label: "BAIRRO", value: req.neighborhood || "-" },
    ],
    [
      { label: "CIDADE", value: req.city || "-" },
      { label: "UF", value: req.state || "-" },
      { label: "CADÚNICO", value: workflowData.cadUnicoNotApplicable || req.cadUnicoNotApplicable ? "Não se aplica" : workflowData.cadUnico || req.cadUnico || "-" },
      { label: "AGRICULTOR", value: workflowData.isFarmer || req.isFarmer ? "Sim" : "Não" },
    ],
  ], y, ctx);
  y -= 10;
  page1.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page1, `DADOS DO ANIMAL (${Math.max(animals.length, 1)})`, y, ctx);
  y -= 6;
  for (const animal of (animals.length ? animals : [{}]).slice(0, 2)) {
    const animalBreed = animal.breedType === "Definida"
      ? (animal.breedDescription || "Definida") : (animal.breedType || "-");
    y = drawProntuarioFields(page1, [
      [
        { label: "NOME", value: animal.name || "-" },
        { label: "ESPÉCIE", value: animal.species || "-" },
        { label: "PROCEDIMENTO", value: animal.procedureType || animal.procedure || requestTypeLabel(req) || "-" },
        { label: "SEXO", value: animal.sex || "-" },
      ],
      [
        { label: "RAÇA", value: animalBreed },
        { label: "PORTE", value: animal.size || "-" },
        { label: "PESO", value: animal.weight || "-" },
        { label: "IDADE", value: animal.age || "-" },
      ],
      [
        { label: "DATA DE NASCIMENTO", value: animal.birthDate || "-" },
        { label: "PELAGEM", value: animal.coat || animal.color || "-" },
        { label: "POSSUI MICROCHIP", value: animal.hasChip || (animal.microchip ? "Sim" : "-") },
        { label: "MICROCHIP", value: animal.microchip || "-" },
      ],
      [
        { label: "VERMIFUGADO", value: animal.dewormed || "-" },
        { label: "VACINAS EM DIA", value: animal.vaccinated || animal.vaccines || animal.vacinas || "-" },
        { label: "ALIMENTAÇÃO", value: animal.food || "-" },
      ],
      [
        { label: "HISTÓRICO DE DOENÇAS", value: animal.illnessHistory || "-" },
      ],
    ], y, ctx);
    y -= 8;
  }

  if (animals.length > 2) {
    page1.drawText(pdfText(`+ ${animals.length - 2} animal(is) adicional(is) vinculado(s) ao processo.`), { x: margin, y, size: 8, font, color: colors.muted });
    y -= 14;
  }

  y -= 2;
  page1.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: colors.line });
  y -= 14;

  y = drawProntuarioSectionTitle(page1, "VALIDAÇÃO", y, ctx);
  y -= 8;
  page1.drawText("CHAVE DE VALIDAÇÃO DIGITAL", { x: margin + 9, y, size: 7, font: bold, color: colors.muted });
  y -= 18;
  page1.drawText(pdfText(validationKey), { x: margin + 9, y, size: 18, font: bold, color: colors.blue });
  y -= 14;
  page1.drawText(
    pdfText(`Aceite eletrônico registrado em ${formatDateTime(signedAt)}`),
    { x: margin + 9, y, size: 8, font, color: colors.muted }
  );
  drawRequestPdfFooter(page1, "Requerimento municipal", "Página 1 de 2", ctx);

  // ── PÁGINA 2: declaração ─────────────────────────────────────────
  const page2 = pdf.addPage(pageSize);
  let y2 = drawProntuarioHeader(
    page2, req.protocol, "Declaração", rgb(0.05, 0.45, 0.69), ctx, "",
    "DECLARAÇÃO DE RESPONSABILIDADES",
    pdfText(`Protocolo: #${req.protocol || "-"}`)
  );
  y2 -= 14;

  y2 = drawProntuarioSectionTitle(page2, "DECLARAÇÃO DE RESPONSABILIDADES - CASTRAÇÃO ANIMAL", y2, ctx);
  y2 -= 8;
  page2.drawText("Declaro para fins civis, penais e administrativos:", { x: margin + 9, y: y2, size: 9, font: bold, color: colors.ink });
  y2 -= 18;

  const declarationItems = REQUEST_DECLARATION_ITEMS;
  const recommendationItems = REQUEST_RECOMMENDATION_ITEMS;

  for (const paragraph of declarationItems) {
    const lines = wrapPdfText(pdfText(paragraph), 110);
    page2.drawText("-", { x: margin + 9, y: y2, size: 8, font: bold, color: colors.ink });
    for (const line of lines) {
      page2.drawText(line, { x: margin + 20, y: y2, size: 8, font, color: colors.ink });
      y2 -= 10;
    }
    y2 -= 4;
  }

  page2.drawText("- Recomendações:", { x: margin + 9, y: y2, size: 8, font: bold, color: colors.ink });
  y2 -= 12;
  for (const item of recommendationItems) {
    page2.drawText(`  - ${pdfText(item)}`, { x: margin + 20, y: y2, size: 8, font, color: colors.ink });
    y2 -= 10;
  }

  y2 -= 8;
  page2.drawLine({ start: { x: margin, y: y2 }, end: { x: margin + contentW, y: y2 }, thickness: 0.4, color: colors.line });
  y2 -= 16;

  y2 = drawProntuarioSectionTitle(page2, "ACEITE ELETRÔNICO DO TUTOR", y2, ctx);
  y2 -= 6;
  drawProntuarioFields(page2, [
    [
      { label: "ACEITE REGISTRADO POR", value: req.tutor || "-" },
      { label: "CPF", value: req.cpf || "-" },
      { label: "DATA / HORA", value: formatDateTime(signedAt) },
      { label: "MÉTODO", value: "Li e aceito" },
    ],
  ], y2, ctx);
  drawRequestPdfFooter(page2, "Requerimento municipal", "Página 2 de 2", ctx);

  return uint8ArrayToDataUrl(await pdf.save(), "application/pdf");
}

function drawRequestPdfHeader(page, kicker, title, protocol, ctx) {
  const { bold, colors, rgb, margin } = ctx;
  const width = page.getWidth() - margin * 2;
  const y = page.getHeight() - margin - 70;
  const protocolText = pdfText(protocol);
  const protocolBoxWidth = Math.max(96, Math.min(126, 28 + protocolText.length * 7.2));
  const protocolX = margin + width - protocolBoxWidth - 16;
  const protocolFontSize = protocolText.length > 11 ? 11 : 13;
  page.drawRectangle({ x: margin, y, width, height: 70, color: colors.blueDark });
  page.drawRectangle({ x: margin + width * 0.56, y, width: width * 0.44, height: 70, color: colors.blue });
  page.drawText(pdfText(kicker), { x: margin + 14, y: y + 46, size: 8, font: bold, color: rgb(0.75, 0.95, 1) });
  page.drawText(pdfText(title), { x: margin + 14, y: y + 25, size: 18, font: bold, color: colors.white });
  page.drawRectangle({ x: protocolX, y: y + 14, width: protocolBoxWidth, height: 42, color: colors.blue, borderColor: rgb(0.5, 0.75, 0.9), borderWidth: 1 });
  page.drawText("PROTOCOLO", { x: protocolX + 16, y: y + 38, size: 7, font: bold, color: rgb(0.82, 0.96, 1) });
  page.drawText(protocolText, { x: protocolX + 12, y: y + 20, size: protocolFontSize, font: bold, color: colors.white });
  return y - 16;
}

function drawRequestPdfSectionTitle(page, title, y, ctx) {
  const { bold, colors, margin } = ctx;
  page.drawRectangle({ x: margin, y: y - 3, width: 5, height: 16, color: colors.blue });
  page.drawText(pdfText(title), { x: margin + 10, y, size: 12, font: bold, color: colors.blueDark });
  return y - 30;
}

function drawRequestPdfInfoGrid(page, items, y, ctx) {
  const {
    font,
    bold,
    colors,
    rgb,
    margin,
    columns = 4,
    wideLast = false,
    wideIndexes = [],
    rowHeight = 46,
    boxHeight = 36,
    labelSize = 7,
    valueSize = 9,
    valueMaxChars = 58,
  } = ctx;
  const gap = 6;
  const width = page.getWidth() - margin * 2;
  const colWidth = (width - gap * (columns - 1)) / columns;
  let x = margin;
  let rowY = y;
  items.forEach((item, index) => {
    const [label, value, explicitSpan] = item;
    const span = explicitSpan
      ? Math.min(explicitSpan, columns)
      : wideLast && index === items.length - 1
      ? Math.min(3, columns)
      : wideIndexes.includes(index) ? Math.min(2, columns) : 1;
    const boxWidth = colWidth * span + gap * (span - 1);
    if (x + boxWidth > margin + width + 1) {
      x = margin;
      rowY -= rowHeight;
    }
    page.drawRectangle({ x, y: rowY - boxHeight + 3, width: boxWidth, height: boxHeight, color: rgb(0.97, 0.99, 1), borderColor: colors.line, borderWidth: 1 });
    page.drawText(pdfText(label), { x: x + 8, y: rowY - 10, size: labelSize, font: bold, color: colors.muted });
    page.drawText(pdfText(String(value || "-")).slice(0, valueMaxChars), { x: x + 8, y: rowY - 24, size: valueSize, font, color: colors.ink });
    x += boxWidth + gap;
  });
  return rowY - rowHeight - 2;
}

function drawRequestPdfAnimalCard(page, animal: AnyRecord = {}, index, y, ctx) {
  const { font, bold, colors, rgb, margin } = ctx;
  const width = page.getWidth() - margin * 2;
  const animalFields = [
    ["ESPÉCIE", animal.species || "-"],
    ["SEXO", animal.sex || "-"],
    ["PORTE", animal.size || "-"],
    ["NASCIMENTO / IDADE", animal.birthDate || animal.age || "-"],
    ["RAÇA", animal.breedType === "Definida" ? (animal.breedDescription || "Definida") : (animal.breedType || "-")],
    ["PELAGEM", animal.coat || "-"],
    ["PROCEDIMENTO", animal.procedure || "-"],
    ["MICROCHIP", animal.microchip || "-"],
    ["VERMIFUGADO", animal.dewormed || "-"],
    ["VACINAS", animal.vaccinated || "-"],
    ["ALIMENTAÇÃO", animal.food || "-"],
  ];
  const columns = 3;
  const rowHeight = 36;
  const boxHeight = 29;
  const fieldRows = Math.ceil(animalFields.length / columns);
  const height = 34 + fieldRows * rowHeight + 8;
  page.drawRectangle({ x: margin, y: y - height, width, height, color: colors.orangeSoft, borderColor: rgb(0.98, 0.45, 0.14), borderWidth: 1 });
  page.drawText(pdfText(`Animal ${index + 1} - ${animal.name || "Sem nome"}`), { x: margin + 10, y: y - 17, size: 11, font: bold, color: colors.orange });
  drawRequestPdfInfoGrid(page, animalFields, y - 30, {
    font,
    bold,
    colors,
    rgb,
    margin: margin + 10,
    columns,
    rowHeight,
    boxHeight,
    valueMaxChars: 42,
  });
  return y - height - 6;
}

function drawRequestPdfValidationBox(page, key, y, ctx) {
  const { font, bold, colors, margin } = ctx;
  const width = page.getWidth() - margin * 2;
  page.drawRectangle({ x: margin, y: y - 48, width, height: 48, color: colors.blueSoft, borderColor: colors.blue, borderWidth: 1 });
  page.drawText("CHAVE DE VALIDAÇÃO", { x: margin + 12, y: y - 14, size: 8, font: bold, color: colors.blue });
  page.drawText(pdfText(key), { x: margin + 12, y: y - 30, size: 14, font: bold, color: colors.ink });
  page.drawText("Guarde junto com o CPF para consultar solicitações e adoções.", { x: margin + 12, y: y - 42, size: 8, font, color: colors.muted });
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

async function drawProntuarioPhotoBox(pdf, page, dataUrl, x, topY, width, height, ctx) {
  const { colors, rgb } = ctx;
  const boxY = topY - height;
  page.drawRectangle({ x, y: boxY, width, height, color: rgb(0.97, 0.98, 0.99), borderColor: colors.line, borderWidth: 1 });
  if (!dataUrl) return;
  try {
    const mimeType = getDataUrlMimeType(dataUrl);
    const bytes = dataUrlToUint8Array(dataUrl);
    const image = mimeType.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const pad = 3;
    const scale = Math.min((width - pad * 2) / image.width, (height - pad * 2) / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    page.drawImage(image, { x: x + (width - drawW) / 2, y: boxY + (height - drawH) / 2, width: drawW, height: drawH });
  } catch {}
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

// Lazy chunk for pdf-lib can 404 if a new deploy replaced dist/assets after this
// page was loaded (stale index.html referencing an old chunk hash). Reload once
// to pick up the fresh build instead of leaving download buttons silently broken.
function importPdfLib(): Promise<typeof import("pdf-lib")> {
  return import("pdf-lib").catch((err) => {
    const message = String(err?.message || "");
    if (/failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(message)) {
      window.location.reload();
    }
    throw err;
  });
}

const A4_PAGE_SIZE: [number, number] = [595.28, 841.89];

type PdfRgbFn = Awaited<ReturnType<typeof importPdfLib>>["rgb"];

function getPdfColors(rgb: PdfRgbFn) {
  return {
    ink: rgb(0.07, 0.12, 0.18),
    muted: rgb(0.38, 0.47, 0.55),
    blue: rgb(0.05, 0.45, 0.69),
    line: rgb(0.88, 0.92, 0.95),
    white: rgb(1, 1, 1),
  };
}

async function createPdfDocContext(pdf: AnyRecord, rgb: PdfRgbFn) {
  const { StandardFonts } = await importPdfLib();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  const colors = getPdfColors(rgb);
  return { font, bold, colors, rgb, margin, pageSize: A4_PAGE_SIZE };
}

async function appendPdfDataUrl(targetPdf, dataUrl) {
  const { PDFDocument } = await importPdfLib();
  const sourcePdf = await PDFDocument.load(dataUrlToUint8Array(dataUrl));
  const pages = await targetPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
  pages.forEach((page) => targetPdf.addPage(page));
}

async function appendImageDataUrl(targetPdf, dataUrl, mimeType = "") {
  const bytes = dataUrlToUint8Array(dataUrl);
  const image = mimeType.includes("png")
    ? await targetPdf.embedPng(bytes)
    : await targetPdf.embedJpg(bytes);
  const page = targetPdf.addPage(A4_PAGE_SIZE);
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
  const page = targetPdf.addPage(A4_PAGE_SIZE);
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



function getCurrentScheduleMonthKey() {
  const today = new Date();
  return `${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
}

function getScheduleMonthKey(dateText) {
  const [, month, year] = normalizeScheduleDateText(dateText).split("/");
  if (!month || !year) return "";
  return `${month}/${year}`;
}

function getScheduleSlotUsage(requests, date, slots = []) {
  const usage = new Map(normalizeScheduleSlots(slots).map((slot) => [slot.time, 0]));
  let unassigned = 0;

  requests
    .map(normalizeRequest)
    .filter((request) => (request.preferredSchedule || request.appointment || request.schedule_date) === date)
    .forEach((request) => {
      const count = countRequestAnimals(request);
      const slotTime = request.scheduleSlotTime || request.scheduleTime;
      if (slotTime && usage.has(slotTime)) {
        usage.set(slotTime, usage.get(slotTime) + count);
      } else {
        unassigned += count;
      }
    });

  normalizeScheduleSlots(slots).forEach((slot) => {
    if (unassigned <= 0) return;
    const used = usage.get(slot.time) || 0;
    const assignable = Math.min(Math.max(slot.vacancies - used, 0), unassigned);
    usage.set(slot.time, used + assignable);
    unassigned -= assignable;
  });

  return usage;
}

function getOfferedScheduleSlot(day, requests, requiredVacancies = 1) {
  const slots = normalizeScheduleSlots(day?.slots, day?.startTime || day?.time, day?.vacancies);
  const usage = getScheduleSlotUsage(requests, day?.date, slots);
  return slots.find((slot) => Math.max(slot.vacancies - (usage.get(slot.time) || 0), 0) >= requiredVacancies) || null;
}

function buildScheduleMonths(days) {
  const monthSet = new Set([getCurrentScheduleMonthKey()]);

  days.forEach((day) => {
    const monthKey = getScheduleMonthKey(day.date);
    if (monthKey) monthSet.add(monthKey);
  });

  return Array.from(monthSet).sort((left, right) => {
    const [leftMonth, leftYear] = left.split("/").map(Number);
    const [rightMonth, rightYear] = right.split("/").map(Number);
    return leftYear === rightYear ? leftMonth - rightMonth : leftYear - rightYear;
  });
}

function mergeScheduleDaysWithRules(days = [], rules = []) {
  const byDate = new Map(
    (Array.isArray(days) ? days : [])
      .map(normalizeScheduleDay)
      .filter((day) => day.date)
      .map((day) => [day.date, day])
  );

  (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.active !== false && !rule.unavailable)
    .flatMap((rule) => {
      try {
        return generateScheduleDaysFromRule(rule).map(normalizeScheduleDay);
      } catch {
        return [];
      }
    })
    .forEach((day) => {
      if (!day.date) return;
      const existing = byDate.get(day.date);
      byDate.set(day.date, existing ? { ...day, ...existing, slots: existing.slots?.length ? existing.slots : day.slots } : day);
    });

  return Array.from(byDate.values()).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));
}

function buildMonthCalendarDays(monthKey = getCurrentScheduleMonthKey()): AnyRecord[] {
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
