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
  Lock,
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
  Users,
  Building2,
  Mail,
  Phone,
  Flower2,
  Zap,
  X,
  Home,
  Paperclip,
  Trash2,
  AlertCircle,
  ImagePlus,
  BadgeCheck,
} from "lucide-react";
import "./styles.css";
import type { AnyRecord } from "./types";
import {
  CONFIG_KEYS,
  CONFIG_KEYS_LIST,
  accessRequesterTypes,
  aiProviderOptions,
  brazilStatesFallback,
  filterByMunicipalityScope,
  displayText,
  formatScheduleDate,
  formatSizeRange,
  getItemMunicipalityId,
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
  isRequestOnScheduleDate,
  mergeTags,
  normalizeDocumentType,
  normalizeRequest,
  normalizeRequestStatus,
  normalizeScheduleDateText,
  normalizeScheduleDay,
  normalizeScheduleSlots,
  requestHasTag,
  requestResultLabel,
  requestResultTag,
  requestTypeLabel,
  statusLabels,
  statuses,
  sumScheduleSlotsVacancies,
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
  ToggleSwitch,
  YesNoField,
} from "./components/ui";
import {
  dataUrlToUint8Array,
  escapeHtml,
  formatCep,
  formatCpf,
  formatDateTime,
  formatPhone,
  getDataUrlMimeType,
  getDocumentPreviewSource,
  getUserUploadedProcessDocuments,
  isGlobalRole,
  maskCpf,
  normalizeSearchKey,
  normalizeText,
  onlyDigits,
  readFileAsDataUrl,
  uint8ArrayToDataUrl,
} from "./utils";
import { AccessRequestsView, accessStatusLabel } from "./features/accessRequests";
import { AgendaView } from "./features/agenda";
import { DashboardView } from "./features/dashboard";
import { ReportsView } from "./features/reports";
const menu = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "admin", label: "Solicitações", icon: LayoutDashboard },
  { id: "credenciamento", label: "Credenciamentos", icon: ClipboardList },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "adocao", label: "Adoção", icon: HeartHandshake },
  { id: "relatorios", label: "Relatórios", icon: Activity },
  { id: "config", label: "Configurações", icon: Settings },
];

const configSidebarItems = [
  { id: "environment", label: "Configurar Ambiente" },
  { id: "municipalities", label: "Criar Municípios", globalOnly: true },
  { id: "users", label: "Criar Usuários" },
  { id: "sectors", label: "Criar Setores" },
  { id: "permissions", label: "Permissões" },
];

const permissionMenuItems = menu.map(({ id, label }) => ({ id, label }));

const permissionConfigItems = [
  { id: "environment", label: "Configurar Ambiente" },
  { id: "municipalities", label: "Criar Municípios", globalOnly: true },
  { id: "users", label: "Criar Usuários" },
  { id: "sectors", label: "Criar Setores" },
  { id: "permissions", label: "Permissões" },
  { id: "whatsapp_settings", label: "Aba WhatsApp" },
];

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
  const [configArea, setConfigArea] = useState("environment");
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
  const [publicForm, setPublicForm] = useState(false);
  const [publicFormInitialScreen, setPublicFormInitialScreen] = useState("agenda");
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState(localStorage.getItem("castragestao:municipalityId") || "");
  const [globalMunicipalityFilterId, setGlobalMunicipalityFilterId] = useState(localStorage.getItem("castragestao:globalMunicipalityFilterId") || "");
  const geoTriedRef = useRef(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [topbarWhatsappQuota, setTopbarWhatsappQuota] = useState<AnyRecord | null>(null);
  const [configMenuOpen, setConfigMenuOpen] = useState(true);
  const [tenantConfigReady, setTenantConfigReady] = useState(false);
  const [loadedConfigKeys, setLoadedConfigKeys] = useState({});
  const [sidebarResetOpen, setSidebarResetOpen] = useState(false);
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

  useEffect(() => {
    api.getConfig("ai").then((saved) => {
      if (saved && typeof saved === "object") {
        const merged = { ...initialAiSettings, ...saved, active: Boolean(saved.active) };
        const validModels = aiProviderOptions[merged.provider]?.models || [];
        if (validModels.length && !validModels.includes(merged.model)) merged.model = validModels[0];
        setAiSettings(merged);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    api.getRequests().then((list) => setRequests(list.map(normalizeRequest))).catch(console.error);
    api.getAccessRequests().then((list) => setAccessRequests(list.map(normalizeAccessRequest))).catch(console.error);
    api.getAdoptions().then((list) => setAdoptionAnimals(list.map(normalizeAdoptionAnimal))).catch(console.error);
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
        municipalityId: payload.municipalityId || currentUser?.municipalityId || "",
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

  if (publicForm) {
    return (
      <>
        <PublicCastrationForm
          createRequest={createRequest}
          onBack={() => setPublicForm(false)}
          initialScreen={publicFormInitialScreen}
          initialMunicipalityId={selectedMunicipalityId}
          onMunicipalitySelect={handleMunicipalitySelect}
          scheduleDays={scheduleDays}
          municipalities={municipalities}
          requestTypes={requestTypes}
          requests={requests}
          speciesOptions={speciesOptions}
          sizeOptions={sizeOptions}
          aiSettings={aiSettings}
          onRequestCreated={registerCreatedRequest}
        />
        <PwaInstallPrompt />
      </>
    );
  }

  function handleInterestSent(updated) {
    setAdoptionAnimals((current) => current.map((a) => a.id === updated.id ? normalizeAdoptionAnimal(updated) : a));
  }

  if (!currentUser) {
    return (
      <>
        <LoginView
          onLogin={setCurrentUser}
          onPublicRequest={() => { setPublicFormInitialScreen("formulario"); setPublicForm(true); }}
          onPublicConsult={() => { setPublicFormInitialScreen("consulta"); setPublicForm(true); }}
          onAccessRequest={createAccessRequest}
          adoptionAnimals={adoptionAnimals}
          onInterestSent={handleInterestSent}
          municipalities={municipalities}
          selectedMunicipalityId={selectedMunicipalityId}
          onMunicipalitySelect={handleMunicipalitySelect}
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
  const canUsePermissions = currentPermissionGroup && !isGlobalRole(currentUser?.role);
  const visibleMenu = canUsePermissions
    ? menu.filter((item) => currentPermissionGroup.allowedMenuItems?.includes(item.id))
    : menu;
  const visibleConfigSidebarItems = configSidebarItems
    .filter((item) => !item.globalOnly || isGlobalRole(currentUser?.role))
    .filter((item) => !canUsePermissions || currentPermissionGroup.allowedConfigItems?.includes(item.id));
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
                    {visibleConfigSidebarItems.map((subitem) => (
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
          <div className="sidebar-account-actions" aria-label="Ações da conta">
            <button className="sidebar-reset-button" type="button" onClick={() => setSidebarResetOpen(true)}>
              <KeyRound size={16} />
              <span>Senha</span>
            </button>
            <button className="logout-button" type="button" onClick={() => setCurrentUser(null)}>
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div className="main-reader">
            <h1>Bem-estar e proteção animal</h1>
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
          scheduleDays={scopedScheduleDays}
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
          globalSearch={globalSearch}
          selectedMunicipalityId={activeMunicipalityId}
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
            <ModalHeader title="Redefinir senha" subtitle={currentUser.email || currentUser.name} onClose={closeSidebarReset} />
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

function ValidationKeyConsultation({ fallbackRequests = [], currentUser, onRequestCreated, municipalityId, onBack, municipalityName = "" }: AnyRecord) {
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

  return (
    <div className="consultation-stack">
      <form className="validation-key-card consultation-card" onSubmit={consult}>
        <div className="consultation-card-topline">
          <div className="consultation-card-location">
            <button className="nr-home-btn" type="button" onClick={onBack} aria-label="Início" title="Início">
              <Home size={18} />
            </button>
            <span>{municipalityName || "Sistema municipal"}</span>
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
        <div className="consultation-card-header">
          <div className="consultation-title-row">
            <div className="metric-icon">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2>Prontuário animal</h2>
              <p>Use o microchip para abrir o prontuário completo ou CPF e chave para localizar solicitações do tutor.</p>
            </div>
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
                <small>{!day.available ? "Sem agenda" : day.isPast ? "Passado" : day.hasEnoughVacancies ? `${day.offeredSlot?.time || day.startTime || ""} - ${day.remaining} vagas` : "Sem vagas suficientes"}</small>
                {day.kind === "Mutirao" && <em>Mutirão</em>}
              </button>
            )
        )}
      </div>
    </section>
  );
}

function AdoptionCarousel({ adoptionAnimals, onOpenAdoption, limit = 6, showViewAll = true, onInterestSent }: AnyRecord) {
  const availableAnimals = adoptionAnimals.filter((animal) => animal.status !== "adotado");
  const [adoptionFilters, setAdoptionFilters] = useState({ species: "", sex: "" });
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestForm, setInterestForm] = useState({ name: "", phone: "", visit_date: "" });
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
    { value: "", label: "Todos os sexos", icon: PawPrint },
    ...sexFilterOptions.map((sex) => ({
      value: sex,
      label: sex,
      icon: normalizeText(sex).includes("feme") ? Flower2 : Zap,
    })),
  ];

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
    <section className={`${filteredAnimals.length <= 2 ? "adoption-showcase few-animals" : "adoption-showcase"} ${showViewAll ? "" : "compact-gallery"}`.trim()}>
      <div className="showcase-header adoption-showcase-header">
        <div>
          <h2>Animais disponíveis para adoção</h2>
        </div>
        <div className="adoption-header-actions">
          <div className="showcase-filter-pills">
            {speciesQuickFilters.map((filter) => {
              const Icon = filter.icon;
              const key = (filter.value || "all").toLowerCase();
              return (
                <button
                  key={`sp-${key}`}
                  className={`showcase-pill species-${key}${adoptionFilters.species === filter.value ? " active" : ""}`}
                  type="button"
                  title={filter.label}
                  onClick={() => setAdoptionFilters((c) => ({ ...c, species: filter.value }))}
                >
                  <Icon size={18} />
                </button>
              );
            })}
            <span className="showcase-pill-sep" />
            {sexQuickFilters.filter((f) => f.value !== "").map((filter) => {
              const Icon = filter.icon;
              const key = filter.value.toLowerCase();
              return (
                <button
                  key={`sx-${key}`}
                  className={`showcase-pill sex-${key}${adoptionFilters.sex === filter.value ? " active" : ""}`}
                  type="button"
                  title={filter.label}
                  onClick={() => setAdoptionFilters((c) => ({ ...c, sex: filter.value }))}
                >
                  <Icon size={18} />
                </button>
              );
            })}
            {activeFilterCount > 0 && (
              <button className="showcase-pill-clear" type="button" onClick={() => setAdoptionFilters({ species: "", sex: "" })}>
                Limpar
              </button>
            )}
          </div>
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
              </button>
              <div className="public-animal-footer">
                <span className={interestCount > 0 ? "public-interest-count has-interest" : "public-interest-count"}>
                  <Users size={13} />
                  {interestCount}
                </span>
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
                  <input value={interestForm.phone} onChange={(e) => setInterestForm((f) => ({ ...f, phone: e.target.value }))} placeholder="WhatsApp (00) 00000-0000" required />
                </div>
                <div className="access-field">
                  <CalendarDays size={14} className="access-field-icon" />
                  <input type="date" value={interestForm.visit_date} onChange={(e) => setInterestForm((f) => ({ ...f, visit_date: e.target.value }))} />
                </div>
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => setShowInterestForm(false)}>Cancelar</button>
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

function LoginView({ onLogin, onPublicRequest, onPublicConsult, onAccessRequest, adoptionAnimals = [], onInterestSent, municipalities = [], selectedMunicipalityId = "", onMunicipalitySelect }: AnyRecord) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showVetModal, setShowVetModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showMobileAdoption, setShowMobileAdoption] = useState(false);
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
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      if (serviceId && templateId && publicKey && data.code) {
        await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            template_params: { to_email: resetEmail.trim(), reset_code: data.code },
          }),
        });
      }
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
          <div className="login-card-topbar">
            <div className="brand login-brand">
              <div className="brand-mark">
                <PawPrint size={24} />
              </div>
              <div>
                {selectedMunicipalityId && municipalities.find((m) => m.id === selectedMunicipalityId) ? (
                  <>
                    <strong>{municipalities.find((m) => m.id === selectedMunicipalityId).name}</strong>
                    <span className="brand-sub">Sistema municipal</span>
                  </>
                ) : (
                  <strong>Sistema municipal</strong>
                )}
              </div>
            </div>
            {municipalities.length > 0 && (
              <MunicipalitySelectorChip
                municipalities={municipalities}
                selectedMunicipalityId={selectedMunicipalityId}
                onSelect={onMunicipalitySelect}
                compact={!!selectedMunicipalityId}
              />
            )}
          </div>

          <div className="login-welcome">
            <h1>Bem-estar e proteção animal</h1>
          </div>

          <div className="login-main-actions">
            <button className="login-big-action primary" onClick={onPublicRequest}>
              <div className="action-icon-wrap"><PawPrint size={22} /></div>
              <div className="action-text">
                <strong>Solicitações</strong>
                <span>Primeiro cadastro do tutor e animal</span>
              </div>
            </button>

            <button className="login-big-action consult" onClick={onPublicConsult}>
              <div className="action-icon-wrap"><Search size={22} /></div>
              <div className="action-text">
                <strong>Prontuário</strong>
                <span>Consultar histórico e solicitar procedimento</span>
              </div>
            </button>

            <button className="login-big-action secondary login-vet-action" onClick={() => setShowVetModal(true)}>
              <div className="action-icon-wrap"><Lock size={20} /></div>
              <div className="action-text">
                <strong>Acesso restrito</strong>
                <span>Área credenciada</span>
              </div>
            </button>

            <button className="login-big-action access" onClick={() => setShowAccessModal(true)}>
              <div className="action-icon-wrap"><Users size={20} /></div>
              <div className="action-text">
                <strong>Credenciamento</strong>
                <span>ONGs e protetores</span>
              </div>
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

function PublicAccessRequestModal({ onClose, onSubmit }: AnyRecord) {
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
      <form className="access-modal" onSubmit={submit}>
        <button className="access-modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={15} /></button>

        {sent ? (
          <div className="access-modal-success">
            <CheckCircle2 size={38} strokeWidth={1.5} />
            <h2>Solicitação enviada!</h2>
            <p>Um usuário interno vai analisar o pedido e liberar o acesso se estiver tudo certo.</p>
            <button className="access-modal-submit" type="button" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <>
            <div className="access-modal-head">
              <div className="access-modal-head-icon"><Shield size={20} /></div>
              <div>
                <h2>Solicitar credenciamento</h2>
                <p>Acesso ao sistema para ONGs e protetores independentes</p>
              </div>
            </div>

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

            <div className="access-form-fields">
              <div className="access-field">
                <Building2 size={14} className="access-field-icon" />
                <input type="text" placeholder="Nome da ONG ou grupo (opcional para protetor)" value={form.organizationName} onChange={(e) => patch("organizationName", e.target.value)} />
              </div>
              <div className="access-field">
                <User size={14} className="access-field-icon" />
                <input type="text" placeholder="Nome completo do responsável *" value={form.responsibleName} onChange={(e) => patch("responsibleName", e.target.value)} required />
              </div>
              <div className="access-field">
                <Mail size={14} className="access-field-icon" />
                <input type="email" placeholder="Email para contato *" value={form.email} onChange={(e) => patch("email", e.target.value)} required />
              </div>
              <div className="access-form-row">
                <div className="access-field">
                  <Phone size={14} className="access-field-icon" />
                  <input type="tel" placeholder="Telefone" value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
                </div>
                <div className="access-field">
                  <FileText size={14} className="access-field-icon" />
                  <input type="text" placeholder="CPF/CNPJ ou matrícula" value={form.document} onChange={(e) => patch("document", e.target.value)} />
                </div>
              </div>
              <div className="access-form-row">
                <div className="access-field">
                  <MapPin size={14} className="access-field-icon" />
                  <input type="text" placeholder="Cidade" value={form.city} onChange={(e) => patch("city", e.target.value)} />
                </div>
                <div className="access-field">
                  <input type="text" placeholder="UF" value={form.state} maxLength={2} onChange={(e) => patch("state", e.target.value.toUpperCase().slice(0, 2))} />
                </div>
              </div>
              <div className="access-field access-field--textarea">
                <MessageCircle size={14} className="access-field-icon" />
                <textarea placeholder="Como pretende auxiliar? Ex: cadastrar animais para adoção, indicar vagas de castração..." value={form.intendedUse} onChange={(e) => patch("intendedUse", e.target.value)} rows={3} />
              </div>
            </div>

            {status && <p className={`access-status${status.includes("Enviando") ? " is-sending" : " is-error"}`}>{status}</p>}

            <button className="access-modal-submit" type="submit">
              <Shield size={14} />
              Enviar solicitação
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function PetWelcomeArt({ className = "" }: AnyRecord) {
  return (
    <section className={`public-hero ${className}`.trim()}>
      <div className="hero-content">
        <div className="hero-eyebrow">
          <PawPrint size={11} />
          <span>Sistema Municipal de Proteção Animal</span>
        </div>
        <h1 className="hero-title">Cuidado e proteção para quem não tem voz</h1>
        <p className="hero-subtitle">Castração gratuita, adoção responsável e bem-estar animal - digital e acessível.</p>
        <div className="hero-features">
          <div className="hero-feature"><CheckCircle2 size={12} /><span>Castração gratuita</span></div>
          <div className="hero-feature"><CheckCircle2 size={12} /><span>Adoção responsável</span></div>
          <div className="hero-feature"><CheckCircle2 size={12} /><span>Prontuário digital</span></div>
        </div>
      </div>
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

function PublicCastrationForm({ createRequest, onBack, initialScreen = "agenda", initialMunicipalityId = "", onMunicipalitySelect, scheduleDays = [], municipalities = [], requestTypes = [], requests = [], speciesOptions = [], sizeOptions = [], aiSettings = initialAiSettings, onRequestCreated }: AnyRecord) {
  const [screen, setScreen] = useState(initialScreen === "consulta" ? "consulta" : "formulario");
  const [done, setDone] = useState(null);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState(initialMunicipalityId);
  const [publicScheduleDays, setPublicScheduleDays] = useState(scheduleDays);
  const [publicRequestTypes, setPublicRequestTypes] = useState(requestTypes);
  const [publicSpeciesOptions, setPublicSpeciesOptions] = useState(speciesOptions);
  const [publicSizeOptions, setPublicSizeOptions] = useState(sizeOptions);

  function handleMunicipalitySelect(id) {
    setSelectedMunicipalityId(id);
    onMunicipalitySelect?.(id);
  }

  useEffect(() => {
    if (!selectedMunicipalityId) return;
    api.getSchedule(selectedMunicipalityId)
      .then((days) => setPublicScheduleDays(days.map(normalizeScheduleDay).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date))))
      .catch(console.error);
    api.getConfig(CONFIG_KEYS.requestTypes, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicRequestTypes(value); }).catch(() => {});
    api.getConfig(CONFIG_KEYS.species, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicSpeciesOptions(value); }).catch(() => {});
    api.getConfig(CONFIG_KEYS.sizes, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicSizeOptions(value); }).catch(() => {});
  }, [selectedMunicipalityId]);

  function goToStart() {
    setScreen("formulario");
  }

  const simpleHeader = (
    <header className="public-form-header">
      <button className="nr-home-btn" type="button" onClick={onBack} aria-label="Início" title="Início">
        <Home size={18} />
      </button>
      <MunicipalitySelectorChip
        municipalities={municipalities}
        selectedMunicipalityId={selectedMunicipalityId}
        onSelect={handleMunicipalitySelect}
        compact={!!selectedMunicipalityId}
      />
      <div><strong>Sistema municipal</strong></div>
    </header>
  );

  if (done) {
    return (
      <main className="public-form-page">
        {simpleHeader}
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
    const selectedMunicipality = municipalities.find((m) => m.id === selectedMunicipalityId);
    return (
      <main className="public-form-page public-form-page--consultation">
        <section className="tutor-screen tutor-screen--full">
          <ValidationKeyConsultation
            fallbackRequests={requests}
            currentUser={GUEST_USER}
            onRequestCreated={onRequestCreated}
            municipalityId={selectedMunicipalityId || undefined}
            onBack={onBack}
            municipalityName={selectedMunicipality?.name || "Sistema municipal"}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="public-form-page">
      {!selectedMunicipalityId ? (
        <div className="public-municipality-prompt">
          <p>Selecione um município para iniciar a solicitação.</p>
        </div>
      ) : (
        <NewRequest
          createRequest={createRequest}
          currentUser={GUEST_USER}
          publicFlow
          municipalities={municipalities}
          selectedMunicipalityId={selectedMunicipalityId}
          onMunicipalitySelect={handleMunicipalitySelect}
          onBack={onBack}
          onDone={(request) => { setDone(request); }}
          requests={requests}
          scheduleDays={publicScheduleDays}
          initialMunicipalityId={selectedMunicipalityId}
          requestTypes={publicRequestTypes}
          aiSettings={aiSettings}
          speciesOptions={publicSpeciesOptions}
          sizeOptions={publicSizeOptions}
        />
      )}
    </main>
  );
}

function TutorDashboard({ requests, setActive, currentUser, compact = false, cpf = "", validationKey = "", onRequestCreated }: AnyRecord) {
  const safeRequests = useMemo(() => (Array.isArray(requests) ? requests : []).map(normalizeRequest), [requests]);
  const next = safeRequests.find((request) => request.status === "AGENDADA" && (request.appointment || request.preferredSchedule));
  const [detailsRequest, setDetailsRequest] = useState(null);
  const detailsAnimal = detailsRequest?.animals?.[0] || {};
  const detailsAnimalHistory = detailsRequest ? buildPublicAnimalHistory(detailsRequest, detailsAnimal) : [];

  return (
    <section className={compact ? "simple-stack consultation-results" : "content-grid"}>
      {!compact && <div className="hero-panel">
        <div>
          <span className="eyebrow">Área do solicitante</span>
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
        <PanelHeader title={compact ? "Solicitações" : "Minhas solicitações"} action={compact ? "" : "Ver todas"} />
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
                <StatusBadge status={request.status} />
                <span className="request-card-date">{request.appointment || request.preferredSchedule || request.createdAt}</span>
              </div>
              <button className="ghost-button" type="button" onClick={() => setDetailsRequest(request)}>
                Detalhes
                <ChevronRight size={16} />
              </button>
            </article>
          ))}
        </div>
      </div>
      {detailsRequest && (
        <div className="modal-backdrop">
          <div className="public-request-details-modal" role="dialog" aria-modal="true">
            <ModalHeader title={`Solicitação #${detailsRequest.protocol}`} subtitle={detailsRequest.tutor || currentUser?.name || ""} onClose={() => setDetailsRequest(null)} />
            <div className="public-request-detail-hero">
              <div>
                <span>Animal</span>
                <strong>{detailsRequest.animals.map((animal) => animal.name).join(", ") || "Animal não informado"}</strong>
                <small>{requestTypeLabel(detailsRequest)}</small>
              </div>
              <StatusBadge status={detailsRequest.status} />
            </div>
            <div className="public-request-detail-grid">
              <InfoTile label="Agenda" value={detailsRequest.appointment || detailsRequest.preferredSchedule || "Sem agenda"} />
              <InfoTile label="Tutor" value={detailsRequest.tutor || currentUser?.name || "Não informado"} />
              <InfoTile label="CPF" value={maskCpf(detailsRequest.cpf || cpf)} />
              <InfoTile label="Telefone" value={detailsRequest.phone || "Não informado"} />
              <InfoTile label="Endereço" value={[detailsRequest.address, detailsRequest.neighborhood, detailsRequest.city, detailsRequest.state].filter(Boolean).join(", ") || "Não informado"} />
              <InfoTile label="Aberta em" value={detailsRequest.createdAt ? formatDateTime(detailsRequest.createdAt) : "Não informado"} />
            </div>
            <div className="public-request-detail-history">
              <strong>Histórico do animal</strong>
              {detailsAnimalHistory.map((item) => (
                <p key={item.label}>
                  <span>{item.label}</span>
                  {item.value}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
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
    { label: "Já teve cria", value: displayText(animal.hadLitter || "Não informado") },
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
  municipalities = [],
  selectedMunicipalityId = "",
  onMunicipalitySelect = () => {},
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
  initialMunicipalityId = "",
}: AnyRecord) {
  const activeSpecies = Array.from(new Set(
    speciesOptions
      .filter((item) => item.active !== false)
      .map((item) => item.name)
      .filter(Boolean),
  ));
  const activeSizes = sizeOptions.filter((item) => item.active !== false);
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
      hadLitter: "",
      illnessHistory: "",
      food: "",
    },
  ]);
  const [expandedAnimal, setExpandedAnimal] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [cepStatus, setCepStatus] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [documentUploads, setDocumentUploads] = useState<AnyRecord>({});
  const [formStep, setFormStep] = useState(internalSimple ? 0 : 1);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [smsCode, setSmsCode] = useState("");
  const [smsInput, setSmsInput] = useState("");
  const [smsConfirmed, setSmsConfirmed] = useState(canManagePublicAnimalFlows(currentUser.role) || skipTutorStep);
  const [smsStatus, setSmsStatus] = useState("");
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
    .map(normalizeDocumentType)
    .filter((document) => document.active !== false);
  const acceptableUploadStatuses = ["approved", "attached"];
  const requiredDocsApproved = selectedTypeDocuments
    .filter((document) => document.required)
    .every((document) => acceptableUploadStatuses.includes(documentUploads[document.id]?.status));
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
          hadLitter: "",
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
    if (field === "phone") {
      setSmsConfirmed(canManagePublicAnimalFlows(currentUser.role));
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
    if (!internalSimple && typeStepTutor) {
      if (cleanPhone.length < 10) issues.push("Informe um celular válido.");
      if (!skipTutorStep && !smsConfirmed) issues.push("Confirme o código SMS recebido no celular cadastrado.");
      if (!requestData.address.trim()) issues.push("Informe o endereço.");
      if (!requestData.neighborhood.trim()) issues.push("Informe o bairro.");
      if (!requestData.city.trim()) issues.push("Informe a cidade.");
      if (requestData.state.trim().length !== 2) issues.push("Informe a UF.");
    }
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
      return [typeStepDocuments && !requiredDocsApproved, typeStepDocuments && !accepted].filter(Boolean);
    }

    return [];
  }

  function showInvalid(field) {
    if (!submitAttempted) return false;
    const cleanCpf = requestData.cpf.replace(/\D/g, "");
    const cleanPhone = requestData.phone.replace(/\D/g, "");
    const firstAnimal: AnyRecord = animals[0] || {};
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

  async function handleDocumentFile(document: AnyRecord, file?: File) {
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

  const publicStepTitles = {
    0: "Seus dados",
    1: "Dados do animal",
    2: "Agendamento",
    3: internalSimple ? "Finalização" : "Documentos",
  };

  const progressPct = Math.round(((currentStepIndex + 1) / formSteps.length) * 100);

  const stepperNode = (
    <div className="nr-stepper">
      {formSteps.map((item, index) => {
        const isDone = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        return (
          <React.Fragment key={item.step}>
            <button
              type="button"
              className={`nr-step${isCurrent ? " nr-step--current" : ""}${isDone ? " nr-step--done" : ""}`}
              onClick={() => { if (isDone) setFormStep(item.step); }}
              disabled={!isDone}
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

  const footerNode = (
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
  );

  if (publicFlow || compact) {
    const internalCompact = compact && !publicFlow;
    return (
      <div className={internalCompact ? "nr-shell nr-shell--internal" : "nr-shell"}>
        <div className={internalCompact ? "nr-topbar nr-topbar--internal" : "nr-topbar"}>
          {!internalCompact && (
            <button
              className="nr-home-btn"
              type="button"
              onClick={onBack}
              aria-label="Início"
            >
              <Home size={18} />
            </button>
          )}
          <div className="nr-topbar-stepper">{stepperNode}</div>
        </div>

        <div className="nr-body">

          {submissionError && <p className="form-error">{submissionError}</p>}
          <div className="single-request-form clean-form">
          {formStep === 0 && <FormSection title={<><User size={14} />Seus dados</>}>
            <div className="two-column-fields">
              <div className={`access-field${showInvalid("tutor") ? " is-invalid" : ""}`}>
                <User size={14} className="access-field-icon" />
                <input type="text" placeholder="Nome do tutor ou responsável" value={requestData.tutor} onChange={(e) => updateRequestField("tutor", e.target.value)} />
              </div>
              <div className={`access-field${showInvalid("cpf") ? " is-invalid" : ""}`}>
                <FileText size={14} className="access-field-icon" />
                <input type="text" placeholder="CPF (000.000.000-00)" value={requestData.cpf} onChange={(e) => updateMaskedRequestField("cpf", e.target.value)} />
              </div>
            </div>
            <div className="cadunico-row">
              <div className="access-field">
                <FileText size={14} className="access-field-icon" />
                <input type="text" placeholder="Número do CadÚnico" value={requestData.cadUnico} onChange={(e) => updateRequestField("cadUnico", e.target.value)} readOnly={requestData.cadUnicoNotApplicable} />
              </div>
              <label className="checkbox-row cadunico-checkbox">
                <input type="checkbox" checked={!requestData.cadUnicoNotApplicable} onChange={(event) => toggleCadUnicoNotApplicable(event.target.checked)} />
                Se aplica
              </label>
            </div>
            <div className="form-subsection-title">Endereço</div>
            <div className="address-lookup-grid">
              <div className={`access-field${showInvalid("cep") ? " is-invalid" : ""}`}>
                <MapPin size={14} className="access-field-icon" />
                <input type="text" placeholder="CEP (00000-000)" value={requestData.cep} onChange={(e) => lookupCep(e.target.value)} />
              </div>
              <div className={`access-field${showInvalid("number") ? " is-invalid" : ""}`}>
                <Navigation size={14} className="access-field-icon" />
                <input type="text" placeholder="Número" value={requestData.number} onChange={(e) => updateRequestField("number", e.target.value)} />
              </div>
              <div className={`access-field${showInvalid("state") ? " is-invalid" : ""}`}>
                <input type="text" placeholder="UF" value={requestData.state} maxLength={2} onChange={(e) => updateMaskedRequestField("state", e.target.value)} />
              </div>
            </div>
            {cepStatus && <p className="cep-status">{cepStatus}</p>}
            <div className={`access-field${showInvalid("address") ? " is-invalid" : ""}`}>
              <MapPin size={14} className="access-field-icon" />
              <input type="text" placeholder="Endereço (Rua, complemento)" value={requestData.address} onChange={(e) => updateRequestField("address", e.target.value)} />
            </div>
            <div className="address-city-grid">
              <div className={`access-field${showInvalid("neighborhood") ? " is-invalid" : ""}`}>
                <MapPin size={14} className="access-field-icon" />
                <input type="text" placeholder="Bairro" value={requestData.neighborhood} onChange={(e) => updateRequestField("neighborhood", e.target.value)} />
              </div>
              <div className={`access-field${showInvalid("city") ? " is-invalid" : ""}`}>
                <Building2 size={14} className="access-field-icon" />
                <input type="text" placeholder="Cidade" value={requestData.city} onChange={(e) => updateRequestField("city", e.target.value)} />
              </div>
            </div>
            {requestData.latitude && requestData.longitude && <p className="map-selected-place">Localização registrada: {requestData.latitude}, {requestData.longitude}.</p>}
            {locationStatus && <p className="cep-status">{locationStatus}</p>}
            <div className="form-subsection-title">Contato</div>
            <div className="two-column-fields">
              <div className={`access-field${showInvalid("email") ? " is-invalid" : ""}`}>
                <Mail size={14} className="access-field-icon" />
                <input type="email" placeholder="Email" value={requestData.email} onChange={(e) => updateRequestField("email", e.target.value)} />
              </div>
              <div className={`access-field${showInvalid("phone") ? " is-invalid" : ""}`}>
                <Phone size={14} className="access-field-icon" />
                <input type="tel" placeholder="WhatsApp / celular" value={requestData.phone} onChange={(e) => updateMaskedRequestField("phone", e.target.value)} />
              </div>
            </div>
            {!internalSimple && !smsCode && !smsConfirmed && (
              <button className="secondary-action sms-send-btn" type="button" onClick={sendSmsCode}>Enviar código de verificação</button>
            )}
            {!internalSimple && (smsCode || smsConfirmed) && (
              <div className="sms-verify-row">
                <label className={showInvalid("sms") ? "field sms-code-field invalid" : "field sms-code-field"}>
                  <span>Código SMS</span>
                  <input value={smsInput} onChange={(event) => setSmsInput(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" disabled={smsConfirmed} />
                </label>
                <button className="ghost-button" type="button" onClick={confirmSmsCode} disabled={smsConfirmed}>Confirmar</button>
              </div>
            )}
            {smsStatus && <p className={smsConfirmed ? "sms-status confirmed" : "sms-status"}>{smsStatus}</p>}
          </FormSection>}

          {formStep === 1 && <FormSection title={<><PawPrint size={14} />Dados do animal</>}>
            {configuredRequestTypes.length > 0 && (
              <div className={`anm-type-picker${showInvalid("type") ? " is-invalid" : ""}`}>
                <span className="anm-type-label">Tipo de solicitação</span>
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
              </div>
            )}

            {animals.map((animal, index) => {
              const isOpen = expandedAnimal === index;
              const summary = [animal.species, animal.sex].filter(Boolean).join(" · ") || "Preencha os dados";
              return (
                <div className={`animal-form${isOpen ? " is-open" : " is-collapsed"}`} key={`animal-${index}`}>
                  <button
                    type="button"
                    className="animal-form-header animal-accordion-toggle"
                    onClick={() => setExpandedAnimal(isOpen ? -1 : index)}
                  >
                    <div className="animal-accordion-title">
                      <strong>Animal {index + 1}</strong>
                      {!isOpen && <span className="animal-accordion-summary">{summary}</span>}
                    </div>
                    <ChevronRight size={15} className={`animal-accordion-chevron${isOpen ? " is-open" : ""}`} />
                  </button>

                  {isOpen && <>
                    <div className="animal-choice-grid two-col">
                      <CompactChoiceField label="Espécie" value={animal.species} options={activeSpecies} onChange={(value) => updateAnimal(index, "species", value)} invalid={submitAttempted && !animal.species} />
                      <CompactChoiceField label="Tipo de Procedimento" value={animal.procedureType} options={["Castração", "Microchipagem", "Ambos"]} onChange={(value) => updateAnimal(index, "procedureType", value)} />
                    </div>
                    <div className="animal-choice-grid two-col">
                      <CompactChoiceField label="Raça" value={animal.breedType} options={["Indefinida", "Definida"]} onChange={(value) => updateAnimal(index, "breedType", value)} invalid={submitAttempted && !animal.breedType} />
                      <CompactChoiceField label="Sexo" value={animal.sex} options={["Macho", "Fêmea"]} onChange={(value) => updateAnimal(index, "sex", value)} invalid={submitAttempted && !animal.sex} />
                    </div>
                    {animal.breedType === "Definida" && (
                      <div className="access-field">
                        <PawPrint size={14} className="access-field-icon" />
                        <input type="text" placeholder="Descreva a raça (Ex: Poodle, Siamês)" value={animal.breedDescription} onChange={(e) => updateAnimal(index, "breedDescription", e.target.value)} />
                      </div>
                    )}
                    <div className="two-column-fields">
                      <div className="access-field">
                        <PawPrint size={14} className="access-field-icon" />
                        <input type="text" placeholder="Nome do animal" value={animal.name} onChange={(e) => updateAnimal(index, "name", e.target.value)} />
                      </div>
                      <div className="access-field">
                        <Dog size={14} className="access-field-icon" />
                        <input type="text" placeholder="Cor da pelagem" value={animal.coat} onChange={(e) => updateAnimal(index, "coat", e.target.value)} />
                      </div>
                    </div>
                    <div className="two-column-fields">
                      <div className="access-field">
                        <input type="text" placeholder="Idade aprox. (ex: 2 anos)" value={animal.age || ""} onChange={(e) => updateAnimal(index, "age", e.target.value)} />
                      </div>
                      <div className={`access-field${submitAttempted && !animal.size ? " is-invalid" : ""}`}>
                        <input type="number" min="0" step="0.1" placeholder="Peso (kg)" value={animal.weight || ""} onChange={(event) => { const w = event.target.value; updateAnimal(index, "weight", w); updateAnimal(index, "size", detectSizeFromWeight(w)); }} />
                      </div>
                    </div>
                    {internalSimple && (
                      <div className="internal-microchip-row">
                        <div className="access-field">
                          <ScanLine size={14} className="access-field-icon" />
                          <input
                            type="text"
                            placeholder={animal.hasChip === "Sim" ? "Codigo do microchip" : "Microchip nao informado"}
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
                    <div className="health-card">
                      <strong>Saúde e cuidados</strong>
                      <div className="health-grid">
                        <YesNoField label="Vermifugado?" value={animal.dewormed} onChange={(value) => updateAnimal(index, "dewormed", value)} />
                        <YesNoField label="Vacinas em dia?" value={animal.vaccinated} onChange={(value) => updateAnimal(index, "vaccinated", value)} />
                        <YesNoField label="Já teve cria?" value={animal.hadLitter} onChange={(value) => updateAnimal(index, "hadLitter", value)} />
                        <YesNoField label="Histórico de doenças?" value={animal.illnessHistory} onChange={(value) => updateAnimal(index, "illnessHistory", value)} />
                        <CompactChoiceField label="Alimentação" value={animal.food} options={["Ração", "Diversos"]} onChange={(value) => updateAnimal(index, "food", value)} />
                      </div>
                    </div>
                    {internalSimple && inlineAnimalPhotoUpload}
                    {animals.length > 1 && (
                      <button className="animal-remove-inline" type="button" onClick={() => { removeAnimal(index); setExpandedAnimal(Math.max(0, index - 1)); }}>
                        <X size={13} /> Remover animal {index + 1}
                      </button>
                    )}
                  </>}
                </div>
              );
            })}
            <button className="anm-add-btn" type="button" onClick={addAnimal}>
              <Plus size={15} /> Adicionar animal
            </button>
          </FormSection>}

          {formStep === 2 && <FormSection title={<><CalendarDays size={14} />Agenda</>}>
            <PublicSchedulePicker
              requests={requests}
              scheduleDays={scheduleDays}
              selectedDate={requestData.schedule}
              pendingReservation={{ date: requestData.schedule, count: animals.length }}
              onSelect={(date) => updateRequestField("schedule", date)}
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

          {!internalSimple && formStep === 3 && <FormSection title={<><FileText size={14} />Documentos comprobatórios</>}>
            <label className="doc-photo-zone">
              {documentUploads.animal_photo?.dataUrl ? (
                <img className="doc-photo-preview" src={documentUploads.animal_photo.dataUrl} alt="Foto do animal" onClick={(e) => { e.preventDefault(); setPreviewDocument(documentUploads.animal_photo); }} />
              ) : (
                <div className="doc-photo-placeholder">
                  <ImagePlus size={28} />
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
                  aiActive={aiSettings.active}
                  onUpload={(file) => handleDocumentFile(document, file)}
                  onRemove={() => removeDocumentFile(document.id)}
                />
              );
            })}

            <div className="doc-declaration">
              <p>
                O tutor declara ciência dos cuidados pré e pós-cirúrgicos e autoriza o registro do procedimento.{" "}
                <button className="inline-link-button" type="button" onClick={openDeclarationPdf}>Ler declaração completa</button>
              </p>
              <label className={`doc-accept-check${showInvalid("accepted") ? " is-invalid" : ""}`}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span className="doc-check-box" />
                <span>Li e concordo com os termos</span>
              </label>
            </div>
          </FormSection>}

          </div>

          {submissionError && <p className="nr-bottom-error">{submissionError}</p>}
          <div className="nr-nav-row">
            {currentStepIndex > 0 && (
              <button
                className="nr-back-btn"
                type="button"
                onClick={() => setFormStep(formSteps[currentStepIndex - 1].step)}
              >
                <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} />
                Voltar
              </button>
            )}
            {currentStepIndex < formSteps.length - 1 ? (
              <button
                className="nr-topbar-continue"
                type="button"
                disabled={!internalSimple && formStep === 0 && !skipTutorStep && !smsConfirmed}
                onClick={goToNextStep}
              >
                Continuar
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                className="nr-topbar-continue"
                type="button"
                disabled={!canSubmit || submitting}
                onClick={submit}
              >
                {submitting ? "Enviando..." : internalSimple ? "Encerrar" : "Enviar"}
              </button>
            )}
          </div>
        </div>

        {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />}
      </div>
    );
  }

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="nr-panel-top">
          <strong className="nr-title">Novo Cadastro</strong>
          {stepperNode}
        </div>
        {submissionError && <p className="form-error">{submissionError}</p>}
        <div className="single-request-form clean-form">
          {formStep === 0 && <FormSection title="Tutor e endereço">
            <Field label="Nome" value={requestData.tutor} onChange={(value) => updateRequestField("tutor", value)} placeholder="Nome do tutor ou responsável" invalid={showInvalid("tutor")} />
            <Field label="CPF" value={requestData.cpf} onChange={(value) => updateMaskedRequestField("cpf", value)} placeholder="000.000.000-00" invalid={showInvalid("cpf")} />
            <div className="cadunico-row">
              <Field label="CadÚnico" value={requestData.cadUnico} onChange={(value) => updateRequestField("cadUnico", value)} placeholder="Número do CadÚnico" readOnly={requestData.cadUnicoNotApplicable} />
              <label className="checkbox-row cadunico-checkbox"><input type="checkbox" checked={!requestData.cadUnicoNotApplicable} onChange={(event) => toggleCadUnicoNotApplicable(event.target.checked)} />Se aplica</label>
            </div>
            <div className="form-subsection-title">Endereço</div>
            <div className="address-lookup-grid">
              <div className="cep-with-map"><Field label="CEP" value={requestData.cep} onChange={lookupCep} placeholder="00000-000" invalid={showInvalid("cep")} /></div>
              <Field label="Número" value={requestData.number} onChange={(value) => updateRequestField("number", value)} placeholder="123" invalid={showInvalid("number")} />
            </div>
            {cepStatus && <p className="cep-status">{cepStatus}</p>}
            <Field label="Endereço completo" value={requestData.address} onChange={(value) => updateRequestField("address", value)} placeholder="Rua, número, complemento" invalid={showInvalid("address")} />
            <Field label="Bairro" value={requestData.neighborhood} onChange={(value) => updateRequestField("neighborhood", value)} placeholder="Informe o bairro" invalid={showInvalid("neighborhood")} />
            <div className="two-column-fields">
              <Field label="Cidade" value={requestData.city} onChange={(value) => updateRequestField("city", value)} placeholder="Cidade" invalid={showInvalid("city")} />
              <Field label="UF" value={requestData.state} onChange={(value) => updateMaskedRequestField("state", value)} placeholder="SP" invalid={showInvalid("state")} />
            </div>
            {locationStatus && <p className="cep-status">{locationStatus}</p>}
            <div className="form-subsection-title">Contato</div>
            <Field label="Email" value={requestData.email} onChange={(value) => updateRequestField("email", value)} placeholder="seuemail@exemplo.com" invalid={showInvalid("email")} />
            <div className="contact-confirmation-panel">
              <div className="phone-validation-row">
                <Field label="Celular" value={requestData.phone} onChange={(value) => updateMaskedRequestField("phone", value)} placeholder="Digite seu WhatsApp/celular" invalid={showInvalid("phone")} />
                {!internalSimple && !smsCode && !smsConfirmed && (<button className="secondary-action" type="button" onClick={sendSmsCode}>Enviar código</button>)}
                {!internalSimple && (smsCode || smsConfirmed) && (<><label className={showInvalid("sms") ? "field sms-code-field invalid" : "field sms-code-field"}><span>Código SMS</span><input value={smsInput} onChange={(event) => setSmsInput(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" disabled={smsConfirmed} /></label><button className="ghost-button" type="button" onClick={confirmSmsCode} disabled={smsConfirmed}>Confirmar</button></>)}
              </div>
            </div>
            {smsStatus && <p className={smsConfirmed ? "sms-status confirmed" : "sms-status"}>{smsStatus}</p>}
          </FormSection>}
          {formStep === 1 && <FormSection title="Dados dos animais">
            {configuredRequestTypes.length > 0 && (<label className={showInvalid("type") ? "field invalid" : "field"}><span>Tipo de solicitação</span><select value={requestData.type} onChange={(event) => updateRequestField("type", event.target.value)}><option value="">Selecione o tipo</option>{configuredRequestTypes.map((type) => (<option key={type.id || type.name} value={type.name}>{type.name}</option>))}</select></label>)}
            {animals.map((animal, index) => (
              <div className="animal-form" key={`animal-${index}`}>
                <div className="animal-form-header"><strong>Animal {index + 1}</strong></div>
                <div className="animal-main-grid">
                  <Field label="Nome" value={animal.name} onChange={(value) => updateAnimal(index, "name", value)} placeholder="Nome do animal" />
                  <Field label="Data de nascimento" value={animal.birthDate || animal.age} onChange={(value) => { updateAnimal(index, "birthDate", value); updateAnimal(index, "age", value); }} type="date" />
                  <Field label="Cor da pelagem" value={animal.coat} onChange={(value) => updateAnimal(index, "coat", value)} placeholder="Ex: preto, caramelo" />
                  <div className="inline-microchip-fields">
                    <Field label="Código do microchip" value={animal.microchip} onChange={(value) => updateAnimal(index, "microchip", value)} placeholder={animal.hasChip === "Sim" ? "Número do chip" : "Marque o campo ao lado"} readOnly={animal.hasChip !== "Sim"} />
                    <label className="checkbox-row compact-checkbox" title="Animal já é chipado"><input type="checkbox" aria-label="Animal já é chipado" checked={animal.hasChip === "Sim"} onChange={(event) => { updateAnimal(index, "hasChip", event.target.checked ? "Sim" : "Nao"); if (!event.target.checked) updateAnimal(index, "microchip", ""); }} /></label>
                  </div>
                </div>
                <div className="choice-card"><strong>Características</strong><div className="animal-choice-grid"><CompactChoiceField label="Espécie" value={animal.species} options={activeSpecies} onChange={(value) => updateAnimal(index, "species", value)} invalid={submitAttempted && !animal.species} /><CompactChoiceField label="Sexo" value={animal.sex} options={["Macho", "Fêmea"]} onChange={(value) => updateAnimal(index, "sex", value)} invalid={submitAttempted && !animal.sex} /><CompactChoiceField label="Porte" value={animal.size} options={activeSizes.map((size) => ({ label: size.name, title: size.description, subtitle: formatSizeRange(size) }))} onChange={(value) => updateAnimal(index, "size", value)} invalid={submitAttempted && !animal.size} /><CompactChoiceField label="Raça" value={animal.breedType} options={["Indefinida", "Definida"]} onChange={(value) => updateAnimal(index, "breedType", value)} invalid={submitAttempted && !animal.breedType} /></div></div>
                {animal.breedType === "Definida" && (<Field label="Descreva a raça" value={animal.breedDescription} onChange={(value) => updateAnimal(index, "breedDescription", value)} placeholder="Ex: Poodle, Siamês" />)}
                <div className="health-card"><strong>Saúde e cuidados <span className="optional-label">opcional</span></strong><div className="health-grid"><YesNoField label="Vermifugado?" value={animal.dewormed} onChange={(value) => updateAnimal(index, "dewormed", value)} /><YesNoField label="Vacinas em dia?" value={animal.vaccinated} onChange={(value) => updateAnimal(index, "vaccinated", value)} /><YesNoField label="Já teve cria?" value={animal.hadLitter} onChange={(value) => updateAnimal(index, "hadLitter", value)} /><YesNoField label="Histórico de doenças?" value={animal.illnessHistory} onChange={(value) => updateAnimal(index, "illnessHistory", value)} /><CompactChoiceField label="Alimentação" value={animal.food} options={["Ração", "Diversos"]} onChange={(value) => updateAnimal(index, "food", value)} /></div></div>
              </div>
            ))}
            <div className="animal-actions-row"><button className="secondary-action" type="button" onClick={addAnimal}><Plus size={18} />Adicionar animal</button>{animals.length > 1 && (<button className="ghost-button danger-action" type="button" onClick={() => removeAnimal(animals.length - 1)}>Remover último</button>)}</div>
          </FormSection>}
          {formStep === 2 && <FormSection title="Agenda"><PublicSchedulePicker requests={requests} scheduleDays={scheduleDays} selectedDate={requestData.schedule} pendingReservation={{ date: requestData.schedule, count: animals.length }} onSelect={(date) => updateRequestField("schedule", date)} /></FormSection>}
          {!internalSimple && formStep === 3 && <FormSection title="Documentos comprobatórios">
            <div className="animal-photo-upload-card"><div><strong>Foto de registro animal</strong><span>Opcional</span>{documentUploads.animal_photo?.fileName && <small>{documentUploads.animal_photo.fileName}</small>}</div>{documentUploads.animal_photo?.dataUrl && (<button className="animal-photo-preview" type="button" onClick={() => setPreviewDocument(documentUploads.animal_photo)}><img src={documentUploads.animal_photo.dataUrl} alt="Foto de registro animal" /></button>)}<div className="animal-photo-actions"><label className="secondary-action file-button">Enviar foto<input type="file" accept="image/*" onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} /></label><label className="ghost-button file-button">Abrir câmera<input type="file" accept="image/*" capture="environment" onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} /></label>{documentUploads.animal_photo && (<button className="danger-action" type="button" onClick={() => removeDocumentFile("animal_photo")}>Remover</button>)}</div></div>
            <div className="document-upload-list">{!selectedRequestType && (<EmptyState title="Nenhum documento obrigatório" text="Este cadastro seguirá sem anexos obrigatórios nesta etapa." />)}{selectedTypeDocuments.map((document) => { const upload = documentUploads[document.id]; return (<DocumentScannerUpload key={document.id} document={document} upload={upload} aiActive={aiSettings.active} onUpload={(file) => handleDocumentFile(document, file)} onRemove={() => removeDocumentFile(document.id)} />); })}</div>
            <div className="declaration-box"><FileText size={20} /><p>O tutor declara ciência dos cuidados pré e pós-cirúrgicos, responsabilidades de acompanhamento e autorização para registro do procedimento.{" "}<button className="inline-link-button" type="button" onClick={openDeclarationPdf}>Ler declaração em PDF</button></p></div>
            <label className={showInvalid("accepted") ? "checkbox-row invalid" : "checkbox-row"}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />Li e aceito a declaração.</label>
          </FormSection>}
          {internalSimple && formStep === 3 && <FormSection title="Finalização">
            <div className="animal-photo-upload-card"><div><strong>Foto de registro animal</strong><span>Opcional</span>{documentUploads.animal_photo?.fileName && <small>{documentUploads.animal_photo.fileName}</small>}</div>{documentUploads.animal_photo?.dataUrl && (<button className="animal-photo-preview" type="button" onClick={() => setPreviewDocument(documentUploads.animal_photo)}><img src={documentUploads.animal_photo.dataUrl} alt="Foto de registro animal" /></button>)}<div className="animal-photo-actions"><label className="secondary-action file-button">Enviar foto<input type="file" accept="image/*" onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} /></label><label className="ghost-button file-button">Abrir câmera<input type="file" accept="image/*" capture="environment" onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} /></label>{documentUploads.animal_photo && (<button className="danger-action" type="button" onClick={() => removeDocumentFile("animal_photo")}>Remover</button>)}</div></div>
          </FormSection>}
        </div>
        {footerNode}
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
        <div class="data-item"><span>Espécie</span><strong>${escapeHtml(animal.species || "-")}</strong></div>
        <div class="data-item"><span>Sexo</span><strong>${escapeHtml(animal.sex || "-")}</strong></div>
        <div class="data-item"><span>Porte</span><strong>${escapeHtml(animal.size || "-")}</strong></div>
        <div class="data-item"><span>Procedimento</span><strong>${escapeHtml(animal.procedure || "-")}</strong></div>
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
        <div class="data-item"><span>Nome</span><strong>${escapeHtml(requestData.tutor || "-")}</strong></div>
        <div class="data-item"><span>CPF</span><strong>${escapeHtml(requestData.cpf || "-")}</strong></div>
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
  const [requestFilter, setRequestFilter] = useState("inbox");
  const [previewRequest, setPreviewRequest] = useState(null);
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);

  const visibleRequests = useMemo(
    () => (Array.isArray(requests) ? requests : [])
      .map(normalizeRequest)
      .filter((request) => matchesRequestSearch(request, globalSearch)),
    [requests, globalSearch],
  );
  const today = formatScheduleDate(new Date());
  const filterTabs = [
    {
      id: "inbox",
      label: "Novas",
      requests: visibleRequests.filter(
        (r) => r.status === "NOVA" && !r.tags.includes("ATRIBUIDA"),
      ),
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
  const activeScheduleDays = scheduleDays
    .filter((day) => day.active !== false && !isPastScheduleDay(day.date))
    .map((day) => ({ ...day, remaining: Math.max((day.vacancies || 0) - countUsedVacancies(requests, day.date), 0) }));
  const activeUsers = teams.users?.filter((user) => user.active !== false) || [];
  const activeSectors = teams.sectors?.filter((sector) => sector.active !== false) || [];
  const currentTeamUser = activeUsers.find((user) => user.email && currentUser.email && user.email.toLowerCase() === currentUser.email.toLowerCase())
    || activeUsers.find((user) => user.id === currentUser.id);
  const currentUserSector = activeSectors.find((sector) => getUserSectorIds(currentTeamUser).includes(sector.id));

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
    const patch = { status: "AGENDADA" };
    patchRequest?.(request.id, patch, `Agenda confirmada por ${currentUser.name}`);
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }

  function notAttendedRequest(request) {
    patchRequest?.(
      request.id,
      { status: "CANCELADA", workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason: "Não compareceu" } },
      `Não comparecimento registrado por ${currentUser.name}`,
    );
  }

  function archiveWithTag(request, tag, note) {
    const cancelReason = tag === "NAO_COMPARECEU" ? "Não compareceu" : tag === "CANCELADA" ? "Cancelado" : "";
    const patch = cancelReason
      ? { status: "CANCELADA", workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason } }
      : { status: "CANCELADA", workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason: tag } };
    patchRequest?.(request.id, patch, note);
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }

  function rescheduleFromPreview(request, date, reason = "") {
    if (!request || !date) return;
    const note = String(reason || "").trim();
    const patch = {
      status: request.status,
      tags: mergeTags(request.tags, ["REAGENDADA"]),
      previousSchedule: request.preferredSchedule || request.appointment || "Não informado",
      preferredSchedule: date,
      appointment: date,
    };
    patchRequest?.(request.id, patch, `Reagendada por ${currentUser.name}: ${request.preferredSchedule || "sem data"} -> ${date}${note ? `. Motivo: ${note}` : ""}`);
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }

  function assignFromPreview(request, assignment: AnyRecord = {}) {
    if (!request) return;
    const sector = activeSectors.find((item) => item.id === assignment.sectorId);
    const user = activeUsers.find((item) => item.id === assignment.userId);
    if (!sector || !user) return;
    const patch = {
      status: request.status,
      assignedSectorId: sector.id,
      assignedSectorName: sector.name,
      assignedUserId: user.id,
      responsible: user.name || sector.name || "Equipe",
      tags: mergeTags(request.tags, ["ATRIBUIDA"]),
    };
    patchRequest?.(request.id, patch, `Atribuída para ${sector.name} / ${user.name}`);
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }

  function rejectRequestFromProcess(request, data: AnyRecord = {}) {
    if (!request) return;
    const note = String(data.note || "").trim();
    const patch = {
      status: "CANCELADA",
      rejectionReason: data.category || note || "Indeferido",
      rejectionNote: note,
      workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason: "Indeferido" },
    };
    patchRequest?.(request.id, patch, `Indeferida por ${currentUser.name}${note ? `. Observação: ${note}` : ""}`);
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }

  function confirmAttendanceFromProcess(request, data: AnyRecord = {}) {
    if (!request) return;
    const normalized = normalizeRequest(request);
    const microchip = String(data.microchip || "").trim();
    const note = String(data.note || "").trim();
    const performedProcedures = getPerformedProceduresLabel(normalized);
    const currentAnimals = Array.isArray(normalized.animals) ? normalized.animals : [];
    const animals = microchip
      ? currentAnimals.map((animal, index) => index === 0 ? { ...animal, hasChip: "Sim", microchip } : animal)
      : currentAnimals;
    const patch = {
      status: "REALIZADA",
      animalMicrochip: microchip,
      animals,
      workflow_data: { performedProcedures, attendanceMicrochip: microchip, attendanceNote: note },
    };
    patchRequest?.(request.id, patch, `Comparecimento confirmado${microchip ? `. Microchip: ${microchip}` : ""}${note ? `. Observação: ${note}` : ""}`);
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }

  function openRequestPreview(request) {
    setSelectedId?.(request.id);
    setPreviewRequest(request);
  }

  return (
    <section className="request-workspace triage-workspace">
      <div className="workspace-heading">
        <div>
          <h2>Solicitações</h2>
        </div>
        <button className="primary-action" type="button" onClick={() => setCreateRequestOpen(true)}>
          <Plus size={18} />
          Criar Solicitação
        </button>
      </div>

      <nav className="request-nav">
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

      <div className="triage-card-grid">
        {activeRequests.length === 0 && <EmptyState title={todayOnly ? "Nenhuma agenda para hoje" : "Nenhuma solicitação nesta etapa"} text={todayOnly ? "Solicitações sem agendamento para hoje não entram neste recorte." : "Quando houver registros, eles aparecerão aqui em cards responsivos."} />}
        {activeRequests.map((request) => (
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
                <span className="tc-value">{requestTypeLabel(request)}</span>
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
                  <span className={`tc-result-badge tc-result-badge--${
                    request.status === "REALIZADA" ? "success" :
                    "canceled"
                  }`}>
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
        ))}
      </div>

      {previewRequest && (
        <RequestPreviewModal
          request={previewRequest}
          requestTypes={requestTypes}
          aiSettings={aiSettings}
          scheduleDays={activeScheduleDays}
          sectors={activeSectors}
          users={activeUsers}
          onClose={() => setPreviewRequest(null)}
          onApprove={approveRequest}
          onReject={rejectRequestFromProcess}
          onArchive={archiveWithTag}
          onAttendance={confirmAttendanceFromProcess}
          onReschedule={rescheduleFromPreview}
          onAssign={assignFromPreview}
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

    </section>
  );
}

function RequestPreviewModal({ request, onClose, onApprove, onReject, onArchive, onAttendance, onReschedule, onAssign, requestTypes = [], scheduleDays = [], sectors = [], users = [], aiSettings = initialAiSettings }: AnyRecord) {
  const normalizedRequest = normalizeRequest(request);
  const isInternal = normalizedRequest.origin === "INTERNA" || normalizedRequest.origin === "BALCAO";
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState("");
  const [downloadLoadingId, setDownloadLoadingId] = useState("");
  const [bundleLoading, setBundleLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<"reject" | "reschedule" | "assign" | null>(null);
  const [rejectData, setRejectData] = useState({ category: "", note: "" });
  const [docDecisions, setDocDecisions] = useState({});
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState("");
  const [attendanceData, setAttendanceData] = useState({
    microchip: normalizedRequest.animalMicrochip || normalizedRequest.animals?.find((animal) => animal.microchip)?.microchip || "",
    note: normalizedRequest.attendanceNote || "",
  });
  const [assignData, setAssignData] = useState({
    sectorId: normalizedRequest.assignedSectorId || sectors[0]?.id || "",
    userId: normalizedRequest.assignedUserId || "",
  });
  const canAnalyze = request.status === "NOVA";
  const canApprove = canAnalyze;
  const canRecordAttendance = request.status === "AGENDADA";
  const canReschedule = request.status === "AGENDADA";
  const hasProcessAssignment = Boolean(normalizedRequest.assignedSectorId && normalizedRequest.assignedUserId);
  const blockWithoutAssignment = !hasProcessAssignment && !isInternal;
  const assignmentRequiredTitle = isInternal ? "" : "Atribua um setor e um usuário ao processo antes de analisar";

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
  const hasPendingRequiredDocuments = !isInternal && requiredRows.some((item) => {
    const decision = docDecisions[item.id];
    if (decision === "approved") return false;
    if (decision === "rejected") return true;
    return item.status !== "Aprovado";
  });

  const rejectionReasons = [
    "Documentação incompleta",
    "Animal inelegível",
    "Fora da área de atendimento",
    "Solicitação duplicada",
    "Tutor não localizado",
    "Outro",
  ];

  const daysWaiting = normalizedRequest.createdAt
    ? Math.floor((Date.now() - new Date(normalizedRequest.createdAt).getTime()) / 86400000)
    : null;
  const historyEntries = normalizedRequest.rawHistory.length ? normalizedRequest.rawHistory : normalizedRequest.history;
  const operationalEvents = buildOperationalTimeline(normalizedRequest, historyEntries);
  const principalAnimal = normalizedRequest.animals?.[0] || {};
  const operationalTags = buildOperationalTags(normalizedRequest, {
    isInternal,
    hasPendingRequiredDocuments,
    daysWaiting,
  });

  function statusClass(status) {
    if (status === "Aprovado") return "approved";
    if (status === "Recusado") return "rejected";
    if (status === "Não enviado") return "missing";
    if (status === "Gerado") return "generated";
    return "pending";
  }

  function getAiStatusLabel(anexo, decision) {
    if (decision === "approved") return "IA: aprovado manual";
    if (decision === "rejected") return "IA: recusado manual";
    if (anexo.status === "Aprovado") return "IA: aprovado";
    if (anexo.status === "Recusado") return "IA: recusado";
    if (anexo.status === "Gerado") return "Sistema";
    if (anexo.status === "Não enviado") return "Pendente";
    return aiSettings.active ? "IA: aguardando" : "Aguardando";
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
      const bundle = await generateDocumentBundlePdf(request);
      if (bundle?.dataUrl) {
        const anchor = window.document.createElement("a");
        anchor.href = bundle.dataUrl;
        anchor.download = bundle.fileName || `juntada-${request.protocol || request.id || "processo"}.pdf`;
        anchor.click();
      }
    } catch (error) {
      console.error("Erro ao preparar juntada:", error);
      const fallback = await generateFallbackBundlePdf(request, error);
      if (fallback?.dataUrl) {
        const anchor = window.document.createElement("a");
        anchor.href = fallback.dataUrl;
        anchor.download = fallback.fileName || `juntada-${request.protocol || request.id || "processo"}.pdf`;
        anchor.click();
      }
    } finally {
      setBundleLoading(false);
    }
  }

  function confirmRejectInline(event) {
    event.preventDefault();
    if (blockWithoutAssignment) return;
    onReject?.(request, rejectData);
  }

  function confirmAttendanceInline(event) {
    event.preventDefault();
    if (blockWithoutAssignment) return;
    onAttendance?.(request, attendanceData);
  }

  function renderAttachments() {
    return (
      <div className="process-attachments-list">
        {anexos.map((anexo, index) => {
          const decision = docDecisions[anexo.id];
          return (
            <article className="process-attachment-row" key={`${anexo.kind}-${anexo.id}`}>
              <div className="process-attachment-main">
                <span className="process-attachment-number">{index + 1}</span>
                <FileText size={18} className="process-attachment-icon" />
                <div className="process-attachment-info">
                  <strong>{anexo.tipo}</strong>
                </div>
                <div className="attachment-ai-status">
                  <span className={`attachment-status attachment-status--${decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : statusClass(anexo.status)}`}>
                    {getAiStatusLabel(anexo, decision)}
                  </span>
                  {anexo.message && <p className="attachment-ai-message">{anexo.message}</p>}
                </div>
              </div>
              <div className="process-attachment-actions">
                {anexo.available && anexo.kind !== "request" ? (
                  <>
                    <button
                      className={`doc-decision-btn${decision === "approved" ? " doc-decision-btn--active-ok" : ""}`}
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
                    <button className="icon-action" title="Visualizar" type="button" disabled={previewLoadingId === anexo.id} onClick={() => handlePreview(anexo)}>
                      <Eye size={16} />
                    </button>
                    <button className="icon-action" title="Baixar" type="button" disabled={downloadLoadingId === anexo.id} onClick={() => handleDownload(anexo)}>
                      <Download size={16} />
                    </button>
                  </>
                ) : anexo.available ? (
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
    function cancelReschedule() {
      setSelectedRescheduleDate("");
      setRescheduleReason("");
      setActivePanel(null);
    }

    function confirmReschedule() {
      if (!selectedRescheduleDate) return;
      onReschedule?.(request, selectedRescheduleDate, rescheduleReason);
      setSelectedRescheduleDate("");
      setRescheduleReason("");
      setActivePanel(null);
    }

    return (
      <div className="prm-inline-panel">
        <strong className="prm-inline-panel-title"><CalendarDays size={14} /> Reagendar</strong>
        <label className="field">
          <span>Motivo do reagendamento</span>
          <textarea
            value={rescheduleReason}
            onChange={(event) => setRescheduleReason(event.target.value)}
            placeholder="Motivo operacional"
          />
        </label>
        {scheduleDays.length === 0
          ? <p className="prm-muted-note">Nenhuma data disponível. Configure em Configurações â€º Agenda.</p>
          : (
            <div className="reschedule-grid">
              {scheduleDays.map((day) => (
                <button
                  key={day.date}
                  className={`calendar-day-button${day.remaining > 0 ? " has-vacancy" : ""}${selectedRescheduleDate === day.date ? " selected" : ""}`}
                  type="button"
                  disabled={day.remaining <= 0}
                  aria-pressed={selectedRescheduleDate === day.date}
                  onClick={() => setSelectedRescheduleDate(day.date)}
                >
                  <span>{day.weekday}</span>
                  <strong>{day.date}</strong>
                  <small>{day.remaining} vagas</small>
                </button>
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

  function renderHistoryTree() {
    return (
      <ol className="process-history-tree prm-operational-timeline">
        {operationalEvents.map((item, index) => {
          return (
            <li key={`${item.status}-${item.at}-${index}`} className="process-history-node">
              <span className="process-history-dot" />
              <div className="process-history-card">
                <div className="process-history-card-head">
                  <strong>{item.status}</strong>
                  {item.at && <time>{item.synthetic ? item.at : formatDateTime(item.at)}</time>}
                </div>
                {item.note && <p>{displayText(item.note)}</p>}
                {item.by && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.by.trim()) && (
                  <small>{displayText(item.by)}</small>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="modal-backdrop">
      {activePanel === "assign" && renderAssignModal()}
      <div className="prm-modal" role="dialog" aria-modal="true">

        {/* HEADER */}
        <header className="prm-header">
          <div className="prm-header-top">
            <div className="prm-header-left">
              <span className="prm-protocol">Processo #{request.protocol}</span>
              {normalizedRequest.rescheduleCount > 0 && (
                <span className="prm-reschedule-badge">
                  <RefreshCw size={10} />
                  {normalizedRequest.rescheduleCount === 1 ? "Reagendado" : `Reagendado ${normalizedRequest.rescheduleCount}x`}
                </span>
              )}
            </div>
            <div className="prm-header-actions">
              <StatusBadge status={normalizedRequest.status} />
              <button className="prm-pdf-btn" type="button" disabled={bundleLoading} onClick={handleBundlePreview}>
                <Download size={13} />
                {bundleLoading ? "Preparando..." : "Baixar Prontuário"}
              </button>
              <button className="prm-close-btn" type="button" aria-label="Fechar" onClick={onClose}>
                <X size={17} />
              </button>
            </div>
          </div>
          <h2 className="prm-tutor-name">{displayText(normalizedRequest.tutor)}</h2>
          <div className="prm-tag-strip">
            {operationalTags.map((tag) => (
              <span className={`prm-op-tag is-${tag.tone}`} key={tag.label}>{tag.label}</span>
            ))}
          </div>
        </header>

        {/* QUICK ACTIONS ZONE */}
        <div className="prm-actions-zone">
          {isInternal && (
            <p className="prm-internal-notice"><AlertCircle size={13} /> Solicitação interna - documentos não obrigatórios para avançar.</p>
          )}

          {activePanel === "reschedule" && renderInlineReschedule()}
          {activePanel === "reject" && (
            <div className="prm-inline-panel">
              <strong className="prm-inline-panel-title">Indeferir solicitação</strong>
              <label className="field">
                <span>Motivo</span>
                <select value={rejectData.category} onChange={(e) => setRejectData((d) => ({ ...d, category: e.target.value }))}>
                  <option value="">Selecione o motivo...</option>
                  {rejectionReasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Observação interna</span>
                <textarea value={rejectData.note} onChange={(e) => setRejectData((d) => ({ ...d, note: e.target.value }))} placeholder="Detalhe o motivo se necessário..." />
              </label>
              <div className="prm-inline-actions">
                <button className="ghost-button" type="button" onClick={() => setActivePanel(null)}>Cancelar</button>
                <button className="secondary-action danger-action" type="button" disabled={!rejectData.category} onClick={confirmRejectInline}>Confirmar indeferimento</button>
              </div>
            </div>
          )}

          <div className="prm-actions-btns">
            {canAnalyze && (
              <>
                <button
                  className={`prm-action-btn prm-action-btn--secondary${activePanel === "assign" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setActivePanel(activePanel === "assign" ? null : "assign")}
                >
                  <ClipboardList size={15} />{hasProcessAssignment ? "Reatribuir" : "Atribuir"}
                </button>
                {activePanel !== "reject" && (
                  <button
                    className="prm-action-btn prm-action-btn--ghost-danger"
                    type="button"
                    disabled={blockWithoutAssignment}
                    title={blockWithoutAssignment ? assignmentRequiredTitle : "Indeferir solicitação"}
                    onClick={() => setActivePanel("reject")}
                  >
                    Indeferir
                  </button>
                )}
                {canApprove && activePanel !== "reject" && (
                  <button
                    className="prm-action-btn prm-action-btn--primary"
                    type="button"
                    disabled={blockWithoutAssignment}
                    title={blockWithoutAssignment ? assignmentRequiredTitle : "Confirmar agenda"}
                    onClick={() => onApprove?.(request)}
                  >
                    <CheckCircle2 size={15} /> Confirmar Agenda
                  </button>
                )}
              </>
            )}
            {canRecordAttendance && (
              <>
                <button
                  className={`prm-action-btn prm-action-btn--secondary${activePanel === "assign" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setActivePanel(activePanel === "assign" ? null : "assign")}
                >
                  <ClipboardList size={15} />{hasProcessAssignment ? "Reatribuir" : "Atribuir"}
                </button>
                {canReschedule && (
                  <button
                    className={`prm-action-btn prm-action-btn--ghost${activePanel === "reschedule" ? " is-active" : ""}`}
                    type="button"
                    disabled={blockWithoutAssignment}
                    title={blockWithoutAssignment ? assignmentRequiredTitle : "Reagendar"}
                    onClick={() => setActivePanel(activePanel === "reschedule" ? null : "reschedule")}
                  >
                    <RefreshCw size={15} /> Reagendar
                  </button>
                )}
                <button
                  className="prm-action-btn prm-action-btn--warning"
                  type="button"
                  disabled={blockWithoutAssignment}
                  title={blockWithoutAssignment ? assignmentRequiredTitle : "Registrar não comparecimento"}
                  onClick={() => onArchive?.(request, "NAO_COMPARECEU", "Não comparecimento registrado")}
                >
                  Não compareceu
                </button>
                <button
                  className="prm-action-btn prm-action-btn--ghost-danger"
                  type="button"
                  disabled={blockWithoutAssignment}
                  title={blockWithoutAssignment ? assignmentRequiredTitle : "Cancelar procedimento"}
                  onClick={() => onArchive?.(request, "CANCELADA", "Procedimento cancelado")}
                >
                  Cancelar
                </button>
                <button
                  className="prm-action-btn prm-action-btn--primary"
                  type="button"
                  disabled={blockWithoutAssignment}
                  title={blockWithoutAssignment ? assignmentRequiredTitle : "Confirmar comparecimento"}
                  onClick={confirmAttendanceInline}
                >
                  <CheckCircle2 size={15} /> Confirmar comparecimento
                </button>
              </>
            )}
            {!canAnalyze && !canRecordAttendance && (
              <p className="prm-muted-note">Nenhuma ação pendente neste momento.</p>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="prm-content">
          <div className="prm-content-main">
            {canRecordAttendance && activePanel !== "reschedule" && (
              <div className="prm-section">
                <p className="prm-section-label"><ClipboardList size={13} /> Dados do procedimento</p>
                <label className="field">
                  <span>Código do microchip</span>
                  <input
                    value={attendanceData.microchip}
                    onChange={(e) => setAttendanceData((d) => ({ ...d, microchip: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                    placeholder="Informe o código aplicado ou lido"
                  />
                </label>
                <label className="field">
                  <span>Observação interna</span>
                  <textarea value={attendanceData.note} onChange={(e) => setAttendanceData((d) => ({ ...d, note: e.target.value }))} />
                </label>
              </div>
            )}
            {anexos.length > 0 && (
              <div className="prm-section">
                <p className="prm-section-label"><FileText size={13} /> Documentos ({anexos.length})</p>
                {renderAttachments()}
              </div>
            )}
            {!canAnalyze && !canRecordAttendance && anexos.length === 0 && (
              <p className="prm-muted-note" style={{ padding: "20px" }}>Nenhum documento anexado.</p>
            )}
            <div className="prm-section prm-section--timeline">
              <p className="prm-section-label"><Clock size={13} /> Timeline operacional</p>
              {operationalEvents.length > 0 ? renderHistoryTree() : <p className="prm-muted-note">Nenhum evento operacional registrado.</p>}
            </div>
          </div>

          <div className="prm-content-side">
            {normalizedRequest.animals.length > 0 && (
              <div className="prm-side-block">
                <p className="prm-side-label"><PawPrint size={13} />Animais</p>
                <div className="prm-animals-list">
                  {normalizedRequest.animals.map((animal, i) => (
                    <div className="prm-animal-card" key={i}>
                      <span className="prm-animal-name">{displayText(animal.name) || "Sem nome"}</span>
                      <div className="prm-animal-tags">
                        {animal.species && <span>{displayText(animal.species)}</span>}
                        {animal.sex && <span>{displayText(animal.sex)}</span>}
                        {animal.size && <span>{displayText(animal.size)}</span>}
                        {(animal.breedDescription || animal.breedType) && <span>{displayText(animal.breedDescription || animal.breedType)}</span>}
                        {(animal.birthDate || animal.age) && <span>{animal.birthDate || animal.age}</span>}
                        {(animal.procedure || normalizedRequest.type) && (
                          <span className="prm-tag--proc">{displayText(animal.procedure || getRequestTypeName(normalizedRequest, requestTypes))}</span>
                        )}
                        {animal.microchip && <span className="prm-tag--chip">Chip: {animal.microchip}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="prm-side-block">
              <p className="prm-side-label"><User size={13} />Tutor</p>
              <div className="prm-side-facts">
                <span><strong>Nome</strong>{displayText(normalizedRequest.tutor)}</span>
                {normalizedRequest.cpf && <span><strong>CPF</strong>{normalizedRequest.cpf}</span>}
                {normalizedRequest.phone && <span><strong>Telefone</strong>{normalizedRequest.phone}</span>}
                {[normalizedRequest.address, normalizedRequest.neighborhood, normalizedRequest.city].filter(Boolean).length > 0 && (
                  <span><strong>Endereço</strong>{[normalizedRequest.address, normalizedRequest.neighborhood, normalizedRequest.city].filter(Boolean).join(" - ")}</span>
                )}
              </div>
            </div>

            <div className="prm-side-block">
              <p className="prm-side-label"><ClipboardList size={13} />Processo</p>
              <div className="prm-side-facts">
                <span><strong>Status</strong>{statusLabels[normalizedRequest.status] || normalizedRequest.status}</span>
                <span><strong>Protocolo</strong>{normalizedRequest.protocol}</span>
                {normalizedRequest.createdAt && <span><strong>Abertura</strong>{formatDateTime(normalizedRequest.createdAt)}</span>}
                <span><strong>Setor</strong>{displayText(normalizedRequest.assignedSectorName) || "Sem setor"}</span>
                <span><strong>Responsável</strong>{displayText(normalizedRequest.responsible) || "Não atribuído"}</span>
              </div>
            </div>

            <div className="prm-side-block">
              <p className="prm-side-label"><Paperclip size={13} />Anexos</p>
              <div className="prm-side-facts">
                <span><strong>Total</strong>{anexos.length}</span>
                <span><strong>Pendentes</strong>{anexos.filter((item) => item.status === "Não enviado" || item.status === "Aguardando análise").length}</span>
              </div>
            </div>

            <div className="prm-side-block">
              <p className="prm-side-label"><FileText size={13} />Observações</p>
              <div className="prm-side-facts">
                <span>{displayText(normalizedRequest.attendanceNote || normalizedRequest.rejectionNote || normalizedRequest.notes || "Sem observações internas")}</span>
              </div>
            </div>
          </div>
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
function buildOperationalTimeline(request: AnyRecord = {}, historyEntries: any[] = []) {
  const events = [];
  if (request.createdAt) {
    events.push({
      status: "Solicitação criada",
      note: `Protocolo ${request.protocol || "sem protocolo"}`,
      by: request.tutor || "",
      at: request.createdAt,
    });
  }
  historyEntries.forEach((entry) => {
    if (entry && typeof entry === "object") {
      events.push({
        status: statusLabels[entry.status] || workflowTagLabels[entry.status] || entry.status || "Registro operacional",
        note: entry.notes || entry.note || "",
        by: entry.by || "",
        at: entry.at || entry.createdAt || "",
      });
      return;
    }
    const text = String(entry || "");
    const parts = text.split(" - ");
    const status = parts.shift() || "Registro operacional";
    const at = parts.find((part) => /\d{4}-\d{2}-\d{2}T/.test(part)) || "";
    const byPart = parts.find((part) => part.trim().startsWith("por "));
    const note = parts.filter((part) => part !== at && part !== byPart).join(" - ");
    events.push({
      status: statusLabels[status] || workflowTagLabels[status] || displayText(status.replaceAll("_", " ").toLowerCase()),
      note,
      by: byPart ? byPart.replace(/^por\s+/i, "") : "",
      at,
    });
  });
  if (request.preferredSchedule) {
    events.push({
      status: requestHasTag(request, "REAGENDADA") ? "Reagendamento" : "Agendamento",
      note: request.preferredSchedule,
      by: request.responsible || "",
      at: request.updatedAt || request.createdAt || "",
    });
  }
  if ((request.status === "REALIZADA" || request.status === "CANCELADA") && !events.some((event) => ["Procedimento executado", "Cancelamento", "Indeferimento", "Conclusão"].includes(event.status))) {
    const cancelReason = request.workflow_data?.cancelReason || request.workflowData?.cancelReason || "";
    events.push({
      status: request.status === "REALIZADA" ? "Procedimento executado" : cancelReason === "Indeferido" ? "Indeferimento" : "Cancelamento",
      note: request.attendanceNote || request.rejectionNote || cancelReason || "",
      by: request.responsible || "",
      at: request.updatedAt || "",
    });
  }
  return events
    .filter((event) => event.status || event.note)
    .sort((left, right) => {
      const leftTime = left.at ? new Date(left.at).getTime() : 0;
      const rightTime = right.at ? new Date(right.at).getTime() : 0;
      return leftTime - rightTime;
    });
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

function buildOperationalTags(request: AnyRecord = {}, context: AnyRecord = {}) {
  const tags = [];
  if (request.rescheduleCount > 0) tags.push({ label: request.rescheduleCount === 1 ? "Reagendado" : `Reagendado ${request.rescheduleCount}x`, tone: "warn" });
  if (context.daysWaiting >= 7 && request.status !== "REALIZADA" && request.status !== "CANCELADA") tags.push({ label: "Prioritário", tone: "danger" });
  if (context.isInternal) tags.push({ label: "Interno", tone: "info" });
  if (context.hasPendingRequiredDocuments) tags.push({ label: "Falta documento", tone: "warn" });
  if (request.animalMicrochip || request.animals?.some((animal: AnyRecord) => animal.microchip)) tags.push({ label: "Microchipado", tone: "ok" });
  if (requestHasTag(request, "PRIORIDADE")) tags.push({ label: "Urgente", tone: "danger" });
  return tags;
}

function getPerformedProceduresLabel(request: AnyRecord = {}) {
  const animals = Array.isArray(request.animals) ? request.animals : [];
  const procedures = animals.map((animal) => animal.procedure).filter(Boolean);
  const uniqueProcedures = [...new Set(procedures)];
  return uniqueProcedures.length ? uniqueProcedures.join(", ") : request.type || request.request_type || "Procedimento realizado";
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
  const [adoptionTab, setAdoptionTab] = useState("available");
  const [adoptionFilters, setAdoptionFilters] = useState({ species: "", sex: "" });
  const [editingAnimalId, setEditingAnimalId] = useState(null);
  const [interestsModal, setInterestsModal] = useState(null);
  const emptyAdoptionModalForm = {
    tutor: "", cpf: "", cep: "", number: "", address: "", neighborhood: "", city: "", state: "", email: "", phone: "",
    procedimentos: "", adopted_at: new Date().toISOString().slice(0, 10),
  };
  const [adoptionConfirmModal, setAdoptionConfirmModal] = useState(null);
  const [adoptionModalForm, setAdoptionModalForm] = useState(emptyAdoptionModalForm);
  const [adoptionModalStep, setAdoptionModalStep] = useState(0);
  const [adoptionModalCepStatus, setAdoptionModalCepStatus] = useState("");
  const [isSavingAdoption, setIsSavingAdoption] = useState(false);
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
      setFormError("Preencha nome, idade, especie, sexo e descricao antes de publicar.");
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
      setAdoptionAnimals((current) => current.map((item) => item.id === adoptionConfirmModal.id ? { ...item, ...updated } : item));
      setAdoptionConfirmModal(null);
    } catch (err) {
      console.error("Erro ao confirmar adoção:", err);
    } finally {
      setIsSavingAdoption(false);
    }
  }

  return (
    <section className="content-grid adoption-workspace">
      <div className="hero-panel adoption-hero">
        <video className="pet-welcome-video" autoPlay muted loop playsInline preload="metadata" poster="https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1400&q=80">
          <source src="https://assets.mixkit.co/videos/preview/mixkit-dog-catches-a-ball-in-a-river-1494-large.mp4" type="video/mp4" />
        </video>
        <div className="pet-video-shade" />
        <div className="adoption-hero-copy">
          <span className="eyebrow">Adoção responsável</span>
          <h2>Adicione pets para adoção</h2>
          <p>Gerencie animais disponíveis, interessados e confirmações de adoção em uma área mais clara e rápida de operar.</p>
          <div className="adoption-hero-stats" aria-label="Resumo da adoção">
            <span><strong>{availableAnimals.length}</strong> disponíveis</span>
            <span><strong>{adoptedAnimals.length}</strong> adotados</span>
            <span><strong>{adoptionAnimals.reduce((sum, animal) => sum + (Array.isArray(animal.interests) ? animal.interests.length : 0), 0)}</strong> interessados</span>
          </div>
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
                <button key={filter.value} className={adoptionTab === filter.value ? "selected" : ""} type="button" title={filter.label} aria-label={filter.label} onClick={() => setAdoptionTab(filter.value)}>
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
                <button key={`internal-species-${filter.value || "all"}`} className={adoptionFilters.species === filter.value ? "selected" : ""} type="button" title={filter.label} aria-label={filter.label} onClick={() => setAdoptionFilters((current) => ({ ...current, species: filter.value }))}>
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
                <button key={`internal-sex-${filter.value || "all"}`} className={adoptionFilters.sex === filter.value ? "selected" : ""} type="button" title={filter.label} aria-label={filter.label} onClick={() => setAdoptionFilters((current) => ({ ...current, sex: filter.value }))}>
                  <Icon size={18} />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>
          {activeFilterCount > 0 && (
            <button className="ghost-button adoption-clear-filters" type="button" onClick={() => setAdoptionFilters({ species: "", sex: "" })}>Limpar filtros</button>
          )}
          <button className="primary-action adoption-create-action" type="button" onClick={openAnimalForm}>
            <Plus size={18} />
            <span>Cadastrar animal</span>
          </button>
        </div>
      )}

      <div className="adoption-grid">
        {displayedAnimals.length === 0 && (
          <EmptyState
            title={adoptionTab === "adopted" ? "Nenhum animal adotado" : "Nenhum animal para adocao"}
            text={
              canManagePublicAnimalFlows(currentUser.role)
                ? activeFilterCount > 0
                  ? "Nenhum animal encontrado com estes filtros."
                  : adoptionTab === "adopted"
                  ? "Animais marcados como adotados ficarão aqui como histórico interno."
                  : "Cadastre o primeiro animal para liberar a galeria pública."
                : "A galeria pública ainda não possui animais cadastrados."
            }
          />
        )}
        {displayedAnimals.map((animal) => {
          const interestCount = Array.isArray(animal.interests) ? animal.interests.length : 0;
          return (
          <article className="adoption-card" key={animal.id || animal.name}>
            <div className="adoption-card-header strong">
              <h3>{animal.name || animal.animal_name}</h3>
              <span className={`adoption-card-status ${animal.status === "adotado" ? "is-adopted" : "is-available"}`}>
                {animal.status === "adotado" ? "Adotado" : "Disponível"}
              </span>
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
            {canManageAdoptions && (
              <div className="adoption-card-actions">
                <button
                  className={interestCount > 0 ? "adoption-interest-indicator has-interest interest-button" : "adoption-interest-indicator interest-button"}
                  type="button"
                  onClick={() => openInterestsModal(animal)}
                >
                  <Users size={13} />
                  <span>{interestCount > 0 ? `${interestCount}` : "0"}</span>
                </button>
                <button className="ghost-button" type="button" onClick={() => editAnimal(animal)} title="Editar" aria-label="Editar">
                  <Edit3 size={16} />
                </button>
                {animal.status === "adotado" ? (
                  <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(animal, "disponivel")} title="Reativar" aria-label="Reativar">
                    <RefreshCw size={16} />
                  </button>
                ) : (
                  <button className="secondary-action" type="button" onClick={() => openAdoptionConfirmModal(animal)} title="Marcar adotado" aria-label="Marcar adotado">
                    <CheckCircle2 size={16} />
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
            <ModalHeader title={`Interessados em ${interestsModal.animal.name || interestsModal.animal.animal_name}`} onClose={() => setInterestsModal(null)} />
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
  permissionGroups = [],
  setPermissionGroups,
  teams = initialTeams,
  setTeams,
  setActive,
  currentUser = null,
  configArea = "environment",
  selectedMunicipalityId = "",
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
  };
  const [configTab, setConfigTab] = useState("agenda");
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
  const [newDocument, setNewDocument] = useState({ name: "", modelHint: "", aiCriteria: "", rejectionRules: "", required: true, active: true });
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
  const emptyTeamUser = { name: "", email: "", sectorIds: [], municipalityId: "", role: "Analista", matricula: "", cargo: "", senha: "", active: true, permissionGroupId: "" };
  const [newTeamUser, setNewTeamUser] = useState(emptyTeamUser);
  const [newMunicipality, setNewMunicipality] = useState({ name: "", state: "", active: true });
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
  const [aiSaveStatus, setAiSaveStatus] = useState("");
  const [whatsappSettings, setWhatsappSettings] = useState(initialWhatsappSettings);
  const [whatsappSaveStatus, setWhatsappSaveStatus] = useState("");
  const initialQuotaSettings = { plan: "", contractStart: "", contractEnd: "" };
  const [quotaSettings, setQuotaSettings] = useState(initialQuotaSettings);
  const [quotaSaveStatus, setQuotaSaveStatus] = useState("");
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
  const environmentTabs = [
    { id: "agenda", label: "Agenda" },
    { id: "requests", label: "Tipo de Solicitação" },
    { id: "sizes", label: "Portes" },
    { id: "species", label: "Espécies" },
    { id: "documents", label: "Documentos Solicitados" },
    { id: "ai", label: "IA" },
    { id: "whatsapp", label: "WhatsApp" },
  ].filter((tab) => tab.id !== "whatsapp" || !canUseConfigPermissions || configCurrentPermissionGroup.allowedConfigItems?.includes("whatsapp_settings"));

  useEffect(() => {
    if (configArea === "environment") {
      setConfigTab((current) => (environmentTabs.some((tab) => tab.id === current) ? current : "agenda"));
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

  const selectedAiProvider = aiSettings.provider || "OpenAI";
  const selectedAiProviderConfig = aiProviderOptions[selectedAiProvider] || aiProviderOptions.OpenAI;
  const selectedAiModels = selectedAiProviderConfig.models || [];
  const selectedAiModel = selectedAiModels.includes(aiSettings.model) ? aiSettings.model : selectedAiModels[0] || "";
  const configMunicipalityScopeId = selectedMunicipalityId || currentUser?.municipalityId || "";

  useEffect(() => {
    if (configArea !== "environment" || configTab !== "whatsapp") return;
    if (!configMunicipalityScopeId) {
      setWhatsappSettings(initialWhatsappSettings);
      setWhatsappSaveStatus("Selecione um município para configurar o WhatsApp.");
      setQuotaSettings(initialQuotaSettings);
      setQuotaSaveStatus("");
      return;
    }
    let cancelled = false;
    setWhatsappSaveStatus("Carregando configuração...");
    Promise.all([
      api.getConfig(CONFIG_KEYS.whatsapp, configMunicipalityScopeId).catch(() => null),
      api.getConfig(CONFIG_KEYS.whatsappQuota, configMunicipalityScopeId).catch(() => null),
    ]).then(([whatsapp, quota]) => {
      if (cancelled) return;
      setWhatsappSettings({ ...initialWhatsappSettings, ...(whatsapp || {}) });
      setWhatsappSaveStatus("");
      setQuotaSettings({
        plan: String(quota?.plan ?? ""),
        contractStart: quota?.contractStart ?? "",
        contractEnd: quota?.contractEnd ?? "",
      });
      setQuotaSaveStatus(quota?.plan ? `Cota atual: ${quota.currentPeriodUsed ?? 0} / ${quota.plan} usadas este mês.` : "");
    });
    return () => { cancelled = true; };
  }, [configArea, configTab, configMunicipalityScopeId]);

  function matchesScopedConfigItem(item: AnyRecord = {}, itemId = "") {
    if (item.id !== itemId) return false;
    if (!configMunicipalityScopeId) return true;
    return getItemMunicipalityId(item) === configMunicipalityScopeId;
  }

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
      },
    ]);
  }

  async function saveWhatsappSettings() {
    if (!configMunicipalityScopeId) {
      setWhatsappSaveStatus("Selecione um município antes de salvar.");
      return;
    }
    const nextSettings = {
      ...whatsappSettings,
      active: Boolean(whatsappSettings.active),
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
    } catch (err) {
      setQuotaSaveStatus(`Não foi possível salvar: ${err.message}`);
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

  function createDocumentType(payload: AnyRecord = {}) {
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
      municipalityId: payload.municipalityId || configMunicipalityScopeId,
    };
    const normalizedDocument = normalizeDocumentType(nextDocument);
    if (editingDocumentId) {
      setDocumentTypes?.((current) =>
        current.map((document) => (matchesScopedConfigItem(document, editingDocumentId) ? { ...document, ...normalizedDocument, id: document.id } : document)),
      );
      setRequestTypes?.((current) =>
        current.map((type) => ({
          ...type,
          documents: (type.documents || []).map((document) =>
            matchesScopedConfigItem(document, editingDocumentId) ? { ...document, ...normalizedDocument, id: document.id } : document,
          ),
        })),
      );
      return;
    }
    setDocumentTypes?.((current) => [...current, normalizedDocument]);
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
      });
    } else {
      setEditingMunicipalityId(null);
      setNewMunicipality({ name: "", state: "", active: true });
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
        setNewMunicipality({ name: "", state: "", active: true });
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
      setNewMunicipality({ name: "", state: "", active: true });
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
      setMunicipalities?.((current) => current.map((item) => (item.id === municipalityId ? updated : item)));
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
      return (Array.from(byDate.values()) as AnyRecord[]).sort((l, r) => parseScheduleDate(l.date) - parseScheduleDate(r.date));
    });
  }

  function patchAgendaForm(field, value) {
    setAgendaForm((current) => ({ ...current, [field]: value }));
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
      setEditingScheduleRuleId(rule.id);
      setAgendaForm({
        ...emptyAgendaForm,
        description: rule.description || "",
        active: rule.active !== false,
        unavailable: rule.unavailable || false,
        kind: rule.kind || "Agenda",
        type: rule.type || "Recorrência",
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
      });
    } else {
      setEditingScheduleRuleId(null);
      setAgendaForm({ ...emptyAgendaForm, municipalityId: currentUser?.municipalityId || municipalities[0]?.id || "" });
    }
    setAgendaSaveStatus("");
    setConfigModal("agenda");
  }

  async function createScheduleFromModal(event) {
    event.preventDefault();
    if (agendaSaving) return;
    const isRecurring = normalizeText(agendaForm.type) === "recorrencia";
    if (!agendaForm.description.trim() || !agendaForm.start || !agendaForm.municipalityId || (isRecurring && (!agendaForm.end || agendaForm.weekdays.length === 0))) {
      setAgendaSaveStatus("Preencha os dados obrigatórios da agenda antes de salvar.");
      return;
    }

    setAgendaSaving(true);
    setAgendaSaveStatus("Salvando agenda...");
    const start = new Date(`${agendaForm.start}T12:00:00`);
    const end = new Date(`${isRecurring ? agendaForm.end : agendaForm.start}T12:00:00`);
    const repeatEvery = Math.max(Number(agendaForm.repeatEvery) || 1, 1);
    const slots = normalizeScheduleSlots(agendaForm.slots, agendaForm.time, agendaForm.vacancies);
    const vacancies = sumScheduleSlotsVacancies(slots);
    const startTime = slots[0]?.time || agendaForm.time;
    const municipality = municipalities.find((item) => item.id === agendaForm.municipalityId);
    const currentEditingRuleId = editingScheduleRuleId;
    const scheduleRuleId = currentEditingRuleId || `agenda_${Date.now()}`;
    const existingRule = scheduleRules.find((rule) => rule.id === scheduleRuleId);
    const nextDays = [];

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

    const nextRule = {
      id: scheduleRuleId,
      description: agendaForm.description.trim(),
      createdAt: existingRule?.createdAt || new Date().toLocaleString("pt-BR"),
      active: agendaForm.active && !agendaForm.unavailable,
      unavailable: agendaForm.unavailable,
      type: agendaForm.type,
      kind: agendaForm.kind,
      repeatEvery,
      weekdays: isRecurring ? agendaForm.weekdays : [start.getDay()],
      start: toScheduleDate(agendaForm.start),
      end: toScheduleDate(isRecurring ? agendaForm.end : agendaForm.start),
      time: startTime,
      vacancies,
      slots,
      municipalityId: agendaForm.municipalityId,
      municipalityName: municipality ? `${municipality.name}/${municipality.state}` : "",
      locationName: agendaForm.locationName,
      locationAddress: agendaForm.locationAddress,
      addressUrl: agendaForm.addressUrl,
      latitude: agendaForm.latitude,
      longitude: agendaForm.longitude,
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
    ai: [{ id: "ai", active: Boolean(aiSettings.active) }],
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
    municipalities: "Criar Municípios",
    users: "Criar Usuários",
    sectors: "Criar Setores",
    permissions: "Permissões",
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

      {configArea === "municipalities" && isGlobalRole(currentUser?.role) && (
        <div className="panel wide">
          <ConfigSectionHeader title="Municípios" createLabel="Cadastrar município" onCreate={() => openMunicipalityModal()}>
            <ConfigStatusFilter
              value={configStatusFilter}
              onChange={setConfigStatusFilter}
              activeCount={municipalities.filter((item) => item.active !== false).length}
              inactiveCount={municipalities.filter((item) => item.active === false).length}
            />
          </ConfigSectionHeader>
          <div className="config-editor-grid">
            {filteredMunicipalities.length === 0 && <EmptyState title="Nenhum município cadastrado" text="Cadastre um município para liberar um ambiente próprio." />}
            {filteredMunicipalities.map((municipality) => (
              <article className="request-type-card config-summary-card" key={municipality.id}>
                <div className="config-card-title">
                  <strong>{municipality.name}</strong>
                  <small className={municipality.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {municipality.active === false ? "Inativo" : "Ativo"}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{municipality.state || "UF não informada"}</span>
                </div>
                <ToggleSwitch
                  label="Município ativo"
                  checked={municipality.active !== false}
                  onChange={(checked) => patchMunicipality(municipality.id, { active: checked })}
                  onText="Ativo"
                  offText="Inativo"
                />
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => openMunicipalityModal(municipality)}>Editar</button>
                </div>
              </article>
            ))}
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
                  <span>{type.charged ? `Taxa: ${type.billingAmount || type.fee || "-"}` : "Gratuito"}</span>
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
                  <span className="config-card-description">{rule.description}</span>
                  <small className={rule.active ? "schedule-status active" : "schedule-status inactive"}>
                    {rule.active ? "Ativo" : "Inativo"}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{rule.kind || "Agenda"} - {rule.type}</span>
                  <span>{rule.start} a {rule.end}</span>
                  <span>{normalizeScheduleSlots(rule.slots, rule.time, rule.vacancies).map((slot) => `${slot.time}h (${slot.vacancies})`).join(" | ")}</span>
                  <span>Total: {sumScheduleSlotsVacancies(rule.slots, rule.time, rule.vacancies)} vagas/dia</span>
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
                const sectorMunicipalityId = getItemMunicipalityId(sector);
                const sectorUsers = dedupeMunicipalityItems(teams.users || []).filter((u) =>
                  getItemMunicipalityId(u) === sectorMunicipalityId && userBelongsToSector(u, sector.id)
                );
                return (
                  <article className="request-type-card config-summary-card" key={`${sectorMunicipalityId}:${sector.id}`}>
                    <div className="config-card-title">
                      <strong>{sector.name || "Setor sem nome"}</strong>
                      <small className={sector.active === false ? "schedule-status inactive" : "schedule-status active"}>
                        {sector.active === false ? "Inativo" : "Ativo"}
                      </small>
                    </div>
                    <div className="config-card-details">
                      <span>{sectorUsers.length} usuário(s) vinculado(s)</span>
                      {sectorUsers.length > 0 && <span>{sectorUsers.map((u) => u.name).join(", ")}</span>}
                      {sector.defaultMunicipalitySector && (
                        <span className="default-user-note">Setor padrão</span>
                      )}
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
            <ModalHeader title={editingSectorId ? "Editar setor" : "Criar setor"} onClose={() => { setSectorModal(false); setEditingSectorId(null); setEditingSectorMunicipalityId(""); }} />
            <div className="config-modal-options">
              <ConfigActiveToggle checked={newSectorActive} onChange={setNewSectorActive} />
            </div>
            <Field label="Nome do setor" value={newSectorName} placeholder="Ex: Triagem documental" onChange={setNewSectorName} />
            <label className="field">
              <span>Vincular usuários</span>
              <div className="team-user-checklist">
                {sectorModalUsers.length === 0 && (
                  <span className="helper-text">Nenhum usuário cadastrado ainda.</span>
                )}
                {sectorModalUsers.map((u) => (
                  <label key={`${getItemMunicipalityId(u)}:${u.id}`} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={pendingSectorUserIds.includes(u.id)}
                      onChange={() => setPendingSectorUserIds((current) =>
                        current.includes(u.id) ? current.filter((id) => id !== u.id) : [...current, u.id]
                      )}
                    />
                    {u.name}{getUserSectorIds(u).length ? ` (setores atuais: ${getUserSectorNames(u, teams.sectors || [])})` : ""}
                  </label>
                ))}
              </div>
            </label>
            <button className="primary-action" type="submit" disabled={!newSectorName.trim()}>{editingSectorId ? "Salvar" : "Criar setor"}</button>
          </form>
        </div>
      )}

      {configArea === "permissions" && (
        <div className="panel wide">
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
            {filteredPermissionGroups.map((group) => {
              const linkedUsers = (teams.users || []).filter((user) => user.permissionGroupId === group.id);
              return (
                <article className="request-type-card config-summary-card" key={group.id}>
                  <div className="config-card-title">
                    <strong>{group.name || "Grupo sem nome"}</strong>
                    <small className={group.active === false ? "schedule-status inactive" : "schedule-status active"}>
                      {group.active === false ? "Inativo" : "Ativo"}
                    </small>
                  </div>
                  <div className="config-card-details">
                    <span>{linkedUsers.length} usuário(s) vinculado(s)</span>
                    <span>Menus: {(group.allowedMenuItems || []).length || 0}</span>
                    <span>Configurações: {(group.allowedConfigItems || []).length || 0}</span>
                    {group.municipalityName && <span>{group.municipalityName}</span>}
                  </div>
                  <ToggleSwitch
                    label="Grupo ativo"
                    checked={group.active !== false}
                    onChange={(checked) => patchPermissionGroup(group.id, { active: checked })}
                    onText="Ativo"
                    offText="Inativo"
                  />
                  <div className="form-actions">
                    <button className="ghost-button" type="button" onClick={() => openPermissionModal(group)}>Editar</button>
                  </div>
                </article>
              );
            })}
          </div>
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
                return (
                <article className="request-type-card config-summary-card" key={`${getItemMunicipalityId(user)}:${user.id}`}>
                  <div className="config-card-title">
                    <strong>{user.name || "Usuário sem nome"}</strong>
                    <small className={user.active === false ? "schedule-status inactive" : "schedule-status active"}>
                      {user.active === false ? "Inativo" : "Ativo"}
                    </small>
                  </div>
                  <div className="config-card-details">
                    <span>E-mail: {user.email || "Não informado"}</span>
                    <span>Cargo: {user.role || "Analista"}</span>
                    <span>Município: {getMunicipalityLabel(user.municipalityId, municipalities)}</span>
                    <span>Setores: {getUserSectorNames(user, teams.sectors || [])}</span>
                    <span>Permissão: {permissionGroups.find((group) => group.id === user.permissionGroupId)?.name || "Sem grupo"}</span>
                    {user.defaultMunicipalityUser && (
                      <span className="default-user-note">Usuário padrão</span>
                    )}
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

      {permissionModal && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={(event) => { event.preventDefault(); createPermissionGroup(); }}>
            <ModalHeader
              title={editingPermissionGroupId ? "Editar grupo de permissão" : "Criar grupo de permissão"}
              onClose={() => { setPermissionModal(false); setEditingPermissionGroupId(null); setNewPermissionGroup(emptyPermissionGroup); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newPermissionGroup.active !== false}
                onChange={(active) => setNewPermissionGroup((current) => ({ ...current, active }))}
              />
            </div>
            <Field
              label="Nome do grupo"
              value={newPermissionGroup.name}
              placeholder="Ex: Triagem documental"
              onChange={(value) => setNewPermissionGroup((current) => ({ ...current, name: value }))}
            />
            <section className="agenda-modal-block">
              <strong>Menus liberados</strong>
              <div className="team-user-checklist">
                {permissionMenuItems.map((item) => (
                  <label key={item.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={(newPermissionGroup.allowedMenuItems || []).includes(item.id)}
                      onChange={() => togglePermissionList("allowedMenuItems", item.id)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </section>
            <section className="agenda-modal-block">
              <strong>Áreas de configuração</strong>
              <div className="team-user-checklist">
                {permissionConfigItems.filter((item) => !item.globalOnly || isGlobalRole(currentUser?.role)).map((item) => (
                  <label key={item.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={(newPermissionGroup.allowedConfigItems || []).includes(item.id)}
                      onChange={() => togglePermissionList("allowedConfigItems", item.id)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </section>
            <button className="primary-action" type="submit" disabled={!newPermissionGroup.name?.trim()}>
              {editingPermissionGroupId ? "Salvar grupo" : "Criar grupo"}
            </button>
          </form>
        </div>
      )}

      {userModal && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={async (e) => { e.preventDefault(); setUserSaveError(""); if (await createTeamUser()) setUserModal(false); }}>
            <ModalHeader title={editingTeamUserId ? "Editar usuário" : "Criar usuário"} onClose={() => { setUserModal(false); setEditingTeamUserId(null); setSectorPickerOpen(false); setUserSaveError(""); }} />
            <div className="config-modal-options">
              <ConfigActiveToggle checked={newTeamUser.active !== false} onChange={(active) => setNewTeamUser((c) => ({ ...c, active }))} />
            </div>
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
            <button className="primary-action" type="submit" disabled={!newTeamUser.name.trim() || !newTeamUser.email.trim() || !newTeamUser.municipalityId || (!editingTeamUserId && !newTeamUser.senha)}>
              {editingTeamUserId ? "Salvar" : "Criar usuário"}
            </button>
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

      {configArea === "environment" && configTab === "ai" && (
        <div className="panel wide">
          <PanelHeader title="IA externa para documentos" />
          <div className="ai-settings-layout">
            <article className="request-type-card ai-settings-card">
              <div className="config-modal-options">
                <ConfigActiveToggle
                  checked={Boolean(aiSettings.active)}
                  onChange={(checked) => setAiSettings?.((current) => ({ ...current, active: checked }))}
                  onText="Ativa"
                  offText="Inativa"
                />
              </div>
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

      {configArea === "environment" && configTab === "whatsapp" && (
        <div className="panel wide">
          <PanelHeader title="WhatsApp por município" />
          <div className="ai-settings-layout">
            <article className="request-type-card ai-settings-card">
              <div className="config-modal-options">
                <ConfigActiveToggle
                  checked={Boolean(whatsappSettings.active)}
                  onChange={(checked) => setWhatsappSettings((current) => ({ ...current, active: checked }))}
                />
              </div>
              <label className="field">
                <span>Provedor</span>
                <select
                  value={whatsappSettings.provider || "cloud_api"}
                  onChange={(event) => setWhatsappSettings((current) => ({ ...current, provider: event.target.value }))}
                >
                  <option value="cloud_api">WhatsApp Cloud API</option>
                  <option value="manual">Link manual / futuro</option>
                </select>
              </label>
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
              <Field
                label="Idioma do template"
                value={whatsappSettings.languageCode || ""}
                placeholder="pt_BR"
                onChange={(value) => setWhatsappSettings((current) => ({ ...current, languageCode: value }))}
              />
              <Field
                label="Variáveis do template"
                value={(Array.isArray(whatsappSettings.templateVariables) ? whatsappSettings.templateVariables : initialWhatsappSettings.templateVariables).join(", ")}
                placeholder="tutor_name, schedule_date"
                onChange={(value) => setWhatsappSettings((current) => ({
                  ...current,
                  templateVariables: value.split(",").map((variable) => variable.trim()).filter(Boolean),
                }))}
              />
            </article>
            <article className="ai-rules-card">
              <strong>Mensagem enviada ao avançar</strong>
              <p>
                Quando os documentos forem deferidos e o processo avançar para procedimento, o sistema usa a configuração
                do município da solicitação para enviar a confirmação de agenda ao telefone do tutor.
              </p>
              <p>
                Cada município deve informar seu próprio número remetente, token e template aprovado. Se não houver
                configuração, o deferimento continua e o histórico registra que o WhatsApp não foi enviado.
              </p>
              <label className="field">
                <span>Token permanente / chave de acesso</span>
                <input
                  value={whatsappSettings.accessToken || ""}
                  type="password"
                  placeholder={whatsappSettings.hasAccessToken ? "Token já salvo" : "Cole o token da Cloud API"}
                  onChange={(event) => setWhatsappSettings((current) => ({ ...current, accessToken: event.target.value }))}
                />
              </label>
              <button className="primary-action ai-save-key-action" type="button" onClick={saveWhatsappSettings} disabled={!configMunicipalityScopeId}>
                Salvar WhatsApp
              </button>
              {whatsappSaveStatus && <p className={whatsappSaveStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{whatsappSaveStatus}</p>}
            </article>
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "whatsapp" && (
        <div className="panel wide">
          <PanelHeader title="Cota de envios" />
          <div className="ai-settings-layout">
            <article className="request-type-card ai-settings-card">
              <Field
                label="Limite mensal de mensagens"
                value={quotaSettings.plan}
                placeholder="Ex: 500"
                onChange={(value) => setQuotaSettings((current) => ({ ...current, plan: value }))}
              />
              <label className="field">
                <span>Início do contrato</span>
                <input
                  type="date"
                  value={quotaSettings.contractStart}
                  onChange={(event) => setQuotaSettings((current) => ({ ...current, contractStart: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Fim do contrato</span>
                <input
                  type="date"
                  value={quotaSettings.contractEnd}
                  onChange={(event) => setQuotaSettings((current) => ({ ...current, contractEnd: event.target.value }))}
                />
              </label>
              <button className="primary-action ai-save-key-action" type="button" onClick={saveQuotaSettings} disabled={!configMunicipalityScopeId}>
                Salvar cota
              </button>
              {quotaSaveStatus && <p className={quotaSaveStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{quotaSaveStatus}</p>}
            </article>
            <article className="ai-rules-card">
              <strong>Controle de envios mensais</strong>
              <p>
                Defina o limite máximo de mensagens WhatsApp que podem ser enviadas por mês para este município.
                O sistema bloqueia automaticamente novos envios ao atingir o limite, sem interromper o deferimento.
              </p>
              <p>
                As datas de contrato são opcionais. Se informadas, envios fora do período são bloqueados e registrados no histórico da solicitação.
              </p>
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

      {configModal === "municipality" && (
        <div className="modal-backdrop">
          <form
            className="config-modal compact"
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
                setNewMunicipality({ name: "", state: "", active: true });
              }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newMunicipality.active !== false}
                onChange={(checked) => setNewMunicipality((current) => ({ ...current, active: checked }))}
              />
            </div>
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
            {municipalitySaveStatus && (
              <p className={municipalitySaveStatus.includes("Não") || municipalitySaveStatus.includes("Selecione") ? "form-error" : "helper-text"}>
                {municipalitySaveStatus}
              </p>
            )}
            <div className="form-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setConfigModal(null);
                  setEditingMunicipalityId(null);
                  setMunicipalitySaveStatus("");
                  setNewMunicipality({ name: "", state: "", active: true });
                }}
              >
                Cancelar
              </button>
              <button className="primary-action" type="submit" disabled={municipalitySaving || !newMunicipality.name.trim() || !newMunicipality.state.trim()}>
                {municipalitySaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {configModal === "agenda" && (
        <div className="modal-backdrop">
          <form className="config-modal" onSubmit={createScheduleFromModal} role="dialog" aria-modal="true">
            <ModalHeader
              title={editingScheduleRuleId ? "Editar agenda" : "Criar agenda"}
              onClose={() => { setConfigModal(null); setEditingScheduleRuleId(null); setAgendaForm(emptyAgendaForm); setAgendaSaving(false); setAgendaSaveStatus(""); }}
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
                  <Field label="Local de atendimento" value={agendaForm.locationName} placeholder="Ex: Centro de zoonoses" onChange={(value) => patchAgendaForm("locationName", value)} />
                  <Field label="Endereço do local" value={agendaForm.locationAddress} placeholder="Ex: Rua Araranguá, 333 - Centro" onChange={(value) => patchAgendaForm("locationAddress", value)} />
                  <Field label="Link do endereço" value={agendaForm.addressUrl} placeholder="Cole o link do Google Maps" onChange={(value) => patchAgendaForm("addressUrl", value)} />
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
                </div>
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
            </div>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setConfigModal(null); setEditingScheduleRuleId(null); setAgendaForm(emptyAgendaForm); setAgendaSaving(false); setAgendaSaveStatus(""); }}>
                Cancelar
              </button>
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
            <div className="request-type-steps-section">
              <span className="request-type-steps-label">Etapas do cadastro</span>
              <div className="request-type-steps-toggles">
                <label className="toggle-switch config-active-toggle">
                  <input
                    type="checkbox"
                    checked={newRequestType.stepTutor !== false}
                    onChange={(e) => setNewRequestType((current) => ({ ...current, stepTutor: e.target.checked }))}
                  />
                  <span className="toggle-track"><span className="toggle-thumb" /></span>
                  <span>Dados do tutor</span>
                </label>
                <label className="toggle-switch config-active-toggle">
                  <input
                    type="checkbox"
                    checked={newRequestType.stepAgenda !== false}
                    onChange={(e) => setNewRequestType((current) => ({ ...current, stepAgenda: e.target.checked }))}
                  />
                  <span className="toggle-track"><span className="toggle-thumb" /></span>
                  <span>Agenda</span>
                </label>
                <label className="toggle-switch config-active-toggle">
                  <input
                    type="checkbox"
                    checked={newRequestType.stepDocuments !== false}
                    onChange={(e) => setNewRequestType((current) => ({ ...current, stepDocuments: e.target.checked }))}
                  />
                  <span className="toggle-track"><span className="toggle-thumb" /></span>
                  <span>Documentos</span>
                </label>
              </div>
            </div>
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
                checked={newDocument.required !== false}
                onChange={(checked) => setNewDocument((current) => ({ ...current, required: checked }))}
                onText="Obrigatório"
                offText="Opcional"
              />
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

function SimpleConfigList({ title, items, allItems = items, filterValue = "active", onFilterChange, onCreate, onEdit, onPatch, showDescription = false }: AnyRecord) {
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

function AnimalRecordPanel({ record, cpf, validationKey, onRequestCreated }: AnyRecord) {
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

  return (
    <section className="animal-record-panel">
      <div className="animal-record-header">
        <div className="animal-record-identity">
          <div className="animal-record-avatar" aria-hidden="true">
            <AnimalIcon size={28} />
          </div>
          <div>
            <span className="eyebrow">Prontuário global por microchip</span>
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
          <button className="ghost-button animal-export-action" type="button" onClick={() => printAnimalRecordPdf(animal, tutor, history)}>
            <Download size={16} />
            Exportar
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

      <div className="animal-record-actions">
        <div>
          <strong>Ações do prontuário</strong>
          <span>Abra novas solicitações vinculadas ao microchip.</span>
        </div>
        <button className="primary-action" type="button" onClick={() => { setProcedureOpen((value) => !value); setDeathOpen(false); setTransferOpen(false); }}>
          <ClipboardCheck size={17} />
          Solicitar procedimento
        </button>
        <div className="animal-record-secondary-actions">
          <button className="secondary-action" type="button" onClick={() => { setTransferOpen((value) => !value); setProcedureOpen(false); setDeathOpen(false); }}>
            <RefreshCw size={16} />
            Troca de tutor
          </button>
          <button className="secondary-action danger-soft" type="button" onClick={() => { setDeathOpen((value) => !value); setProcedureOpen(false); setTransferOpen(false); }}>
            <AlertCircle size={16} />
            Registrar óbito
          </button>
        </div>
      </div>

      {procedureOpen && (
        <div className="modal-backdrop">
          <form className="workflow-modal animal-action-modal" onSubmit={submitProcedure} role="dialog" aria-modal="true">
            <ModalHeader title="Solicitar procedimento" subtitle={animal.name || undefined} onClose={() => setProcedureOpen(false)} />
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

  const statusIcon = {
    approved: <BadgeCheck size={16} className="doc-status-icon is-ok" />,
    rejected: <AlertCircle size={16} className="doc-status-icon is-err" />,
    checking: <RefreshCw size={14} className="doc-status-icon is-spin" />,
    attached: <Paperclip size={15} className="doc-status-icon is-att" />,
  }[upload?.status] || <FileText size={15} className="doc-status-icon is-empty" />;

  return (
    <article className={`doc-row ${upload?.status || "empty"}`}>
      <div className="doc-row-icon">{statusIcon}</div>
      <div className="doc-row-info">
        <strong>{document.name}{document.required && <span className="doc-required">*</span>}</strong>
        {upload?.fileName
          ? <small>{upload.fileName}</small>
          : <small className="doc-row-hint">{statusLabel}</small>
        }
        {upload?.message && <small className="doc-row-msg">{upload.message}</small>}
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
  );
}

async function validateDocumentWithAI(document: AnyRecord, file: File, aiSettings: AnyRecord = initialAiSettings, dataUrl = ""): Promise<AnyRecord> {
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

function validateDocumentLocally(document: AnyRecord, file: File, aiSettings: AnyRecord = initialAiSettings): Promise<AnyRecord> {
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
      message: "Arquivo anexado. Aguardando validação.",
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
        <span class="kicker">Prontuário Animal</span>
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
  .kicker, .section-title, .header-box span, .data-item span { font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
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

async function generateDocumentBundlePdf(request: AnyRecord = {}) {
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

async function generateFallbackBundlePdf(request: AnyRecord = {}, error = null) {
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

async function createRequestPdfDataUrl(request: AnyRecord = {}) {
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
  const pageSize: [number, number] = [595.28, 841.89];
  const validationKey = request.validationKey || request.validation_key || "A definir";
  const animals = Array.isArray(request.animals) ? request.animals : [];
  const signedAt = request.signedAt || request.signed_at || request.createdAt || request.created_at || new Date().toISOString();
  const scheduleAddress = [
    request.scheduleLocationName || request.locationName,
    request.scheduleAddress || request.schedule_address,
    request.scheduleMunicipality || request.municipalityName || request.city,
  ].filter(Boolean).join(" - ");
  const scheduleMapUrl = request.scheduleAddressUrl || request.schedule_address_url || "";

  const page1 = pdf.addPage(pageSize);
  let y = drawRequestPdfHeader(page1, "REQUERIMENTO MUNICIPAL", "Solicitação de castração animal", request.protocol || "-", ctx);
  y = drawRequestPdfSectionTitle(page1, "Agendamento", y, ctx);
  y = drawRequestPdfInfoGrid(page1, [
    ["DATA DA AGENDA", request.preferredSchedule || request.appointment || "-"],
    ["PROCEDIMENTO", requestTypeLabel(request)],
    ["POSTO / LOCAL DE ATENDIMENTO", scheduleAddress || "A confirmar", 2],
    ["ABERTURA", request.createdAt ? formatDateTime(request.createdAt) : new Date().toLocaleDateString("pt-BR")],
    ["LINK DO MAPA", scheduleMapUrl || "-", 4],
  ], y, { ...ctx, columns: 4, valueMaxChars: 118, rowHeight: 42, boxHeight: 32 });
  y = drawRequestPdfSectionTitle(page1, "Dados do tutor", y - 4, ctx);
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
  ], y, { ...ctx, columns: 3, wideLast: true, rowHeight: 42, boxHeight: 32 });
  y = drawRequestPdfSectionTitle(page1, `Animais (${animals.length})`, y - 4, ctx);
  for (const [index, animal] of animals.slice(0, 2).entries()) {
    y = drawRequestPdfAnimalCard(page1, animal, index, y, ctx);
  }
  y = drawRequestPdfSectionTitle(page1, "Validação", y - 2, ctx);
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
    ["JÁ TEVE CRIA", animal.hadLitter || "-"],
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



function getCurrentScheduleMonthKey() {
  const today = new Date();
  return `${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
}

function getScheduleMonthKey(dateText) {
  const [, month, year] = normalizeScheduleDateText(dateText).split("/");
  if (!month || !year) return "";
  return `${month}/${year}`;
}

function parseScheduleDate(dateText) {
  const [day, month, year] = normalizeScheduleDateText(dateText).split("/").map(Number);
  return new Date(year, month - 1, day).getTime();
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

function isPastScheduleDay(dateText) {
  const date = parseScheduleDate(dateText);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today.getTime();
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

