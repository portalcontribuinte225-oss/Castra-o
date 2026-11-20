import React, { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "./api";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
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
  Navigation,
  PawPrint,
  Plus,
  PlusCircle,
  ClipboardList,
  RefreshCw,
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
  X,
  Paperclip,
  Trash2,
  AlertCircle,
  ImagePlus,
  BadgeCheck,
} from "lucide-react";
import "./styles.css";
import { HeroCard } from "./features/public-home/hero-card";
import { PublicMetrics } from "./features/public-home/public-metrics";
import type { AnyRecord } from "./types";
import {
  CONFIG_KEYS,
  CONFIG_KEYS_LIST,
  GLOBAL_MUNICIPALITY_FILTER_KEY,
  accessRequesterTypes,
  aiProviderOptions,
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
  initialBreeds,
  initialNeighborhoods,
  initialDocumentTypes,
  initialMunicipalities,
  initialRequestTypes,
  initialScheduleDays,
  initialScheduleRules,
  initialSizes,
  initialSpecies,
  initialTeams,
  isPastScheduleDay,
  mergeTags,
  normalizeDocumentType,
  normalizeRequest,
  normalizeRequestStatus,
  normalizeScheduleDateText,
  normalizeScheduleDay,
  normalizeScheduleSlots,
  parseScheduleDate,
  requestHasTag,
  requestResultLabel,
  requestResultTag,
  animalProcedureLabels,
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
  ConfigField,
  ConfigRow,
  ConfigSectionHeader,
  ConfigStatusFilter,
  configTextareaStyle,
  EmptyState,
  Field,
  InfoTile,
  ModalHeader,
  PanelHeader,
  StatusBadge,
} from "./components/ui";
import { Button } from "./components/button";
import { Card } from "./components/card";
import { CloseButton } from "./components/close-button";
import { ConfigDialogBackdrop } from "./components/config-dialog";
import { Input } from "./components/input";
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
  isMasterRole,
  isValidCpf,
  maskCpf,
  normalizeSearchKey,
  normalizeText,
  onlyDigits,
  readFileAsDataUrl,
  uint8ArrayToDataUrl,
} from "./utils";
import { AccessRequestsView, accessStatusLabel } from "./features/accessRequests";
import { AgendaView } from "./features/agenda";
import { canEditRequests, useRequestActions } from "./features/request-actions";
import { ProcessModal } from "./features/process-modal/process-modal";
import { PDF_BASE_STYLES, printHtmlViaIframe } from "./features/process-report/print-html";
import { ReportsView } from "./features/reports";
import { ActiveFiltersBar } from "./features/request-filters/active-filters-bar";
import { ACCESS_REQUEST_SOURCE, getEmptyListMessage } from "./features/request-filters/request-filters";
import { RequestFiltersDrawer } from "./features/request-filters/request-filters-drawer";
import { RequestFiltersToolbar } from "./features/request-filters/request-filters-toolbar";
import { useRequestFilterResults, useRequestFilters } from "./features/request-filters/use-request-filters";
import { BreedChecklist } from "./features/breeds/breed-checklist";
import { AnimalAccordionCard } from "./features/request-procedures/animal-accordion-card";
import { AnimalFields } from "./features/request-procedures/animal-fields";
import { RequestProcedureList } from "./features/request-procedures/request-procedure-list";
import {
  animalHeader,
  applyProceduresToAll,
  blankAnimal,
  breedOptionsFor,
  duplicateAnimal,
  mergeProcedureDocuments,
  needsProcedure,
  procedureNames,
  procedureSignature,
  withProceduresAt,
} from "./features/request-procedures/request-procedures";
import { animalRequestTypeIds, combineRequestFees, deriveRequestTypeFields, isRequestFeeCharged, isRequestTypeCharged, resolveRequestTypes } from "../shared/request-types-contract.js";
import { renderDeclaration } from "../shared/request-declaration-contract.js";
import { isProcedureRequest, RequestOrigin } from "../shared/request-contract.js";
import { readAccessLink } from "../shared/request-access-contract.js";
import { RequestAcceptance, requestAcceptance } from "./features/request-document/request-acceptance";
import { BreedsConfig } from "./features/breeds/breeds-config";
import { NeighborhoodsConfig } from "./features/neighborhoods/neighborhoods-config";
import { MunicipalityAddressFields } from "./features/municipality-form/municipality-address-fields";
import { MunicipalityImageField } from "./features/municipality-form/municipality-image-field";
import { emptyMunicipalityForm, formFromMunicipality, municipalityContactIssue } from "./features/municipality-form/municipality-address";
import type { MunicipalityForm } from "./features/municipality-form/municipality-address";
import { findNeighborhoodName, neighborhoodNames } from "./features/neighborhoods/neighborhoods";
import { RequestStep, requestSteps } from "./features/request-steps/request-steps";
import { RequestFormLayout } from "./features/request-steps/request-form-layout";
import { availableFollowUpContacts, buildFollowUpPayload, emptyFollowUp, getFollowUpIssues } from "./features/request-follow-up/follow-up";
import type { FollowUpValue } from "./features/request-follow-up/follow-up";
import { useFollowUpPolicy } from "./features/request-follow-up/use-follow-up-policy";
import { RequesterStep } from "./features/request-requester/requester-step";
import { RequestDoneCard } from "./features/request-requester/request-done-card";
import { MUNICIPALITY_OPTION } from "./features/registered-animals/use-request-options";
import { WhatsappIntegrationTab } from "./features/whatsapp-integration/whatsapp-integration-tab";
import { AnimalTutorship, tutorshipRequiresTutor } from "../shared/request-tutorship-contract.js";
import { resolveRequestProcedures } from "../shared/request-procedure-contract.js";
import { historyBlocks, reportPrescriptions } from "./features/process-report/process-report";
import type { ReportBlock } from "./features/process-report/process-report";
import { useSession } from "./features/tutor-access/use-session";
import { AuthEntry } from "./features/tutor-access/auth-entry";
import { AuthEntryOrigin, authEntryKey, createAuthEntryContext } from "./features/tutor-access/auth-entry-context";
import type { AuthEntryContext } from "./features/tutor-access/auth-entry-context";
import { SmsSettings } from "./features/sms/sms-settings";
import { EmailIntegrationTab } from "./features/email/email-integration-tab";
import { IntegrationConfigItem } from "../shared/config-permission-contract.js";
import { canUseIntegration, integrationTabItems } from "./features/integrations/integration-access";
import { animalHistoryTone, getAnimalHistoryMunicipality, getAnimalHistorySchedule } from "./features/animal-services/animal-history";
import type { AnimalRecord } from "./features/animal-services/animal-service-types";
import { RequestTracking } from "./features/request-tracking/request-tracking";
import { RequestAccess } from "./features/request-access/request-access";
import { PublicReportPanel } from "./features/complaint/public-report-panel";
import { registrationContactIssues } from "./features/tutor-access/registration-contact-fields";
import { PasswordChangeForm } from "./features/tutor-access/password-change-form";
import { TutorArea } from "./features/tutor-access/tutor-area";
import { TutorDataTab } from "./features/tutor-data/tutor-data-tab";

import { stripEphemeralCredentials, stripMunicipalityBootstrap } from "./features/tutor-access/submission-envelope";
import { validateTutorName } from "./features/tutor-access/tutor-identity";
import { SessionBoundary } from "./features/tutor-access/session-boundary";
import { getAdoptionInterestCount } from "./features/adoption-interest-count";
import { ADOPTION_STATUS_ADOPTED, ADOPTION_STATUS_AVAILABLE, ADOPTION_STATUS_IN_PROGRESS } from "./features/adoption-status";
import { MAX_ADOPTION_PHOTO_BYTES } from "../shared/adoption-contract.js";
import { ShareAdoptionButton, ShareButtonLook } from "./features/adoption-share/share-adoption-button";
import { SharedAdoptionState, useSharedAdoption } from "./features/adoption-share/use-shared-adoption";
import { SharedAdoptionNotice } from "./features/adoption-share/shared-adoption-notice";
import { compressAdoptionPhoto } from "./features/adoption-share/compress-adoption-photo";
import { bindProcedureIntent } from "./features/registered-animals/procedure-intent";
import type { ProcedureIntent } from "./features/registered-animals/procedure-intent";
import type { ReusableDocumentCandidate } from "./features/registered-animals/registered-animal-types";
import { buildRequestPayload } from "./features/registered-animals/request-payload";
import { animalForRequest, pickReusableDocuments } from "./features/registered-animals/registered-request-data";
import { RegisteredRequestSelection } from "./features/registered-animals/registered-request-selection";
import { ReusableDocumentChoices } from "./features/registered-animals/reusable-document-choices";
import { ReusableDocumentPreview } from "./features/registered-animals/reusable-document-preview";
import { getAvailableScheduleSlot, selectScheduleOccurrence, useScheduleAvailability } from "./features/registered-animals/use-schedule-availability";
import { DocumentReuseScope, DocumentReviewStatus, normalizeDocumentReusePolicy } from "../shared/document-reuse-contract.js";
import { documentPolicyFromForm } from "./features/registered-animals/document-policy-form";
import { buildDocumentSubmission, removeReusedDocument } from "./features/registered-animals/document-selection";

// The dashboard and its chart library load only when someone opens it, so the public form does not carry them.
const DashboardView = lazy(() => import("./features/dashboard/dashboard-view").then((module) => ({ default: module.DashboardView })));

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
  { id: "breeds", label: "Raças" },
  { id: "neighborhoods", label: "Bairros" },
  { id: "documents", label: "Documentos Solicitados" },
];

const integrationsConfigTabs: ConfigTabItem[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "E-mail" },
  { id: "sms", label: "SMS" },
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
  { id: IntegrationConfigItem.WHATSAPP, label: "Aba WhatsApp" },
  { id: IntegrationConfigItem.EMAIL, label: "Aba E-mail" },
  { id: IntegrationConfigItem.SMS, label: "Aba SMS" },
  { id: "ai_settings", label: "Configurar IA" },
];

function filterVisibleConfigTabs(tabs: ConfigTabItem[] = [], currentUser: AnyRecord, canUsePermissions: boolean, currentPermissionGroup: AnyRecord): ConfigTabItem[] {
  return tabs.filter((tab) => {
    if (tab.globalOnly && !isGlobalRole(currentUser?.role)) return false;
    if (tab.aiSettingsOnly) {
      if (canUsePermissions) return Boolean(currentPermissionGroup?.allowedConfigItems?.includes("ai_settings"));
      return canManageAiSettings(currentUser?.role);
    }
    const integrationItem = integrationTabItems[tab.id];
    if (integrationItem && !canUseIntegration(canUsePermissions, currentPermissionGroup, integrationItem, canManageAiSettings(currentUser?.role))) return false;
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
  const session = useSession();
  const [procedureIntent, setProcedureIntent] = useState<ProcedureIntent | null>(null);
  const accept = useCallback((user) => { setProcedureIntent((current) => bindProcedureIntent(current, user)); session.accept(user); }, [session.accept]);
  const logout = useCallback(() => { setProcedureIntent(null); session.logout(); }, [session.logout]);
  useEffect(() => { if (session.ready && !session.user) setProcedureIntent((current) => current?.ownerId ? null : current); }, [session.ready, session.user]);
  return <SessionBoundary session={{ ...session, accept, logout }}
    renderTutor={(user) => <TutorArea key={user.id} user={user} intent={procedureIntent} onIntentConsumed={() => setProcedureIntent(null)} onSession={accept} onLogout={logout} downloadRecordPdf={downloadAnimalRecordPdf} createRequirement={createRequestPdfDataUrl} renderRequests={(rows) => <TutorDashboard requests={rows} currentUser={user} />}
      renderForm={(input) => <NewRequest key={input.context?.animal.id || "new-animal"} createRequest={(payload) => api.createRequest(buildRequestPayload(payload, user))} currentUser={user} selectedMunicipalityId={user.municipalityId || ""} initialMunicipalityId={user.municipalityId || ""} municipality={input.options[MUNICIPALITY_OPTION]} initialSchedule={input.intent?.schedule || ""} initialType={input.context?.requestTypes.find((type) => type.id === input.requestTypeId)?.name || input.intent?.requestTypeId || ""} onBack={input.onBack} onDone={input.onDone}
        requestTypes={input.context?.requestTypes || input.options[CONFIG_KEYS.requestTypes] || []} documentTypes={input.context?.documentTypes || input.options[CONFIG_KEYS.documentTypes] || []} speciesOptions={input.options[CONFIG_KEYS.species] || []} sizeOptions={input.options[CONFIG_KEYS.sizes] || []} breeds={input.options[CONFIG_KEYS.breeds] || []} neighborhoods={input.options[CONFIG_KEYS.neighborhoods] || []} aiSettings={input.options.ai || initialAiSettings} registeredContext={input.context} contextLoading={input.contextLoading} onRequestTypeChange={input.onRequestTypeChange} />}
    />}
    renderWorkspace={(user) => <ApplicationWorkspace key={user?.id || "public"} currentUser={user} setCurrentUser={accept} onProcedureIntent={setProcedureIntent} />} />;
}

function ApplicationWorkspace({ currentUser, setCurrentUser, onProcedureIntent }: AnyRecord) {
  const [active, setActive] = useState("admin");
  const [configArea, setConfigArea] = useState("");
  const [configTab, setConfigTab] = useState("agenda");
  const [requests, setRequests] = useState([]);
  const [adoptionAnimals, setAdoptionAnimals] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [speciesOptions, setSpeciesOptions] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
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
  const [accessLink, setAccessLink] = useState(() => readAccessLink(window.location.search));
  const [globalMunicipalityFilterId, setGlobalMunicipalityFilterId] = useState(localStorage.getItem(GLOBAL_MUNICIPALITY_FILTER_KEY) || "");
  const geoTriedRef = useRef(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  // The settings item whose tabs are listed open in the sidebar (Ambiente or Integrações); opening it does not change the screen.
  const [expandedConfigItem, setExpandedConfigItem] = useState("");
  const [tenantConfigReady, setTenantConfigReady] = useState(false);
  const [loadedConfigKeys, setLoadedConfigKeys] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [sidebarResetOpen, setSidebarResetOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // A shared adoption link opens the public page on the animal; whoever is signed in sees the app as usual.
  const sharedAdoption = useSharedAdoption(!currentUser, handleMunicipalitySelect);

  const selected = requests.find((request) => request.id === selectedId) || requests[0] || null;
  const metrics = useMemo(() => buildMetrics(requests), [requests]);

  useEffect(() => {
    if (accessLink) window.history.replaceState(window.history.state, "", window.location.pathname);
    api.getAdoptions().then((list) => setAdoptionAnimals(list.map(normalizeAdoptionAnimal))).catch(console.error);
    api.getMunicipalities().then((list) => {
      const active = Array.isArray(list) ? list : [];
      setMunicipalities(active);
      if (geoTriedRef.current || !active.length) return;
      geoTriedRef.current = true;
      const linked = accessLink?.slug ? active.find((m) => m.slug === accessLink.slug) : null;
      if (linked) {
        setSelectedMunicipalityId(linked.id);
        localStorage.setItem("castragestao:municipalityId", linked.id);
        return;
      }
      const stored = localStorage.getItem("castragestao:municipalityId");
      if (stored && active.some((m) => m.id === stored)) {
        setSelectedMunicipalityId(stored);
        return;
      }
      // The animal of a shared link decides the municipality; guessing it from the location would race with it.
      if (sharedAdoption.id) return;
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
    localStorage.removeItem(GLOBAL_MUNICIPALITY_FILTER_KEY);
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
          setBreeds(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.breeds], municipality)));
          setNeighborhoods(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.neighborhoods], municipality)));
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
      [CONFIG_KEYS.breeds, setBreeds],
      [CONFIG_KEYS.neighborhoods, setNeighborhoods],
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
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.neighborhoods]) api.setConfig(CONFIG_KEYS.neighborhoods, neighborhoods).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, neighborhoods]);
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

  // The tutor data saved in an attendance also changes the requests in progress, so the list is read again.
  const refreshRequests = useCallback(() => {
    api.getRequests().then((list) => setRequests(list.map(normalizeRequest))).catch(console.error);
  }, []);

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

  async function runProcedureAction(requestId, action) {
    const updated = await api.runProcedureAction(requestId, action);
    setRequests((current) => current.map((r) => (r.id === updated.id ? normalizeRequest(updated) : r)));
    return updated;
  }

  async function createRequest(payload) {
    try {
      const newRequest = await api.createRequest(buildRequestPayload(payload, currentUser));
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

    return { accessRequest: normalized, credential: updated.credential };
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
    onProcedureIntent(null);
    setSelectedMunicipalityId(id);
    localStorage.setItem("castragestao:municipalityId", id);
  }

  function closeSidebarReset() { setSidebarResetOpen(false); }

  function handleGlobalMunicipalityFilter(id) {
    setGlobalMunicipalityFilterId(id);
    if (id) {
      localStorage.setItem(GLOBAL_MUNICIPALITY_FILTER_KEY, id);
    } else {
      localStorage.removeItem(GLOBAL_MUNICIPALITY_FILTER_KEY);
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
          onLogin={(user) => { setAccessLink(null); setCurrentUser(user); }}
          accessLink={accessLink}
          onProcedureIntent={onProcedureIntent}
          onAccessRequest={createAccessRequest}
          adoptionAnimals={adoptionAnimals}
          sharedAdoption={sharedAdoption}
          onInterestSent={handleInterestSent}
          municipalities={municipalities}
          selectedMunicipalityId={selectedMunicipalityId}
          onMunicipalitySelect={handleMunicipalitySelect}
          createRequest={createRequest}
          scheduleDays={scheduleDays}
          requestTypes={requestTypes}
          documentTypes={documentTypes}
          speciesOptions={speciesOptions}
          sizeOptions={sizeOptions}
          breeds={breeds}
          neighborhoods={neighborhoods}
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
  const scopedBreeds = filterByMunicipalityScope(breeds, scopedMunicipalityId);
  const scopedNeighborhoods = filterByMunicipalityScope(neighborhoods, scopedMunicipalityId);
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
                  aria-expanded={item.id === "config" ? configMenuOpen : undefined}
                  aria-controls={item.id === "config" && configMenuOpen ? "settings-navigation" : undefined}
                  onClick={() => {
                    if (item.id === "config") {
                      setConfigMenuOpen((open) => !open);
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
                {item.id === "config" && configMenuOpen && (
                  <div className="sidebar-subnav" id="settings-navigation" role="group" aria-label="Subabas de configurações">
                    {visibleConfigSidebarItems.map((subitem) => {
                      const subitemTabs = subitem.id === "environment"
                        ? visibleEnvironmentTabs
                        : subitem.id === "integrations"
                          ? visibleIntegrationsTabs
                          : [];
                      const hasTabs = subitemTabs.length > 0;
                      const showing = active === "config" && configArea === subitem.id;
                      const expanded = expandedConfigItem === subitem.id;
                      return (
                        <React.Fragment key={subitem.id}>
                          <Button
                            variant="custom"
                            className="tw:w-full tw:justify-start tw:gap-2 tw:border-transparent tw:bg-transparent tw:text-left tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:data-[selected=true]:border-ui-accent tw:data-[selected=true]:bg-ui-accent-soft tw:data-[selected=true]:text-ui-accent-strong"
                            data-selected={showing}
                            aria-current={!hasTabs && showing ? "page" : undefined}
                            aria-expanded={hasTabs ? expanded : undefined}
                            aria-controls={hasTabs && expanded ? `settings-tabs-${subitem.id}` : undefined}
                            onClick={() => {
                              if (hasTabs) {
                                setExpandedConfigItem(expanded ? "" : subitem.id);
                                return;
                              }
                              setActive("config");
                              setConfigArea(subitem.id);
                              setMobileOpen(false);
                            }}
                          >
                            <span className="tw:min-w-0 tw:flex-1 tw:truncate">{subitem.label}</span>
                            {hasTabs && (
                              <ChevronRight size={13} aria-hidden="true" className={`tw:shrink-0 tw:motion-safe:transition-transform${expanded ? " tw:rotate-90" : ""}`} />
                            )}
                          </Button>
                          {hasTabs && expanded && (
                            <div className="config-nav-children" id={`settings-tabs-${subitem.id}`}>
                              {subitemTabs.map((tab) => (
                                <Button
                                  key={tab.id}
                                  variant="custom"
                                  className="tw:w-full tw:justify-start tw:border-transparent tw:bg-transparent tw:text-left tw:text-ui-text tw:hover:bg-card-page tw:aria-[current=page]:border-ui-accent tw:aria-[current=page]:bg-ui-accent-soft tw:aria-[current=page]:font-semibold tw:aria-[current=page]:text-ui-accent-strong"
                                  aria-current={showing && configTab === tab.id ? "page" : undefined}
                                  onClick={() => { setActive("config"); setConfigArea(subitem.id); setConfigTab(tab.id); setMobileOpen(false); }}
                                >
                                  <span className="tw:min-w-0 tw:truncate">{tab.label}</span>
                                </Button>
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
            <button className="icon-button" aria-label="Notificações">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <Suspense fallback={<p className="dash-empty">Carregando o painel...</p>}>
          <ActiveView
            requests={scopedRequests}
            selected={scopedSelected}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            metrics={scopedMetrics}
            patchRequest={patchRequest}
            runProcedureAction={runProcedureAction}
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
            breeds={scopedBreeds}
            setBreeds={setBreeds}
            neighborhoods={scopedNeighborhoods}
            setNeighborhoods={setNeighborhoods}
            refreshRequests={refreshRequests}
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
        </Suspense>
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

      {sidebarResetOpen && <div className="modal-backdrop"><div className="workflow-modal reset-form" role="dialog" aria-modal="true"><PasswordChangeForm onChanged={(user) => { setCurrentUser(user); closeSidebarReset(); }} onCancel={closeSidebarReset} /></div></div>}
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

export function userBelongsToSector(user: AnyRecord = {}, sectorId = "") {
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
  const safeItem = stripEphemeralCredentials(item);
  const requesterType = item.requesterType || item.requester_type || "";
  const type = accessRequesterTypes.find((option) => option.id === requesterType);
  return {
    ...safeItem,
    requesterType,
    requesterLabel: type?.label || requesterType || "Solicitante",
    organizationName: item.organizationName || item.organization_name || "",
    responsibleName: item.responsibleName || item.responsible_name || "",
    municipalityId: item.municipalityId || item.municipality_id || "",
    intendedUse: item.intendedUse || item.intended_use || "",
    assignedSector: item.assignedSector || item.assigned_sector || type?.sector || "",
    reviewNote: item.reviewNote || item.review_note || "",
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

// Opened by the link of the notice "Solicitação registrada" or by "Criar minha senha" on the last screen of a request.
const REQUEST_ACCESS_SERVICE = "request_access";

const publicHomeServices = [
  { id: "procedure_form", label: "Solicitar procedimento", icon: ClipboardCheck },
  { id: "tracking", label: "Acompanhar solicitação", icon: Search },
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
export function PublicSchedulePicker({
  scheduleDays = [],
  selectedDate = "",
  selectedOccurrenceKey = "",
  onSelect,
  pendingReservation = null,
  title = "",
  hint = "",
  external = false,
}) {
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const requiredVacancies = Math.max(Number(pendingReservation?.count) || 1, 1);
  const scheduleWithUsage = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const confirmed = Math.max(day.vacancies - day.remaining, 0);
    const pending = pendingReservation?.date === day.date && (!selectedOccurrenceKey || selectedOccurrenceKey === day.occurrenceKey) ? (pendingReservation.count || 0) : 0;
    const used = confirmed + pending;
    const offeredSlot = getAvailableScheduleSlot(day, requiredVacancies);
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
  const chosenDay = scheduleWithUsage.find((day) => day.date === selectedDate && (!selectedOccurrenceKey || day.occurrenceKey === selectedOccurrenceKey));
  const chosenTime = chosenDay ? chosenDay.offeredSlot?.time || chosenDay.startTime || "" : "";
  const scheduleByDate = new Map();
  scheduleWithUsage.forEach((day) => {
    const previous = scheduleByDate.get(day.date);
    if (!previous || day.occurrenceKey === selectedOccurrenceKey || (!previous.hasEnoughVacancies && day.hasEnoughVacancies)) scheduleByDate.set(day.date, day);
  });
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
      <div className="schedule-picker-controls">
        {title && <span className="form-sub-card-title">{title}</span>}
        {hint && <p className="form-hint">{hint}</p>}
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
      </div>
      <div className="schedule-picker-calendar">
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
                  onClick={() => onSelect(day.date, day.occurrenceKey || "")}
                >
                  <strong>{String(day.calendarDay || day.date.slice(0, 2)).padStart(2, "0")}</strong>
                  <small>{!day.available ? "Sem atendimento" : day.isPast ? "Já passou" : day.hasEnoughVacancies ? `${day.offeredSlot?.time || day.startTime || ""} · ${day.remaining} vagas` : "Sem vagas suficientes"}</small>
                  {day.kind === "Mutirao" && <em>Mutirão</em>}
                </ScheduleDayButton>
              )
          )}
        </div>
      </div>
      {chosenDay && <p className="schedule-chosen" role="status">Você escolheu {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(parseScheduleDate(chosenDay.date)))}{chosenTime ? `, às ${chosenTime}` : ""}.</p>}
      {selectedDate && scheduleWithUsage.filter((day) => day.date === selectedDate).length > 1 && (
        <div className="schedule-occurrence-options" role="group" aria-label="Local e horário">
          <p>Escolha o local desta data:</p>
          {scheduleWithUsage.filter((day) => day.date === selectedDate).map((day) => {
            const selected = selectedOccurrenceKey === day.occurrenceKey;
            const remaining = Math.max(day.vacancies - (day.used - (selected ? requiredVacancies : 0)), 0);
            const label = `${day.locationName || "Local de atendimento"} · ${day.offeredSlot?.time || day.startTime} · ${remaining} vagas`;
            const disabled = !day.hasEnoughVacancies || day.isPast;
            const onClick = () => onSelect(day.date, day.occurrenceKey || "");
            return external
              ? <Button key={day.occurrenceKey || day.id} variant={selected ? "primary" : "outline"} aria-pressed={selected} className="tw:whitespace-normal tw:text-center" disabled={disabled} onClick={onClick}>{label}</Button>
              : <button type="button" key={day.occurrenceKey || day.id} className={selected ? "primary-action" : "ghost-button"} disabled={disabled} onClick={onClick}>{label}</button>;
          })}
        </div>
      )}
    </section>
  );
}

function AdoptionCarousel({ adoptionAnimals, limit = 24, onInterestSent, sharedAdoption = null }: AnyRecord) {
  const availableAnimals = sortAdoptionsForHighlight(adoptionAnimals.filter((animal) => animal.status !== ADOPTION_STATUS_ADOPTED));
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestForm, setInterestForm] = useState({ name: "", phone: "", visit_date: "" });
  const [interestError, setInterestError] = useState("");
  const [interestSaving, setInterestSaving] = useState(false);
  const interestRequest = useRef<symbol | null>(null);
  const adoptionTitleId = useId();
  const adoptionCloseRef = useRef<HTMLButtonElement>(null);
  const interestNameRef = useRef<HTMLInputElement>(null);
  const adoptionOpen = Boolean(selectedAnimal);
  const speciesQuickFilters = [
    { value: "", label: "Todos" },
    { value: "canino", label: "Cães" },
    { value: "felino", label: "Gatos" },
  ];
  const filteredAnimals = availableAnimals
    .filter((animal) => !speciesFilter || normalizeText(animal.species).includes(speciesFilter))
    .slice(0, limit);
  // The animal of a shared link opens on its own once it has been found.
  const sharedAnimalId = sharedAdoption?.state === SharedAdoptionState.AVAILABLE ? sharedAdoption.animal?.id || "" : "";
  useEffect(() => {
    if (sharedAnimalId) openAnimalModal(normalizeAdoptionAnimal(sharedAdoption.animal));
  }, [sharedAnimalId]);
  useEffect(() => {
    if (!adoptionOpen) return;
    const previous = document.activeElement;
    adoptionCloseRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [adoptionOpen]);
  useEffect(() => {
    if (interestSent) adoptionCloseRef.current?.focus();
  }, [interestSent]);
  useEffect(() => {
    if (showInterestForm) interestNameRef.current?.focus();
  }, [showInterestForm]);

  function openAnimalModal(animal, openInterestForm = false) {
    interestRequest.current = null;
    setSelectedAnimal(animal);
    setShowInterestForm(openInterestForm);
    setInterestSent(false);
    setInterestSaving(false);
    setInterestError("");
    setInterestForm({ name: "", phone: "", visit_date: "" });
  }

  function closeAnimalModal() {
    interestRequest.current = null;
    setSelectedAnimal(null);
    setShowInterestForm(false);
    setInterestSent(false);
    setInterestSaving(false);
    setInterestError("");
    setInterestForm({ name: "", phone: "", visit_date: "" });
  }

  async function submitInterest(e) {
    e.preventDefault();
    if (!selectedAnimal || interestRequest.current) return;
    const request = Symbol();
    interestRequest.current = request;
    setInterestError("");
    setInterestSaving(true);
    try {
      const updated = await api.registerInterest(selectedAnimal.id, interestForm, selectedAnimal.municipality_id);
      if (interestRequest.current === request) setInterestSent(true);
      onInterestSent?.(updated);
    } catch {
      if (interestRequest.current === request) setInterestError("Não foi possível registrar o interesse. Tente novamente.");
    } finally {
      if (interestRequest.current === request) {
        interestRequest.current = null;
        setInterestSaving(false);
      }
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
            <Button
              key={filter.value || "all"}
              variant="custom"
              aria-pressed={speciesFilter === filter.value}
              className="tw:border-card-border tw:bg-card-surface tw:font-semibold tw:text-[#7a6f60] tw:hover:bg-[#f0e9da] tw:aria-pressed:border-ui-ink tw:aria-pressed:bg-ui-ink tw:aria-pressed:text-white"
              onClick={() => setSpeciesFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {sharedAdoption && <SharedAdoptionNotice shared={sharedAdoption} />}

      <div className="public-animal-grid">
        {filteredAnimals.length === 0 && (
          <div className="adoption-filter-empty" role="status">
            {availableAnimals.length === 0 ? "Nenhum animal disponível para adoção no momento." : "Nenhum animal encontrado com estes filtros."}
          </div>
        )}
        {filteredAnimals.map((animal) => {
          const displayName = String(animal.name || animal.animal_name || "Animal").trim();
          const interestCount = getAdoptionInterestCount(animal);
          const highlighted = isAdoptionHighlighted(animal);
          return (
            <Card
              as="article"
              className={`public-animal-card tw:grid tw:grid-rows-[1fr_auto] tw:overflow-hidden tw:shadow-sm tw:motion-safe:transition-shadow tw:hover:shadow-md${highlighted ? " is-highlighted" : ""}`}
              key={animal.id || animal.name}
            >
              <button className="tw:grid tw:h-full tw:w-full tw:border-0 tw:bg-transparent tw:p-0 tw:text-inherit tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-ui-accent" type="button" aria-label={`Ver detalhes de ${displayName}`} onClick={() => openAnimalModal(animal)}>
                <div className={`public-animal-photo ${getAnimalGradient(animal)}`}>
                  {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={displayName} /> : <PawPrint size={24} />}
                </div>
              </button>
              <div className="public-animal-footer">
                <span className={interestCount > 0 ? "public-interest-count has-interest" : "public-interest-count"}>
                  <Users size={13} />
                  {interestCount} interessado{interestCount === 1 ? "" : "s"}
                </span>
                <Button
                  className="tw:w-full"
                  onClick={() => openAnimalModal(animal, true)}
                >
                  <HeartHandshake size={14} />
                  Quero adotar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

    </section>

    {selectedAnimal && (
      <div className="modal-backdrop">
        <Card as="section" className="animal-detail-modal adoption-profile-modal" role="dialog" aria-modal="true" aria-labelledby={adoptionTitleId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeAnimalModal();
            }
            if (event.key !== "Tab") return;
            const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]");
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (!first || !last) return;
            if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
              event.preventDefault();
              (event.shiftKey ? last : first).focus();
            }
          }}
        >
          <div className="tw:absolute tw:end-3 tw:top-3 tw:z-20">
            <CloseButton aria-label="Fechar detalhes do animal" ref={adoptionCloseRef} onClick={closeAnimalModal} />
          </div>
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
              <h2 id={adoptionTitleId}>{selectedAnimal.name || selectedAnimal.animal_name || "Animal"}</h2>
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
              <Button className="tw:w-full" onClick={() => setShowInterestForm(true)}>
                <HeartHandshake size={18} />
                Quero adotar
              </Button>
            )}

            <ShareAdoptionButton animal={selectedAnimal} />

            {showInterestForm && !interestSent && (
              <form className="adoption-interest-form" onSubmit={submitInterest}>
                <div className="interest-form-heading">
                  <HeartHandshake size={15} />
                  <span>Registrar interesse</span>
                </div>
                <label className="tw:grid tw:gap-1.5 tw:text-sm tw:font-medium">Nome completo
                  <Input ref={interestNameRef} value={interestForm.name} onChange={(e) => setInterestForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" required />
                </label>
                <label className="tw:grid tw:gap-1.5 tw:text-sm tw:font-medium">WhatsApp
                  <Input type="tel" value={interestForm.phone} onChange={(e) => setInterestForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" autoComplete="tel" required />
                </label>
                <label className="tw:grid tw:gap-1.5 tw:text-sm tw:font-medium">Data da visita
                  <Input type="date" value={interestForm.visit_date} onChange={(e) => setInterestForm((f) => ({ ...f, visit_date: e.target.value }))} />
                </label>
                {interestError && <p className="form-error" role="alert">{interestError}</p>}
                <div className="form-actions">
                  <Button type="submit" disabled={interestSaving}>
                    <HeartHandshake size={15} />
                    {interestSaving ? "Enviando..." : "Enviar interesse"}
                  </Button>
                </div>
              </form>
            )}

            {interestSent && (
              <div className="adoption-interest-success" role="status">
                <CheckCircle2 size={40} />
                <strong>Interesse registrado!</strong>
                <p>Em breve entraremos em contato pelo WhatsApp informado.</p>
              </div>
            )}
          </div>
        </Card>
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
function LoginView({ onLogin, accessLink = null, onProcedureIntent, onAccessRequest, adoptionAnimals = [], sharedAdoption = null, onInterestSent, municipalities = [], selectedMunicipalityId = "", onMunicipalitySelect, createRequest, scheduleDays = [], requestTypes = [], documentTypes = [], speciesOptions = [], sizeOptions = [], breeds = [], neighborhoods = [], aiSettings = initialAiSettings, onRequestCreated }: AnyRecord) {
  const [authEntry, setAuthEntry] = useState<AuthEntryContext | null>(null);
  const [authEntryError, setAuthEntryError] = useState("");
  const [activePublicService, setActivePublicService] = useState<string | null>(accessLink ? REQUEST_ACCESS_SERVICE : null);
  // What "Acessar minha solicitação" opens with: the protocol of the link, or the protocol and the CPF of the request just sent.
  const [accessPrefill, setAccessPrefill] = useState<{ protocol: string; cpf: string } | null>(accessLink ? { protocol: accessLink.protocol, cpf: "" } : null);
  const [procedurePrefill, setProcedurePrefill] = useState<AnyRecord | null>(null);
  const [publicServiceDone, setPublicServiceDone] = useState<AnyRecord | null>(null);
  const [publicServiceScheduleDays, setPublicServiceScheduleDays] = useState(scheduleDays);
  const [publicServiceScheduleRules, setPublicServiceScheduleRules] = useState([]);
  const [publicServiceRequestTypes, setPublicServiceRequestTypes] = useState(requestTypes);
  const [publicServiceDocumentTypes, setPublicServiceDocumentTypes] = useState(documentTypes);
  const [publicServiceSpeciesOptions, setPublicServiceSpeciesOptions] = useState(speciesOptions);
  const [publicServiceSizeOptions, setPublicServiceSizeOptions] = useState(sizeOptions);
  const [publicServiceBreeds, setPublicServiceBreeds] = useState(breeds);
  const [publicServiceNeighborhoods, setPublicServiceNeighborhoods] = useState(neighborhoods);
  const adoptionSectionRef = useRef(null);
  // A shared adoption link lands on the adoption section, where its animal or its notice is.
  const sharedAdoptionState = sharedAdoption?.state || SharedAdoptionState.NONE;
  useEffect(() => {
    if (sharedAdoptionState === SharedAdoptionState.NONE || sharedAdoptionState === SharedAdoptionState.LOADING) return;
    adoptionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sharedAdoptionState]);
  const publicMunicipalityRef = useRef(selectedMunicipalityId);
  publicMunicipalityRef.current = selectedMunicipalityId;
  useEffect(() => { setPublicServiceDone(null); setProcedurePrefill(null); setAuthEntry(null); setAuthEntryError(""); }, [selectedMunicipalityId]);

  useEffect(() => {
    setPublicServiceScheduleDays(scheduleDays);
    setPublicServiceRequestTypes(requestTypes);
    setPublicServiceDocumentTypes(documentTypes);
    setPublicServiceSpeciesOptions(speciesOptions);
    setPublicServiceSizeOptions(sizeOptions);
    setPublicServiceBreeds(breeds);
    setPublicServiceNeighborhoods(neighborhoods);
  }, [scheduleDays, requestTypes, documentTypes, speciesOptions, sizeOptions, breeds, neighborhoods]);

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
    api.getConfig(CONFIG_KEYS.breeds, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceBreeds(value); }).catch(() => {});
    api.getConfig(CONFIG_KEYS.neighborhoods, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceNeighborhoods(value); }).catch(() => {});
  }, [selectedMunicipalityId]);

  const activeMunicipality = selectedMunicipalityId ? municipalities.find((m) => m.id === selectedMunicipalityId) : null;
  const activePublicServiceDetails = publicHomeServices.find((service) => service.id === activePublicService) || null;
  const effectivePublicServiceScheduleDays = mergeScheduleDaysWithRules(publicServiceScheduleDays, publicServiceScheduleRules);
  const nextMutirao = getNextUpcomingMutirao(effectivePublicServiceScheduleDays);

  function openAuthEntry(origin: AuthEntryOrigin) {
    const context = createAuthEntryContext(origin, selectedMunicipalityId);
    if (!context || (origin !== AuthEntryOrigin.STAFF && (!activeMunicipality || activeMunicipality.active === false))) { setAuthEntryError("Selecione o município na página."); return; }
    setAuthEntryError("");
    if (origin === AuthEntryOrigin.REGISTERED_ANIMAL) onProcedureIntent({ municipalityId: selectedMunicipalityId, schedule: procedurePrefill?.schedule || "", requestTypeId: procedurePrefill?.requestType || "" });
    else onProcedureIntent(null);
    setAuthEntry(context);
  }

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

  function openRequestAccess(prefill: { protocol: string; cpf: string }) {
    setAccessPrefill(prefill);
    setPublicServiceDone(null);
    setActivePublicService(REQUEST_ACCESS_SERVICE);
  }

  function closePublicService() {
    setActivePublicService(null);
    setProcedurePrefill(null);
    setPublicServiceDone(null);
  }

  const publicFooterItems = [
    { label: "Contato", value: activeMunicipality?.contact, icon: Phone },
    { label: "Email", value: activeMunicipality?.email, icon: Mail },
    { label: "Endereço", value: activeMunicipality?.address, icon: MapPin },
    { label: "CEP", value: activeMunicipality?.cep, icon: Navigation },
  ].filter((item) => String(item.value || "").trim());
  const procedureService = activePublicService === "procedure_form";
  const requestFormOpen = procedureService && selectedMunicipalityId && !publicServiceDone;
  const scrollableMenuButton = "tw:[@media(max-width:820px),(max-height:480px)]:flex-none";
  const serviceButtonLayout = requestFormOpen ? scrollableMenuButton : "tw:[@media(max-width:820px)]:flex-[1_1_calc(50%-6px)]";
  const enterButtonLayout = requestFormOpen ? scrollableMenuButton : "tw:[@media(max-width:820px)]:w-full";
  return (
    <main className={`login-page${requestFormOpen ? " login-page--request" : ""}`}>
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
          {activeMunicipality?.department_logo && (
            <img src={activeMunicipality.department_logo} alt="Logo do órgão" className="public-topbar-logo" />
          )}
        </div>
        <nav className="public-topbar-nav" aria-label="Serviços públicos">
          {publicHomeServices.map((service) => {
            const Icon = service.icon;
            const active = activePublicService === service.id;
            return (
              <Button
                key={service.id}
                variant="menu"
                aria-current={active || undefined}
                className={`tw:text-[color:var(--ink-700)] ${serviceButtonLayout}`}
                onClick={() => openPublicService(service.id)}
              >
                <Icon size={14} aria-hidden="true" className={service.danger ? "tw:shrink-0 tw:text-[#b5482f]" : "tw:shrink-0 tw:text-[color:var(--ui-action)]"} />
                <span>{service.label}</span>
              </Button>
            );
          })}
          <Button
            variant="menu"
            className={`tw:text-[color:var(--selected-ink)] ${enterButtonLayout}`}
            onClick={() => openAuthEntry(AuthEntryOrigin.STAFF)}
          >
            <User size={15} aria-hidden="true" />
            Entrar
          </Button>
        </nav>
      </div>

      {authEntryError && <p className="form-error" role="alert">{authEntryError}</p>}

      {activePublicService ? (
        <section className="public-service-workspace">
          <aside className="public-service-rail">
            <HeroCard
              variant={requestFormOpen ? "request" : "service"}
              onGoToAdoption={scrollToAdoption}
              onPublicRequest={() => openPublicService("procedure_form")}
            />
          </aside>

          <section className={`public-service-panel${publicServiceDone ? " public-service-panel--success" : ""}`}>
            {(!procedureService || !selectedMunicipalityId) && (
              <div className="public-service-panel-header">
                <h2>{activePublicService === REQUEST_ACCESS_SERVICE ? "Acessar minha solicitação" : activePublicServiceDetails?.label || "Serviço"}</h2>
                {!publicServiceDone && <Button variant="outline" className="tw:shrink-0" onClick={closePublicService}>Voltar ao início</Button>}
              </div>
            )}

            {publicServiceDone ? (
              <RequestDoneCard
                protocol={publicServiceDone.protocol}
                followUp={(publicServiceDone.workflow_data || publicServiceDone.workflowData)?.followUp}
                createRequirement={() => createRequestPdfDataUrl(publicServiceDone, activeMunicipality)}
                closeLabel="Voltar ao início"
                onClose={closePublicService}
                onCreatePassword={publicServiceDone.cpf && isProcedureRequest(publicServiceDone.request_type)
                  ? () => openRequestAccess({ protocol: publicServiceDone.protocol, cpf: onlyDigits(String(publicServiceDone.cpf)) }) : undefined}
              />
            ) : (procedureService || activePublicService === "report") && !selectedMunicipalityId ? (
              <p role="status">Selecione o município na página para continuar.</p>
            ) : procedureService ? (
              <NewRequest
                key={`public-procedure-${selectedMunicipalityId}`}
                createRequest={createRequest}
                currentUser={GUEST_USER}
                selectedMunicipalityId={selectedMunicipalityId}
                municipality={activeMunicipality}
                onBack={closePublicService}
                backLabel="Voltar"
                onRegisteredAnimal={() => openAuthEntry(AuthEntryOrigin.REGISTERED_ANIMAL)}
                onDone={(request) => {
                  if (selectedMunicipalityId !== publicMunicipalityRef.current) return;
                  const normalized = onRequestCreated?.(request, { openAdmin: true }) || normalizeRequest(request);
                  setPublicServiceDone(normalized);
                }}
                initialMunicipalityId={selectedMunicipalityId}
                requestTypes={publicServiceRequestTypes}
                documentTypes={publicServiceDocumentTypes}
                aiSettings={aiSettings}
                speciesOptions={publicServiceSpeciesOptions}
                sizeOptions={publicServiceSizeOptions}
                breeds={publicServiceBreeds}
                neighborhoods={publicServiceNeighborhoods}
                initialType={procedurePrefill?.requestType || ""}
                initialSchedule={procedurePrefill?.schedule || ""}
              />
            ) : activePublicService === "credential" ? (
              <PublicAccessRequestInline onSubmit={onAccessRequest} municipalityId={selectedMunicipalityId} />
            ) : activePublicService === "tracking" ? (
              <RequestTracking key={selectedMunicipalityId} municipalityId={selectedMunicipalityId} />
            ) : activePublicService === REQUEST_ACCESS_SERVICE ? (
              <RequestAccess
                key={`${selectedMunicipalityId}:${accessPrefill?.protocol || ""}`}
                municipalityId={selectedMunicipalityId}
                initialProtocol={accessPrefill?.protocol}
                initialCpf={accessPrefill?.cpf}
                createRequirement={(request) => createRequestPdfDataUrl(request, activeMunicipality)}
                onSession={onLogin}
                onLogin={() => openAuthEntry(AuthEntryOrigin.REQUEST_ACCESS)}
              />
            ) : activePublicService === "report" ? (
              <PublicReportPanel
                key={selectedMunicipalityId}
                municipalityName={activeMunicipality?.name || "Sistema municipal"}
                onSubmit={async (payload) => {
                  const created = await createRequest({
                    ...payload,
                    request_type: RequestType.COMPLAINT,
                    municipality_id: selectedMunicipalityId,
                  });
                  if (selectedMunicipalityId === publicMunicipalityRef.current) setPublicServiceDone(normalizeRequest(created));
                }}
              />
            ) : null}
          </section>
        </section>
      ) : (
        <>
          <HeroCard
            onGoToAdoption={scrollToAdoption}
            onPublicRequest={() => openPublicService("procedure_form")}
          />

          {nextMutirao && <MutiraoBanner scheduleDay={nextMutirao} onJoin={joinMutirao} />}

          <PublicMetrics />

          <section className="public-adoption-section" ref={adoptionSectionRef}>
            <AdoptionCarousel adoptionAnimals={adoptionAnimals} sharedAdoption={sharedAdoption} onInterestSent={onInterestSent} />
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

{authEntry && <AuthEntry key={authEntryKey(authEntry)} audience={authEntry.audience} municipalityId={authEntry.municipalityId} onLogin={onLogin} onClose={() => { onProcedureIntent(null); setAuthEntry(null); }} />}
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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);
  const selectedType = accessRequesterTypes.find((type) => type.id === form.requesterType) || accessRequesterTypes[0];
  const fieldLabel = "tw:grid tw:gap-1.5 tw:text-sm tw:font-medium tw:text-ui-ink";

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.responsibleName.trim() || !form.email.trim()) {
      setError("Informe o responsável e o email para contato.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
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
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Não foi possível enviar a solicitação.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Card className="tw:p-4 tw:sm:p-6">
      <form className="tw:grid tw:gap-4" aria-label="Solicitar credenciamento" aria-busy={saving} onSubmit={submit}>
        {sent ? (
          <div className="tw:grid tw:min-h-48 tw:content-center tw:justify-items-center tw:gap-2 tw:text-center" role="status">
            <CheckCircle2 size={38} strokeWidth={1.5} className="tw:text-ui-accent" aria-hidden="true" />
            <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Solicitação enviada!</h3>
            <p className="tw:m-0 tw:text-ui-text">Um usuário interno vai analisar o pedido e liberar o acesso se estiver tudo certo.</p>
          </div>
        ) : (
          <>
            <div className="tw:flex tw:items-center tw:gap-3">
              <span className="tw:inline-flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[10px] tw:bg-ui-accent-soft tw:text-ui-accent"><Shield size={18} aria-hidden="true" /></span>
              <div>
                <h3 className="tw:m-0 tw:text-base tw:font-semibold">Solicitar credenciamento</h3>
                <p className="tw:m-0 tw:text-sm tw:text-ui-text">Acesso ao sistema para ONGs e protetores independentes.</p>
              </div>
            </div>

            <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2" role="group" aria-label="Tipo de solicitante">
              {accessRequesterTypes.map((type) => (
                <Card
                  as="button"
                  key={type.id}
                  aria-pressed={form.requesterType === type.id}
                  className="tw:flex tw:enabled:cursor-pointer tw:flex-col tw:items-start tw:gap-1 tw:px-3.5 tw:py-3 tw:text-left tw:enabled:hover:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent"
                  disabled={saving}
                  onClick={() => patch("requesterType", type.id)}
                >
                  <span className="tw:inline-flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg tw:bg-ui-accent-soft tw:text-ui-accent">
                    {type.id === "ONG" ? <Building2 size={17} aria-hidden="true" /> : <HeartHandshake size={17} aria-hidden="true" />}
                  </span>
                  <span className="tw:text-sm tw:font-semibold tw:text-ui-ink">{type.label}</span>
                  <span className="tw:text-xs tw:text-ui-text">{type.sector}</span>
                </Card>
              ))}
            </div>

            <label className={fieldLabel}>
              <span>Organização</span>
              <Input type="text" placeholder="Nome da ONG ou grupo (opcional para protetor)" value={form.organizationName} onChange={(e) => patch("organizationName", e.target.value)} autoComplete="organization" disabled={saving} />
            </label>
            <label className={fieldLabel}>
              <span>Responsável</span>
              <Input type="text" placeholder="Nome completo do responsável *" value={form.responsibleName} onChange={(e) => patch("responsibleName", e.target.value)} autoComplete="name" required disabled={saving} />
            </label>
            <label className={fieldLabel}>
              <span>Email</span>
              <Input type="email" placeholder="Email para contato *" value={form.email} onChange={(e) => patch("email", e.target.value)} autoComplete="email" required disabled={saving} />
            </label>
            <div className="tw:grid tw:gap-4 tw:sm:grid-cols-2">
              <label className={fieldLabel}>
                <span>Telefone</span>
                <Input type="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => patch("phone", formatPhone(e.target.value))} autoComplete="tel" disabled={saving} />
              </label>
              <label className={fieldLabel}>
                <span>CPF / CNPJ</span>
                <Input type="text" placeholder="CPF, CNPJ ou matrícula" value={form.document} onChange={(e) => patch("document", /^[0-9.\-/\s]*$/.test(e.target.value) ? formatCpfOrCnpj(e.target.value) : e.target.value)} disabled={saving} />
              </label>
            </div>
            <div className="tw:grid tw:gap-4 tw:sm:grid-cols-2">
              <label className={fieldLabel}>
                <span>Cidade</span>
                <Input type="text" placeholder="Cidade" value={form.city} onChange={(e) => patch("city", e.target.value)} autoComplete="address-level2" disabled={saving} />
              </label>
              <label className={fieldLabel}>
                <span>UF</span>
                <Input type="text" placeholder="UF" value={form.state} maxLength={2} onChange={(e) => patch("state", e.target.value.toUpperCase().slice(0, 2))} autoComplete="address-level1" disabled={saving} />
              </label>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <Button className="tw:justify-self-start" type="submit" disabled={saving}>
              <Shield size={14} aria-hidden="true" />
              {saving ? "Enviando solicitação..." : "Enviar solicitação"}
            </Button>
          </>
        )}
      </form>
    </Card>
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
      <Button variant="custom" className="tw:shrink-0 tw:border-[#c2410c] tw:bg-transparent tw:font-semibold tw:text-[#c2410c] tw:hover:bg-[#c2410c] tw:hover:text-[#fff7ed] tw:max-[640px]:w-full" onClick={onJoin}>
        Quero participar
      </Button>
    </section>
  );
}

function MunicipalitySelectorChip({ municipalities, selectedMunicipalityId, onSelect, compact = false }: AnyRecord) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  useEffect(() => {
    if (popoverOpen) searchRef.current?.focus();
  }, [popoverOpen]);

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
  }

  function close() {
    setPopoverOpen(false);
    triggerRef.current?.focus();
  }

  function pick(id) {
    onSelect(id);
    close();
    setSearch("");
  }

  return (
    <div className="tw:relative tw:inline-block" onKeyDown={(event) => {
      if (event.key === "Escape" && popoverOpen) {
        event.preventDefault();
        close();
      }
    }}>
      <button
        ref={triggerRef}
        type="button"
        className={`municipality-chip-btn${selected ? " selected" : ""}${compact ? " compact" : ""}`}
        aria-label={compact && selected ? "Trocar município" : undefined}
        aria-expanded={popoverOpen}
        aria-controls={popoverOpen ? popoverId : undefined}
        onClick={popoverOpen ? close : open}
      >
        {compact && selected ? (
          <><ChevronDown size={13} />trocar</>
        ) : (
          <><MapPin size={14} />{selected ? selected.name : "Município"}<ChevronDown size={13} /></>
        )}
      </button>
      {popoverOpen && (
        <>
          <div className="municipality-popover-backdrop" onClick={close} />
          <div className="municipality-popover" id={popoverId}>
            <div className="mun-search-box">
              <Search size={14} />
              <input
                ref={searchRef}
                type="text"
                aria-label="Buscar município"
                placeholder="Buscar município..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mun-list">
              {filtered.length === 0 && (
                <p className="mun-empty" role="status">Nenhum resultado</p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={m.id === selectedMunicipalityId}
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

async function downloadAnimalRecordPdf(record: AnimalRecord) {
  const bundle = await generateProntuarioPdf({}, record);
  if (!bundle?.dataUrl) return;
  const anchor = window.document.createElement("a");
  anchor.href = bundle.dataUrl;
  anchor.download = bundle.fileName || `prontuario-${record.animal?.name || "animal"}.pdf`;
  anchor.click();
}

function TutorDashboard({ requests, currentUser }: AnyRecord) {
  const safeRequests = useMemo(() => (Array.isArray(requests) ? requests : []).map(normalizeRequest), [requests]);
  const [detailsRequest, setDetailsRequest] = useState(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  return (
    <>
      <Card as="section" className="tw:grid tw:gap-4 tw:p-5">
        <h2 className="tw:m-0 tw:text-xl">Minhas solicitações</h2>
        <div className="tw:grid tw:gap-3">
          {safeRequests.map((request) => (
            <Card as="article" key={request.id} className="tw:grid tw:items-center tw:gap-3 tw:p-4 tw:min-[721px]:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="tw:grid tw:min-w-0 tw:gap-1 tw:[overflow-wrap:anywhere]">
                <strong>#{request.protocol}</strong>
                <span>{request.animals.map((animal) => animal.name).join(", ") || "Animal não informado"}</span>
                <small>{requestTypeLabel(request)}</small>
              </div>
              <div className="tw:grid tw:justify-items-start tw:gap-1">
                <StatusBadge status={request.status} className="card-status-plain" />
                <span className="tw:text-sm tw:text-ui-muted">{request.appointment || request.preferredSchedule || request.createdAt}</span>
              </div>
              <Button variant="outline" className="tw:justify-self-start" onClick={() => setDetailsRequest(request)}>
                Detalhes
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </Card>
          ))}
        </div>
      </Card>
      {detailsRequest && (() => {
        const req = detailsRequest;
        const animal = req.animals?.[0] || {};
        const wf: AnyRecord = req.workflowData || req.workflow_data || {};
        const animalBreed = animal.breedType === "Definida" ? (animal.breedDescription || "Definida") : (animal.breedType || "—");
        const microchip = animal.microchip || req.animalMicrochip || "—";
        const performed = wf.attendanceProcedure || wf.performedProcedures || req.performedProcedures || "";
        const prescriptions = reportPrescriptions(resolveRequestProcedures(req), wf.attendancePrescription, { completedOnly: true });
        const cancelReason = wf.cancelReason || req.rejectionReason || "";
        return (
          <div className="modal-backdrop">
            <div className="public-request-details-modal prontuario-modal" role="dialog" aria-modal="true" aria-label={`Prontuário · #${req.protocol}`}>
              <div className="prontuario-modal-header">
                <div className="prontuario-modal-title">
                  <span className="prontuario-modal-eyebrow">Prontuário · #{req.protocol}</span>
                  <h2>{animal.name || "Animal não informado"}</h2>
                  <StatusBadge status={req.status} />
                </div>
                <div className="prontuario-modal-actions">
                  <Button
                    variant="outline"
                    title="Baixar prontuário do animal"
                    aria-label="Baixar prontuário do animal"
                    disabled={downloadingId === req.id}
                    onClick={async () => {
                      setDownloadingId(req.id);
                      try {
                        const chip = (animal.microchip || req.animalMicrochip || "").trim();
                        const municipalityId = currentUser?.municipalityId || req.municipalityId || req.municipality_id || "";
                        const history = animal.id
                          ? await api.consultAnimalById(animal.id).catch(() => null)
                          : chip ? await api.consultAnimalByMicrochip({ microchip: chip, municipalityId }).catch(() => null) : null;
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
                    <Download size={16} aria-hidden="true" />
                  </Button>
                  <CloseButton onClick={() => setDetailsRequest(null)} aria-label="Fechar prontuário" />
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
                    <InfoTile label="CPF" value={maskCpf(req.cpf || currentUser?.cpf || "")} />
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

                {(performed || prescriptions.length > 0 || cancelReason) && (
                  <div className="prontuario-section">
                    <span className="prontuario-section-label">Atendimento</span>
                    <div className="prontuario-grid">
                      {performed && <InfoTile label="Procedimento realizado" value={performed} />}
                      {wf.attendanceMicrochip && <InfoTile label="Microchip aplicado" value={wf.attendanceMicrochip} />}
                      {prescriptions.map(({ id, subtitle, blocks }) => (
                        <InfoTile key={id} label={id === "legacy" ? "Receita / Prescrição" : `Receita · ${subtitle}`} value={blocks.map(({ text }) => text).join("\n")} />
                      ))}
                      {cancelReason && <InfoTile label="Motivo cancelamento" value={cancelReason} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

function NewRequest({
  createRequest,
  // The public form only: "Animal já cadastrado" goes through the tutor's sign-in.
  onRegisteredAnimal,
  currentUser,
  internalSimple = false,
  selectedMunicipalityId = "",
  onBack,
  backLabel = "Voltar ao início",
  onDone,
  registeredContext,
  contextLoading = false,
  onRequestTypeChange,
  requestTypes = initialRequestTypes,
  aiSettings = initialAiSettings,
  speciesOptions = initialSpecies,
  sizeOptions = initialSizes,
  documentTypes = initialDocumentTypes,
  breeds = initialBreeds,
  neighborhoods = initialNeighborhoods,
  initialSchedule = "",
  initialType = "",
  initialMunicipalityId = "",
  municipality = null,
}: AnyRecord) {
  const activeSpecies = Array.from(new Set<string>(
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
  const registered = Boolean(registeredContext);
  // The tutor's data already exist: the account of a tutor with a complete profile, or the registered animal.
  const tutorKnown = registered || (currentUser.role === "tutor" && currentUser.profileComplete && isValidCpf(currentUser.cpf || ""));
  const [requestData, setRequestData] = useState({
    tutor: registeredContext?.tutor.name || registeredContext?.tutor.tutor || (canManagePublicAnimalFlows(currentUser.role) ? "" : currentUser.name),
    neighborhood: registeredContext?.tutor.neighborhood || currentUser.neighborhood || "",
    address: registeredContext?.tutor.address || currentUser.address || "",
    cpf: registeredContext?.tutor.cpf || currentUser.cpf || "",
    email: currentUser.role === "tutor" ? currentUser.email || "" : "",
    cep: currentUser.cep || "",
    number: currentUser.number || "",
    city: currentUser.city || "",
    state: currentUser.state || "",
    isFarmer: Boolean(currentUser.isFarmer || currentUser.is_farmer),
    latitude: "",
    longitude: "",
    tutorship: registeredContext?.animal.tutorship || "",
    phone: currentUser.role === "tutor" ? currentUser.phone || "" : "",
    notes: "",
    schedule: initialSchedule,
    municipalityId: initialMunicipalityId || currentUser.municipalityId || "",
    scheduleOccurrenceKey: "",
  });
  const [animals, setAnimals] = useState<AnyRecord[]>([
    registeredContext ? { ...animalForRequest(registeredContext.animal), requestTypeIds: [] } : blankAnimal(),
  ]);
  const [expandedAnimal, setExpandedAnimal] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [documentUploads, setDocumentUploads] = useState<AnyRecord>({});
  const documentUploadGeneration = useRef(0);
  const animalPhotoGeneration = useRef(0);
  const animalPhotoInput = useRef<HTMLInputElement>(null);
  const [animalPhotoLoading, setAnimalPhotoLoading] = useState(false);
  useEffect(() => () => { documentUploadGeneration.current += 1; }, []);
  const [reusedDocuments, setReusedDocuments] = useState<Record<string, ReusableDocumentCandidate>>({});
  const [reusedPreview, setReusedPreview] = useState<ReusableDocumentCandidate | null>(null);
  const [formStep, setFormStep] = useState<RequestStep>(RequestStep.TUTOR);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<AnyRecord | null>(null);
  const [submissionError, setSubmissionError] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpValue>(emptyFollowUp);
  // The public form asks first how the person wants to request: the rest of the step opens for a first request.
  const [firstRequest, setFirstRequest] = useState(false);
  const followUpMunicipalityId = selectedMunicipalityId || requestData.municipalityId || currentUser.municipalityId || "";
  const followUpPolicy = useFollowUpPolicy(followUpMunicipalityId);
  // The notices go to the contacts typed in the first step (or the profile's), so nothing is typed twice.
  const tutorContacts = { email: requestData.email, phone: requestData.phone };
  const availability = useScheduleAvailability(followUpMunicipalityId, initialSchedule);
  const scheduleDays = availability.days;
  useEffect(() => {
    if (!availability.ready || !requestData.schedule || requestData.scheduleOccurrenceKey) return;
    const day = selectScheduleOccurrence(scheduleDays, requestData.schedule, "", Math.max(animals.length, 1));
    if (day) setRequestData((current) => ({ ...current, scheduleOccurrenceKey: day.occurrenceKey }));
  }, [availability.ready, scheduleDays, requestData.schedule, requestData.scheduleOccurrenceKey, animals.length]);

  useEffect(() => {
    if (!registeredContext) return;
    // The procedure chosen for the animal outlives the refresh of its context that the choice itself triggers.
    setAnimals((current) => [{ ...animalForRequest(registeredContext.animal), requestTypeIds: animalRequestTypeIds(current[0]) }]);
    setRequestData((current) => ({ ...current, tutor: registeredContext.tutor.name || registeredContext.tutor.tutor || "", cpf: registeredContext.tutor.cpf, address: registeredContext.tutor.address || "", neighborhood: registeredContext.tutor.neighborhood || "", city: registeredContext.tutor.city || "", state: registeredContext.tutor.state || "", cep: registeredContext.tutor.cep || "", tutorship: registeredContext.animal.tutorship || "" }));
  }, [registeredContext]);

  useEffect(() => {
    setReusedDocuments(registeredContext && !contextLoading ? pickReusableDocuments(registeredContext.documents) : {});
    setReusedPreview(null);
  }, [registeredContext?.documents, contextLoading]);

  useEffect(() => {
    setFollowUp({ ...emptyFollowUp });
  }, [followUpMunicipalityId]);

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

  const configuredRequestTypes = requestTypes
    .filter((type) => type.name.trim() && type.active !== false)
    .filter((type, index, items) => items.findIndex((item) => item.name === type.name) === index);
  const hasConfiguredTypes = configuredRequestTypes.length > 0;
  const breedContext = { requestTypes: configuredRequestTypes, breeds, speciesOptions };
  const neighborhoodList = neighborhoodNames(neighborhoods);

  // A procedure asked for from outside (the animal's own screen) starts as the procedure of the first animal.
  useEffect(() => {
    const type = initialType ? configuredRequestTypes.find((item) => item.name === initialType) : null;
    if (type?.id) setAnimals((current) => (animalRequestTypeIds(current[0]).length ? current : withProceduresAt(current, 0, [type.id], breedContext)));
  }, [initialType, hasConfiguredTypes]);

  // The request types the animals ask for, together: they decide the steps, the tutor and the documents of the request.
  const selectedRequestTypes = resolveRequestTypes({ animals }, configuredRequestTypes);
  const procedureFields = deriveRequestTypeFields(selectedRequestTypes);
  // The declaration the tutor accepts: the words of the municipality, and the fee clause only when a chosen procedure is charged.
  const declaration = renderDeclaration({ municipalityName: municipality?.name, departmentName: municipality?.department_name, charged: selectedRequestTypes.some(isRequestTypeCharged) });
  // Without request types configured there is nothing to choose, so the animals go without procedures, as before.
  const payloadAnimals = (items: AnyRecord[]) => items.map(({ requestTypeIds, ...animal }) => (hasConfiguredTypes ? { ...animal, requestTypeIds } : animal));
  // Whoever is a tutor already (the account, or a registered animal) is not asked whether the animal has one: the answer is "with tutor".
  const tutorshipFixed = registered || currentUser.role === "tutor";
  const tutorship = registeredContext ? (registeredContext.animal.tutorship || AnimalTutorship.WITH_TUTOR)
    : currentUser.role === "tutor" ? AnimalTutorship.WITH_TUTOR : requestData.tutorship;
  const requiresTutorIdentity = currentUser.role === "tutor" || tutorshipRequiresTutor(tutorship);
  const showsTutorFields = tutorship === AnimalTutorship.WITH_TUTOR && !tutorKnown;
  const withoutTutor = tutorship === AnimalTutorship.WITHOUT_TUTOR && !tutorKnown;
  const reachableContacts = availableFollowUpContacts(tutorContacts, followUpPolicy.phoneEnabled);
  // A yes to the notices is sent only with a contact they can reach; without one the step says what is missing.
  const noticesEnabled = followUp.enabled === true && Boolean(reachableContacts.email || reachableContacts.phone);
  const noticesIssues = followUp.enabled ? getFollowUpIssues(followUp, tutorContacts, followUpPolicy.phoneEnabled) : [];
  // Without a tutor nothing about one is sent, whatever was typed before the answer changed; the contacts go only for the notices.
  const sent = requiresTutorIdentity ? requestData
    : { ...requestData, tutor: "", cpf: "", cep: "", number: "", address: "", neighborhood: "", city: "", state: "", latitude: "", longitude: "", ...(noticesEnabled ? {} : { email: "", phone: "" }) };
  const selectedTypeDocuments = mergeProcedureDocuments(selectedRequestTypes.map((type) => (type.documents || [])
    .map((document) => resolveConfiguredDocument(document, documentTypes))
    .map(normalizeDocumentType)
    .filter((document) => document.active !== false)));
  const acceptableUploadStatuses = [DocumentReviewStatus.APPROVED, DocumentReviewStatus.ATTACHED];
  const requiredDocsApproved = selectedTypeDocuments
    .filter((document) => document.required)
    .every((document) => Boolean(reusedDocuments[document.id]?.eligible) || acceptableUploadStatuses.includes(documentUploads[document.id]?.status));
  const hasUploadNeedingReplacement = Object.values(documentUploads)
    .some((upload: AnyRecord) => upload?.status === "attached" && upload?.aiVerdict === "rejected");
  // The staff's documents are optional, but one still being analysed or refused cannot be sent: it would be left out without a word.
  const hasUnsendableDocument = selectedTypeDocuments.some((document) => documentUploads[document.id] && !acceptableUploadStatuses.includes(documentUploads[document.id].status));
  // What goes with the request: the documents the types ask for that were accepted, and the animal's photo.
  const uploadedDocumentsToSend = [
    ...selectedTypeDocuments.map((document) => documentUploads[document.id]).filter((upload) => upload && acceptableUploadStatuses.includes(upload.status)),
    ...(documentUploads.animal_photo ? [documentUploads.animal_photo] : []),
  ];
  const contactIssues = registrationContactIssues(requestData.email, requestData.phone, showsTutorFields || (withoutTutor && followUp.enabled === true), showsTutorFields);
  const requiredIssues = getRequestValidationIssues();
  const canSubmit = requiredIssues.length === 0;
  const currentStepIndex = Math.max(requestSteps.findIndex((item) => item.step === formStep), 0);
  function selectedScheduleHasCapacity() {
    if (!requestData.schedule) return false;
    const selectedDay = selectScheduleOccurrence(scheduleDays, requestData.schedule, requestData.scheduleOccurrenceKey, Math.max(animals.length, 1));
    if (!selectedDay || isPastScheduleDay(selectedDay.date)) return false;
    return Boolean(getAvailableScheduleSlot(selectedDay, Math.max(animals.length, 1)));
  }

  // Every change to the animals that can change the procedures of the whole request goes through here: what was attached for the old
  // requirements is dropped, as it was when the single request type changed.
  function commitAnimals(next: AnyRecord[], expand?: number) {
    if (procedureSignature(next) !== procedureSignature(animals)) {
      documentUploadGeneration.current += 1;
      setAnimalPhotoLoading(false);
      setReusedDocuments({}); setDocumentUploads({}); setAccepted(false);
    }
    setAnimals(next);
    if (expand !== undefined) setExpandedAnimal(expand);
  }

  function addAnimal() {
    commitAnimals([...animals, blankAnimal()], animals.length);
  }

  function duplicatePreviousAnimal() {
    commitAnimals(duplicateAnimal(animals, animals.length - 1), animals.length);
  }

  function applyFirstProceduresToAll() {
    commitAnimals(applyProceduresToAll(animals, 0, breedContext));
  }

  function changeProcedures(index: number, ids: string[]) {
    commitAnimals(withProceduresAt(animals, index, ids, breedContext));
  }

  function updateAnimal(index, field, value) {
    setAnimals((current) =>
      current.map((animal, animalIndex) => (animalIndex === index ? { ...animal, [field]: value } : animal)),
    );
  }

  // Changing the species changes the breed options, so the chosen breed is cleared.
  function selectSpecies(index, value) {
    setAnimals((current) =>
      current.map((animal, animalIndex) => (
        animalIndex === index && animal.species !== value ? { ...animal, species: value, breedDescription: "" } : animal
      )),
    );
  }

  // The animal of an existing registration asks for one procedure: choosing it asks for the requirements of that procedure again.
  function selectRegisteredProcedure(name) {
    const type = configuredRequestTypes.find((item) => item.name === name);
    if (!type?.id || animalRequestTypeIds(animals[0])[0] === type.id) return;
    commitAnimals(withProceduresAt(animals, 0, [type.id], breedContext));
    onRequestTypeChange?.(type.id);
  }

  function removeAnimal(indexToRemove) {
    commitAnimals(animals.filter((_, index) => index !== indexToRemove));
  }

  function updateRequestField(field, value) {
    setRequestData((current) => ({ ...current, [field]: value }));
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
    if (animalPhotoLoading) issues.push("Aguarde a leitura da foto do animal.");
    if (onRegisteredAnimal && !firstRequest) issues.push("Informe como deseja solicitar.");
    if (!tutorshipFixed && !tutorship) issues.push("Informe se o animal tem alguém que cuida dele.");
    if (followUp.enabled === null) issues.push("Informe se quer acompanhar a solicitação.");
    const filledAnimals = animals.length > 0 ? animals : [{}];
    if (registered && (contextLoading || registeredContext.eligibility?.canSubmit === false)) issues.push(registeredContext.eligibility?.reason || "Aguarde a validação do cadastro ou procure o atendimento.");

    // The term and the required documents are the public form's only; everything else is asked of both forms.
    if (!internalSimple && !accepted) issues.push("Leia e aceite a declaração para encerrar o cadastro.");
    if (!requestData.schedule) issues.push("Escolha uma data disponível.");
    else if (!selectedScheduleHasCapacity()) issues.push("Escolha uma data com vagas suficientes para todos os animais.");
    filledAnimals.forEach((animal, index) => {
      if (registered) {
        if (needsProcedure(animal, hasConfiguredTypes)) issues.push("Selecione o tipo de solicitação.");
        if (!animal.species || !animal.sex || !animal.size || !animal.breedType) issues.push("O cadastro do animal está incompleto. Procure o atendimento para conferência.");
        return;
      }
      const label = filledAnimals.length > 1 ? ` do animal ${index + 1}` : " do animal";
      if (needsProcedure(animal, hasConfiguredTypes)) issues.push(`Escolha ao menos um procedimento${label}.`);
      if (!animal.species) issues.push(`Selecione a espécie${label}.`);
      if (!animal.sex) issues.push(`Selecione o sexo${label}.`);
      if (!animal.size) issues.push(`Selecione o porte${label}.`);
      if (!animal.breedType) issues.push(`Informe se a raça é definida ou indefinida${label}.`);
      if (!animal.neighborhood) issues.push(`Informe o bairro${label}.`);
    });
    if (!internalSimple && !requiredDocsApproved) issues.push("Anexe ou reaproveite os documentos obrigatórios. Arquivos pendentes serão conferidos pela equipe.");
    if (hasUploadNeedingReplacement) issues.push("Um dos arquivos anexados não corresponde ao documento solicitado. Anexe o comprovante correto antes de continuar.");
    if (hasUnsendableDocument) issues.push("Aguarde a análise ou remova o anexo recusado antes de continuar.");
    if ((requiresTutorIdentity || requestData.cpf) && !isValidCpf(requestData.cpf)) issues.push("Informe um CPF válido.");
    if (requiresTutorIdentity && validateTutorName(requestData.tutor)) issues.push(validateTutorName(requestData.tutor));
    if (!registered && contactIssues.email) issues.push(contactIssues.email);
    if (contactIssues.phone) issues.push(contactIssues.phone);
    if (followUp.enabled) {
      if (!followUpPolicy.ready) issues.push(followUpPolicy.error || "Aguarde o carregamento dos canais de acompanhamento.");
      issues.push(...noticesIssues);
    }

    return issues;
  }

  function getStepIssues(step = formStep) {
    if (step === RequestStep.TUTOR) {
      return [
        Boolean(onRegisteredAnimal) && !firstRequest,
        !tutorship,
        ...(showsTutorFields ? [!isValidCpf(requestData.cpf), validateTutorName(requestData.tutor)] : []),
        contactIssues.email, contactIssues.phone,
        followUp.enabled === null,
        ...(followUp.enabled ? [!followUpPolicy.ready, ...noticesIssues] : []),
      ].filter(Boolean);
    }

    if (step === RequestStep.ANIMAL) {
      if (registered && (contextLoading || registeredContext.eligibility?.canSubmit === false)) return [true];
      return animals
        .flatMap((animal) => [
          needsProcedure(animal, hasConfiguredTypes),
          !animal.species,
          !animal.sex,
          !animal.size,
          !animal.breedType,
          !animal.neighborhood,
        ])
        .filter(Boolean);
    }

    if (step === RequestStep.SCHEDULE) {
      return [!requestData.schedule || !selectedScheduleHasCapacity()].filter(Boolean);
    }

    if (step === RequestStep.DOCUMENTS) {
      return [!internalSimple && !requiredDocsApproved, !internalSimple && !accepted, hasUploadNeedingReplacement, hasUnsendableDocument].filter(Boolean);
    }

    return [];
  }

  function showInvalid(field) {
    if (!submitAttempted) return false;
    const firstAnimal: AnyRecord = animals[0] || {};
    const checks = {
      tutor: requiresTutorIdentity && Boolean(validateTutorName(requestData.tutor)),
      cpf: (requiresTutorIdentity || Boolean(requestData.cpf)) && !isValidCpf(requestData.cpf),
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
    const targetIndex = requestSteps.findIndex((item) => item.step === targetStep);
    if (targetIndex < 0 || targetIndex === currentStepIndex) return;

    if (targetIndex < currentStepIndex) {
      setSubmitAttempted(false);
      setFormStep(targetStep);
      return;
    }

    for (let index = currentStepIndex; index < targetIndex; index += 1) {
      const step = requestSteps[index].step;
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
        neighborhood: neighborhoodList.length ? findNeighborhoodName(neighborhoodList, data.bairro) || current.neighborhood : data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
    } catch {
      // busca de CEP é apenas conveniência; falha silenciosa não bloqueia o preenchimento manual
    }
  }

  async function handleDocumentFile(document: AnyRecord, file?: File) {
    if (!file) return;
    const generation = documentUploadGeneration.current;
    setReusedDocuments((current) => { const next = { ...current }; delete next[document.id]; return next; });

    try {
      const normalizedDocument = normalizeDocumentType(document);
      const documentUsesAi = normalizedDocument.analysisRules?.useAi !== false;
      const shouldAnalyzeWithAi = aiSettings.active && documentUsesAi;
      const dataUrl = await readFileAsDataUrl(file);
      if (generation !== documentUploadGeneration.current) return;
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
      if (generation !== documentUploadGeneration.current) return;
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
      if (generation !== documentUploadGeneration.current) return;
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
    const generation = documentUploadGeneration.current;
    const photoGeneration = ++animalPhotoGeneration.current;
    setReusedDocuments((current) => removeReusedDocument(current, "animal_photo"));
    removeDocumentFile("animal_photo");
    setAnimalPhotoLoading(true);
    setSubmissionError("");
    const isCurrentPhoto = () => generation === documentUploadGeneration.current && photoGeneration === animalPhotoGeneration.current;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (!isCurrentPhoto()) return;
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
      if (isCurrentPhoto()) setSubmissionError("Não foi possível anexar a foto do animal. Selecione o arquivo novamente ou envie sem a foto opcional.");
    } finally {
      if (isCurrentPhoto()) setAnimalPhotoLoading(false);
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
      const firstInvalidStep = requestSteps.find((item) => getStepIssues(item.step).length > 0);
      const nextMessage = requiredIssues[0] || "Revise os dados obrigatórios antes de enviar.";
      setSubmissionError(nextMessage);
      if (firstInvalidStep && firstInvalidStep.step !== formStep) {
        setFormStep(firstInvalidStep.step);
      }
      return;
    }
    setSubmitting(true);
    try {
      // The staff and the public send the same request; each adds only what is its own: the notes and the origin, or the term.
      const own = internalSimple
        ? { notes: sent.notes || "", signedAt: "", tags: [], origin: RequestOrigin.INTERNAL }
        : { declarationAccepted: accepted, signedAt: new Date().toISOString() };
      await sendRequest({ ...(await buildRequestSubmission()), ...own });
    } finally {
      setSubmitting(false);
    }
  }

  function openDeclarationPdf() {
    const html = buildDeclarationPdfHtml(requestData, animals.map((animal) => ({ ...animal, procedures: procedureNames(animal, configuredRequestTypes).join(", ") })), declaration);
    printHtmlViaIframe(html);
  }

  // What the staff and the public send in common: the tutor, the animals, the date chosen, the notices and the documents.
  async function buildRequestSubmission() {
    const selectedScheduleDay = selectScheduleOccurrence(scheduleDays, sent.schedule, sent.scheduleOccurrenceKey, Math.max(animals.length, 1));
    const selectedScheduleSlot = getAvailableScheduleSlot(selectedScheduleDay, Math.max(animals.length, 1));
    const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    const addressString = [sent.address, sent.number, sent.neighborhood, sent.city, sent.state, sent.cep].filter(Boolean).join(", ");
    const hasGpsCoords = sent.latitude && sent.longitude;
    const { latitude, longitude } = hasGpsCoords
      ? { latitude: sent.latitude, longitude: sent.longitude }
      : (mapsApiKey && addressString ? await geocodeAddress(addressString, mapsApiKey) : { latitude: "", longitude: "" });
    const tutorshipAnswer = tutorship ? { tutorship } : {};
    return {
      tutor: sent.tutor || (currentUser.role === "tutor" ? currentUser.name : ""),
      neighborhood: sent.neighborhood || "Bairro não informado",
      address:
        [sent.address, sent.number, sent.neighborhood, sent.city, sent.state]
          .filter(Boolean)
          .join(", ") || "Endereço não informado",
      type: procedureFields.requestType || "Cadastro animal",
      requestTypeId: registeredContext ? selectedRequestTypes[0]?.id || "" : "",
      fee: combineRequestFees(selectedRequestTypes),
      phone: sent.phone || "",
      cpf: sent.cpf || "",
      email: sent.email || "",
      cep: sent.cep || "",
      preferredSchedule: sent.schedule || "",
      municipalityId: followUpMunicipalityId || selectedScheduleDay?.municipalityId || "",
      scheduleTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
      scheduleSlotTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
      scheduleLocationName: selectedScheduleDay?.locationName || "",
      scheduleAddress: selectedScheduleDay?.locationAddress || "",
      scheduleAddressUrl: selectedScheduleDay?.addressUrl || "",
      scheduleMunicipality: selectedScheduleDay?.municipality || sent.city || "",
      responsibleUnit: selectedScheduleDay?.responsibleUnit || selectedScheduleDay?.unit || "",
      veterinarian: selectedScheduleDay?.veterinarian || selectedScheduleDay?.responsible || "",
      latitude,
      longitude,
      workflowData: {
        isFarmer: sent.isFarmer,
        scheduleTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
        scheduleSlotTime: selectedScheduleSlot?.time || selectedScheduleDay?.startTime || "",
        scheduleOccurrenceKey: selectedScheduleDay?.occurrenceKey || "",
        ...tutorshipAnswer,
        followUp: buildFollowUpPayload({ enabled: noticesEnabled }, tutorContacts, followUpPolicy.phoneEnabled),
      },
      animalId: registeredContext?.animal.id || "",
      animals: registeredContext ? [{ id: registeredContext.animal.id }] : payloadAnimals(animals.map((animal) => ({
        ...animal,
        ...tutorshipAnswer,
        name: animal.name || "",
        age: animal.birthDate || animal.age || "",
      }))),
      ...buildDocumentSubmission(uploadedDocumentsToSend, reusedDocuments),
    };
  }

  async function sendRequest(payload) {
    try {
      const created = await createRequest(payload);
      const protocol = String(created?.protocol || "").trim();
      if (!protocol) {
        setSubmissionError("Não foi possível obter o protocolo. Confira o envio antes de tentar novamente.");
        return;
      }
      onDone?.(normalizeRequest({ ...payload, ...created, protocol }));
    } catch (err) {
      if (err?.status === 409) availability.refresh();
      setSubmissionError(err?.message || "Falha ao enviar solicitação. Tente novamente.");
    }
  }

  const RequestButton = internalSimple ? "button" : Button;
  const animalActionStyle = internalSimple ? "anm-add-btn" : "tw:min-w-0 tw:flex-1 tw:whitespace-normal tw:text-center tw:text-[color:var(--ui-action)]";
  const uploadedPhoto = documentUploads.animal_photo;

  return (
    <>
      <RequestFormLayout
        stepIndex={currentStepIndex}
        stepInvalid={submitAttempted && getStepIssues(formStep).length > 0}
        internal={internalSimple}
        exit={onBack ? { label: backLabel, onClick: onBack } : undefined}
        onNavigate={navigateToStep}
        onSubmit={submit}
        submitting={submitting}
        submitDisabled={animalPhotoLoading || contextLoading || registeredContext?.eligibility?.canSubmit === false
          || (followUp.enabled === true && (!followUpPolicy.ready || noticesIssues.length > 0))}
        error={submissionError}
        actions={formStep === RequestStep.ANIMAL && !registered && (
          <>
            <RequestButton className={animalActionStyle} variant={internalSimple ? undefined : "outline"} type="button" onClick={addAnimal}>
              <PlusCircle size={18} aria-hidden="true" />
              Adicionar outro animal
            </RequestButton>
            <RequestButton className={animalActionStyle} variant={internalSimple ? undefined : "outline"} type="button" onClick={duplicatePreviousAnimal}>
              <RefreshCw size={18} aria-hidden="true" />
              Repetir os dados do anterior
            </RequestButton>
          </>
        )}
      >
          {formStep === RequestStep.TUTOR && <div className="form-section">
            <RequesterStep
              entry={onRegisteredAnimal ? { first: firstRequest, onFirst: () => setFirstRequest(true), onRegistered: onRegisteredAnimal } : undefined}
              tutorship={tutorship}
              tutorshipFixed={tutorshipFixed}
              tutorKnown={tutorKnown}
              showErrors={submitAttempted}
              onTutorshipChange={(value) => {
                // The acceptance of the notices belongs to the answer it was given under: a new answer starts it unchecked again.
                if (value !== tutorship) setFollowUp({ ...emptyFollowUp });
                updateRequestField("tutorship", value);
              }}
              tutorFields={{
                data: requestData,
                internal: internalSimple,
                nameInvalid: showInvalid("tutor"),
                nameIssue: validateTutorName(requestData.tutor),
                cpfInvalid: showInvalid("cpf"),
                neighborhoodNames: neighborhoodList,
                showErrors: submitAttempted,
                onField: updateRequestField,
                onMaskedField: updateMaskedRequestField,
                onCepChange: lookupCep,
              }}
              contacts={tutorContacts}
              followUp={followUp}
              onFollowUpChange={setFollowUp}
              policy={{ loading: followUpPolicy.loading, error: followUpPolicy.error, phoneEnabled: followUpPolicy.phoneEnabled, retry: followUpPolicy.retry }}
            />
          </div>}

          {formStep === RequestStep.ANIMAL && <div className="form-section">
            {registeredContext ? <><RegisteredRequestSelection context={registeredContext} selectedType={selectedRequestTypes[0]?.name || ""} onSelectType={selectRegisteredProcedure} />{contextLoading && <p role="status">Atualizando os requisitos do procedimento...</p>}</> : <>
            {animals.map((animal, index) => {
              const header = animalHeader(animal, index);
              return (
                <AnimalAccordionCard
                  key={`animal-${index}`}
                  index={index}
                  title={header.title}
                  detail={header.detail}
                  open={animals.length === 1 || expandedAnimal === index}
                  collapsible={animals.length > 1}
                  internal={internalSimple}
                  onToggle={() => setExpandedAnimal(expandedAnimal === index ? -1 : index)}
                >
                  <AnimalFields
                    procedures={hasConfiguredTypes && (
                      <RequestProcedureList
                        types={configuredRequestTypes}
                        selectedIds={animalRequestTypeIds(animal)}
                        onChange={(ids) => changeProcedures(index, ids)}
                        invalid={submitAttempted && needsProcedure(animal, hasConfiguredTypes)}
                      />
                    )}
                    animal={animal}
                    speciesNames={activeSpecies}
                    sizeChoices={sizeChoiceOptions}
                    breedOptions={breedOptionsFor(animal, breedContext)}
                    neighborhoodNames={neighborhoodList}
                    submitAttempted={submitAttempted}
                    internal={internalSimple}
                    onChange={(field, value) => updateAnimal(index, field, value)}
                    onSelectSpecies={(value) => selectSpecies(index, value)}
                  />
                  {animals.length > 1 && (
                    <RequestButton className={internalSimple ? "animal-remove-inline" : "tw:self-start"} variant={internalSimple ? undefined : "danger"} type="button" onClick={() => { removeAnimal(index); setExpandedAnimal(Math.max(0, index - 1)); }}>
                      Remover animal {index + 1}
                    </RequestButton>
                  )}
                </AnimalAccordionCard>
              );
            })}
            {animals.length > 1 && hasConfiguredTypes && (
              <div className="anm-actions-row">
                <RequestButton className={internalSimple ? "ghost-button" : "tw:whitespace-normal"} variant={internalSimple ? undefined : "outline"} type="button" onClick={applyFirstProceduresToAll} disabled={animalRequestTypeIds(animals[0]).length === 0}>
                  Aplicar os procedimentos do Animal 1 a todos
                </RequestButton>
              </div>
            )}
            </>}
          </div>}

          {formStep === RequestStep.SCHEDULE && <div className="form-section">
            {availability.loading && <p role="status">Carregando vagas disponíveis...</p>}
            {availability.error && <p className="form-error" role="alert">{availability.error} <RequestButton type="button" className={internalSimple ? "ghost-button" : undefined} variant={internalSimple ? undefined : "outline"} onClick={availability.refresh}>Tentar novamente</RequestButton></p>}
            <PublicSchedulePicker
              external={!internalSimple}
              scheduleDays={scheduleDays}
              selectedDate={requestData.schedule}
              selectedOccurrenceKey={requestData.scheduleOccurrenceKey}
              pendingReservation={{ date: requestData.schedule, count: animals.length }}
              onSelect={(date, occurrenceKey) => setRequestData((current) => ({ ...current, schedule: date, scheduleOccurrenceKey: occurrenceKey }))}
              title="Escolha o melhor dia para o atendimento"
              hint="Os dias em destaque têm vagas. Toque em um para escolher."
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
          </div>}

          {formStep === RequestStep.DOCUMENTS && <div className="form-section">
            <div className="form-sub-card documents-step-card">
              <div className="documents-step-header">
                <span className="form-sub-card-title">{internalSimple ? "Documentos" : "Quase lá! Faltam só os documentos"}</span>
                {internalSimple && <small>Anexe os comprovantes do tutor. Os pendentes ficam para conferência da equipe.</small>}
              </div>

              <div className="documents-step-grid">
                <aside className="documents-photo-column">
                  {internalSimple ? <label className="doc-photo-zone doc-photo-zone--compact">
                    {documentUploads.animal_photo?.dataUrl ? (
                      <img className="doc-photo-preview" src={documentUploads.animal_photo.dataUrl} alt="Foto do animal" onClick={(e) => { e.preventDefault(); setPreviewDocument(documentUploads.animal_photo); }} />
                    ) : (
                      <div className="doc-photo-placeholder">
                        <ImagePlus size={22} />
                        <span>{animalPhotoLoading ? "Carregando foto..." : reusedDocuments.animal_photo?.fileName || "Foto do animal"}</span>
                        <small>{reusedDocuments.animal_photo ? "Foto reaproveitada" : "Opcional"}</small>
                      </div>
                    )}
                    <input type="file" accept="image/*" onClick={(e) => { e.currentTarget.value = ""; }} onChange={(e) => handleAnimalPhotoFile(e.target.files?.[0])} />
                    {documentUploads.animal_photo && (
                      <button className="doc-photo-remove" type="button" onClick={(e) => { e.preventDefault(); removeDocumentFile("animal_photo"); }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </label> : (
                    <Card className="tw:grid tw:justify-items-center tw:gap-3 tw:p-3 tw:text-center">
                      {uploadedPhoto?.dataUrl ? (
                        <img className="tw:max-h-40 tw:w-full tw:rounded-[var(--ui-radius-md)] tw:object-contain" src={uploadedPhoto.dataUrl} alt="Foto do animal" />
                      ) : <ImagePlus size={22} aria-hidden="true" className="tw:text-ui-accent" />}
                      <span className="tw:text-sm tw:font-medium" role={animalPhotoLoading ? "status" : undefined}>
                        {animalPhotoLoading ? "Carregando foto..." : reusedDocuments.animal_photo?.fileName || "Foto do animal"}
                      </span>
                      <small className="tw:text-ui-muted">{reusedDocuments.animal_photo ? "Foto reaproveitada" : "Opcional"}</small>
                      <input ref={animalPhotoInput} type="file" accept="image/*" hidden onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} />
                      <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-2">
                        <Button variant="outline" disabled={animalPhotoLoading} onClick={() => animalPhotoInput.current?.click()}>{uploadedPhoto ? "Substituir foto" : "Anexar foto"}</Button>
                        {uploadedPhoto?.dataUrl && <Button variant="outline" onClick={() => setPreviewDocument(uploadedPhoto)}>Ver foto</Button>}
                        {uploadedPhoto && <Button variant="danger" onClick={() => removeDocumentFile("animal_photo")}>Remover foto</Button>}
                      </div>
                    </Card>
                  )}
                  {registeredContext && !contextLoading && <ReusableDocumentChoices candidates={registeredContext.documents.filter((candidate) => candidate.documentId === "animal_photo")} selected={reusedDocuments.animal_photo} onSelect={(candidate) => { animalPhotoGeneration.current += 1; setAnimalPhotoLoading(false); removeDocumentFile("animal_photo"); setReusedDocuments((current) => ({ ...current, animal_photo: candidate })); }} onPreview={setReusedPreview} onRemove={() => setReusedDocuments((current) => removeReusedDocument(current, "animal_photo"))} />}
                </aside>

                <div className="documents-main-column">
                  <div className="documents-list-card">
                    {selectedRequestTypes.length === 0 && (
                      <div className="doc-empty-note">
                        <BadgeCheck size={16} />
                        <span>Nenhum documento obrigatório para este cadastro.</span>
                      </div>
                    )}
                    {selectedTypeDocuments.map((document) => {
                      const upload = documentUploads[document.id];
                      const selectedReuse = reusedDocuments[document.id];
                      return (
                        <div key={document.id}>
                        {registeredContext && !contextLoading && <ReusableDocumentChoices candidates={registeredContext.documents.filter((candidate) => candidate.documentId === document.id)} selected={selectedReuse} onSelect={(candidate) => { removeDocumentFile(document.id); setReusedDocuments((current) => ({ ...current, [document.id]: candidate })); }} onPreview={setReusedPreview} onRemove={() => setReusedDocuments((current) => { const next = { ...current }; delete next[document.id]; return next; })} />}
                        {!selectedReuse && <DocumentScannerUpload
                          document={document}
                          upload={upload}
                          aiActive={aiSettings.active && document.analysisRules?.useAi !== false}
                          onUpload={(file) => handleDocumentFile(document, file)}
                          onRemove={() => removeDocumentFile(document.id)}
                          onPreview={internalSimple ? undefined : setPreviewDocument}
                        />}
                        </div>
                      );
                    })}
                  </div>

                  {!internalSimple && <div className="doc-declaration">
                    <p>
                      <span>Declaração de responsabilidade</span>{" · "}
                      <Button variant="outline" onClick={openDeclarationPdf}>Ler</Button>
                    </p>
                    <label className={`tw:flex tw:min-h-10 tw:cursor-pointer tw:items-center tw:gap-2 tw:text-sm ${showInvalid("accepted") ? "tw:text-ui-danger" : "tw:text-ui-text"}`}>
                      <input type="checkbox" className="tw:size-5 tw:shrink-0 tw:accent-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" aria-invalid={showInvalid("accepted") || undefined} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                      <span>Li e concordo<span className="required-asterisk">*</span></span>
                    </label>
                  </div>}
                </div>
              </div>
            </div>
          </div>}
      </RequestFormLayout>
      {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} external={!internalSimple} />}
      {reusedPreview && registeredContext && <ReusableDocumentPreview key={`${reusedPreview.attachmentId}:${reusedPreview.reuseRef.hash}`} animalId={registeredContext.animal.id} candidate={reusedPreview} onClose={() => setReusedPreview(null)} />}
    </>
  );
}

function buildDeclarationPdfHtml(requestData, animals = [], declaration) {
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
    ["Agricultor", yesNo(requestData.isFarmer)],
    ["Data da agenda", requestData.schedule],
  ];
  const animalFieldLabels = [
    ["Procedimentos", "procedures"],
    ["Nome", "name"],
    ["Espécie", "species"],
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
  const declarationItems = declaration.items;
  const recommendationItems = declaration.recommendations;

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
export function DocumentPreviewModal({ document, onClose, external = false }: AnyRecord) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const dataUrl = getDocumentPreviewSource(document);
  const mimeType = document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl);
  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const canPreview = Boolean(dataUrl) && (isImage || isPdf);
  const title = document.documentName || document.fileName;

  useEffect(() => {
    if (!external) return;
    const trigger = window.document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => { if (trigger instanceof HTMLElement) trigger.focus(); };
  }, [external]);

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="document-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={external ? title : undefined}
        onKeyDown={external ? (event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } } : undefined}
      >
        {external ? (
          <header className="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:p-2">
            <div className="tw:min-w-0 tw:break-words">
              <h2 className="tw:m-0 tw:text-lg tw:font-semibold tw:text-ui-ink">{title}</h2>
              {document.fileName !== title && <p className="tw:m-0 tw:text-sm tw:text-ui-muted">{document.fileName}</p>}
            </div>
            <CloseButton onClick={onClose} />
          </header>
        ) : <ModalHeader title={title} subtitle={document.fileName !== title ? document.fileName : undefined} onClose={onClose} />}
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
  runProcedureAction,
  createRequest,
  requestTypes = initialRequestTypes,
  documentTypes = initialDocumentTypes,
  speciesOptions = initialSpecies,
  sizeOptions = initialSizes,
  breeds = initialBreeds,
  neighborhoods = initialNeighborhoods,
  refreshRequests,
  aiSettings = initialAiSettings,
  teams = initialTeams,
  municipalities = [],
  globalSearch = "",
  accessRequests = [],
  setActive,
  selectedMunicipalityId = "",
}) {
  const { filters: requestFilters, actions: requestFilterActions } = useRequestFilters();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  // The request just made at the counter: the modal shows its last screen until it is closed.
  const [createdRequest, setCreatedRequest] = useState<AnyRecord | null>(null);
  function closeCreateRequest() {
    setCreateRequestOpen(false);
    setCreatedRequest(null);
  }
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
    updatePreviewTutor,
    activeSectors,
    activeUsers,
    applyProcedureAction,
    updateDocuments,
    assignFromPreview,
    assumeFromPreview,
    rejectRequestFromProcess,
    confirmSpecialRequest,
  } = useRequestActions({ patchRequest, runProcedureAction, currentUser, teams, showToast, setSelectedId });

  const normalizedRequests = useMemo(
    () => (Array.isArray(requests) ? requests : []).map(normalizeRequest),
    [requests],
  );
  const visibleRequests = useMemo(
    () => normalizedRequests.filter((request) => matchesRequestSearch(request, globalSearch)),
    [normalizedRequests, globalSearch],
  );
  const visibleAccessRequests = useMemo(
    () => (Array.isArray(accessRequests) ? accessRequests : [])
      .filter((item) => matchesRequestSearch({ tutor: item.responsibleName, animals: [] }, globalSearch))
      .map((item) => ({
        __source: ACCESS_REQUEST_SOURCE,
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
  const listItems = useMemo(
    () => [...visibleRequests, ...visibleAccessRequests],
    [visibleRequests, visibleAccessRequests],
  );
  const {
    activeRequests,
    counts: filterCounts,
    typeOptions,
    assigneeOptions,
    pills: filterPills,
  } = useRequestFilterResults({
    filters: requestFilters,
    normalizedRequests,
    listItems,
    users: teams.users,
    today,
  });
  const emptyMessage = getEmptyListMessage(requestFilters);
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

          <RequestFiltersToolbar
            todayOnly={requestFilters.todayOnly}
            todayCount={filterCounts.today}
            activePillCount={filterPills.length}
            drawerOpen={filtersDrawerOpen}
            onToggleToday={requestFilterActions.toggleToday}
            onOpenDrawer={() => setFiltersDrawerOpen(true)}
          />
      </div>
      <ActiveFiltersBar
        filters={requestFilters}
        resultCount={activeRequests.length}
        pills={filterPills}
        onClearDimension={requestFilterActions.clearDimension}
        onClearAll={requestFilterActions.clearAll}
      />
      <div className="triage-card-grid">
        {activeRequests.length === 0 && (
          <EmptyState
            title={emptyMessage.title}
            text={emptyMessage.text}
            action={emptyMessage.canClear ? "Limpar filtros" : undefined}
            onAction={requestFilterActions.clearAll}
          />
        )}
        {activeRequests.map((request) => {
          const isAccessRequest = request.__source === ACCESS_REQUEST_SOURCE;
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

      {filtersDrawerOpen && (
        <RequestFiltersDrawer
          filters={requestFilters}
          counts={filterCounts}
          typeOptions={typeOptions}
          assigneeOptions={assigneeOptions}
          resultCount={activeRequests.length}
          onToggleStage={requestFilterActions.toggleStage}
          onToggleType={requestFilterActions.toggleType}
          onToggleAssignee={requestFilterActions.toggleAssignee}
          onClearAll={requestFilterActions.clearAll}
          onClose={() => setFiltersDrawerOpen(false)}
        />
      )}

      {previewRequest && (
        <ProcessModal
          key={previewRequest.id}
          request={previewRequest}
          readOnly={!canEditRequests(currentUser?.role)}
          neighborhoods={neighborhoods}
          onTutorSaved={(tutor) => { updatePreviewTutor(tutor); refreshRequests?.(); }}
          requestTypes={requestTypes}
          documentTypes={documentTypes}
          sectors={activeSectors}
          users={activeUsers}
          municipalities={municipalities}
          currentUserName={currentUser?.name || ""}
          onClose={closeRequestPreview}
          onRejectProcess={rejectRequestFromProcess}
          onAssign={assignFromPreview}
          onAssume={assumeFromPreview}
          onConfirmSpecial={confirmSpecialRequest}
          onProcedureAction={applyProcedureAction}
          onUpdateDocuments={updateDocuments}
        />
      )}

      {createRequestOpen && (
        <div className="modal-backdrop">
          <div className="internal-request-modal" role="dialog" aria-modal="true" aria-labelledby="internal-request-title">
            <div className="irm-header">
              <div className="irm-header-text">
                <strong id="internal-request-title">Nova solicitação</strong>
              </div>
              <button className="irm-close-btn" type="button" aria-label="Fechar" onClick={closeCreateRequest}>
                <X size={18} />
              </button>
            </div>
            {createdRequest ? (
              <div className="nr-body">
                <RequestDoneCard
                  internal
                  protocol={createdRequest.protocol}
                  followUp={(createdRequest.workflow_data || createdRequest.workflowData)?.followUp}
                  createRequirement={() => createRequestPdfDataUrl(createdRequest, municipalities.find((item) => item.id === createdRequest.municipalityId))}
                  closeLabel="Fechar"
                  onClose={closeCreateRequest}
                />
              </div>
            ) : (
              <NewRequest
                key={`internal-procedure-${selectedMunicipalityId || currentUser.municipalityId || ""}`}
                createRequest={createRequest}
                currentUser={currentUser}
                selectedMunicipalityId={selectedMunicipalityId || currentUser.municipalityId || ""}
                initialMunicipalityId={selectedMunicipalityId || currentUser.municipalityId || ""}
                internalSimple
                onDone={setCreatedRequest}
                requestTypes={requestTypes}
                aiSettings={aiSettings}
                speciesOptions={speciesOptions}
                sizeOptions={sizeOptions}
                breeds={breeds}
                neighborhoods={neighborhoods}
              />
            )}
          </div>
        </div>
      )}

    </section>
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


function AdoptionView({
  adoptionAnimals,
  setAdoptionAnimals,
  currentUser,
  speciesOptions = initialSpecies,
  selectedMunicipalityId = "",
}) {
  const MAX_ADOPTION_PHOTOS = 5;
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

    // The photos are made light first (so a link preview shows them), and the limits apply to what will be stored.
    Promise.all(files.map(compressAdoptionPhoto)).then((photos) => {
      if (photos.some((photo) => estimatePhotoBytes(photo) > MAX_ADOPTION_PHOTO_BYTES)) {
        setFormError(`Cada imagem pode ter no máximo ${Math.floor(MAX_ADOPTION_PHOTO_BYTES / (1024 * 1024))} MB.`);
        selectedInput.value = "";
        return;
      }
      const currentTotalBytes = animalForm.photos.reduce((total, photo) => total + estimatePhotoBytes(photo), 0);
      const incomingBytes = photos.reduce((total, photo) => total + estimatePhotoBytes(photo), 0);
      if (currentTotalBytes + incomingBytes > MAX_ADOPTION_TOTAL_BYTES) {
        setFormError(`Total de imagens excedido. Limite: ${Math.floor(MAX_ADOPTION_TOTAL_BYTES / (1024 * 1024))} MB.`);
        selectedInput.value = "";
        return;
      }
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
                  const interestCount = getAdoptionInterestCount(animal);
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
                            {animal.status !== ADOPTION_STATUS_ADOPTED && <ShareAdoptionButton animal={animal} look={ShareButtonLook.ICON} />}
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
                  const interestCount = getAdoptionInterestCount(animal);
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
                          {animal.status !== ADOPTION_STATUS_ADOPTED && <ShareAdoptionButton animal={animal} look={ShareButtonLook.ICON} />}
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
    <div className="tw:grid tw:grid-cols-2 tw:gap-1.5" role="group" aria-label="Tipo de agenda">
      {["Agenda", "Mutirao"].map((option) => (
        <Button
          key={option}
          variant="custom"
          aria-pressed={value === option}
          className="tw:min-w-0 tw:px-2 tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:aria-pressed:border-ui-accent tw:aria-pressed:bg-ui-accent-soft tw:aria-pressed:text-ui-accent-strong"
          onClick={() => onChange(option)}
        >
          {option === "Agenda" ? "Agenda normal" : "Mutirão"}
        </Button>
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
    <Card as="section" className={`document-criteria-column document-criteria-column--${accent}`}>
      <header className="document-criteria-column-header">
        <span>{label}</span>
        <span className="document-criteria-count">{count}</span>
      </header>
      <textarea
        data-ui-input=""
        className={`${configTextareaStyle} tw:min-h-0 tw:flex-1 tw:resize-none`}
        aria-label={label}
        value={value}
        placeholder={placeholder || "Um crit\u00e9rio por linha\u2026"}
        onChange={(event) => onChange(event.target.value)}
      />
    </Card>
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
  breeds = initialBreeds,
  setBreeds,
  neighborhoods = initialNeighborhoods,
  setNeighborhoods,
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
  const emptyRequestType = { name: "", charged: false, fee: "Gratuito", billingDescription: "", billingAmount: "", billingDueDate: "", active: true, overrideDailyLimit: false, breedIds: [] };
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
  const [requestTypeSaving, setRequestTypeSaving] = useState(false);
  const [requestTypeSaveError, setRequestTypeSaveError] = useState("");
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
    reuseScope: String(DocumentReuseScope.REQUEST),
    reuseValidityDays: "",
  };
  const [newDocument, setNewDocument] = useState(emptyDocumentForm);
  const [documentPolicyError, setDocumentPolicyError] = useState("");
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
  const [newMunicipality, setNewMunicipality] = useState<MunicipalityForm>(emptyMunicipalityForm);
  const [editingMunicipalityId, setEditingMunicipalityId] = useState(null);
  const [municipalitySaving, setMunicipalitySaving] = useState(false);
  const [municipalitySaveStatus, setMunicipalitySaveStatus] = useState("");
  const [editingTeamUserId, setEditingTeamUserId] = useState(null);
  const [userModal, setUserModal] = useState(false);
  const [sectorPickerOpen, setSectorPickerOpen] = useState(false);
  const [municipalityStateFilter, setMunicipalityStateFilter] = useState("");
  const [userSaveError, setUserSaveError] = useState("");
  const [agendaForm, setAgendaForm] = useState(emptyAgendaForm);
  const [aiSaveStatus, setAiSaveStatus] = useState("");
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
      setConfigTab((current) => (integrationsTabs.some((tab) => tab.id === current) ? current : integrationsTabs[0]?.id || ""));
      return;
    }
    setConfigTab(configArea);
  }, [configArea, integrationsTabs.map((tab) => tab.id).join("|")]);

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

  async function saveScopedConfigCatalog(
    key: string,
    municipalityId: string,
    update: (current: AnyRecord[]) => AnyRecord[],
    setItems: React.Dispatch<React.SetStateAction<AnyRecord[]>>,
  ) {
    if (!municipalityId) throw new Error("Selecione um município para salvar esta configuração.");
    const municipality = municipalities.find((item) => item.id === municipalityId) || { id: municipalityId };
    const current = await api.getConfig(key, municipalityId);
    if (current !== null && !Array.isArray(current)) throw new Error("Não foi possível carregar a configuração atual do município.");
    const saved = await api.setConfig(key, update(scopeConfigItems(current, municipality)), municipalityId);
    if (!Array.isArray(saved?.value)) throw new Error("Não foi possível confirmar o salvamento.");
    setItems((items) => mergeScopedConfigItems(items, scopeConfigItems(saved.value, municipality), municipalityId));
  }

  function buildRequestType(payload: AnyRecord, municipalityId: string) {
    const billingAmount = payload.billingAmount || payload.fee || "";
    const selectedDocuments = payload.documents?.length
      ? payload.documents
      : filterByMunicipalityScope(documentTypes, municipalityId).filter((document) => document.active !== false);
    return {
      id: `tipo_${Date.now()}`,
      name: payload.name || "",
      fee: payload.charged ? billingAmount : "Gratuito",
      charged: Boolean(payload.charged),
      billingDescription: payload.charged ? payload.billingDescription || "" : "",
      billingAmount: payload.charged ? billingAmount : "",
      billingDueDate: payload.charged ? payload.billingDueDate || "" : "",
      active: payload.active !== false,
      overrideDailyLimit: Boolean(payload.overrideDailyLimit),
      municipalityId,
      documents: selectedDocuments,
      breedIds: Array.isArray(payload.breedIds) ? payload.breedIds : [],
    };
  }

  function closeRequestTypeEditor() {
    setNewRequestType(emptyRequestType);
    setEditingRequestTypeId(null);
    setRequestTypeSaveError("");
    setConfigModal(null);
  }

  async function saveRequestType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestTypeSaving) return;
    const municipalityId = newRequestType.municipalityId || configMunicipalityScopeId;
    const update = (current: AnyRecord[]) => editingRequestTypeId
      ? current.map((type) => (
        type.id === editingRequestTypeId && getItemMunicipalityId(type) === municipalityId
          ? { ...type, ...newRequestType }
          : type
      ))
      : [...current, buildRequestType(newRequestType, municipalityId)];
    setRequestTypeSaving(true);
    setRequestTypeSaveError("");
    try {
      if (isGlobalRole(currentUser?.role)) {
        await saveScopedConfigCatalog(CONFIG_KEYS.requestTypes, municipalityId, update, setRequestTypes);
      } else {
        setRequestTypes?.(update);
      }
      closeRequestTypeEditor();
    } catch (error) {
      setRequestTypeSaveError(error instanceof Error ? error.message : "Não foi possível salvar o tipo de solicitação.");
    } finally {
      setRequestTypeSaving(false);
    }
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
      ...normalizeDocumentReusePolicy(payload),
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
    setDocumentPolicyError("");
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
        reuseScope: normalized.reuseScope,
        reuseValidityDays: normalized.reuseValidityDays == null ? "" : String(normalized.reuseValidityDays),
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

  function deleteListItem(setter, itemId) {
    setter?.((current) => current.filter((item) => !matchesScopedConfigItem(item, itemId)));
  }

  function openMunicipalityModal(municipality = null) {
    if (municipality) {
      setEditingMunicipalityId(municipality.id);
      setNewMunicipality(formFromMunicipality(municipality));
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
    const issue = municipalityContactIssue(newMunicipality);
    if (issue) {
      setMunicipalitySaveStatus(issue);
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
      const safeCreated = stripMunicipalityBootstrap(created);
      const refreshed = await api.getMunicipalitiesAdmin().catch(() => null);
      setMunicipalities?.((current) => (
        Array.isArray(refreshed)
          ? refreshed
          : [safeCreated, ...current.filter((item) => item.id !== created.id)]
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
        ? refreshed.find((municipality) => municipality.id === created.id) || safeCreated
        : safeCreated;

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
      setBreeds?.((current) => mergeScopedConfigItems(
        current,
        scopeConfigItems(createdConfigs[CONFIG_KEYS.breeds], createdMunicipalityScope),
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
        ...(editingTeamUserId ? { id: editingTeamUserId } : {}),
        active: newTeamUser.active !== false,
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
  const managementSubmitStyle = "tw:border-ui-ink tw:bg-[#e8f0fb] tw:font-semibold tw:text-ui-ink tw:enabled:hover:bg-card-page";
  const municipalitySaveFailed = ["Não", "Selecione", "Informe"].some((message) => municipalitySaveStatus.includes(message));
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
                <ConfigRow key={municipality.id} onClick={() => openMunicipalityModal(municipality)}>
                  <span className="config-list-index">{index + 1}</span>
                  <span className="config-list-main">
                    <strong>{municipality.name}</strong>
                    <span>{municipality.state || "UF não informada"}</span>
                  </span>
                  <small className={municipality.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {municipality.active === false ? "Inativo" : "Ativo"}
                  </small>
                </ConfigRow>
              ))}
            </div>
          </div>
        );
      })()}

      {configArea === "integrations" && configTab === "email" && integrationsTabs.some((tab) => tab.id === "email") && <EmailIntegrationTab key={configMunicipalityScopeId} municipalityId={configMunicipalityScopeId} master={isMasterRole(currentUser?.role)} canManage={canUseIntegration(Boolean(canUseConfigPermissions), configCurrentPermissionGroup, IntegrationConfigItem.EMAIL, canManageAiSettings(currentUser?.role))} canEditContract={isMasterRole(currentUser?.role)} />}

      {configArea === "integrations" && configTab === "sms" && integrationsTabs.some((tab) => tab.id === "sms") && <SmsSettings key={configMunicipalityScopeId} municipalityId={configMunicipalityScopeId} master={isMasterRole(currentUser?.role)} canEditContract={isMasterRole(currentUser?.role)} canManage={canUseIntegration(Boolean(canUseConfigPermissions), configCurrentPermissionGroup, IntegrationConfigItem.SMS, canManageAiSettings(currentUser?.role))} />}

      {configArea === "integrations" && configTab === "ai_settings" && integrationsTabs.some((tab) => tab.id === "ai_settings") && (
        <div className="config-panel wide">
          <PanelHeader title="IA externa para documentos" />
          <div className="tw:grid tw:items-start tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card as="article" className="tw:grid tw:min-w-0 tw:content-start tw:gap-3 tw:p-4">
              <ConfigActiveToggle
                checked={Boolean(aiSettings.active)}
                onChange={(checked) => setAiSettings?.((current: AnyRecord) => ({ ...current, active: checked }))}
                onText="Ativa"
                offText="Inativa"
              />
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
            </Card>
            <Card as="article" className="tw:grid tw:min-w-0 tw:gap-3 tw:p-4">
              <h3 className="tw:m-0 tw:text-sm tw:font-semibold tw:text-ui-ink">Como a IA será usada</h3>
              <div className="tw:grid tw:gap-2 tw:text-sm tw:text-ui-text">
                <p className="tw:m-0">
                  Ao anexar um documento, a IA usa os critérios cadastrados no tipo de documento (obrigatórios e de recusa)
                  para decidir se o arquivo condiz com o solicitado.
                </p>
                <p className="tw:m-0">
                  Com a IA inativa, o arquivo fica apenas anexado e segue para conferência manual, sem análise automática.
                </p>
              </div>
              <ConfigField
                label="Token / chave API"
                value={aiSettings.apiKey}
                type="password"
                name="ai-provider-api-key"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                placeholder={`Cole a chave da ${selectedAiProvider}`}
                onChange={(apiKey) => setAiSettings?.((current: AnyRecord) => ({ ...current, apiKey }))}
              />
              {selectedAiProviderConfig.keyUrl && (
                <a
                  className="tw:inline-flex tw:min-h-10 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-solid tw:border-[color:var(--ui-border-strong)] tw:bg-[var(--selected-bg)] tw:px-3.5 tw:text-center tw:text-[0.85rem] tw:font-semibold tw:text-[color:var(--selected-ink)] tw:no-underline tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent"
                  href={selectedAiProviderConfig.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Criar ou acessar chave da {selectedAiProvider}
                </a>
              )}
              <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
                <Button onClick={saveAiCredentials}>
                  Salvar configuração
                </Button>
                {aiSettings.hasApiKey && (
                  <Button variant="outline" onClick={clearAiCredentials}>
                    Remover chave
                  </Button>
                )}
              </div>
              {aiSaveStatus && <p className={aiSaveStatus.includes("sucesso") || aiSaveStatus === "Chave removida." ? "sms-status confirmed" : "sms-status"}>{aiSaveStatus}</p>}
            </Card>
          </div>
        </div>
      )}

      {configArea === "environment" && configTab === "requests" && (
        <Card className="config-panel wide">
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
              <ConfigRow key={type.id} onClick={() => { setEditingRequestTypeId(type.id); setNewRequestType({ ...emptyRequestType, ...type }); setConfigModal("requestType"); }}>
                <span className="config-list-index">{index + 1}</span>
                <span className="config-list-main">
                  <strong>{type.name}</strong>
                  <span>{type.charged ? `Taxa: ${type.billingAmount || type.fee || "-"}` : "Gratuito"} · {(type.documents?.length || 0)} documento(s)</span>
                </span>
                <small className={type.active === false ? "schedule-status inactive" : "schedule-status active"}>
                  {type.active === false ? "Inativo" : "Ativo"}
                </small>
              </ConfigRow>
            ))}
          </div>
        </Card>
      )}

      {configArea === "environment" && configTab === "agenda" && (
        <Card className="config-panel wide">
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
              <ConfigRow key={rule.id} onClick={() => openAgendaModal(rule)}>
                <span className="config-list-index">{index + 1}</span>
                <span className="config-list-main">
                  <strong>{rule.description}</strong>
                  <span>{formatAgendaRuleSummary(rule)}</span>
                </span>
                <small className={rule.active ? "schedule-status active" : "schedule-status inactive"}>
                  {rule.active ? "Ativo" : "Inativo"}
                </small>
              </ConfigRow>
            ))}
          </div>
        </Card>
      )}

      {configArea === "environment" && configTab === "sizes" && (
        <SimpleConfigList title="Portes" items={filteredSizes} allItems={sizeOptions} filterValue={configStatusFilter} onFilterChange={setConfigStatusFilter} onCreate={() => openSizeModal()} onEdit={openSizeModal} showDescription />
      )}

      {configArea === "environment" && configTab === "species" && (
        <SimpleConfigList title="Espécies" items={filteredSpecies} allItems={speciesOptions} filterValue={configStatusFilter} onFilterChange={setConfigStatusFilter} onCreate={() => openSpeciesModal()} onEdit={openSpeciesModal} />
      )}

      {configArea === "environment" && configTab === "breeds" && (
        <BreedsConfig
          items={breeds}
          onSave={(municipalityId, update) => saveScopedConfigCatalog(CONFIG_KEYS.breeds, municipalityId, update, setBreeds)}
          municipalityScopeId={configMunicipalityScopeId}
          speciesOptions={speciesOptions}
        />
      )}

      {configArea === "environment" && configTab === "neighborhoods" && (
        <NeighborhoodsConfig items={neighborhoods} setItems={setNeighborhoods} municipalityScopeId={configMunicipalityScopeId} />
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
                  <ConfigRow key={`${sectorMunicipalityId}:${sector.id}`} onClick={() => openSectorModal(sector)}>
                    <span className="config-list-index">{index + 1}</span>
                    <span className="config-list-main">
                      <strong>{sector.name || "Setor sem nome"}</strong>
                      <span>{sectorUsers.length} usuário(s) vinculado(s){sectorUsers.length > 0 ? ` · ${sectorUsers.map((u) => u.name).join(", ")}` : ""}</span>
                    </span>
                    <small className={sector.active === false ? "schedule-status inactive" : "schedule-status active"}>
                      {sector.active === false ? "Inativo" : "Ativo"}
                    </small>
                  </ConfigRow>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {sectorModal && (
        <ConfigDialogBackdrop>
          <Card as="form" className="workflow-modal config-sector-modal" role="dialog" aria-modal="true" aria-label={editingSectorId ? "Editar setor" : "Criar setor"} onSubmit={(e) => { e.preventDefault(); createSector(); setSectorModal(false); }}>
            <ModalHeader
              appearance="config"
              title={editingSectorId ? "Editar setor" : "Criar setor"}
              subtitle="Organize vínculos internos e responsáveis por etapa."
              onClose={() => { setSectorModal(false); setEditingSectorId(null); setEditingSectorMunicipalityId(""); }}
              actions={<ConfigActiveToggle checked={newSectorActive} onChange={setNewSectorActive} />}
            />

            <div className="sector-modal-body">
              <ConfigField label="Nome do setor" value={newSectorName} placeholder="Ex: Triagem documental" onChange={setNewSectorName} />

              <Card as="section" className="sector-links-panel">
                <div className="sector-links-head">
                  <strong>Vincular usuários</strong>
                  <small>{pendingSectorUserIds.length} de {sectorModalUsers.length} selecionados</small>
                </div>
                <div className="sector-link-list">
                  {sectorModalUsers.length === 0 && (
                    <span className="helper-text" role="status">Nenhum usuário cadastrado ainda.</span>
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
              </Card>
            </div>

            <footer className="sector-modal-footer">
              <Button variant="custom" className={managementSubmitStyle} type="submit" disabled={!newSectorName.trim()}>{editingSectorId ? "Salvar" : "Criar setor"}</Button>
            </footer>
          </Card>
        </ConfigDialogBackdrop>
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
                <ConfigRow key={group.id} onClick={() => openPermissionModal(group)}>
                  <span className="config-list-index">{index + 1}</span>
                  <span className="config-list-main">
                    <strong>{group.name || "Grupo sem nome"}</strong>
                    <span>{linkedUsers.length} usuário(s) · Menus: {(group.allowedMenuItems || []).length || 0} · Config: {(group.allowedConfigItems || []).length || 0}</span>
                  </span>
                  <small className={group.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {group.active === false ? "Inativo" : "Ativo"}
                  </small>
                </ConfigRow>
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
                <ConfigRow key={`${getItemMunicipalityId(user)}:${user.id}`} onClick={() => openTeamUserModal(user)}>
                  <span className="config-list-index">{index + 1}</span>
                  <span className="config-list-main">
                    <strong>{user.name || "Usuário sem nome"}</strong>
                    <span>{user.email || "Sem e-mail"} · {getMunicipalityLabel(user.municipalityId, municipalities)}</span>
                  </span>
                  <small className={user.active === false ? "schedule-status inactive" : "schedule-status active"}>
                    {user.active === false ? "Inativo" : "Ativo"}
                  </small>
                </ConfigRow>
              ))}
            </div>
          </div>
        </div>
      )}

      {permissionModal && (
        <ConfigDialogBackdrop>
          <Card as="form" className="workflow-modal config-permission-modal" role="dialog" aria-modal="true" aria-label={editingPermissionGroupId ? "Editar grupo de permissão" : "Criar grupo de permissão"} onSubmit={(event) => { event.preventDefault(); createPermissionGroup(); }}>
            <ModalHeader
              appearance="config"
              title={newPermissionGroup.name || (editingPermissionGroupId ? "Grupo de permissão" : "Novo grupo")}
              subtitle={<>Grupo padrão com todas as permissões do catálogo habilitadas.<br />Criado em: {newPermissionGroup.createdAt || "sem registro"}</>}
              onClose={() => { setPermissionModal(false); setEditingPermissionGroupId(null); setNewPermissionGroup(emptyPermissionGroup); }}
              actions={
                <ConfigActiveToggle
                  checked={newPermissionGroup.active !== false}
                  onChange={(checked) => setNewPermissionGroup((current) => ({ ...current, active: checked }))}
                />
              }
            />

            <div className="permission-modal-body">
              <ConfigField label="Nome do grupo" value={newPermissionGroup.name} placeholder="Ex: Triagem documental" onChange={(value) => setNewPermissionGroup((current) => ({ ...current, name: value }))} />

              <Card as="section" className="permission-catalog-panel">
                <div className="permission-catalog-head">
                  <strong>Permissões</strong>
                </div>

                <div className="permission-group-list">
                  {permissionCatalogSections.map((section) => {
                    const selectedCount = section.items.filter((item) => (newPermissionGroup[item.field] || []).includes(item.id)).length;
                    const isOpen = permissionOpenSections[section.key] === true;
                    return (
                      <Card as="section" className={`permission-group-card permission-group-card--${section.tone}`} key={section.key}>
                        <button
                          className="permission-group-header"
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setPermissionOpenSections((current) => ({ ...current, [section.key]: !isOpen }))}
                        >
                          <span>
                            <strong>{section.title}</strong>
                            <small>{selectedCount} de {section.items.length} permissões</small>
                          </span>
                          <span className={`permission-group-toggle${isOpen ? " is-open" : ""}`}>
                            {isOpen ? "Ocultar" : "Expandir"}
                            <ChevronDown size={14} aria-hidden="true" />
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
                      </Card>
                    );
                  })}
                </div>
              </Card>
            </div>

            <footer className="permission-modal-footer">
              <Button variant="custom" className={managementSubmitStyle} type="submit" disabled={!newPermissionGroup.name?.trim()}>
                Salvar
              </Button>
            </footer>
          </Card>
        </ConfigDialogBackdrop>
      )}
      {userModal && (
        <ConfigDialogBackdrop>
          <Card as="form" className="workflow-modal config-user-modal" role="dialog" aria-modal="true" aria-label={editingTeamUserId ? "Editar usuário" : "Criar usuário"} onSubmit={async (e) => { e.preventDefault(); setUserSaveError(""); if (await createTeamUser()) setUserModal(false); }}>
            <ModalHeader
              appearance="config"
              title={editingTeamUserId ? "Editar usuário" : "Criar usuário"}
              onClose={() => { setUserModal(false); setEditingTeamUserId(null); setSectorPickerOpen(false); setUserSaveError(""); }}
              actions={
                <ConfigActiveToggle
                  checked={newTeamUser.active !== false}
                  onChange={(checked) => setNewTeamUser((c) => ({ ...c, active: checked }))}
                />
              }
            />
            <div className="config-management-body">
              <ConfigField label="Nome" value={newTeamUser.name} placeholder="Nome completo" onChange={(value) => setNewTeamUser((c) => ({ ...c, name: value }))} />
              <ConfigField label="Email" value={newTeamUser.email} placeholder="email@dominio.com" onChange={(value) => setNewTeamUser((c) => ({ ...c, email: value }))} />
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
              <div className="tw:grid tw:min-w-0 tw:gap-1.5 tw:text-sm" role="group" aria-labelledby="config-user-sectors-label">
                <span id="config-user-sectors-label" className="tw:font-medium">Setores vinculados</span>
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
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <Button variant="outline" aria-label="Adicionar setor" onClick={() => setSectorPickerOpen(true)}>
                    <Plus size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <ConfigField label="N° Matrícula" value={newTeamUser.matricula} placeholder="Ex: 00123" onChange={(value) => setNewTeamUser((c) => ({ ...c, matricula: value }))} />
              <ConfigField label="Cargo" value={newTeamUser.role} placeholder="Ex: Veterinário, Coordenador..." onChange={(value) => setNewTeamUser((c) => ({ ...c, role: value }))} />
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
              <ConfigField
                label="Senha de login"
                type="password"
                value={newTeamUser.senha}
                placeholder={editingTeamUserId ? "Preencha apenas se quiser alterar" : "Senha inicial"}
                onChange={(value) => setNewTeamUser((c) => ({ ...c, senha: value }))}
              />
              {userSaveError && <p className="form-error-msg" role="alert">{userSaveError}</p>}
            </div>
            <footer className="config-management-footer">
              <Button variant="custom" className={managementSubmitStyle} type="submit" disabled={!newTeamUser.name.trim() || !newTeamUser.email.trim() || !newTeamUser.municipalityId || (!editingTeamUserId && !newTeamUser.senha)}>
                {editingTeamUserId ? "Salvar" : "Criar usuário"}
              </Button>
            </footer>
          </Card>
        </ConfigDialogBackdrop>
      )}

      {userModal && sectorPickerOpen && (
        <ConfigDialogBackdrop>
          <Card className="sector-picker-modal tw:max-h-[calc(100dvh-32px)] tw:grid-rows-[auto_minmax(0,1fr)] tw:overflow-hidden" role="dialog" aria-modal="true" aria-label="Adicionar setor">
            <ModalHeader appearance="config" title="Adicionar setor" onClose={() => setSectorPickerOpen(false)} />
            <div className="tw:grid tw:min-h-0 tw:gap-1.5 tw:overflow-auto tw:p-1">
              {availableTeamSectors.length === 0 && <small className="tw:py-2 tw:text-ui-muted" role="status">Todos os setores ativos já estão vinculados.</small>}
              {availableTeamSectors.map((sector) => (
                <Button
                  key={`${getItemMunicipalityId(sector)}:${sector.id}`}
                  variant="outline"
                  className="tw:justify-start tw:whitespace-normal"
                  onClick={() => {
                    setNewTeamUser((current) => ({ ...current, sectorIds: [...(current.sectorIds || []), sector.id] }));
                    setSectorPickerOpen(false);
                  }}
                >
                  {sector.name}
                </Button>
              ))}
            </div>
          </Card>
        </ConfigDialogBackdrop>
      )}

      {configArea === "integrations" && configTab === "whatsapp" && (
        <WhatsappIntegrationTab key={configMunicipalityScopeId} municipalityId={configMunicipalityScopeId} readOnly={!canUseIntegration(Boolean(canUseConfigPermissions), configCurrentPermissionGroup, IntegrationConfigItem.WHATSAPP, canManageAiSettings(currentUser?.role))} master={isMasterRole(currentUser?.role)} canEditContract={isMasterRole(currentUser?.role)} />
      )}

      {configArea === "environment" && configTab === "documents" && (
        <Card className="config-panel wide">
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
              <ConfigRow key={document.id} onClick={() => openDocumentModal(document)}>
                <span className="config-list-index">{index + 1}</span>
                <span className="config-list-main">
                  <strong>{document.name || "Documento sem nome"}</strong>
                  <span>
                    {document.required === false ? "Opcional" : "Obrigatório"}
                    {document.analysisRules?.expectedDocument ? ` · ${document.analysisRules.expectedDocument}` : ""}
                    {document.analysisRules?.requiredCriteria?.length ? " · Critérios configurados" : ""}
                  </span>
                </span>
                <small className={document.active === false ? "schedule-status inactive" : "schedule-status active"}>
                  {document.active === false ? "Inativo" : "Ativo"}
                </small>
              </ConfigRow>
            ))}
          </div>
        </Card>
      )}

      {configModal === "municipality" && (
        <ConfigDialogBackdrop>
          <Card
            as="form"
            className="config-modal compact config-environment-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingMunicipalityId ? "Editar município" : "Cadastrar município"}
            onSubmit={async (event) => {
              event.preventDefault();
              await saveMunicipality();
            }}
          >
            <ModalHeader
              appearance="config"
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
            <MunicipalityAddressFields form={newMunicipality} setForm={setNewMunicipality} canEditCity={isGlobalRole(currentUser?.role)} />

            <ConfigField
              label="Nome do órgão / secretaria"
              value={newMunicipality.departmentName}
              placeholder="Ex: Secretaria de Meio Ambiente"
              onChange={(value) => setNewMunicipality((current) => ({ ...current, departmentName: value }))}
            />
            <div className="modal-form-grid">
              <ConfigField label="Contato" type="tel" value={newMunicipality.contact} placeholder="(00) 00000-0000" onChange={(value) => setNewMunicipality((current) => ({ ...current, contact: formatPhone(value) }))} />
              <ConfigField label="Email" type="email" value={newMunicipality.email} placeholder="contato@municipio.gov.br" onChange={(value) => setNewMunicipality((current) => ({ ...current, email: value }))} />
            </div>
            <div className="modal-form-grid">
              <MunicipalityImageField
                label="Brasão do município"
                value={newMunicipality.brasao}
                onChange={(brasao) => setNewMunicipality((current) => ({ ...current, brasao }))}
              />
              <MunicipalityImageField
                label="Logo do órgão"
                value={newMunicipality.departmentLogo}
                onChange={(departmentLogo) => setNewMunicipality((current) => ({ ...current, departmentLogo }))}
              />
            </div>

            {municipalitySaveStatus && (
              <p className={municipalitySaveFailed ? "form-error" : "helper-text"} role={municipalitySaveFailed ? "alert" : "status"}>
                {municipalitySaveStatus}
              </p>
            )}
            <div className="form-actions">
              <Button type="submit" disabled={municipalitySaving || !newMunicipality.name.trim() || !newMunicipality.state.trim()}>
                {municipalitySaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </Card>
        </ConfigDialogBackdrop>
      )}

      {configModal === "agenda" && (
        <ConfigDialogBackdrop>
          <form className="config-modal agenda-config-modal config-environment-modal" onSubmit={createScheduleFromModal} role="dialog" aria-modal="true" aria-label={editingScheduleRuleId ? "Editar agenda" : "Criar agenda"}>
            <ModalHeader
              appearance="config"
              title={editingScheduleRuleId ? "Editar agenda" : "Criar agenda"}
              onClose={() => { setConfigModal(null); setEditingScheduleRuleId(null); setAgendaForm(emptyAgendaForm); setAgendaSaving(false); setAgendaSaveStatus(""); }}
            />

            <Card className="agenda-modal-head">
              <div>
                <span>{agendaFormIsMutirao ? "Mutirão" : "Agenda"}</span>
                <strong>{agendaForm.description || "Nova agenda"}</strong>
              </div>
              <ConfigActiveToggle
                checked={agendaForm.active}
                onChange={(checked) => patchAgendaForm("active", checked)}
              />
            </Card>

            <div className="agenda-modal-layout agenda-modal-layout--modern">
              <Card as="section" className="agenda-modal-block">
                <div className="agenda-block-title">
                  <div>
                    <strong>Identificação</strong>
                    <small>Nome, município e tipo de agenda.</small>
                  </div>
                </div>
                <ConfigField label="Descrição" value={agendaForm.description} placeholder="Ex: Mutirão bairro Centro" onChange={(value) => patchAgendaForm("description", value)} />
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
              </Card>

              {!agendaFormIsMutirao && (
                <>
                  <Card as="section" className="agenda-modal-block">
                    <div className="agenda-block-title">
                      <div>
                        <strong>Local</strong>
                        <small>Dados exibidos para o tutor no agendamento.</small>
                      </div>
                    </div>
                    <div className="modal-form-grid">
                      <ConfigField label="Local de atendimento" value={agendaForm.locationName} placeholder="Ex: Centro de zoonoses" onChange={(value) => patchAgendaForm("locationName", value)} />
                      <ConfigField label="Endereço do local" value={agendaForm.locationAddress} placeholder="Ex: Rua Araranguá, 333 - Centro" onChange={(value) => patchAgendaForm("locationAddress", value)} />
                      <ConfigField label="Link do endereço" value={agendaForm.addressUrl} placeholder="Cole o link do Google Maps" onChange={(value) => patchAgendaForm("addressUrl", value)} />
                    </div>
                  </Card>

                  <Card as="section" className="agenda-modal-block">
                    <div className="agenda-block-title">
                      <div>
                        <strong>Período e capacidade</strong>
                        <small>Defina datas e vagas disponíveis.</small>
                      </div>
                    </div>
                    <div className="modal-form-grid">
                      <ConfigField label="Início da agenda" type="date" value={agendaForm.start} onChange={(value) => patchAgendaForm("start", value)} />
                      {normalizeText(agendaForm.type) === "recorrencia" && (
                        <ConfigField label="Fim da agenda" type="date" value={agendaForm.end} onChange={(value) => patchAgendaForm("end", value)} />
                      )}
                      {normalizeText(agendaForm.type) === "recorrencia" && (
                        <ConfigField label="Repetir a cada semana(s)" value={agendaForm.repeatEvery} onChange={(value) => patchAgendaForm("repeatEvery", value)} />
                      )}
                    </div>
                    {normalizeText(agendaForm.type) === "recorrencia" && (
                      <div className="agenda-weekday-field">
                        <div>
                          <span>Dias da semana</span>
                          <small>Selecione quando esta agenda abre vagas.</small>
                        </div>
                        <div className="weekday-picker" role="group" aria-label="Dias da semana">
                          {[
                            { label: "Dom", name: "Domingo" },
                            { label: "Seg", name: "Segunda-feira" },
                            { label: "Ter", name: "Terça-feira" },
                            { label: "Qua", name: "Quarta-feira" },
                            { label: "Qui", name: "Quinta-feira" },
                            { label: "Sex", name: "Sexta-feira" },
                            { label: "Sáb", name: "Sábado" },
                          ].map((weekday, index) => (
                            <Button
                              key={weekday.name}
                              variant={agendaForm.weekdays.includes(index) ? "primary" : "outline"}
                              aria-label={weekday.name}
                              aria-pressed={agendaForm.weekdays.includes(index)}
                              title={weekday.name}
                              className="tw:min-w-0"
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
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <Card className="agenda-slots-field">
                      <div className="agenda-slots-header">
                        <div>
                          <span>Faixas de horário</span>
                          <small>Total diário: {sumScheduleSlotsVacancies(agendaForm.slots)} vagas</small>
                        </div>
                        <Button variant="outline" onClick={addAgendaSlot}>
                          <Plus size={16} />
                          Adicionar faixa
                        </Button>
                      </div>
                      <div className="agenda-slots-list">
                        {(agendaForm.slots || []).map((slot, index) => (
                          <div className="agenda-slot-row" key={index}>
                            <ConfigField label="Hora de início" type="time" value={slot.time} onChange={(value) => patchAgendaSlot(index, "time", value)} />
                            <ConfigField label="Vagas" value={slot.vacancies} onChange={(value) => patchAgendaSlot(index, "vacancies", value)} />
                            <Button className="tw:justify-self-end" variant="danger" onClick={() => removeAgendaSlot(index)} aria-label="Remover faixa" title="Remover faixa">
                              <X size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </Card>
                </>
              )}

              {agendaFormIsMutirao && (
                <Card as="section" className="agenda-modal-block agenda-mutirao-block">
                  <div className="agenda-block-title">
                    <div>
                      <strong>Datas e locais do mutirão</strong>
                      <small>Adicione uma ocorrência para cada dia de atendimento.</small>
                    </div>
                    <Button variant="outline" onClick={addAgendaOccurrence}>
                      <Plus size={16} />
                      Adicionar data
                    </Button>
                  </div>

                  <div className="agenda-occurrence-list">
                    {getAgendaOccurrenceList(agendaForm).map((occurrence, occurrenceIndex) => (
                      <Card as="article" className="agenda-occurrence-card" key={occurrence.id || occurrenceIndex}>
                        <div className="agenda-occurrence-header">
                          <div>
                            <span>Ocorrência {occurrenceIndex + 1}</span>
                            <strong>{occurrence.date ? toScheduleDate(occurrence.date) : "Nova data"}</strong>
                          </div>
                          <Button
                            variant="danger"
                            onClick={() => removeAgendaOccurrence(occurrenceIndex)}
                            disabled={getAgendaOccurrenceList(agendaForm).length === 1}
                            aria-label="Remover data do mutirão"
                            title="Remover data"
                          >
                            <X size={16} />
                          </Button>
                        </div>

                        <div className="modal-form-grid">
                          <ConfigField label="Data do mutirão" type="date" value={occurrence.date} onChange={(value) => patchAgendaOccurrence(occurrenceIndex, "date", value)} />
                          <ConfigField label="Local de atendimento" value={occurrence.locationName} placeholder="Ex: Escola municipal do bairro" onChange={(value) => patchAgendaOccurrence(occurrenceIndex, "locationName", value)} />
                          <ConfigField label="Endereço do local" value={occurrence.locationAddress} placeholder="Rua, número e bairro" onChange={(value) => patchAgendaOccurrence(occurrenceIndex, "locationAddress", value)} />
                          <ConfigField label="Link do endereço" value={occurrence.addressUrl} placeholder="Cole o link do Google Maps" onChange={(value) => patchAgendaOccurrence(occurrenceIndex, "addressUrl", value)} />
                        </div>

                        <Card className="agenda-slots-field agenda-slots-field--compact">
                          <div className="agenda-slots-header">
                            <div>
                              <span>Faixas de horário</span>
                              <small>Total: {sumScheduleSlotsVacancies(occurrence.slots)} vagas</small>
                            </div>
                            <Button variant="outline" onClick={() => addAgendaOccurrenceSlot(occurrenceIndex)}>
                              <Plus size={16} />
                              Adicionar faixa
                            </Button>
                          </div>
                          <div className="agenda-slots-list">
                            {(occurrence.slots || []).map((slot, slotIndex) => (
                              <div className="agenda-slot-row" key={slotIndex}>
                                <ConfigField label="Hora de início" type="time" value={slot.time} onChange={(value) => patchAgendaOccurrenceSlot(occurrenceIndex, slotIndex, "time", value)} />
                                <ConfigField label="Vagas" value={slot.vacancies} onChange={(value) => patchAgendaOccurrenceSlot(occurrenceIndex, slotIndex, "vacancies", value)} />
                                <Button className="tw:justify-self-end" variant="danger" onClick={() => removeAgendaOccurrenceSlot(occurrenceIndex, slotIndex)} aria-label="Remover faixa" title="Remover faixa">
                                  <X size={16} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </Card>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div className="form-actions">
              <Button type="submit" disabled={agendaSaving}>
                {agendaSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            {agendaSaveStatus && (
              <p className={agendaSaving ? "helper-text" : "form-error"} role={agendaSaving ? "status" : "alert"}>
                {agendaSaveStatus}
              </p>
            )}
          </form>
        </ConfigDialogBackdrop>
      )}
      {configModal === "requestType" && (
        <ConfigDialogBackdrop>
          <form
            className="config-modal compact request-type-modal config-environment-modal"
            onSubmit={saveRequestType}
            role="dialog"
            aria-modal="true"
            aria-label={editingRequestTypeId ? "Editar tipo de solicitação" : "Criar tipo de solicitação"}
          >
            <ModalHeader
              appearance="config"
              title={editingRequestTypeId ? "Editar tipo de solicitação" : "Criar tipo de solicitação"}
              onClose={() => { if (!requestTypeSaving) closeRequestTypeEditor(); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newRequestType.active !== false}
                onChange={(checked) => setNewRequestType((current) => ({ ...current, active: checked }))}
              />
              <ConfigActiveToggle
                checked={!!newRequestType.charged}
                onChange={(charged) => setNewRequestType((current) => ({ ...current, charged, fee: charged ? current.billingAmount || "" : "Gratuito" }))}
                onText="Cobrar taxa"
                offText="Cobrar taxa"
              />
              <ConfigActiveToggle
                checked={!!newRequestType.overrideDailyLimit}
                onChange={(overrideDailyLimit) => setNewRequestType((current) => ({ ...current, overrideDailyLimit }))}
                onText="Sobrepor limite"
                offText="Sobrepor limite"
              />
            </div>
            <ConfigField label="Nome" value={newRequestType.name} placeholder="Ex: Castração" onChange={(value) => setNewRequestType((current) => ({ ...current, name: value }))} />
            {newRequestType.charged && (
              <div className="billing-grid">
                <ConfigField label="Descrição da taxa" value={newRequestType.billingDescription} placeholder="Ex: Taxa de castração" onChange={(value) => setNewRequestType((current) => ({ ...current, billingDescription: value }))} />
                <ConfigField label="Valor" value={newRequestType.billingAmount} placeholder="Ex: R$ 20,00" onChange={(value) => setNewRequestType((current) => ({ ...current, billingAmount: value, fee: value }))} />
                <ConfigField label="Vencimento do boleto" type="date" value={newRequestType.billingDueDate} onChange={(value) => setNewRequestType((current) => ({ ...current, billingDueDate: value }))} />
              </div>
            )}
            <DocumentButtonPicker
              documents={filterByMunicipalityScope(documentTypes, newRequestType.municipalityId || configMunicipalityScopeId)}
              selectedDocuments={newRequestType.documents || []}
              onToggle={(document) =>
                setNewRequestType((current) => {
                  const selectedDocuments = current.documents || [];
                  const exists = selectedDocuments.some((item) => item.id === document.id);
                  return { ...current, documents: exists ? selectedDocuments.filter((item) => item.id !== document.id) : [...selectedDocuments, document] };
                })
              }
            />
            <BreedChecklist
              breeds={breeds}
              species={speciesOptions}
              municipalityId={newRequestType.municipalityId || configMunicipalityScopeId}
              selectedIds={newRequestType.breedIds || []}
              onChange={(breedIds) => setNewRequestType((current) => ({ ...current, breedIds }))}
            />
            {requestTypeSaveError && <p className="form-error" role="alert">{requestTypeSaveError}</p>}
            <div className="form-actions">
              <Button type="submit" disabled={requestTypeSaving}>{requestTypeSaving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </ConfigDialogBackdrop>
      )}

      {configModal === "species" && (
        <ConfigDialogBackdrop>
          <form className="config-modal compact config-environment-modal" role="dialog" aria-modal="true" aria-label={editingSpeciesId ? "Editar espécie" : "Criar espécie"} onSubmit={(event) => { event.preventDefault(); createSpecies(newSpecies); setNewSpecies({ name: "", active: true }); setEditingSpeciesId(null); setConfigModal(null); }}>
            <ModalHeader
              appearance="config"
              title={editingSpeciesId ? "Editar espécie" : "Criar espécie"}
              onClose={() => { setConfigModal(null); setEditingSpeciesId(null); setNewSpecies({ name: "", active: true }); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newSpecies.active !== false}
                onChange={(checked) => setNewSpecies((current) => ({ ...current, active: checked }))}
              />
            </div>
            <ConfigField label="Nome" value={newSpecies.name} onChange={(value) => setNewSpecies((current) => ({ ...current, name: value }))} />
            <div className="form-actions">
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </ConfigDialogBackdrop>
      )}

      {configModal === "size" && (
        <ConfigDialogBackdrop>
          <form className="config-modal compact config-environment-modal" role="dialog" aria-modal="true" aria-label={editingSizeId ? "Editar porte" : "Criar porte"} onSubmit={(event) => { event.preventDefault(); saveSize(newSize); setNewSize({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true }); setEditingSizeId(null); setConfigModal(null); }}>
            <ModalHeader
              appearance="config"
              title={editingSizeId ? "Editar porte" : "Criar porte"}
              onClose={() => { setConfigModal(null); setEditingSizeId(null); setNewSize({ name: "", weightStart: "", weightEnd: "", weightUnit: "kg", active: true }); }}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newSize.active !== false}
                onChange={(checked) => setNewSize((current) => ({ ...current, active: checked }))}
              />
            </div>
            <ConfigField label="Nome" value={newSize.name} onChange={(value) => setNewSize((current) => ({ ...current, name: value }))} />
            <div className="size-range-grid">
              <ConfigField label="De" value={newSize.weightStart} placeholder="0" onChange={(value) => setNewSize((current) => ({ ...current, weightStart: value }))} />
              <ConfigField label="Até" value={newSize.weightEnd} placeholder="5" onChange={(value) => setNewSize((current) => ({ ...current, weightEnd: value }))} />
              <ConfigField label="Unidade" value={newSize.weightUnit} placeholder="kg" onChange={(value) => setNewSize((current) => ({ ...current, weightUnit: value }))} />
            </div>
            <div className="form-actions">
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </ConfigDialogBackdrop>
      )}

      {configModal === "document" && (
        <ConfigDialogBackdrop>
          <form
            className="config-modal document-analysis-modal config-environment-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingDocumentId ? "Editar documento" : "Criar documento"}
            onSubmit={(event) => {
              event.preventDefault();
              const { policy, error } = documentPolicyFromForm(newDocument.reuseScope, newDocument.reuseValidityDays);
              if (error) { setDocumentPolicyError(error); return; }
              createDocumentType({
                ...newDocument,
                ...policy,
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
              appearance="config"
              title={editingDocumentId ? "Editar documento" : "Criar documento"}
              onClose={() => { setConfigModal(null); setEditingDocumentId(null); setNewDocument(emptyDocumentForm); setNewRequiredCriterion(""); setNewRejectionCriterion(""); }}
            />

            <div className="config-modal-options">
              <ConfigActiveToggle
                checked={newDocument.active !== false}
                onChange={(checked) => setNewDocument((current) => ({ ...current, active: checked }))}
              />
              <ConfigActiveToggle
                checked={newDocument.required !== false}
                onChange={(checked) => setNewDocument((current) => ({ ...current, required: checked }))}
                onText="Obrigatório"
                offText="Obrigatório"
              />
              <ConfigActiveToggle
                checked={newDocument.useAi !== false}
                onChange={(checked) => setNewDocument((current) => ({ ...current, useAi: checked }))}
                onText="Usar análise por IA"
                offText="Usar análise por IA"
              />
            </div>
            <div className="document-modal-body">
              {documentPolicyError && <p className="form-error" role="alert">{documentPolicyError}</p>}
              <Card as="section" className="document-modal-panel">
                <label className="field"><span>Abrangência para reaproveitamento</span><select value={newDocument.reuseScope} onChange={(event) => setNewDocument((current) => ({ ...current, reuseScope: event.target.value }))}><option value={DocumentReuseScope.REQUEST}>Somente esta solicitação</option><option value={DocumentReuseScope.TUTOR}>Tutor, entre seus pedidos</option><option value={DocumentReuseScope.ANIMAL}>Este animal, entre seus pedidos</option></select></label>
                <ConfigField
                  label="Prazo para reaproveitamento em dias (opcional)"
                  type="number"
                  min={1}
                  max={36525}
                  step={1}
                  value={newDocument.reuseValidityDays}
                  onChange={(value) => setNewDocument((current) => ({ ...current, reuseValidityDays: value }))}
                  placeholder="Sem prazo"
                />
                <small>Contado desde o envio original do arquivo. Vazio significa sem vencimento por idade; a conferência do conteúdo continua necessária.</small>
              </Card>
              <div className="document-identity-grid">
                <ConfigField label="Nome" value={newDocument.name} placeholder="Ex: Comprovante de residencia" onChange={(value) => setNewDocument((current) => ({ ...current, name: value }))} />
                <ConfigField
                  label="Sigla"
                  value={newDocument.expectedDocument}
                  placeholder="EX: CR"
                  onChange={(value) => setNewDocument((current) => ({ ...current, expectedDocument: value.toUpperCase() }))}
                />
              </div>

              <Card as="section" className="document-modal-panel document-modal-panel--criteria">
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
              </Card>
              {newDocument.useAi !== false && (
                <Card as="section" className="document-modal-panel document-modal-panel--decision">
                  <div className="document-section-heading">
                    <span><ShieldCheck size={15} /> Decisão automática</span>
                  </div>
                  <DocumentConfidenceSlider
                    value={newDocument.minimumConfidence}
                    onChange={(value: number) => setNewDocument((current) => ({ ...current, minimumConfidence: value }))}
                  />
                </Card>
              )}
            </div>

            <div className="form-actions document-modal-actions">
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </ConfigDialogBackdrop>
      )}
    </section>
  );

}

function SimpleConfigList({ title, items, allItems = items, filterValue = "active", onFilterChange, onCreate, onEdit, showDescription = false }: AnyRecord) {
  return (
    <Card className="config-panel wide">
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
          <ConfigRow key={item.id} onClick={() => onEdit?.(item)}>
            <span className="config-list-index">{index + 1}</span>
            <span className="config-list-main">
              <strong>{item.name || "Item sem nome"}</strong>
              {showDescription && <span>{formatSizeRange(item) || "Faixa de peso não informada"}</span>}
            </span>
            <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
              {item.active === false ? "Inativo" : "Ativo"}
            </small>
          </ConfigRow>
        ))}
      </div>
    </Card>
  );
}

function DocumentButtonPicker({ documents, selectedDocuments, onToggle }: AnyRecord) {
  return (
    <div className="document-button-field">
      <span>Documentos vinculados</span>
      <div className="document-button-grid">
        {documents.map((document) => {
          const selected = selectedDocuments.some((item) => item.id === document.id);
          return (
            <Card
              as="button"
              aria-pressed={selected}
              className="tw:min-h-10 tw:max-w-full tw:px-3 tw:py-2 tw:text-left tw:text-sm tw:font-medium tw:text-ui-text tw:hover:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent tw:aria-pressed:text-ui-accent-strong"
              key={document.id}
              onClick={() => onToggle(document)}
            >
              {document.name || "Documento sem nome"}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DocumentScannerUpload({ document, upload, aiActive, onUpload, onRemove, onPreview }: AnyRecord) {
  const fileInput = useRef<HTMLInputElement>(null);
  const documentUsesAi = document.analysisRules?.useAi !== false;
  const needsReplacement = upload?.status === "attached" && upload?.aiVerdict === "rejected";
  const statusLabel = needsReplacement ? "Não confirmado" : ({
    checking: aiActive ? "Em análise" : "Recebendo arquivo",
    approved: aiActive ? "Aprovado pela análise" : "Aprovado",
    attached: documentUsesAi ? "Conferência manual" : "Anexado",
    rejected: aiActive ? "Recusado pela análise" : "Recusado",
  }[upload?.status] || "Não anexado");
  const publicMessage = needsReplacement
    ? "Não parece ser este documento. Envie de novo."
    : upload?.status === "attached"
    ? documentUsesAi ? "Recebido. Nossa equipe vai conferir." : ""
    : upload?.status === "approved"
    ? "Documento confirmado."
    : upload?.status === "rejected"
    ? "Não atende ao que foi pedido. Envie de novo."
    : upload?.message;

  const statusIcon = needsReplacement ? <AlertCircle size={16} className="doc-status-icon is-err" /> : ({
    approved: <BadgeCheck size={16} className="doc-status-icon is-ok" />,
    rejected: <AlertCircle size={16} className="doc-status-icon is-err" />,
    checking: <RefreshCw size={14} className="doc-status-icon is-spin" />,
    attached: <Paperclip size={15} className="doc-status-icon is-att" />,
  }[upload?.status] || <FileText size={15} className="doc-status-icon is-empty" />);

  return (
    <>
      <article className={`doc-row ${upload?.status || "empty"}${needsReplacement ? " needs-replacement" : ""}${onPreview ? " tw:flex-wrap" : ""}`}>
        <div className="doc-row-icon">{statusIcon}</div>
        <div className="doc-row-info">
          <strong>{document.name}{document.required && <span className="doc-required">*</span>}</strong>
          {upload?.fileName
            ? <small>{upload.fileName}</small>
            : <small className="doc-row-hint">{statusLabel}</small>
          }
          {publicMessage && <small className="doc-row-msg">{publicMessage}</small>}
        </div>
        <div className={onPreview ? "tw:flex tw:w-full tw:flex-wrap tw:gap-2" : "doc-row-actions"}>
          {onPreview ? <>
            <input ref={fileInput} type="file" hidden accept={(document.accept || []).join(",")} onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => onUpload(event.target.files?.[0])} />
            <Button variant="outline" onClick={() => fileInput.current?.click()} aria-label={`${upload ? "Substituir" : "Anexar"} ${document.name}`}>
              <Paperclip size={15} aria-hidden="true" />{upload ? "Substituir" : "Anexar"}
            </Button>
            {upload?.dataUrl && <Button variant="outline" onClick={() => onPreview(upload)} aria-label={`Ver ${document.name}`}>Ver arquivo</Button>}
            {upload && <Button variant="danger" onClick={onRemove} aria-label={`Remover ${document.name}`}><Trash2 size={14} aria-hidden="true" />Remover</Button>}
          </> : <>
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
          </>}
        </div>
      </article>
      {upload?.status === "checking" && upload?.dataUrl && (
        <DocumentScanningPreview dataUrl={upload.dataUrl} fileType={upload.fileType} />
      )}
    </>
  );
}

export function AiAnalysisDetails({ show, provider, model, confidence, criteriaResults, metaClassName = "doc-row-meta", criteriaClassName = "doc-criteria-results", showMeta = true }: AnyRecord) {
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

const PROCESS_REPORT_FOOTER = "Relatório do processo emitido pelo sistema municipal";

// Pages of text for the process report (the tramitação, the prescription): a header, a section and the blocks wrapped and placed one after
// another, with a new page when one does not fit.
async function appendProcessTextPages(output: AnyRecord, request: AnyRecord, { docTitle, subtitle, section, blocks, emptyText }: { docTitle: string; subtitle: string; section: string; blocks: ReportBlock[]; emptyText: string }) {
  const { rgb } = await importPdfLib();
  const ctx = await createPdfDocContext(output, rgb);
  const { font, bold, colors, margin, pageSize } = ctx;
  const req = normalizeRequest(request);
  const statusColors: Record<string, unknown> = { NOVA: rgb(0.45, 0.52, 0.57), AGENDADA: rgb(0.08, 0.48, 0.72), REALIZADA: rgb(0.07, 0.44, 0.22), CANCELADA: rgb(0.75, 0.18, 0.18) };
  const startPage = () => {
    const created = output.addPage(pageSize);
    const top = drawProntuarioHeader(created, req.protocol, statusLabels[req.status] || req.status || "Sem status", statusColors[req.status] || statusColors.NOVA, ctx, "", docTitle, pdfText(subtitle));
    return { created, top: drawProntuarioSectionTitle(created, section, top - 4, ctx) - 10 };
  };
  let pageNumber = 1;
  let { created: page, top: y } = startPage();
  if (!blocks.length) page.drawText(pdfText(emptyText), { x: margin, y, size: 9, font, color: colors.muted });
  for (const block of blocks) {
    const lines = wrapPdfText(pdfText(block.text), 100);
    const height = (block.heading ? 13 : 0) + lines.length * 11 + 8;
    if (y - height < margin + 40) {
      drawRequestPdfFooter(page, PROCESS_REPORT_FOOTER, `Página ${pageNumber}`, ctx);
      pageNumber += 1;
      ({ created: page, top: y } = startPage());
    }
    if (block.heading) {
      page.drawText(pdfText(block.heading), { x: margin, y, size: 9, font: bold, color: colors.ink });
      y -= 13;
    }
    lines.forEach((line) => {
      page.drawText(line, { x: margin + 10, y, size: 8.5, font, color: colors.muted });
      y -= 11;
    });
    y -= 8;
  }
  drawRequestPdfFooter(page, PROCESS_REPORT_FOOTER, `Página ${pageNumber}`, ctx);
}

// The whole process in one PDF, with its request document, history, attachments and issued prescriptions.
export async function generateProcessReportPdf(request: AnyRecord = {}, requestDocumentKind = "request", municipality: AnyRecord | null = null, requestTypes: AnyRecord[] = []) {
  const { PDFDocument, StandardFonts, rgb } = await importPdfLib();
  const output = await PDFDocument.create();
  const req = normalizeRequest(request);
  const workflow: AnyRecord = req.workflowData || req.workflow_data || {};
  try {
    const requestDocument = await prepareProcessDocumentPreview({ kind: requestDocumentKind }, request, municipality);
    await appendPdfDataUrl(output, requestDocument.dataUrl);
  } catch (error) {
    console.warn("Aviso: documento do processo ignorado no relatório:", error);
    await appendUnsupportedAttachmentPage(output, { title: "Documento do processo", fileName: `Não foi possível gerar o documento do processo ${request.protocol || ""}`.trim(), StandardFonts, rgb });
  }

  await appendProcessTextPages(output, request, {
    docTitle: "TRAMITAÇÃO DO PROCESSO",
    subtitle: `Protocolo: #${req.protocol || "-"}`,
    section: "REGISTROS",
    blocks: historyBlocks(req.rawHistory, (status) => statusLabels[status] || status, formatDateTime),
    emptyText: "Nenhuma tramitação registrada para este processo.",
  });

  for (const attachment of getUserUploadedProcessDocuments(request.documents)) {
    const dataUrl = getDocumentPreviewSource(attachment);
    const mimeType = attachment.fileType || attachment.type || attachment.mimeType || getDataUrlMimeType(dataUrl);
    try {
      if (dataUrl && mimeType === "application/pdf") {
        await appendPdfDataUrl(output, dataUrl);
        continue;
      }
      if (dataUrl && mimeType?.startsWith("image/")) {
        await appendImageDataUrl(output, dataUrl, mimeType);
        continue;
      }
    } catch (error) {
      console.warn("Aviso: anexo sem prévia no relatório do processo:", error);
    }
    await appendUnsupportedAttachmentPage(output, { title: attachment.documentName || "Documento anexado", fileName: attachment.fileName || "Arquivo sem prévia", StandardFonts, rgb });
  }

  const animals = resolveRequestProcedures(request, requestTypes);
  for (const prescription of reportPrescriptions(animals.length ? animals : req.animals, workflow.attendancePrescription)) {
    await appendProcessTextPages(output, request, {
      docTitle: "RECEITA VETERINÁRIA",
      subtitle: [`Protocolo: #${req.protocol || "-"}`, prescription.subtitle].filter(Boolean).join("  ·  "),
      section: "PRESCRIÇÃO",
      blocks: prescription.blocks,
      emptyText: "",
    });
  }

  return {
    fileName: `Relatório ${request.protocol || ""}.pdf`.trim(),
    dataUrl: uint8ArrayToDataUrl(await output.save(), "application/pdf"),
  };
}

export async function prepareProcessDocumentPreview(item: AnyRecord, request: AnyRecord, municipality: AnyRecord | null = null) {
  if (item.kind === "request") {
    return {
      documentName: "Requerimento municipal",
      fileName: `Requerimento ${request.protocol || ""}.pdf`.trim(),
      fileType: "application/pdf",
      eyebrow: "Requerimento",
      dataUrl: await createRequestPdfDataUrl(request, municipality),
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

// Paleta neutra da tela "Consultar prontuário" — fonte única, reaproveitada por
// todas as funções de desenho do PDF do Prontuário (que não usam a paleta
// azul genérica dos demais documentos).
const ANIMAL_RECORD_COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#dbe5f1",
  bg: "#f8fafc",
  cardBorder: "#e5e7eb",
};

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

function drawProntuarioSectionTitle(page, title, y, ctx, colorOverride: unknown = null) {
  const { bold, colors, margin } = ctx;
  const barColor = colorOverride ?? colors.blue;
  const textColor = colorOverride ?? colors.ink;
  page.drawRectangle({ x: margin, y: y - 13, width: 3, height: 13, color: barColor });
  page.drawText(pdfText(title), { x: margin + 9, y: y - 11, size: 8, font: bold, color: textColor });
  return y - 22;
}

// Mirrors the neutral header card of the animal record.
// (#f8fafc / borda #dbe5f1) com avatar circular escuro, nome, resumo,
// microchip/município e o chip de status verde no canto direito.
function drawAnimalRecordHeader(page, animalName, animalSummary, microchipLine, statusLabel, ctx) {
  const { font, bold, margin, rgb } = ctx;
  const beige = {
    bg: rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.bg)),
    border: rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.line)),
    ink: rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.ink)),
    muted: rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.muted)),
  };
  const hex = (h: string) => rgb(...hexToRgbTuple(h));
  const pageW = page.getWidth();
  const contentW = pageW - margin * 2;
  const cardH = 76;
  const topY = page.getHeight() - margin;
  const cardTop = topY;
  const cardBottom = cardTop - cardH;

  page.drawRectangle({ x: margin, y: cardBottom, width: contentW, height: cardH, color: beige.bg, borderColor: beige.border, borderWidth: 1 });

  const avatarSize = 46;
  const avatarX = margin + 16;
  const avatarY = cardTop - 16 - avatarSize;
  page.drawRectangle({ x: avatarX, y: avatarY, width: avatarSize, height: avatarSize, color: beige.ink });
  page.drawText("*", { x: avatarX + avatarSize / 2 - 3, y: avatarY + avatarSize / 2 - 6, size: 18, font: bold, color: hex("#ffffff") });

  const textX = avatarX + avatarSize + 14;
  const textW = margin + contentW - 130 - textX;
  page.drawText(pdfText(wrapPdfText(pdfText(animalName || "Animal sem nome"), Math.floor(textW / 7.5))[0] || "-"), { x: textX, y: cardTop - 28, size: 14, font: bold, color: beige.ink });
  page.drawText(pdfText(wrapPdfText(pdfText(animalSummary), Math.floor(textW / 5.2))[0] || "-"), { x: textX, y: cardTop - 44, size: 9, font, color: beige.muted });
  page.drawText(pdfText(wrapPdfText(pdfText(microchipLine), Math.floor(textW / 5))[0] || "-"), { x: textX, y: cardTop - 58, size: 8, font, color: beige.muted });

  const pillText = pdfText(statusLabel || "ATIVO");
  const pillW = Math.max(52, pillText.length * 5.5 + 20);
  const pillH = 18;
  const pillX = margin + contentW - 16 - pillW;
  const pillY = cardTop - 16 - pillH;
  const statusOk = String(statusLabel || "").toUpperCase() === "ATIVO";
  const pillColors = statusOk ? { bg: hex("#dcfce7"), ink: hex("#166534") } : { bg: hex("#fee2e2"), ink: hex("#b91c1c") };
  page.drawRectangle({ x: pillX, y: pillY, width: pillW, height: pillH, color: pillColors.bg });
  page.drawText(pillText, { x: pillX + Math.round((pillW - pillText.length * 5) / 2), y: pillY + 6, size: 8, font: bold, color: pillColors.ink });

  return cardBottom - 16;
}

function drawProntuarioFields(page, rows, y, ctx, contentWidthOverride = 0, colorOverride: { label: unknown; value: unknown } | null = null) {
  // rows: array of { label, value }[] — each inner array is one row of columns
  const { font, bold, colors, margin } = ctx;
  const labelColor = colorOverride?.label ?? colors.muted;
  const valueColor = colorOverride?.value ?? colors.ink;
  const contentW = contentWidthOverride || (page.getWidth() - margin * 2);
  const baseRowH = 30;
  const valueLineH = 11;

  // Cada linha do grid reserva 30px por padrão, mas o valor pode quebrar em
  // até 2 linhas (wrapped.slice(0, 2)) — altura fixa deixava a 2ª linha do
  // valor colada no label da próxima linha do grid.
  const rowHeights = rows.map((cols) => {
    const colW = contentW / cols.length;
    const maxLines = Math.max(1, ...cols.map(({ value }) =>
      Math.min(2, wrapPdfText(pdfText(String(value || "-")), Math.floor(colW / 5.5)).length)
    ));
    return Math.max(baseRowH, 12 + maxLines * valueLineH + 6);
  });

  let rowY = y;
  rows.forEach((cols, ri) => {
    const colW = contentW / cols.length;
    const fy = rowY;
    cols.forEach(({ label, value }, ci) => {
      const x = margin + ci * colW;
      page.drawText(pdfText(String(label || "")), { x, y: fy, size: 7, font: bold, color: labelColor });
      const val = pdfText(String(value || "-"));
      const wrapped = wrapPdfText(val, Math.floor(colW / 5.5));
      wrapped.slice(0, 2).forEach((line, li) => {
        page.drawText(line, { x, y: fy - 12 - li * valueLineH, size: 9, font: bold, color: valueColor });
      });
    });
    rowY -= rowHeights[ri];
  });
  return y - rowHeights.reduce((sum, h) => sum + h, 0);
}

function drawProntuarioSummaryCards(page, cards, y, ctx) {
  // cards: { label, primary, secondary }[] mirrors the summaries shown in the animal record.
  const { font, bold, margin, rgb } = ctx;
  const cardBorder = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.cardBorder));
  const cardInk = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.ink));
  const cardMuted = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.muted));
  const cardWhite = rgb(1, 1, 1);
  const contentW = page.getWidth() - margin * 2;
  const gap = 10;
  const colW = (contentW - gap * (cards.length - 1)) / cards.length;
  const baseCardH = 48;
  const secondaryLineH = 9;

  // `secondary` (ex.: endereço) pode precisar de 2 linhas — altura fixa
  // cortava a segunda linha silenciosamente quando o texto não cabia.
  const cardsWithLines = cards.map(({ label, primary, secondary }) => ({
    label, primary, secondary,
    primaryLines: wrapPdfText(pdfText(String(primary || "-")), Math.floor(colW / 5.5)),
    secondaryLines: wrapPdfText(pdfText(String(secondary || "-")), Math.floor(colW / 5)).slice(0, 2),
  }));
  const maxSecondaryLines = Math.max(1, ...cardsWithLines.map((c) => c.secondaryLines.length));
  const cardH = baseCardH + (maxSecondaryLines - 1) * secondaryLineH;

  cardsWithLines.forEach(({ label, primaryLines, secondaryLines }, ci) => {
    const x = margin + ci * (colW + gap);
    page.drawRectangle({ x, y: y - cardH, width: colW, height: cardH, borderColor: cardBorder, borderWidth: 0.8, color: cardWhite });
    page.drawText(pdfText(String(label || "")), { x: x + 8, y: y - 14, size: 6.5, font: bold, color: cardMuted });
    page.drawText(primaryLines[0] || "-", { x: x + 8, y: y - 27, size: 9, font: bold, color: cardInk });
    secondaryLines.forEach((line, li) => {
      page.drawText(line, { x: x + 8, y: y - 39 - li * secondaryLineH, size: 7.5, font, color: cardMuted });
    });
  });

  return y - cardH;
}

// Desenha a timeline em fluxo contínuo: quando o evento não cabe mais na
// página atual, abre uma página de continuação (sem repetir o cabeçalho
// grande do documento) e segue desenhando a partir do topo.
// Cores dos marcadores por tone, espelhando .animal-history-item.<tone> .animal-history-marker
const PRONTUARIO_TIMELINE_TONE_COLORS: Record<string, { bg: string; ink: string }> = {
  danger: { bg: "#fee2e2", ink: "#b91c1c" },
  transfer: { bg: "#f1f5f9", ink: "#475569" },
  success: { bg: "#dcfce7", ink: "#166534" },
  scheduled: { bg: "#dbeafe", ink: "#1d4ed8" },
  neutral: { bg: ANIMAL_RECORD_COLORS.bg, ink: ANIMAL_RECORD_COLORS.muted },
};

function drawProntuarioTimeline(output, page, events, y, ctx, pageSize) {
  const { font, bold, margin, rgb } = ctx;
  const hex = (h: string) => rgb(...hexToRgbTuple(h));
  const ink = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.ink));
  const muted = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.muted));
  const dividerColor = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.line));
  const markerRadius = 12;
  const lineX = margin + markerRadius;
  const contentX = lineX + markerRadius + 12;
  const baseEventH = 36;
  const detailLineH = 11;
  const bottomLimit = margin + 40;
  const topStart = pageSize[1] - margin - 20;

  // Altura do bloco de um evento: distância do nó (topo) até a última linha
  // de texto desenhada (título em nodeY+markerRadius-21, detalhes a partir de
  // nodeY+markerRadius-33, cada um 11px abaixo do anterior), mais uma folga
  // fixa para a divisória não colidir com a última linha. A fórmula anterior
  // não acompanhava essa posição real e a divisória cortava o texto.
  const eventHeightOf = (ev) => {
    const detailsCount = ev.details?.length || 0;
    const lastTextOffsetFromNode = detailsCount > 0
      ? markerRadius - 33 - (detailsCount - 1) * detailLineH // relativo a nodeY
      : markerRadius - 21; // só o título
    const neededHeight = markerRadius - lastTextOffsetFromNode + 14; // + folga até a divisória
    return Math.max(baseEventH, neededHeight);
  };

  let currentPage = page;

  events.forEach((ev, i) => {
    const eventH = eventHeightOf(ev);
    if (y - eventH < bottomLimit) {
      currentPage = output.addPage(pageSize);
      y = topStart;
    }
    const nodeY = y - markerRadius;
    const tone = PRONTUARIO_TIMELINE_TONE_COLORS[ev.tone] || PRONTUARIO_TIMELINE_TONE_COLORS.neutral;
    const markerBg = hex(tone.bg);
    const markerInk = hex(tone.ink);

    if (i < events.length - 1) {
      currentPage.drawLine({
        start: { x: lineX, y: nodeY - markerRadius },
        end: { x: lineX, y: nodeY - eventH + markerRadius },
        thickness: 1,
        color: dividerColor,
      });
    }
    currentPage.drawCircle({ x: lineX, y: nodeY, size: markerRadius, color: markerBg, borderColor: dividerColor, borderWidth: 0.6 });
    const iconText = pdfText(ev.iconLabel || "•");
    const iconWidth = bold.widthOfTextAtSize(iconText, 8);
    currentPage.drawText(iconText, {
      x: lineX - iconWidth / 2,
      y: nodeY - 3,
      size: 8,
      font: bold,
      color: markerInk,
    });

    if (ev.date) {
      currentPage.drawText(pdfText(ev.date), { x: contentX, y: nodeY + markerRadius - 9, size: 7.5, font, color: muted });
    }
    currentPage.drawText(pdfText(ev.title), { x: contentX, y: nodeY + markerRadius - 21, size: 9.5, font: bold, color: ink });
    (ev.details || []).forEach((detail, di) => {
      currentPage.drawText(pdfText(String(detail)), { x: contentX, y: nodeY + markerRadius - 33 - di * detailLineH, size: 8, font, color: muted });
    });

    if (i < events.length - 1) {
      currentPage.drawLine({
        start: { x: contentX - 6, y: y - eventH + 6 },
        end: { x: page.getWidth() - margin, y: y - eventH + 6 },
        thickness: 0.4,
        color: dividerColor,
      });
    }

    y -= eventH;
  });

  return { page: currentPage, y };
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

// Marcador textual do evento na timeline do PDF (equivalente ao ícone lucide
// usado por AnimalHistoryIcon na tela — pdf-lib não desenha ícones vetoriais
// de biblioteca, então usamos uma letra curta com a mesma semântica).
function prmHistoryIconLabel(item: AnyRecord = {}) {
  if (["ANIMAL_OBITO", "SOLICITACAO_OBITO"].includes(item.type)) return "!";
  if (["TROCA_TUTOR", "SOLICITACAO_TROCA_TUTOR"].includes(item.type)) return "T";
  if (item.type === "CIRURGIA_REALIZADA") return "OK";
  if (item.status === "AGENDADA" || item.status === "AGUARDANDO_CIRURGIA") return "AG";
  return "•";
}

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

  const statusLabel = String(animal.status || "ativo").toUpperCase();

  const latestHistoryItem = historyList[0] || null;
  const nextScheduledHistoryItem = historyList.find((item) => (
    (item.status === "AGENDADA" || item.status === "AGUARDANDO_CIRURGIA") && getAnimalHistorySchedule(item)
  )) || null;
  const latestProcedureItem = historyList.find((item) => (
    ["CIRURGIA_REALIZADA", "SOLICITACAO_PROCEDIMENTO"].includes(item.type)
  )) || null;
  const historyMunicipalitiesList = [...new Set(historyList.map(getAnimalHistoryMunicipality).filter(Boolean))];

  return {
    req, wf, animal, historyList, hasRealRequest,
    tutorName,
    tutorCpfMasked: maskCpf(tutorCpf || "") || "-",
    tutorContact: [tutorPhone, tutorEmail].filter(Boolean).join(" · ") || "Não informado",
    tutorAddressLine: tutorAddressLine || "Endereço não informado",
    statusLabel,
    animalSummary: [animal.species, animal.sex, animal.size].filter(Boolean).join(" · ") || "Dados do animal em atualização",
    latestHistoryItem,
    nextScheduledHistoryItem,
    latestProcedureItem,
    historyMunicipalitiesList,
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
    statusLabel, animalSummary,
    latestHistoryItem, nextScheduledHistoryItem, latestProcedureItem,
    historyMunicipalitiesList,
  } = data;

  const isRealizada = req.status === "REALIZADA";
  const isCancelada = req.status === "CANCELADA";

  const contentW = 595.28 - margin * 2;

  const scheduleAddress = [req.scheduleLocationName, req.scheduleAddress, req.scheduleMunicipality]
    .filter(Boolean).join(" - ");
  const microchipApplied = String(wf.attendanceMicrochip || "").trim();
  const prescription = String(wf.attendancePrescription || "").trim();
  const attendanceNote = String(req.attendanceNote || "").trim();
  const cancelReason = String(wf.cancelReason || req.rejectionReason || "").trim();
  const cancelNote = String(wf.cancelNote || req.rejectionNote || "").trim();

  // Paleta neutra da tela "Consultar prontuário" — usada em todo este
  // documento em vez da paleta azul genérica dos demais PDFs.
  const beigeLine = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.line));
  const beigeMuted = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.muted));
  const beigeInk = rgb(...hexToRgbTuple(ANIMAL_RECORD_COLORS.ink));

  const page = output.addPage(pageSize);
  const microchipLine = `Microchip: ${animal.microchip || req.animalMicrochip || "não informado"}${historyMunicipalitiesList.length ? "   ·   " + historyMunicipalitiesList.join(", ") : ""}`;
  let y = drawAnimalRecordHeader(page, animal.name, animalSummary, microchipLine, statusLabel, ctx);
  y -= 4;

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
  ], y, ctx, 0, { label: beigeMuted, value: beigeInk });
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.4, color: beigeLine });
  y -= 16;

  // ── HISTÓRICO DO ANIMAL (espelha .animal-history da tela, mesma continuidade) ──
  const historyTitle = historyList.length
    ? "HISTÓRICO DO ANIMAL"
    : "HISTÓRICO DO PROCESSO";
  const historyTitleTopY = y;
  y = drawProntuarioSectionTitle(page, historyTitle, y, ctx, beigeInk);
  page.drawText(pdfText(`${historyList.length} evento(s) registrado(s) para este microchip`), { x: margin, y: historyTitleTopY - 24, size: 7.5, font, color: beigeMuted });
  y -= 10;

  const tlEvents: { date: string; title: string; details: string[]; done: boolean; tone: string; iconLabel: string }[] = [];

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
        tone: animalHistoryTone(item),
        iconLabel: prmHistoryIconLabel(item),
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
      tone: "neutral",
      iconLabel: "•",
    });
    tlEvents.push({
      date: scheduleDate,
      title: "Agendamento",
      details: [scheduleAddress || "Local não informado", req.responsible ? `Responsável: ${req.responsible}` : ""].filter(Boolean),
      done: req.status === "AGENDADA" || isRealizada,
      tone: "scheduled",
      iconLabel: "AG",
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
        tone: "success",
        iconLabel: "OK",
      });
      if (prescription) {
        tlEvents.push({ date: "", title: "Receita prescrita", details: wrapPdfText(pdfText(prescription), 72).slice(0, 4), done: true, tone: "neutral", iconLabel: "•" });
      }
    }
    if (isCancelada) {
      tlEvents.push({
        date: "",
        title: "Processo cancelado / indeferido",
        details: [cancelReason || "Motivo não informado", cancelNote].filter(Boolean),
        done: true,
        tone: "danger",
        iconLabel: "!",
      });
    }
    if (!isRealizada && !isCancelada) {
      tlEvents.push({ date: "-", title: "Realização · aguardando", details: ["Procedimento ainda não realizado"], done: false, tone: "neutral", iconLabel: "•" });
    }
  }

  if (hasRealRequest) {
    for (const { subtitle, blocks } of reportPrescriptions(resolveRequestProcedures(req), "", { completedOnly: true })) {
      const text = blocks.map((block) => block.text).join("\n");
      tlEvents.push({ date: "", title: "Receita prescrita", details: [subtitle, ...wrapPdfText(pdfText(text), 72).slice(0, 4)].filter(Boolean), done: true, tone: "neutral", iconLabel: "•" });
    }
  }
  const timelineResult = drawProntuarioTimeline(output, page, tlEvents, y, ctx, pageSize);
  const finalPage = timelineResult.page;

  // nota de rodapé quando sem microchip
  if (!animal.microchip && !req.animalMicrochip) {
    finalPage.drawText("* Histórico parcial — animal sem microchip registrado. Dados referentes ao protocolo acima.", {
      x: margin, y: margin + 40, size: 7, font, color: beigeMuted,
    });
  }

  const allPages = output.getPages();
  allPages.forEach((pg, index) => {
    drawRequestPdfFooter(pg, "Prontuário emitido pelo sistema municipal", `Página ${index + 1} de ${allPages.length}`, ctx);
  });

  const bytes = await output.save();
  const animalName = animal.name || "";
  const fileName = ["Prontuário", animalName, animal.microchip || req.animalMicrochip || req.protocol || ""]
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

async function createRequestPdfDataUrl(request: AnyRecord = {}, municipality: AnyRecord | null = null) {
  const { PDFDocument, rgb } = await importPdfLib();
  const pdf = await PDFDocument.create();
  const { font, bold, colors, margin, pageSize } = await createPdfDocContext(pdf, rgb);
  const ctx = { font, bold, colors, rgb, margin };
  const contentW = 595.28 - margin * 2;

  const req = normalizeRequest(request);
  const workflowData = req.workflowData || req.workflow_data || {};
  const animals = Array.isArray(req.animals) ? req.animals : [];
  // The public form records an electronic acceptance; a request made at the counter is registered by the staff and signed on paper.
  const acceptance = requestAcceptance(req);
  const acceptedAt = acceptance.at || new Date().toISOString();
  const electronic = acceptance.kind === RequestAcceptance.ELECTRONIC;
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
        { label: "PROCEDIMENTO", value: animal.procedureType || animal.procedure || animalProcedureLabels(animal, req).join(", ") || requestTypeLabel(req) || "-" },
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

  y = drawProntuarioSectionTitle(page1, electronic ? "PROTOCOLO E ACEITE" : "PROTOCOLO E REGISTRO", y, ctx);
  y -= 8;
  page1.drawText("PROTOCOLO", { x: margin + 9, y, size: 7, font: bold, color: colors.muted });
  y -= 18;
  page1.drawText(pdfText(`#${req.protocol || "-"}`), { x: margin + 9, y, size: 18, font: bold, color: colors.blue });
  y -= 14;
  page1.drawText(
    pdfText(`${electronic ? "Aceite eletrônico registrado em" : "Registrado no atendimento em"} ${formatDateTime(acceptedAt)}`),
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

  // The text of the declaration is the municipality's: its name and department, and the fee clause only for a charged request.
  const declaration = renderDeclaration({ municipalityName: municipality?.name || request.municipalityName || request.municipality_name, departmentName: municipality?.department_name, charged: isRequestFeeCharged(request.fee) });
  const declarationItems = declaration.items;
  const recommendationItems = declaration.recommendations;

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

  if (electronic) {
    y2 = drawProntuarioSectionTitle(page2, "ACEITE ELETRÔNICO DO TUTOR", y2, ctx);
    y2 -= 6;
    drawProntuarioFields(page2, [
      [
        { label: "ACEITE REGISTRADO POR", value: req.tutor || "-" },
        { label: "CPF", value: req.cpf || "-" },
        { label: "DATA / HORA", value: formatDateTime(acceptedAt) },
        { label: "MÉTODO", value: "Li e aceito" },
      ],
    ], y2, ctx);
  } else {
    // No term is accepted on the screen at the counter: the tutor signs the printed declaration.
    y2 = drawProntuarioSectionTitle(page2, "ASSINATURA DO TUTOR", y2, ctx);
    y2 -= 6;
    y2 = drawProntuarioFields(page2, [
      [
        { label: "NOME", value: req.tutor || "-" },
        { label: "CPF", value: req.cpf || "-" },
        { label: "REGISTRADO NO ATENDIMENTO EM", value: formatDateTime(acceptedAt) },
      ],
    ], y2, ctx);
    y2 -= 36;
    page2.drawLine({ start: { x: margin + 9, y: y2 }, end: { x: margin + 289, y: y2 }, thickness: 0.6, color: colors.ink });
    y2 -= 12;
    page2.drawText(pdfText("Assinatura do tutor ou responsável"), { x: margin + 9, y: y2, size: 8, font, color: colors.muted });
  }
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

// Converte uma cor hex (#rrggbb, mesmo formato usado em styles.css) para a
// tupla 0-1 esperada por pdf-lib, para reaproveitar as cores exatas da tela
// ao invés de reaproximá-las visualmente.
function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

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
