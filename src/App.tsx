import React, { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "./api";
import {
  Activity,
  BarChart3,
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
  Users,
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
import { PublicAccessRequestForm } from "./features/access-request/public-access-request-form";
import { RequestTextField } from "./features/request-steps/request-text-field";
import { HeroCard } from "./features/public-home/hero-card";
import { PublicMetrics } from "./features/public-home/public-metrics";
import { PUBLIC_PHONE_QUERY, PublicMenuButton, PublicServiceButtons, PublicServicesMenu } from "./features/public-home/public-services-menu";
import { useBackLayer } from "./features/public-navigation/use-back-layer";
import type { AnyRecord } from "./types";
import {
  CONFIG_KEYS,
  CONFIG_KEYS_LIST,
  GLOBAL_MUNICIPALITY_FILTER_KEY,
  accessRequesterTypes,
  aiProviderOptions,
  DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE,
  filterByMunicipalityScope,
  generateScheduleDaysFromRule,
  displayText,
  formatScheduleDate,
  formatSizeRange,
  getItemMunicipalityId,
  getNextUpcomingMutirao,
  initialAiSettings,
  initialBreeds,
  initialNeighborhoods,
  initialDocumentTypes,
  initialMunicipalities,
  initialRequestTypes,
  initialSizes,
  initialSpecies,
  initialTeams,
  isPastScheduleDay,
  normalizeDocumentType,
  normalizeRequest,
  normalizeScheduleDateText,
  normalizeScheduleDay,
  normalizeScheduleSlots,
  parseScheduleDate,
  requestTypeLabel,
  RequestType,
  sumScheduleSlotsVacancies,
  textToCriteriaList,
  triageStatusTone,
} from "./domain";
import {
  buildMetrics,
} from "./analytics";
import {
  ConfigActiveToggle,
  ConfigField,
  ConfigRow,
  ConfigSectionHeader,
  ConfigStatusFilter,
  configFieldStyle,
  configTextareaStyle,
  EmptyState,
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
import { useModalFocus } from "./components/modal-focus";
import { useMediaQuery } from "./components/use-media-query";
import { WorkspaceMobileNavigation } from "./components/workspace-mobile-navigation";
import { DocumentPreviewModal } from "./components/document-preview-modal";
import { ToastContainer } from "./components/toast-container";
import { PublicSchedulePicker } from "./features/schedule-picker/public-schedule-picker";
import { getUserSectorIds, userBelongsToSector } from "./features/teams/user-sectors";
import { createRequestDocumentDataUrl } from "./features/municipal-documents/request-document-pdf";
import { downloadAnimalRecordPdf } from "./features/municipal-documents/animal-record-pdf";
import { loadMunicipalityRecord } from "./features/municipal-documents/document-municipality";
import { DeclarationDialog } from "./features/request-document/declaration-dialog";
import {
  formatCep,
  formatCpf,
  formatDateTime,
  formatPhone,
  getDataUrlMimeType,
  isGlobalRole,
  isMasterRole,
  isValidCpf,
  isValidPhone,
  maskCpf,
  normalizeSearchKey,
  normalizeText,
  onlyDigits,
  readFileAsDataUrl,
} from "./utils";
import { AccessRequestsView } from "./features/access-requests/access-requests-view";
import { AgendaView } from "./features/agenda/agenda-view";
import { canEditRequests, useRequestActions } from "./features/request-actions/request-actions";
import { ProcessModal } from "./features/process-modal/process-modal";
import { ReportsView } from "./features/reports/reports-view";
import { ActiveFiltersBar } from "./features/request-filters/active-filters-bar";
import { StaffNotificationBell } from "./features/staff-notifications/staff-notification-bell";
import { SidebarMunicipalityBrand } from "./components/sidebar-municipality-brand";
import { REQUESTS_MENU_ITEM } from "../shared/staff-notifications-contract.js";
import { ACCESS_REQUEST_SOURCE, getEmptyListMessage, isRequestFiltersEmpty } from "./features/request-filters/request-filters";
import type { RequestListFilters } from "./features/request-filters/request-filters";
import { RequestFiltersDrawer } from "./features/request-filters/request-filters-drawer";
import { RequestFiltersToolbar } from "./features/request-filters/request-filters-toolbar";
import {
  buildRequestFilterResults,
  requestFiltersReducer,
  RequestFiltersActionType,
  useRequestFilterResults,
  useRequestFilters,
} from "./features/request-filters/use-request-filters";
import type { RequestFiltersAction } from "./features/request-filters/use-request-filters";
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
  procedureSignature,
  withProceduresAt,
} from "./features/request-procedures/request-procedures";
import { animalRequestTypeIds, combineRequestFees, deriveRequestTypeFields, resolveRequestTypes } from "../shared/request-types-contract.js";
import { isProcedureRequest, RequestOrigin } from "../shared/request-contract.js";
import { readAccessLink } from "../shared/request-access-contract.js";
import { BreedsConfig } from "./features/breeds/breeds-config";
import { NeighborhoodsConfig } from "./features/neighborhoods/neighborhoods-config";
import { useNeighborhoodCatalog } from "./features/neighborhoods/use-neighborhood-catalog";
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
import { issuedPrescriptions } from "./features/process-report/process-report";
import { useSession } from "./features/tutor-access/use-session";
import { AuthEntry } from "./features/tutor-access/auth-entry";
import { AuthEntryOrigin, authEntryKey, createAuthEntryContext } from "./features/tutor-access/auth-entry-context";
import type { AuthEntryContext } from "./features/tutor-access/auth-entry-context";
import { SmsSettings } from "./features/sms/sms-settings";
import { EmailIntegrationTab } from "./features/email/email-integration-tab";
import { IntegrationConfigItem } from "../shared/config-permission-contract.js";
import { canUseIntegration, integrationTabItems } from "./features/integrations/integration-access";
import { RequestTracking } from "./features/request-tracking/request-tracking";
import { RequestAccess } from "./features/request-access/request-access";
import { PublicReportPanel } from "./features/complaint/public-report-panel";
import { registrationContactIssues } from "./features/tutor-access/registration-contact-fields";
import { PasswordChangeForm } from "./features/tutor-access/password-change-form";
import { TutorArea } from "./features/tutor-access/tutor-area";

import { stripEphemeralCredentials, stripMunicipalityBootstrap } from "./features/tutor-access/submission-envelope";
import { validateTutorName } from "./features/tutor-access/tutor-identity";
import { SessionBoundary } from "./features/tutor-access/session-boundary";
import { getAdoptionInterestCount } from "./features/adoption/adoption-interest-count";
import { ADOPTION_STATUS_ADOPTED, ADOPTION_STATUS_AVAILABLE, ADOPTION_STATUS_IN_PROGRESS } from "./features/adoption/adoption-status";
import { MAX_ADOPTION_PHOTO_BYTES } from "../shared/adoption-contract.js";
import { ShareAdoptionButton } from "./features/adoption-share/share-adoption-button";
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
const mobileWorkspaceQuery = "(max-width: 1120px)";
const settingsNavButtonClassName = [
  "tw:w-full tw:min-w-0 tw:shrink-0 tw:justify-start tw:gap-2 tw:rounded-none tw:border-y-0 tw:border-r-0 tw:border-l-[3px] tw:border-transparent",
  "tw:bg-transparent tw:py-2 tw:pr-2 tw:pl-2 tw:text-left tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:aria-[current=page]:border-l-ui-accent",
].join(" ");
const settingsNavLabelClassName = "tw:min-w-0 tw:flex-1 tw:leading-snug tw:[overflow-wrap:anywhere]";

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
    renderTutor={(user) => <TutorArea key={user.id} user={user} intent={procedureIntent} onIntentConsumed={() => setProcedureIntent(null)} onSession={accept} onLogout={logout} downloadRecordPdf={async (record) => downloadAnimalRecordPdf({ history: record, municipality: await loadMunicipalityRecord(user.municipalityId || "") })} createRequirement={createRequestDocumentDataUrl} renderRequests={(rows) => <TutorDashboard requests={rows} currentUser={user} />}
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
  const [aiConfig, setAiConfig] = useState<{ scope: string; settings: AnyRecord | null } | null>(null);
  const [aiConfigAttempt, setAiConfigAttempt] = useState(0);
  const [scheduleDays, setScheduleDays] = useState([]);
  const [scheduleRules, setScheduleRules] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [{ teams, persistTeams }, setTeamState] = useState(() => ({ teams: normalizeTeams(initialTeams), persistTeams: false }));
  const setTeams = useCallback((update: React.SetStateAction<typeof teams>, persist = true) => {
    setTeamState((current) => ({
      teams: typeof update === "function" ? update(current.teams) : update,
      persistTeams: persist,
    }));
  }, []);
  const [accessRequests, setAccessRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [notificationRequest, setNotificationRequest] = useState<AnyRecord | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const usesMobileMenu = useMediaQuery(mobileWorkspaceQuery);
  const sidebar = useRef<HTMLElement>(null);
  const sidebarTrigger = useRef<HTMLButtonElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
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
  const mobileDialogOpen = Boolean(currentUser && usesMobileMenu && mobileOpen);

  // Leaving the phone layout closes its menu.
  useEffect(() => {
    if (!usesMobileMenu) setMobileOpen(false);
  }, [usesMobileMenu]);

  useEffect(() => {
    if (sidebar.current) sidebar.current.inert = usesMobileMenu && !mobileOpen;
  }, [usesMobileMenu, mobileOpen, currentUser]);
  useModalFocus(sidebar, mobileDialogOpen, sidebarTrigger.current);
  // A shared adoption link always opens the public page on the animal: main.tsx makes that page ignore a saved session.
  const sharedAdoption = useSharedAdoption(handleMunicipalitySelect);


  useEffect(() => {
    if (accessLink) window.history.replaceState(window.history.state, "", window.location.pathname);
    api.getAdoptions().then((list) => setAdoptionAnimals(list.map(normalizeAdoptionAnimal))).catch(console.error);
    api.getMunicipalities().then((list) => {
      const active = Array.isArray(list) ? list : [];
      if (!isGlobalRole(currentUser?.role)) setMunicipalities(active);
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
    if (!currentUser) return;
    setTenantConfigReady(false);
    setLoadedConfigKeys({});
    if (isGlobalRole(currentUser.role)) {
      let cancelled = false;
      const loadGlobalMunicipalityConfigs = async () => {
        try {
          const municipalityList = await api.getMunicipalitiesAdmin();
          if (cancelled || !Array.isArray(municipalityList)) return;
          setMunicipalities(municipalityList);
          const savedMunicipalityId = localStorage.getItem(GLOBAL_MUNICIPALITY_FILTER_KEY);
          if (savedMunicipalityId && !municipalityList.some(({ id }) => id === savedMunicipalityId)) {
            handleGlobalMunicipalityFilter("");
          }
          const configEntries = await Promise.all(municipalityList.map(async (municipality) => {
            const values = await Promise.all(CONFIG_KEYS_LIST.map((key) =>
              api.getConfig(key, municipality.id).then((value) => [key, value]).catch(() => [key, null]),
            ));
            return { municipality, values: Object.fromEntries(values) };
          }));
          if (cancelled) return;
          setRequestTypes(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.requestTypes], municipality)));
          setDocumentTypes(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.documentTypes], municipality)));
          setSpeciesOptions(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.species], municipality)));
          setSizeOptions(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.sizes], municipality)));
          setBreeds(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.breeds], municipality)));
          setNeighborhoods(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.neighborhoods], municipality)));
          setTeams({
            sectors: dedupeMunicipalityItems(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.teams]?.sectors, municipality))),
            users: dedupeMunicipalityItems(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.teams]?.users, municipality))),
          }, false);
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
          if (!cancelled) setTenantConfigReady(true);
        }
      };
      loadGlobalMunicipalityConfigs().catch(console.error);
      return () => { cancelled = true; };
    }
    const configLoaders: Array<[string, (value: any) => void]> = [
      [CONFIG_KEYS.requestTypes, setRequestTypes],
      [CONFIG_KEYS.documentTypes, setDocumentTypes],
      [CONFIG_KEYS.species, setSpeciesOptions],
      [CONFIG_KEYS.sizes, setSizeOptions],
      [CONFIG_KEYS.breeds, setBreeds],
      [CONFIG_KEYS.neighborhoods, setNeighborhoods],
      [CONFIG_KEYS.teams, (value) => setTeams(value, false)],
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
  useEffect(() => { if (persistTeams && canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.teams]) api.setConfig(CONFIG_KEYS.teams, teams).catch(() => {}); }, [persistTeams, canPersistTenantConfig, loadedConfigKeys, teams]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.permissionGroups]) api.setConfig(CONFIG_KEYS.permissionGroups, permissionGroups).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, permissionGroups]);
  useEffect(() => { if (canPersistTenantConfig && loadedConfigKeys[CONFIG_KEYS.scheduleRules]) api.setConfig(CONFIG_KEYS.scheduleRules, scheduleRules).catch(() => {}); }, [canPersistTenantConfig, loadedConfigKeys, scheduleRules]);

  const aiConfigMunicipalityId = currentUser
    ? (isGlobalRole(currentUser.role) ? globalMunicipalityFilterId : currentUser.municipalityId || "")
    : selectedMunicipalityId;
  const aiConfigScope = `${currentUser?.id || ""}:${currentUser?.role || ""}:${aiConfigMunicipalityId}`;
  const scopedAiConfig = aiConfig?.scope === aiConfigScope ? aiConfig : null;
  const aiSettings = scopedAiConfig?.settings || initialAiSettings;
  const aiConfigStatus = !aiConfigMunicipalityId ? "unselected" : !scopedAiConfig ? "loading" : scopedAiConfig.settings ? "ready" : "error";

  function retryAiConfig() {
    setAiConfig(null);
    setAiConfigAttempt((attempt) => attempt + 1);
  }

  function setAiSettings(update: React.SetStateAction<AnyRecord>) {
    setAiConfig((current) => {
      if (current?.scope !== aiConfigScope || !current.settings) return current;
      return { ...current, settings: typeof update === "function" ? update(current.settings) : update };
    });
  }

  useEffect(() => {
    if (!aiConfigMunicipalityId) return;
    let cancelled = false;
    api.getConfig("ai", aiConfigMunicipalityId).then((saved) => {
      if (cancelled) return;
      if (saved !== null && typeof saved?.hasApiKey !== "boolean") throw new Error("Incomplete AI settings");
      const safeSaved = saved && typeof saved === "object" ? saved : {};
      const merged = { ...initialAiSettings, ...safeSaved, active: Boolean(safeSaved.active) };
      const validModels = aiProviderOptions[merged.provider]?.models || [];
      if (validModels.length && !validModels.includes(merged.model)) merged.model = validModels[0];
      setAiConfig({ scope: aiConfigScope, settings: merged });
    }).catch(() => {
      if (!cancelled) setAiConfig({ scope: aiConfigScope, settings: null });
    });
    return () => { cancelled = true; };
  }, [aiConfigMunicipalityId, aiConfigScope, aiConfigAttempt]);

  // The tutor data saved in an attendance also changes the requests in progress, so the list is read again.
  const refreshRequests = useCallback(() => {
    api.getRequests().then((list) => setRequests(list.map(normalizeRequest))).catch(console.error);
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
    if (!isGlobalRole(currentUser.role)) {
      api.getMunicipalities().then((list) => setMunicipalities(Array.isArray(list) ? list : [])).catch(() => {});
    }
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

  function openMobileMenu(event: React.MouseEvent<HTMLButtonElement>) {
    sidebarTrigger.current = event.currentTarget;
    setMobileOpen(true);
  }

  function navigateWorkspace(id: string) {
    setConfigMenuOpen(false);
    setConfigArea("");
    setActive(id);
    setMobileOpen(false);
  }

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
        aiSettings={aiSettings}
        onRequestCreated={registerCreatedRequest}
      />
    );
  }

  const currentTeamUser = (teams.users || []).find((user) => currentUser?.id && user.id === currentUser.id);
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
  const sidebarMunicipality = municipalities.find((municipality) => municipality.id === activeMunicipalityId);
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
  const settingsMenu = configMenuOpen ? visibleMenu.find((item) => item.id === "config") : undefined;
  const sidebarMenu = settingsMenu ? [settingsMenu] : visibleMenu;
  const sidebarIsCollapsed = sidebarCollapsed && !usesMobileMenu && !settingsMenu;

  return (
    <div className={`app-shell${sidebarIsCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside
        ref={sidebar}
        id="workspace-sidebar"
        className={`sidebar${mobileDialogOpen ? " open" : ""}${sidebarIsCollapsed ? " collapsed" : ""}`}
        data-managed-dialog={mobileDialogOpen ? "" : undefined}
        role={mobileDialogOpen ? "dialog" : undefined}
        aria-modal={mobileDialogOpen || undefined}
        aria-label={mobileDialogOpen ? "Menu principal" : undefined}
      >
        <div className="brand">
          <SidebarMunicipalityBrand municipality={sidebarMunicipality} defaultLabel={isGlobalRole(currentUser.role) ? "Plataforma" : "Sistema municipal"} />
          {usesMobileMenu ? (
            <CloseButton aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />
          ) : (
            <Button
              variant="outline"
              className="sidebar-toggle-btn tw:w-10 tw:shrink-0 tw:px-0"
              onClick={() => {
                const collapsed = !sidebarIsCollapsed;
                if (collapsed) setConfigMenuOpen(false);
                setSidebarCollapsed(collapsed);
                localStorage.setItem("sidebar-collapsed", String(collapsed));
              }}
              aria-label={sidebarIsCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              <ChevronLeft size={15} aria-hidden="true" className={`sidebar-toggle-icon${sidebarIsCollapsed ? " rotated" : ""}`} />
            </Button>
          )}
        </div>

        <nav aria-label={settingsMenu ? "Configurações" : "Menu principal"}>
          {sidebarMenu.map((item) => {
            const settingsExpanded = item === settingsMenu;
            const Icon = settingsExpanded ? ChevronLeft : item.icon;
            return (
              <React.Fragment key={item.id}>
                <Button
                  variant="custom"
                  className="tw:w-full tw:justify-start tw:gap-2 tw:border-transparent tw:bg-transparent tw:text-left tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:data-[selected=true]:border-ui-accent tw:data-[selected=true]:bg-ui-accent-soft tw:data-[selected=true]:font-semibold tw:data-[selected=true]:text-ui-accent-strong"
                  data-selected={!settingsExpanded && active === item.id}
                  title={sidebarIsCollapsed ? item.label : undefined}
                  aria-label={sidebarIsCollapsed ? item.label : undefined}
                  aria-current={!settingsExpanded && active === item.id ? "page" : undefined}
                  aria-expanded={item.id === "config" ? settingsExpanded : undefined}
                  aria-controls={settingsExpanded ? "settings-navigation" : undefined}
                  onClick={() => {
                    if (item.id === "config") {
                      setConfigMenuOpen((open) => !open);
                      return;
                    }
                    navigateWorkspace(item.id);
                  }}
                >
                  <Icon size={18} aria-hidden="true" className="tw:shrink-0" />
                  <span className="tw:min-w-0 tw:flex-1 tw:truncate">{settingsExpanded ? "Voltar ao menu" : item.label}</span>
                  {item.id === "config" && !settingsExpanded && (
                    <ChevronRight className="sidebar-chevron" size={16} aria-hidden="true" />
                  )}
                </Button>
                {settingsExpanded && (
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
                            className={settingsNavButtonClassName}
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
                            <span className={settingsNavLabelClassName}>{subitem.label}</span>
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
                                  className={settingsNavButtonClassName}
                                  aria-current={showing && configTab === tab.id ? "page" : undefined}
                                  onClick={() => { setActive("config"); setConfigArea(subitem.id); setConfigTab(tab.id); setMobileOpen(false); }}
                                >
                                  <span className={settingsNavLabelClassName}>{tab.label}</span>
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
              <Button variant="outline" className="sidebar-action-item tw:w-full tw:justify-start" aria-label="Alterar senha" onClick={() => { setSidebarResetOpen(true); setUserMenuOpen(false); }}>
                <KeyRound size={15} aria-hidden="true" />
                <span>Alterar senha</span>
              </Button>
              <Button variant="outline" className="sidebar-action-item tw:w-full tw:justify-start tw:enabled:hover:text-ui-danger" aria-label="Sair" onClick={() => setCurrentUser(null)}>
                <LogOut size={15} aria-hidden="true" />
                <span>Sair</span>
              </Button>
            </>
          )}
          <Button
            ref={accountButton}
            variant="outline"
            className="sidebar-user-card tw:w-full tw:justify-start tw:gap-2 tw:p-2 tw:text-left tw:aria-expanded:border-ui-accent tw:aria-expanded:bg-ui-accent-soft"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-label={sidebarIsCollapsed ? "Menu da conta" : undefined}
            aria-expanded={userMenuOpen}
          >
            <span className="sidebar-user-avatar">
              <ShieldCheck size={15} aria-hidden="true" />
            </span>
            <span className="sidebar-user-info">
              <strong>{currentUser.name || "Usuário"}</strong>
              <span>{userRoleLabel(currentUser.role)}</span>
            </span>
            <ChevronDown size={14} className={userMenuOpen ? "sidebar-chevron open" : "sidebar-chevron"} />
          </Button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <Button variant="outline" className="mobile-menu tw:w-10 tw:px-0" onClick={openMobileMenu} aria-label="Abrir menu" aria-controls="workspace-sidebar" aria-expanded={mobileDialogOpen}>
            <Menu size={20} />
          </Button>
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
            <label className="tw:relative tw:min-w-0 tw:w-[min(32vw,360px)] tw:max-[1120px]:flex-1 tw:max-[760px]:basis-full">
              <Search size={18} aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:left-3 tw:top-1/2 tw:-translate-y-1/2 tw:text-ui-muted" />
              <Input
                className="tw:pl-10"
                type="search"
                aria-label="Buscar no sistema"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Protocolo, CPF, tutor, microchip..."
              />
            </label>
            {tenantConfigReady && canEditRequests(currentUser.role) && visibleMenu.some((item) => item.id === REQUESTS_MENU_ITEM) && (
              <StaffNotificationBell
                key={activeMunicipalityId}
                municipalityId={activeMunicipalityId}
                onOpenRequest={(request) => {
                  setNotificationRequest(registerCreatedRequest(request));
                  navigateWorkspace(REQUESTS_MENU_ITEM);
                }}
              />
            )}
          </div>
        </header>

        <Suspense fallback={<p className="dash-empty">Carregando o painel...</p>}>
          <ActiveView
            requests={scopedRequests}
            selected={scopedSelected}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            notificationRequest={notificationRequest}
            setNotificationRequest={setNotificationRequest}
            metrics={scopedMetrics}
            patchRequest={patchRequest}
            runProcedureAction={runProcedureAction}
            createRequest={createRequest}
            adoptionAnimals={scopedAdoptionAnimals}
            setAdoptionAnimals={setAdoptionAnimals}
            currentUser={currentUser}
            scheduleDays={active === "relatorios" ? scopedScheduleDays : effectiveScopedScheduleDays}
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
            aiConfigStatus={aiConfigStatus}
            retryAiConfig={retryAiConfig}
            setScheduleDays={setScheduleDays}
            scheduleRules={scopedScheduleRules}
            setScheduleRules={setScheduleRules}
            permissionGroups={scopedPermissionGroups}
            setPermissionGroups={setPermissionGroups}
            teams={scopedTeams}
            setTeams={setTeams}
            onUserSession={setCurrentUser}
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
            onGenerateProntuario={(history: AnyRecord) => downloadAnimalRecordPdf({ history, municipality: municipalities.find((item) => item.id === (history?.animal?.municipality_id || activeMunicipalityId)) || null })}
          />
        </Suspense>
      </main>

      {mobileDialogOpen && (
        <div className="sidebar-overlay" aria-hidden="true" onClick={() => setMobileOpen(false)} />
      )}

      <WorkspaceMobileNavigation items={visibleMenu} active={active} menuOpen={mobileDialogOpen} onNavigate={navigateWorkspace} onOpenMenu={openMobileMenu} />

      {sidebarResetOpen && <PasswordChangeForm modal returnFocus={accountButton.current} onChanged={(user) => { setCurrentUser(user); closeSidebarReset(); }} onCancel={closeSidebarReset} />}
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
    id: user.id,
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
    addressNumber: item.addressNumber || item.address_number || "",
    municipalityId: item.municipalityId || item.municipality_id || "",
    intendedUse: item.intendedUse || item.intended_use || "",
    assignedSector: item.assignedSector || item.assigned_sector || type?.sector || "",
    reviewNote: item.reviewNote || item.review_note || "",
    createdAt: item.createdAt || item.created_at || "",
    reviewedAt: item.reviewedAt || item.reviewed_at || "",
    status: item.status || "PENDENTE",
  };
}

const userRoleLabels = {
  master: "Master",
  suporte: "Suporte",
  admin_municipal: "Administrador municipal",
  analista: "Analista",
  tutor: "Tutor",
  ong: "ONG",
  protetor: "Protetor",
  servidor_publico: "Servidor público",
};

function userRoleLabel(role = "") {
  return userRoleLabels[role] || role || "Usuário";
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
  const [interestAttempted, setInterestAttempted] = useState(false);
  // The name and the WhatsApp are required: the field that is missing turns red once the visitor tries to send.
  const interestIssues = {
    name: interestForm.name.trim() ? "" : "Informe seu nome completo.",
    phone: isValidPhone(interestForm.phone) ? "" : "Informe um WhatsApp com DDD.",
  };
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
  // The phone's back closes the animal's window instead of leaving the page.
  useBackLayer(adoptionOpen, closeAnimalModal);

  function openAnimalModal(animal, openInterestForm = false) {
    interestRequest.current = null;
    setSelectedAnimal(animal);
    setShowInterestForm(openInterestForm);
    setInterestSent(false);
    setInterestSaving(false);
    setInterestError("");
    setInterestAttempted(false);
    setInterestForm({ name: "", phone: "", visit_date: "" });
  }

  function closeAnimalModal() {
    interestRequest.current = null;
    setSelectedAnimal(null);
    setShowInterestForm(false);
    setInterestSent(false);
    setInterestSaving(false);
    setInterestError("");
    setInterestAttempted(false);
    setInterestForm({ name: "", phone: "", visit_date: "" });
  }

  async function submitInterest(e) {
    e.preventDefault();
    if (!selectedAnimal || interestRequest.current) return;
    setInterestAttempted(true);
    if (interestIssues.name || interestIssues.phone) return;
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
                <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                  <span className={interestCount > 0 ? "public-interest-count has-interest" : "public-interest-count"}>
                    <Users size={13} />
                    {interestCount} interessado{interestCount === 1 ? "" : "s"}
                  </span>
                  <ShareAdoptionButton animal={animal} iconOnly />
                </div>
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
              <form className="adoption-interest-form" noValidate onSubmit={submitInterest}>
                <div className="interest-form-heading">
                  <HeartHandshake size={15} />
                  <span>Registrar interesse</span>
                </div>
                <RequestTextField ref={interestNameRef} label="Nome completo" required value={interestForm.name} error={(interestAttempted && interestIssues.name) || undefined} onChange={(e) => setInterestForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" />
                <RequestTextField label="WhatsApp" required type="tel" value={interestForm.phone} error={(interestAttempted && interestIssues.phone) || undefined} onChange={(e) => setInterestForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" autoComplete="tel" />
                <label className="tw:grid tw:gap-1.5 tw:text-sm tw:font-medium">Data da visita
                  <Input type="date" value={interestForm.visit_date} onChange={(e) => setInterestForm((f) => ({ ...f, visit_date: e.target.value }))} />
                </label>
                {interestError && <p className="form-error" role="alert">{interestError}</p>}
                <div className="form-actions">
                  <Button type="submit" className="tw:ml-auto" disabled={interestSaving}>
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

function LoginView({ onLogin, accessLink = null, onProcedureIntent, onAccessRequest, adoptionAnimals = [], sharedAdoption = null, onInterestSent, municipalities = [], selectedMunicipalityId = "", onMunicipalitySelect, createRequest, scheduleDays = [], requestTypes = [], documentTypes = [], speciesOptions = [], sizeOptions = [], breeds = [], aiSettings = initialAiSettings, onRequestCreated }: AnyRecord) {
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
  const phoneLayout = useMediaQuery(PUBLIC_PHONE_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
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
    if (!phoneLayout) setMenuOpen(false);
  }, [phoneLayout]);
  // The phone's back closes the ☰ menu, the sign-in and the open service before it leaves the site.
  useBackLayer(Boolean(activePublicService), closePublicService);
  useBackLayer(menuOpen, () => setMenuOpen(false));
  useBackLayer(Boolean(authEntry), closeAuthEntry);

  useEffect(() => {
    setPublicServiceScheduleDays(scheduleDays);
    setPublicServiceRequestTypes(requestTypes);
    setPublicServiceDocumentTypes(documentTypes);
    setPublicServiceSpeciesOptions(speciesOptions);
    setPublicServiceSizeOptions(sizeOptions);
    setPublicServiceBreeds(breeds);
  }, [scheduleDays, requestTypes, documentTypes, speciesOptions, sizeOptions, breeds]);

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

  // A service opens, ends and closes at the top of the page, where its form or its confirmation is.
  function scrollPublicPageToTop() {
    window.scrollTo({ top: 0 });
  }

  function openPublicService(serviceId: string) {
    setProcedurePrefill(null);
    setPublicServiceDone(null);
    setActivePublicService(serviceId);
    scrollPublicPageToTop();
  }

  function joinMutirao() {
    setProcedurePrefill(nextMutirao ? { schedule: nextMutirao.date } : null);
    setPublicServiceDone(null);
    setActivePublicService("procedure_form");
    scrollPublicPageToTop();
  }

  function openRequestAccess(prefill: { protocol: string; cpf: string }) {
    setAccessPrefill(prefill);
    setPublicServiceDone(null);
    setActivePublicService(REQUEST_ACCESS_SERVICE);
    scrollPublicPageToTop();
  }

  function closePublicService() {
    setActivePublicService(null);
    setProcedurePrefill(null);
    setPublicServiceDone(null);
    scrollPublicPageToTop();
  }

  function closeAuthEntry() {
    onProcedureIntent(null);
    setAuthEntry(null);
  }

  function selectFromMenu(serviceId: string) {
    setMenuOpen(false);
    openPublicService(serviceId);
  }

  function enterFromMenu() {
    setMenuOpen(false);
    openAuthEntry(AuthEntryOrigin.STAFF);
  }

  const publicFooterItems = [
    { label: "Contato", value: activeMunicipality?.contact, icon: Phone },
    { label: "Email", value: activeMunicipality?.email, icon: Mail },
    { label: "Endereço", value: activeMunicipality?.address, icon: MapPin },
    { label: "CEP", value: activeMunicipality?.cep, icon: Navigation },
  ].filter((item) => String(item.value || "").trim());
  const procedureService = activePublicService === "procedure_form";
  const neighborhoodCatalog = useNeighborhoodCatalog(procedureService ? selectedMunicipalityId : "");
  const requestFormOpen = procedureService && selectedMunicipalityId && !publicServiceDone;
  return (
    <main className={`login-page${requestFormOpen ? " login-page--request" : ""}`}>
      <div className="public-topbar">
        <div className="public-topbar-brand">
          {activeMunicipality?.brasao ? (
            <img src={activeMunicipality.brasao} alt={`Brasão ${activeMunicipality.name}`} className="brand-brasao" />
          ) : (
            <div className="brand-mark"><PawPrint size={20} /></div>
          )}
          <div className="tw:min-w-0">
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
        {phoneLayout ? (
          <PublicMenuButton ref={menuTriggerRef} expanded={menuOpen} onClick={() => setMenuOpen(true)} />
        ) : (
          <nav className="public-topbar-nav" aria-label="Serviços públicos">
            <PublicServiceButtons
              services={publicHomeServices}
              activeServiceId={activePublicService}
              onSelect={openPublicService}
              onEnter={() => openAuthEntry(AuthEntryOrigin.STAFF)}
            />
          </nav>
        )}
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
            {(!procedureService || !selectedMunicipalityId || !neighborhoodCatalog.ready) && (
              <div className="public-service-panel-header">
                <h2>{activePublicService === REQUEST_ACCESS_SERVICE ? "Acessar minha solicitação" : activePublicServiceDetails?.label || "Serviço"}</h2>
                {!publicServiceDone && <Button variant="outline" className="tw:shrink-0" onClick={closePublicService}>Voltar ao início</Button>}
              </div>
            )}

            {publicServiceDone ? (
              <RequestDoneCard
                protocol={publicServiceDone.protocol}
                followUp={(publicServiceDone.workflow_data || publicServiceDone.workflowData)?.followUp}
                createRequirement={() => createRequestDocumentDataUrl(publicServiceDone, activeMunicipality)}
                closeLabel="Voltar ao início"
                onClose={closePublicService}
                onCreatePassword={publicServiceDone.cpf && isProcedureRequest(publicServiceDone.request_type)
                  ? () => openRequestAccess({ protocol: publicServiceDone.protocol, cpf: onlyDigits(String(publicServiceDone.cpf)) }) : undefined}
              />
            ) : (procedureService || activePublicService === "report") && !selectedMunicipalityId ? (
              <p role="status">Selecione o município na página para continuar.</p>
            ) : procedureService && !neighborhoodCatalog.ready ? (
              neighborhoodCatalog.failed ? (
                <div className="tw:grid tw:justify-items-start tw:gap-2">
                  <p className="form-error" role="alert">Não foi possível carregar os bairros do município.</p>
                  <Button variant="outline" onClick={neighborhoodCatalog.retry}>Tentar novamente</Button>
                </div>
              ) : <p role="status">Carregando os bairros do município...</p>
            ) : procedureService ? (
              <NewRequest
                key={`public-procedure-${selectedMunicipalityId}`}
                createRequest={createRequest}
                currentUser={GUEST_USER}
                selectedMunicipalityId={selectedMunicipalityId}
                municipality={activeMunicipality}
                onBack={closePublicService}
                onRegisteredAnimal={() => openAuthEntry(AuthEntryOrigin.REGISTERED_ANIMAL)}
                onDone={(request) => {
                  if (selectedMunicipalityId !== publicMunicipalityRef.current) return;
                  const normalized = onRequestCreated?.(request, { openAdmin: true }) || normalizeRequest(request);
                  setPublicServiceDone(normalized);
                  scrollPublicPageToTop();
                }}
                initialMunicipalityId={selectedMunicipalityId}
                requestTypes={publicServiceRequestTypes}
                documentTypes={publicServiceDocumentTypes}
                aiSettings={aiSettings}
                speciesOptions={publicServiceSpeciesOptions}
                sizeOptions={publicServiceSizeOptions}
                breeds={publicServiceBreeds}
                neighborhoods={neighborhoodCatalog.items}
                initialType={procedurePrefill?.requestType || ""}
                initialSchedule={procedurePrefill?.schedule || ""}
              />
            ) : activePublicService === "credential" ? (
              <PublicAccessRequestForm onSubmit={onAccessRequest} municipalityId={selectedMunicipalityId} neighborhoods={neighborhoodCatalog.items} />
            ) : activePublicService === "tracking" ? (
              <RequestTracking key={selectedMunicipalityId} municipalityId={selectedMunicipalityId} />
            ) : activePublicService === REQUEST_ACCESS_SERVICE ? (
              <RequestAccess
                key={`${selectedMunicipalityId}:${accessPrefill?.protocol || ""}`}
                municipalityId={selectedMunicipalityId}
                initialProtocol={accessPrefill?.protocol}
                initialCpf={accessPrefill?.cpf}
                createRequirement={(request) => createRequestDocumentDataUrl(request, activeMunicipality)}
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
                  if (selectedMunicipalityId !== publicMunicipalityRef.current) return;
                  setPublicServiceDone(normalizeRequest(created));
                  scrollPublicPageToTop();
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

      {menuOpen && (
        <PublicServicesMenu
          services={publicHomeServices}
          activeServiceId={activePublicService}
          returnFocus={menuTriggerRef.current}
          onSelect={selectFromMenu}
          onEnter={enterFromMenu}
          onClose={() => setMenuOpen(false)}
        />
      )}
      <PwaInstallPrompt visible={!activePublicService} />
{authEntry && <AuthEntry key={authEntryKey(authEntry)} audience={authEntry.audience} municipalityId={authEntry.municipalityId} onLogin={onLogin} onClose={closeAuthEntry} />}
    </main>
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
        const performed = wf.performedProcedures || req.performedProcedures || "";
        const prescriptions = issuedPrescriptions(resolveRequestProcedures(req), { completedOnly: true });
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
                        await downloadAnimalRecordPdf({ request: req, history, municipality: await loadMunicipalityRecord(municipalityId) });
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
                      {prescriptions.map(({ id, subtitle, prescription }) => (
                        <InfoTile key={id} label={`Receita · ${subtitle}`} value={prescription.text} />
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
  const [declarationOpen, setDeclarationOpen] = useState(false);
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
  const neighborhoodList = followUpMunicipalityId ? neighborhoodNames(neighborhoods, followUpMunicipalityId) : [];

  // A procedure asked for from outside (the animal's own screen) starts as the procedure of the first animal.
  useEffect(() => {
    const type = initialType ? configuredRequestTypes.find((item) => item.name === initialType) : null;
    if (type?.id) setAnimals((current) => (animalRequestTypeIds(current[0]).length ? current : withProceduresAt(current, 0, [type.id], breedContext)));
  }, [initialType, hasConfiguredTypes]);

  // The request types the animals ask for, together: they decide the steps, the tutor and the documents of the request.
  const selectedRequestTypes = resolveRequestTypes({ animals }, configuredRequestTypes);
  const procedureFields = deriveRequestTypeFields(selectedRequestTypes);
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
  // Outside the team, the phone's back goes to the previous step and closes the windows of the form.
  const backOnPage = !internalSimple;
  useBackLayer(backOnPage && currentStepIndex > 0, () => navigateToStep(requestSteps[currentStepIndex - 1].step));
  useBackLayer(backOnPage && Boolean(previewDocument), () => setPreviewDocument(null));
  useBackLayer(backOnPage && declarationOpen, () => setDeclarationOpen(false));
  useBackLayer(backOnPage && Boolean(reusedPreview), () => setReusedPreview(null));
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
        if (needsProcedure(animal)) issues.push("Selecione o tipo de solicitação.");
        if (!animal.species || !animal.sex || !animal.size || !animal.breedType) issues.push("O cadastro do animal está incompleto. Procure o atendimento para conferência.");
        return;
      }
      const label = filledAnimals.length > 1 ? ` do animal ${index + 1}` : " do animal";
      if (needsProcedure(animal)) issues.push(`Escolha ao menos um procedimento${label}.`);
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
          needsProcedure(animal),
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
        ? { notes: sent.notes || "", tags: [], origin: RequestOrigin.INTERNAL }
        : { declarationAccepted: accepted };
      await sendRequest({ ...(await buildRequestSubmission()), ...own });
    } finally {
      setSubmitting(false);
    }
  }

  function selectedRequestSchedule() {
    const count = Math.max(animals.length, 1);
    const day = selectScheduleOccurrence(scheduleDays, sent.schedule, sent.scheduleOccurrenceKey, count);
    const slot = getAvailableScheduleSlot(day, count);
    const time = slot?.time || day?.startTime || "";
    return { day, time };
  }

  // What the staff and the public send in common: the tutor, the animals, the date chosen, the notices and the documents.
  async function buildRequestSubmission() {
    const { day: selectedScheduleDay, time: selectedScheduleTime } = selectedRequestSchedule();
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
      type: procedureFields.requestType,
      fee: combineRequestFees(selectedRequestTypes),
      phone: sent.phone || "",
      cpf: sent.cpf || "",
      email: sent.email || "",
      cep: sent.cep || "",
      city: sent.city || "",
      state: sent.state || "",
      preferredSchedule: sent.schedule || "",
      municipalityId: followUpMunicipalityId || selectedScheduleDay?.municipalityId || "",
      scheduleTime: selectedScheduleTime,
      scheduleSlotTime: selectedScheduleTime,
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
        scheduleTime: selectedScheduleTime,
        scheduleSlotTime: selectedScheduleTime,
        scheduleOccurrenceKey: selectedScheduleDay?.occurrenceKey || "",
        ...tutorshipAnswer,
        followUp: buildFollowUpPayload({ enabled: noticesEnabled }, tutorContacts, followUpPolicy.phoneEnabled),
      },
      animalId: registeredContext?.animal.id || "",
      animals: registeredContext ? [{ id: registeredContext.animal.id, requestTypeIds: animalRequestTypeIds(animals[0]) }] : animals.map((animal) => ({
        ...animal,
        ...tutorshipAnswer,
        name: animal.name || "",
        age: animal.birthDate || animal.age || "",
      })),
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
      onDone?.(normalizeRequest({ ...payload, ...created, workflowData: created.workflow_data || created.workflowData || payload.workflowData, protocol }));
    } catch (err) {
      if (err?.status === 409) availability.refresh();
      setSubmissionError(err?.message || "Falha ao enviar solicitação. Tente novamente.");
    }
  }

  const animalActionColor = internalSimple ? "tw:text-[color:var(--blue)]" : "tw:text-[color:var(--ui-action)]";
  const animalActionStyle = `tw:min-w-0 tw:flex-1 tw:text-center ${animalActionColor}`;
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
            <Button className={animalActionStyle} variant="outline" onClick={addAnimal}>
              <PlusCircle size={18} aria-hidden="true" />
              Adicionar outro animal
            </Button>
            <Button className={animalActionStyle} variant="outline" onClick={duplicatePreviousAnimal}>
              <RefreshCw size={18} aria-hidden="true" />
              Repetir os dados do anterior
            </Button>
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
                identityRequired: requiresTutorIdentity,
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
                  onToggle={() => setExpandedAnimal(expandedAnimal === index ? -1 : index)}
                >
                  <AnimalFields
                    procedures={(
                      <RequestProcedureList
                        types={configuredRequestTypes}
                        selectedIds={animalRequestTypeIds(animal)}
                        onChange={(ids) => changeProcedures(index, ids)}
                        invalid={submitAttempted && needsProcedure(animal)}
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
                    <Button className="tw:self-start" variant="danger" onClick={() => { removeAnimal(index); setExpandedAnimal(Math.max(0, index - 1)); }}>
                      Remover animal {index + 1}
                    </Button>
                  )}
                </AnimalAccordionCard>
              );
            })}
            {animals.length > 1 && hasConfiguredTypes && (
              <div className="tw:flex tw:gap-2.5">
                <Button variant="outline" onClick={applyFirstProceduresToAll} disabled={animalRequestTypeIds(animals[0]).length === 0}>
                  Aplicar os procedimentos do Animal 1 a todos
                </Button>
              </div>
            )}
            </>}
          </div>}

          {formStep === RequestStep.SCHEDULE && <div className="form-section">
            {availability.loading && <p role="status">Carregando vagas disponíveis...</p>}
            {availability.error && <p className="form-error" role="alert">{availability.error} <Button variant="outline" onClick={availability.refresh}>Tentar novamente</Button></p>}
            <PublicSchedulePicker
              external
              internal={internalSimple}
              scheduleDays={scheduleDays}
              selectedDate={requestData.schedule}
              selectedOccurrenceKey={requestData.scheduleOccurrenceKey}
              pendingReservation={{ date: requestData.schedule, count: animals.length }}
              onSelect={(date, occurrenceKey) => setRequestData((current) => ({ ...current, schedule: date, scheduleOccurrenceKey: occurrenceKey }))}
              title="Escolha o melhor dia para o atendimento"
              hint="Os dias em destaque têm vagas. Toque em um para escolher."
            />
            {internalSimple && (
              <label className="tw:grid tw:min-w-0 tw:gap-1.5 tw:text-sm tw:font-medium tw:text-ui-text">
                <span>Observações internas</span>
                <textarea
                  data-ui-input=""
                  className={`${configTextareaStyle} tw:min-h-24 tw:resize-y`}
                  value={requestData.notes}
                  onChange={(event) => updateRequestField("notes", event.target.value)}
                  placeholder="Registre orientações, atendimento no balcão ou ponto de atenção para a equipe."
                />
              </label>
            )}
          </div>}

          {formStep === RequestStep.DOCUMENTS && <div className="form-section">
            <Card className="form-sub-card documents-step-card">
              <div className="documents-step-header">
                <span className="form-sub-card-title">{internalSimple ? "Documentos" : "Quase lá! Faltam só os documentos"}</span>
                {internalSimple && <small>Anexe os comprovantes do tutor. Os pendentes ficam para conferência da equipe.</small>}
              </div>

              <div className="documents-step-grid">
                <aside className="documents-photo-column">
                  <Card className="tw:grid tw:overflow-hidden tw:text-center">
                    {/* The whole card picks the photo: a click anywhere attaches it, or replaces the one already attached. */}
                    <button
                      type="button"
                      className="tw:grid tw:w-full tw:justify-items-center tw:gap-3 tw:border-0 tw:bg-transparent tw:p-3 tw:text-inherit tw:enabled:hover:bg-card-page tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-ui-accent"
                      disabled={animalPhotoLoading}
                      aria-label={`${uploadedPhoto ? "Substituir" : "Anexar"} foto do animal`}
                      onClick={() => animalPhotoInput.current?.click()}
                    >
                      {uploadedPhoto?.dataUrl ? (
                        <img className="tw:max-h-40 tw:w-full tw:rounded-[var(--ui-radius-md)] tw:object-contain" src={uploadedPhoto.dataUrl} alt="Foto do animal" />
                      ) : <ImagePlus size={22} aria-hidden="true" className="tw:text-ui-accent" />}
                      <span className="tw:text-sm tw:font-medium" role={animalPhotoLoading ? "status" : undefined}>
                        {animalPhotoLoading ? "Carregando foto..." : reusedDocuments.animal_photo?.fileName || "Foto do animal"}
                      </span>
                      <small className="tw:text-ui-muted">{reusedDocuments.animal_photo ? "Foto reaproveitada" : "Opcional"}</small>
                    </button>
                    <input ref={animalPhotoInput} type="file" accept="image/*" hidden onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => handleAnimalPhotoFile(event.target.files?.[0])} />
                    {uploadedPhoto && (
                      <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-2 tw:px-3 tw:pb-3">
                        {uploadedPhoto.dataUrl && <Button variant="outline" onClick={() => setPreviewDocument(uploadedPhoto)}>Ver foto</Button>}
                        <Button variant="danger" onClick={() => removeDocumentFile("animal_photo")}>Remover foto</Button>
                      </div>
                    )}
                  </Card>
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
                      <button
                        type="button"
                        className="tw:rounded-sm tw:border-0 tw:bg-transparent tw:p-0 tw:text-[color:var(--blue)] tw:underline tw:underline-offset-2 tw:hover:no-underline tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-[color:var(--blue)]"
                        onClick={() => setDeclarationOpen(true)}
                      >
                        Ler
                      </button>
                    </p>
                    <label className={`tw:flex tw:min-h-10 tw:cursor-pointer tw:items-center tw:gap-2 tw:text-sm ${showInvalid("accepted") ? "tw:text-ui-danger" : "tw:text-ui-text"}`}>
                      <input type="checkbox" className="tw:size-5 tw:shrink-0 tw:accent-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" aria-invalid={showInvalid("accepted") || undefined} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                      <span>Li e concordo<span className="required-asterisk">*</span></span>
                    </label>
                  </div>}
                </div>
              </div>
            </Card>
          </div>}
      </RequestFormLayout>
      {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} external={!internalSimple} />}
      {declarationOpen && <DeclarationDialog municipalityName={municipality?.name || ""} tutorName={sent.tutor || (currentUser.role === "tutor" ? currentUser.name : "")} onClose={() => setDeclarationOpen(false)} />}
      {reusedPreview && registeredContext && <ReusableDocumentPreview key={`${reusedPreview.attachmentId}:${reusedPreview.reuseRef.hash}`} animalId={registeredContext.animal.id} candidate={reusedPreview} onClose={() => setReusedPreview(null)} />}
    </>
  );
}

function AdminDashboard({
  requests,
  setSelectedId,
  notificationRequest,
  setNotificationRequest,
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
  // The filters panel edits a draft; null means the panel is closed.
  const [filtersDraft, setFiltersDraft] = useState<RequestListFilters | null>(null);
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  // The request just made at the counter: the modal shows its last screen until it is closed.
  const [createdRequest, setCreatedRequest] = useState<AnyRecord | null>(null);
  function closeCreateRequest() {
    setCreateRequestOpen(false);
    setCreatedRequest(null);
  }
  const [toasts, setToasts] = useState<AnyRecord[]>([]);
  // A global user without a municipality chosen sees the requests of every municipality together.
  const mixedMunicipalities = isGlobalRole(currentUser?.role) && !selectedMunicipalityId;

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

  useEffect(() => {
    if (!notificationRequest) return;
    openRequestPreview(notificationRequest);
    setNotificationRequest(null);
  }, [notificationRequest, openRequestPreview, setNotificationRequest]);

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
    pills: filterPills,
  } = useRequestFilterResults({
    filters: requestFilters,
    normalizedRequests,
    listItems,
    users: teams.users,
    today,
  });
  const filtersPreview = useMemo(
    () => filtersDraft && buildRequestFilterResults({ filters: filtersDraft, normalizedRequests, listItems, users: teams.users, today }),
    [filtersDraft, normalizedRequests, listItems, teams.users, today],
  );
  function editFiltersDraft(action: RequestFiltersAction) {
    setFiltersDraft((current) => current && requestFiltersReducer(current, action));
  }
  const emptyMessage = getEmptyListMessage(requestFilters);
  return (
    <section className="tw:grid tw:min-w-0 tw:gap-3.5">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((t) => t.id !== id))} />
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <Button
          variant="custom"
          className="tw:border-[color:var(--action-primary-border)] tw:bg-[var(--action-primary)] tw:font-semibold tw:text-[color:var(--action-primary-ink)] tw:enabled:hover:bg-[var(--action-primary-hover)] tw:max-[760px]:w-full"
          onClick={() => setCreateRequestOpen(true)}
        >
          <Plus size={18} aria-hidden="true" />
          Criar Solicitação
        </Button>
        <RequestFiltersToolbar
          today={{ active: requestFilters.todayOnly, count: filterCounts.today, onToggle: requestFilterActions.toggleToday }}
          activePillCount={filterPills.length}
          drawerOpen={filtersDraft !== null}
          onOpenDrawer={() => setFiltersDraft(requestFilters)}
        />
      </div>
      <ActiveFiltersBar
        resultCount={activeRequests.length}
        pills={filterPills}
        canClear={!isRequestFiltersEmpty(requestFilters)}
        onClearDimension={requestFilterActions.clearDimension}
        onClearAll={requestFilterActions.clearAll}
      />
      <div className="tw:grid tw:min-w-0 tw:gap-2.5">
        {activeRequests.length === 0 && (
          <Card className="tw:grid tw:min-h-[86px] tw:content-center tw:justify-items-start tw:gap-2 tw:px-5 tw:py-4">
            <strong className="tw:text-base tw:font-semibold tw:text-ui-ink">{emptyMessage.title}</strong>
            <p className="tw:m-0 tw:text-sm tw:text-ui-muted">{emptyMessage.text}</p>
            {emptyMessage.canClear && (
              <Button variant="outline" onClick={requestFilterActions.clearAll}>Limpar filtros</Button>
            )}
          </Card>
        )}
        {activeRequests.map((request) => {
          const isAccessRequest = request.__source === ACCESS_REQUEST_SOURCE;
          function openCard() {
            if (isAccessRequest) setActive?.("credenciamento");
            else openRequestPreview(request);
          }
          // Each municipality counts its own protocols: when the list mixes municipalities, the protocol says which one it is.
          const protocol = mixedMunicipalities && !isAccessRequest ? `#${request.protocol} · ${getMunicipalityLabel(request.municipalityId, municipalities)}` : `#${request.protocol}`;
          const fields = [
            { label: "Protocolo", value: protocol },
            { label: "Tutor", value: displayText(request.tutor) },
            { label: "Animal", value: request.animals.map((animal) => displayText(animal.name)).join(", ") || "-" },
            { label: "Tipo", value: isAccessRequest ? "Credenciamento" : requestTypeLabel(request) },
            { label: "Responsável", value: displayText(request.responsible) || "-" },
            { label: "Agenda", value: request.preferredSchedule || request.appointment || "-" },
          ];
          return (
            <Card
              as="button"
              key={request.id}
              aria-label={`Abrir solicitação #${request.protocol}`}
              onClick={openCard}
              className="tw:grid tw:min-h-[76px] tw:min-w-0 tw:w-full tw:items-center tw:gap-3 tw:px-4 tw:py-3.5 tw:text-left tw:touch-manipulation tw:hover:border-ui-accent tw:hover:bg-card-page tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent tw:min-[761px]:grid-cols-2 tw:min-[1101px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,auto)]"
            >
              {fields.map(({ label, value }) => (
                <span key={label} className="tw:grid tw:min-w-0 tw:gap-1">
                  <span className="tw:text-xs tw:font-medium tw:text-ui-muted">{label}</span>
                  <span className={label === "Protocolo"
                    ? "tw:wrap-anywhere tw:text-sm tw:font-semibold tw:text-ui-accent-strong"
                    : "tw:wrap-anywhere tw:text-sm tw:text-ui-ink"}
                  >
                    {value}
                  </span>
                </span>
              ))}
              <span className="tw:flex tw:min-w-0 tw:flex-col tw:items-start tw:gap-1.5 tw:min-[1101px]:items-end">
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
              </span>
            </Card>
          );
        })}
      </div>

      {filtersDraft && filtersPreview && (
        <RequestFiltersDrawer
          filters={filtersDraft}
          counts={filtersPreview.counts}
          typeOptions={filtersPreview.typeOptions}
          assigneeOptions={filtersPreview.assigneeOptions}
          onToggleStage={(stage) => editFiltersDraft({ type: RequestFiltersActionType.TOGGLE_STAGE, stage })}
          onToggleType={(value) => editFiltersDraft({ type: RequestFiltersActionType.TOGGLE_TYPE, value })}
          onToggleAssignee={(value) => editFiltersDraft({ type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value })}
          onClearAll={() => editFiltersDraft({ type: RequestFiltersActionType.CLEAR_ALL })}
          onClose={() => setFiltersDraft(null)}
          onApply={() => {
            requestFilterActions.apply(filtersDraft);
            setFiltersDraft(null);
          }}
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
        <ConfigDialogBackdrop>
          <Card className="internal-request-modal" role="dialog" aria-modal="true" aria-labelledby="internal-request-title">
            <header className="tw:flex tw:shrink-0 tw:items-center tw:justify-between tw:gap-3 tw:px-2 tw:py-1">
              <h2 id="internal-request-title" className="tw:m-0 tw:text-base tw:font-semibold tw:text-ui-ink">Nova solicitação</h2>
              <CloseButton onClick={closeCreateRequest} />
            </header>
            {createdRequest ? (
              <div className="nr-body">
                <RequestDoneCard
                  protocol={createdRequest.protocol}
                  followUp={(createdRequest.workflow_data || createdRequest.workflowData)?.followUp}
                  createRequirement={() => createRequestDocumentDataUrl(createdRequest, municipalities.find((item) => item.id === createdRequest.municipalityId))}
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
          </Card>
        </ConfigDialogBackdrop>
      )}

    </section>
  );
}

// The notice to install the app, on the home page only: with a service open it would cover the buttons of its form. It stays
// mounted while hidden, so the browser's install offer of this visit is not lost.
function PwaInstallPrompt({ visible }: { visible: boolean }) {
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

  if (!visible || dismissed || installed || isStandalone) return null;
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


type AdoptionChoice = {
  value: string;
  label: string;
  icon?: typeof PawPrint;
};

const adoptionSelectedButtonStyle = "tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:aria-pressed:border-ui-accent tw:aria-pressed:bg-ui-accent-soft tw:aria-pressed:text-ui-accent-strong";
const adoptionPrimaryButtonStyle = "tw:border-[color:var(--action-primary-border)] tw:bg-[var(--action-primary)] tw:font-semibold tw:text-[color:var(--action-primary-ink)] tw:enabled:hover:bg-[var(--action-primary-hover)]";
const adoptionIconButtonStyle = "tw:w-10 tw:shrink-0 tw:px-0";
const adoptionBlueButtonStyle = "tw:border-[color:var(--teal)] tw:bg-[var(--teal)] tw:text-white tw:enabled:hover:brightness-95";
// Small translucent controls over the photo of an adoption card: the dark glass keeps them readable on light and dark photos.
const adoptionPhotoControlStyle = "tw:absolute tw:top-2 tw:z-[3] tw:inline-flex tw:h-7 tw:min-w-7 tw:items-center tw:justify-center tw:gap-1 tw:rounded-full tw:border-0 tw:bg-slate-900/45 tw:px-2 tw:text-xs tw:text-white tw:backdrop-blur-sm tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-white";
// Icon actions of an adoption card without border or fill: the color stays in the icon and the hover brings a light background.
const adoptionGhostIconButtonStyle = `${adoptionIconButtonStyle} tw:border-transparent tw:bg-transparent tw:enabled:hover:bg-card-page`;

function AdoptionChoiceGroup({ label, choices, value, onChange }: { label: string; choices: AdoptionChoice[]; value: string; onChange: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} className="tw:flex tw:flex-wrap tw:gap-1.5">
      {choices.map((choice) => {
        const Icon = choice.icon;
        return (
          <Button key={choice.value} variant="custom" aria-pressed={value === choice.value} className={adoptionSelectedButtonStyle} onClick={() => onChange(choice.value)}>
            {Icon && <Icon size={15} aria-hidden={true} />}
            {choice.label}
          </Button>
        );
      })}
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
  const adoptionToolbar = useRef<HTMLDivElement>(null);
  const drawerLayer = useRef<HTMLDivElement>(null);
  const editorLayer = useRef<HTMLDivElement>(null);
  const confirmLayer = useRef<HTMLDivElement>(null);
  const drawerTrigger = useRef<HTMLButtonElement | null>(null);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const confirmTrigger = useRef<HTMLButtonElement | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const editorTitle = useId();
  const confirmTitle = useId();
  const confirmPanel = useId();
  useModalFocus(drawerLayer, Boolean(selectedAdoptionAnimal), drawerTrigger.current);
  useModalFocus(editorLayer, canManageAdoptions && isFormOpen, editorTrigger.current);
  useModalFocus(confirmLayer, Boolean(adoptionConfirmModal), confirmTrigger.current);
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
    { value: ADOPTION_STATUS_AVAILABLE, label: `Disponíveis (${availableAnimals.length})`, icon: HeartHandshake },
    { value: ADOPTION_STATUS_IN_PROGRESS, label: `Triagem (${inProgressAnimals.length})`, icon: Clock },
    { value: ADOPTION_STATUS_ADOPTED, label: `Adotados (${adoptedAnimals.length})`, icon: CheckCircle2 },
  ];
  const speciesQuickFilters = [
    { value: "", label: "Todas", icon: PawPrint },
    ...speciesFilterOptions.map((species) => ({
      value: species,
      label: normalizeText(species).includes("fel") ? "Gatos" : normalizeText(species).includes("can") ? "Cães" : species,
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

  function restoreAvailableAdoptionFocus(trigger: HTMLButtonElement | null) {
    requestAnimationFrame(() => {
      if (trigger?.isConnected) return;
      const fallback = drawerLayer.current?.querySelector<HTMLButtonElement>("[data-ui-close-button]")
        ?? adoptionToolbar.current?.querySelector<HTMLButtonElement>("[aria-pressed=true]");
      fallback?.focus();
    });
  }

  function showAdoptionDrawer(animal: AnyRecord, trigger: HTMLButtonElement) {
    drawerTrigger.current = trigger;
    setSelectedAdoptionAnimal(animal);
  }

  function closeAdoptionDrawer() {
    restoreAvailableAdoptionFocus(drawerTrigger.current);
    setSelectedAdoptionAnimal(null);
  }

  function openAnimalForm(trigger: HTMLButtonElement) {
    editorTrigger.current = trigger;
    setEditingAnimalId(null);
    setAnimalForm(emptyAnimalForm);
    setFormError("");
    setIsFormOpen(true);
  }

  function closeAnimalForm(force = false) {
    if (isSavingAnimal && !force) return;
    restoreAvailableAdoptionFocus(editorTrigger.current);
    setEditingAnimalId(null);
    setAnimalForm(emptyAnimalForm);
    setFormError("");
    setIsFormOpen(false);
  }

  function editAnimal(animal: AnyRecord, trigger: HTMLButtonElement) {
    editorTrigger.current = trigger;
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

  async function openInterestsModal(animal: AnyRecord, trigger: HTMLButtonElement) {
    try {
      const list = await api.getInterests(animal.id);
      showAdoptionDrawer({ ...animal, interests: list }, trigger);
    } catch (err) {
      console.error("Erro ao carregar interessados:", err);
      showAdoptionDrawer(animal, trigger);
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

  function openAdoptionConfirmModal(animal: AnyRecord, trigger: HTMLButtonElement) {
    confirmTrigger.current = trigger;
    setAdoptionConfirmModal(animal);
    setAdoptionModalForm({ ...emptyAdoptionModalForm, adopted_at: new Date().toISOString().slice(0, 10) });
    setAdoptionModalStep(0);
    setAdoptionModalCepStatus("");
  }

  function closeAdoptionConfirmModal() {
    if (isSavingAdoption) return;
    restoreAvailableAdoptionFocus(confirmTrigger.current);
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
      restoreAvailableAdoptionFocus(confirmTrigger.current);
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
        <div ref={adoptionToolbar} className="page-toolbar adoption-command-controls">
          {canManageAdoptions && (
            <nav className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-wrap tw:items-center tw:gap-3" aria-label="Filtros de adoção">
              <AdoptionChoiceGroup label="Filtrar por status" choices={statusQuickFilters} value={adoptionStatusFilter} onChange={setAdoptionStatusFilter} />
              <AdoptionChoiceGroup label="Filtrar por espécie" choices={speciesQuickFilters} value={adoptionFilters.species} onChange={(species) => setAdoptionFilters((current) => ({ ...current, species }))} />
              <AdoptionChoiceGroup label="Filtrar por sexo" choices={sexQuickFilters} value={adoptionFilters.sex} onChange={(sex) => setAdoptionFilters((current) => ({ ...current, sex }))} />
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={() => { setAdoptionStatusFilter(ADOPTION_STATUS_AVAILABLE); setAdoptionFilters({ species: "", sex: "" }); }}>
                  Limpar filtros
                </Button>
              )}
            </nav>
          )}

          <div className="adoption-toolbar-actions tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <div role="group" className="tw:flex tw:gap-1.5" aria-label="Modo de visualização">
              <Button variant="custom" className={`${adoptionIconButtonStyle} ${adoptionSelectedButtonStyle}`} aria-pressed={adoptionViewMode === "grid"} onClick={() => setAdoptionViewMode("grid")} title="Grade" aria-label="Grade">
                <LayoutDashboard size={15} aria-hidden="true" />
              </Button>
              <Button variant="custom" className={`${adoptionIconButtonStyle} ${adoptionSelectedButtonStyle}`} aria-pressed={adoptionViewMode === "list"} onClick={() => setAdoptionViewMode("list")} title="Lista" aria-label="Lista">
                <ListChecks size={15} aria-hidden="true" />
              </Button>
            </div>
            {canManageAdoptions && (
              <Button variant="custom" className={adoptionPrimaryButtonStyle} onClick={(event) => openAnimalForm(event.currentTarget)}>
                <Plus size={16} aria-hidden="true" />
                Cadastrar animal
              </Button>
            )}
          </div>
        </div>

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
                    <Card as="article" className="adoption-card adoption-card-modern tw:relative" key={animal.id || animal.name}>
                      <Card as="button"
                        className={`animal-photo ${getAnimalGradient(animal)} tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent`}
                        onClick={(event) => showAdoptionDrawer(animal, event.currentTarget)}
                        aria-label={`Abrir ficha de ${displayName}`}
                      >
                        {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt="" /> : <PawPrint size={44} aria-hidden="true" />}
                        <span className="adoption-card-name">{displayName}</span>
                      </Card>

                      {canManageAdoptions && (
                        <>
                          <button type="button" className={`${adoptionPhotoControlStyle} tw:right-2 tw:hover:bg-ui-danger`} aria-label={`Excluir ${displayName}`} onClick={() => deleteAnimal(animal)}>
                            <X size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={`${adoptionPhotoControlStyle} tw:left-2 tw:hover:bg-slate-900/65`}
                            onClick={(event) => openInterestsModal(animal, event.currentTarget)}
                            title="Interessados"
                            aria-label={`Interessados em ${displayName}: ${interestCount}`}
                          >
                            <Users size={13} aria-hidden="true" />
                            <span className={interestCount > 0 ? "tw:font-semibold" : undefined}>{interestCount}</span>
                          </button>
                          <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-1.5 tw:p-2">
                            <Button variant="custom" className={`${adoptionGhostIconButtonStyle} tw:text-ui-muted tw:enabled:hover:text-ui-ink`} onClick={(event) => editAnimal(animal, event.currentTarget)} title="Editar" aria-label={`Editar ${displayName}`}>
                              <Edit3 size={15} aria-hidden="true" />
                            </Button>
                            {animal.status === ADOPTION_STATUS_ADOPTED ? (
                              <Button variant="custom" className={`${adoptionGhostIconButtonStyle} tw:text-[color:var(--teal)]`} onClick={() => updateAnimalStatus(animal, ADOPTION_STATUS_AVAILABLE)} title="Reativar" aria-label={`Reativar ${displayName}`}>
                                <RefreshCw size={15} aria-hidden="true" />
                              </Button>
                            ) : (
                              <Button variant="custom" className={`${adoptionGhostIconButtonStyle} tw:text-[color:var(--teal)]`} onClick={(event) => openAdoptionConfirmModal(animal, event.currentTarget)} title="Concluir adoção" aria-label={`Concluir adoção de ${displayName}`}>
                                <CheckCircle2 size={15} aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </Card>
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
                    <Card as="article" className="adoption-list-row" key={animal.id || animal.name}>
                      <Card as="button" className={`adoption-list-thumb ${getAnimalGradient(animal)} tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent`} onClick={(event) => showAdoptionDrawer(animal, event.currentTarget)} aria-label={`Abrir ficha de ${displayName}`}>
                        {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt="" /> : <PawPrint size={22} aria-hidden="true" />}
                      </Card>
                      <div className="adoption-list-info">
                        <strong>{displayName}</strong>
                        <span>{[animal.species, animal.sex, animal.age].filter(Boolean).join(" - ") || "Dados básicos não informados"}</span>
                      </div>
                      <span className={`adoption-card-status ${statusView.className}`}>{statusView.label}</span>
                      <span className="adoption-list-muted"><Users size={13} aria-hidden="true" /> {interestCount}</span>
                      <span className="adoption-list-muted">{daysInProgram !== null ? `${daysInProgram} dias` : "Sem data"}</span>
                      {canManageAdoptions && (
                        <div className="adoption-list-actions">
                          <Button variant="outline" className={adoptionIconButtonStyle} onClick={(event) => showAdoptionDrawer(animal, event.currentTarget)} title="Ver ficha" aria-label={`Ver ficha de ${displayName}`}><Eye size={15} aria-hidden="true" /></Button>
                          <Button variant="outline" className={adoptionIconButtonStyle} onClick={(event) => editAnimal(animal, event.currentTarget)} title="Editar" aria-label={`Editar ${displayName}`}><Edit3 size={15} aria-hidden="true" /></Button>
                          {animal.status === ADOPTION_STATUS_ADOPTED ? (
                            <Button variant="custom" className={`${adoptionIconButtonStyle} ${adoptionBlueButtonStyle}`} onClick={() => updateAnimalStatus(animal, ADOPTION_STATUS_AVAILABLE)} title="Reativar" aria-label={`Reativar ${displayName}`}><RefreshCw size={15} aria-hidden="true" /></Button>
                          ) : (
                            <Button variant="custom" className={`${adoptionIconButtonStyle} ${adoptionBlueButtonStyle}`} onClick={(event) => openAdoptionConfirmModal(animal, event.currentTarget)} title="Concluir adoção" aria-label={`Concluir adoção de ${displayName}`}><CheckCircle2 size={15} aria-hidden="true" /></Button>
                          )}
                        </div>
                      )}
                    </Card>
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
          <div className="adoption-drawer-layer tw:z-[300]" ref={drawerLayer} data-managed-dialog="">
            <div className="adoption-drawer-scrim" aria-hidden="true" onClick={closeAdoptionDrawer} />
            <aside className="adoption-drawer" role="dialog" aria-modal="true" aria-label={`Ficha de ${displayName}`}>
              <div className={`adoption-drawer-photo ${getAnimalGradient(selectedAdoptionAnimal)}`}>
                {getAnimalMainPhoto(selectedAdoptionAnimal) ? <img src={getAnimalMainPhoto(selectedAdoptionAnimal)} alt={displayName} /> : <PawPrint size={48} />}
                <div className="tw:absolute tw:right-3 tw:top-3">
                  <CloseButton onClick={closeAdoptionDrawer} aria-label="Fechar ficha" />
                </div>
                <span className={`adoption-card-status ${statusView.className}`}>{statusView.label}</span>
              </div>
              <div className="adoption-drawer-body">
                <h2>{displayName}</h2>
                <p>{[selectedAdoptionAnimal.species, selectedAdoptionAnimal.sex, selectedAdoptionAnimal.age].filter(Boolean).join(" - ") || "Dados básicos não informados"}</p>
                <div className="adoption-drawer-facts">
                  <Card className="tw:min-w-0 tw:px-3 tw:py-2"><small>Interesses</small><strong>{interestList.length}</strong></Card>
                  <Card className="tw:min-w-0 tw:px-3 tw:py-2"><small>No programa</small><strong>{daysInProgram !== null ? `${daysInProgram} dias` : "--"}</strong></Card>
                  <Card className="tw:min-w-0 tw:px-3 tw:py-2"><small>Microchip</small><strong>{selectedAdoptionAnimal.animal_microchip || selectedAdoptionAnimal.microchip || "--"}</strong></Card>
                  <Card className="tw:min-w-0 tw:px-3 tw:py-2"><small>Status</small><strong>{statusView.label}</strong></Card>
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
                    {interestList.length === 0 && <p role="status">Nenhum interessado ainda.</p>}
                    {interestList.map((item, index) => (
                      <Card className="adoption-drawer-interest" key={`${item.name || "interest"}-${index}`}>
                        <strong>{item.name || "Interessado"}</strong>
                        <span>{item.phone || "Telefone não informado"}</span>
                        {item.visit_date && <small>Visita: {formatAdoptionDate(item.visit_date)}</small>}
                        {canManageAdoptions && (
                          <Button variant="danger" className="tw:mt-1 tw:justify-self-start" onClick={() => removeInterest(selectedAdoptionAnimal.id, index)}>
                            Remover
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
              {canManageAdoptions && (
                <div className="adoption-drawer-actions tw:flex-wrap">
                  <Button variant="outline" className="tw:flex-1" onClick={(event) => editAnimal(selectedAdoptionAnimal, event.currentTarget)}><Edit3 size={15} aria-hidden="true" /> Editar ficha</Button>
                  {selectedAdoptionAnimal.status === ADOPTION_STATUS_ADOPTED ? (
                    <Button variant="outline" className="tw:flex-1" onClick={() => updateAnimalStatus(selectedAdoptionAnimal, ADOPTION_STATUS_AVAILABLE)}><RefreshCw size={15} aria-hidden="true" /> Reativar</Button>
                  ) : (
                    <Button variant="custom" className={`${adoptionPrimaryButtonStyle} tw:flex-1`} onClick={(event) => openAdoptionConfirmModal(selectedAdoptionAnimal, event.currentTarget)}><CheckCircle2 size={15} aria-hidden="true" /> Concluir adoção</Button>
                  )}
                </div>
              )}
            </aside>
          </div>
        );
      })()}
      {canManageAdoptions && isFormOpen && (
        <div
          className="modal-backdrop"
          ref={editorLayer}
          data-managed-dialog=""
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAnimalForm();
          }}
        >
          <Card as="form" className="adoption-form-modal" onSubmit={publishAnimal} role="dialog" aria-modal="true" aria-labelledby={editorTitle} aria-busy={isSavingAnimal}>
            <header className="modal-header">
              <div className="modal-header-text">
                <h2 id={editorTitle}>{editingAnimalId ? "Editar animal para adoção" : "Cadastrar animal para adoção"}</h2>
              </div>
              <CloseButton onClick={() => closeAnimalForm()} disabled={isSavingAnimal} />
            </header>
            <div className="adoption-editor-grid">
              <div className="adoption-photo-column">
                <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={handlePhotoChange} />
                <Button variant="outline" className="animal-photo-uploader" aria-label="Adicionar fotos do animal" onClick={() => photoInput.current?.click()}>
                  {animalForm.photos.length > 0 ? (
                    <img src={animalForm.photos[animalForm.mainPhotoIndex]} alt="Prévia principal do animal" />
                  ) : (
                    <span>
                      <UploadCloud size={28} aria-hidden="true" />
                      Fotos do animal
                    </span>
                  )}
                </Button>
                <small>Máximo: 5 imagens, 2 MB por imagem, 8 MB no total.</small>
                {animalForm.photos.length > 0 && (
                  <div className="animal-photo-picker">
                    {animalForm.photos.map((photo, index) => (
                      <div className="animal-photo-option" key={`${photo}-${index}`}>
                        <Card as="button"
                          className="tw:w-full tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent"
                          aria-label={`Usar foto ${index + 1} como principal`}
                          aria-pressed={animalForm.mainPhotoIndex === index}
                          onClick={() => updateAnimalForm("mainPhotoIndex", index)}
                        >
                          <img src={photo} alt="" />
                          <span>{animalForm.mainPhotoIndex === index ? "Principal" : "Usar principal"}</span>
                        </Card>
                        <Button variant="danger" className={`${adoptionIconButtonStyle} tw:absolute tw:right-1 tw:top-1`} onClick={() => removeAnimalPhoto(index)} aria-label={`Excluir foto ${index + 1}`}>
                          <X size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="adoption-editor-fields">
                <div className="animal-main-grid">
                  <ConfigField label="Nome" value={animalForm.name} onChange={(value) => updateAnimalForm("name", value)} />
                  <ConfigField label="Idade aproximada" value={animalForm.age} onChange={(value) => updateAnimalForm("age", value)} />
                </div>
                <div className="animal-choice-grid">
                  <div className={configFieldStyle}>
                    <span aria-hidden="true">Espécie</span>
                    <AdoptionChoiceGroup label="Espécie" value={animalForm.species} choices={activeSpecies.map((value) => ({ value, label: value }))} onChange={(value) => updateAnimalForm("species", value)} />
                  </div>
                  <div className={configFieldStyle}>
                    <span aria-hidden="true">Sexo</span>
                    <AdoptionChoiceGroup label="Sexo" value={animalForm.sex} choices={[{ value: "Femea", label: "Fêmea" }, { value: "Macho", label: "Macho" }]} onChange={(value) => updateAnimalForm("sex", value)} />
                  </div>
                </div>
                <label className={configFieldStyle}>
                  <span>Descrição para a página pública</span>
                  <textarea
                    className={`${configTextareaStyle} tw:min-h-24 tw:resize-y`}
                    value={animalForm.tone}
                    placeholder="Temperamento, história, cuidados e perfil do adotante indicado"
                    onChange={(event) => updateAnimalForm("tone", event.target.value)}
                  />
                </label>
              </div>
            </div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="form-actions">
              <Button variant="outline" onClick={() => closeAnimalForm()} disabled={isSavingAnimal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingAnimal}>
                {isSavingAnimal ? "Salvando..." : editingAnimalId ? "Salvar alterações" : "Publicar na galeria"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {adoptionConfirmModal && (
        <div className="modal-backdrop" ref={confirmLayer} data-managed-dialog="" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAdoptionConfirmModal(); }}>
          <Card className="auth-modal adoption-confirm-modal" role="dialog" aria-modal="true" aria-labelledby={confirmTitle} aria-busy={isSavingAdoption}>
            <header className="modal-header">
              <div className="modal-header-text">
                <h2 id={confirmTitle}>Confirmar adoção - {adoptionConfirmModal.name || adoptionConfirmModal.animal_name}</h2>
              </div>
              <CloseButton onClick={closeAdoptionConfirmModal} disabled={isSavingAdoption} />
            </header>

            <div className="tw:flex tw:flex-wrap tw:gap-1.5 tw:border-b tw:border-card-border tw:px-4 tw:pb-3" role="tablist" aria-label="Etapas da adoção" onKeyDown={(event) => {
              const next = { ArrowLeft: (adoptionModalStep + 2) % 3, ArrowRight: (adoptionModalStep + 1) % 3, Home: 0, End: 2 }[event.key];
              if (next === undefined) return;
              event.preventDefault();
              setAdoptionModalStep(next);
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
            }}>
              {["Tutor", "Procedimentos", "Dados do Animal"].map((label, index) => (
                <Button
                  key={label}
                  variant="custom"
                  role="tab"
                  id={`${confirmPanel}-${index}`}
                  tabIndex={index === adoptionModalStep ? 0 : -1}
                  aria-controls={confirmPanel}
                  aria-selected={index === adoptionModalStep}
                  className="tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:aria-selected:border-ui-accent tw:aria-selected:bg-ui-accent-soft tw:aria-selected:text-ui-accent-strong"
                  onClick={() => setAdoptionModalStep(index)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="adoption-confirm-body" role="tabpanel" id={confirmPanel} aria-labelledby={`${confirmPanel}-${adoptionModalStep}`}>
              {adoptionModalStep === 0 && (
                <div className="adoption-confirm-panel">
                  <ConfigField label="Nome" value={adoptionModalForm.tutor} onChange={(v) => updateAdoptionModalForm("tutor", v)} placeholder="Nome do tutor ou responsável" />
                  <ConfigField label="CPF" value={adoptionModalForm.cpf} inputMode="numeric" onChange={(v) => updateAdoptionModalMasked("cpf", v)} placeholder="000.000.000-00" />
                  <div className="address-lookup-grid">
                    <ConfigField label="CEP" value={adoptionModalForm.cep} inputMode="numeric" onChange={(v) => updateAdoptionModalMasked("cep", v)} placeholder="00000-000" />
                    <ConfigField label="Número" value={adoptionModalForm.number} onChange={(v) => updateAdoptionModalForm("number", v)} placeholder="123" />
                  </div>
                  {adoptionModalCepStatus && <p className="cep-status" role="status">{adoptionModalCepStatus}</p>}
                  <ConfigField label="Endereço completo" value={adoptionModalForm.address} onChange={(v) => updateAdoptionModalForm("address", v)} placeholder="Rua, complemento" />
                  <ConfigField label="Bairro" value={adoptionModalForm.neighborhood} onChange={(v) => updateAdoptionModalForm("neighborhood", v)} placeholder="Informe o bairro" />
                  <div className="two-column-fields">
                    <ConfigField label="Cidade" value={adoptionModalForm.city} onChange={(v) => updateAdoptionModalForm("city", v)} placeholder="Cidade" />
                    <ConfigField label="UF" value={adoptionModalForm.state} onChange={(v) => updateAdoptionModalForm("state", v.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase())} placeholder="SP" />
                  </div>
                  <ConfigField label="E-mail" value={adoptionModalForm.email} inputMode="email" onChange={(v) => updateAdoptionModalForm("email", v)} placeholder="email@exemplo.com" />
                  <ConfigField label="Celular" value={adoptionModalForm.phone} inputMode="tel" onChange={(v) => updateAdoptionModalMasked("phone", v)} placeholder="(00) 00000-0000" />
                </div>
              )}

              {adoptionModalStep === 1 && (
                <div className="adoption-confirm-panel">
                  <ConfigField label="Data da adoção" value={adoptionModalForm.adopted_at} onChange={(v) => updateAdoptionModalForm("adopted_at", v)} type="date" />
                  <label className={configFieldStyle}>
                    Procedimentos realizados
                    <textarea
                      className={`${configTextareaStyle} tw:min-h-[130px] tw:resize-y`}
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
                  <label className={configFieldStyle}>
                    Doenças pré-existentes
                    <textarea
                      className={`${configTextareaStyle} tw:min-h-[130px] tw:resize-y`}
                      value={adoptionModalForm.doencas}
                      onChange={(e) => updateAdoptionModalForm("doencas", e.target.value)}
                      placeholder="Ex: diabetes, displasia, cardiopatia..."
                      rows={2}
                    />
                  </label>
                  <label className={configFieldStyle}>
                    Alergias conhecidas
                    <textarea
                      className={`${configTextareaStyle} tw:min-h-[130px] tw:resize-y`}
                      value={adoptionModalForm.alergias}
                      onChange={(e) => updateAdoptionModalForm("alergias", e.target.value)}
                      placeholder="Ex: alergia a penicilina, sensibilidade a frango..."
                      rows={2}
                    />
                  </label>
                  <label className={configFieldStyle}>
                    Vacinas aplicadas
                    <textarea
                      className={`${configTextareaStyle} tw:min-h-[130px] tw:resize-y`}
                      value={adoptionModalForm.vacinas}
                      onChange={(e) => updateAdoptionModalForm("vacinas", e.target.value)}
                      placeholder="Ex: V8, antirrábica, giárdia..."
                      rows={2}
                    />
                  </label>
                  <label className={configFieldStyle}>
                    Comportamento
                    <textarea
                      className={`${configTextareaStyle} tw:min-h-[130px] tw:resize-y`}
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
              <Button variant="custom" className={adoptionPrimaryButtonStyle} onClick={submitAdoptionConfirm} disabled={isSavingAdoption}>
                {isSavingAdoption ? "Salvando..." : "Confirmar adoção"}
              </Button>
            </div>
          </Card>
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
  onUserSession,
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
  aiConfigStatus,
  retryAiConfig,
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
  const emptyTeamUser = { name: "", email: "", sectorIds: [], municipalityId: "", role: "analista", matricula: "", cargo: "", senha: "", active: true, permissionGroupId: "" };
  const [newTeamUser, setNewTeamUser] = useState(emptyTeamUser);
  const [newMunicipality, setNewMunicipality] = useState<MunicipalityForm>(emptyMunicipalityForm);
  const [editingMunicipalityId, setEditingMunicipalityId] = useState(null);
  const [municipalitySaving, setMunicipalitySaving] = useState(false);
  const [municipalitySaveStatus, setMunicipalitySaveStatus] = useState("");
  const [editingTeamUserId, setEditingTeamUserId] = useState(null);
  const [savingTeamUser, setSavingTeamUser] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const teamRoleOptions = Object.keys(userRoleLabels).filter((role) => role !== "tutor" && (isGlobalRole(currentUser?.role) || !isGlobalRole(role)));
  const [sectorPickerOpen, setSectorPickerOpen] = useState(false);
  const [municipalityStateFilter, setMunicipalityStateFilter] = useState("");
  const [userSaveError, setUserSaveError] = useState("");
  const [agendaForm, setAgendaForm] = useState(emptyAgendaForm);
  const [aiSaveStatus, setAiSaveStatus] = useState("");
  const configCurrentTeamUser = (teams.users || []).find((user) => currentUser?.id && user.id === currentUser.id);
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

  async function saveAiCredentials() {
    const nextSettings = {
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
      const saved = await api.setConfig("ai", { clearApiKey: true }, configMunicipalityScopeId);
      setAiSettings?.({ ...initialAiSettings, ...saved.value });
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
            ...(current.users || []).filter((user) => user.id !== defaultTeamUser.id),
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
    if (savingTeamUser || !newTeamUser.name.trim() || !newTeamUser.email.trim()) return false;
    const sectorIds = Array.isArray(newTeamUser.sectorIds) ? newTeamUser.sectorIds : [];
    const municipalityId = isGlobalRole(currentUser?.role)
      ? newTeamUser.municipalityId
      : currentUser?.municipalityId || newTeamUser.municipalityId;
    if (!municipalityId) return false;
    setSavingTeamUser(true);
    setUserSaveError("");
    try {
      const saved = await api.upsertAuthUser({
        ...(editingTeamUserId ? { id: editingTeamUserId } : {}),
        active: newTeamUser.active !== false,
        name: newTeamUser.name.trim(),
        email: newTeamUser.email.trim(),
        password: newTeamUser.senha,
        role: newTeamUser.role,
        municipalityId,
        team: {
          sectorIds,
          matricula: newTeamUser.matricula,
          cargo: newTeamUser.cargo,
          permissionGroupId: newTeamUser.permissionGroupId,
        },
      }, editingTeamUserId === currentUser?.id);
      const savedUser = saved.teamUser;
      if (savedUser) {
        setTeams?.((current) => {
          const users = current.users || [];
          return {
            ...current,
            users: editingTeamUserId
              ? users.map((user) => user.id === editingTeamUserId ? savedUser : user)
              : [...users, savedUser],
          };
        }, false);
      }
      if (saved.session) onUserSession?.(saved.session.user);
      setEditingTeamUserId(null);
      setNewTeamUser(emptyTeamUser);
      return true;
    } catch (err) {
      setUserSaveError(err.message || "Erro ao salvar usuário. Verifique os dados e tente novamente.");
      return false;
    } finally {
      setSavingTeamUser(false);
    }
  }

  function openTeamUserModal(user = null) {
    const getMunState = (munId) => municipalities.find((m) => m.id === munId)?.state || "";
    const defaultMunId = isGlobalRole(currentUser?.role)
      ? (user?.municipalityId || selectedMunicipalityId || currentUser?.municipalityId || municipalities[0]?.id || "")
      : (currentUser?.municipalityId || "");
    if (user) {
      const ownAccount = user.id === currentUser?.id ? currentUser : null;
      setEditingTeamUserId(user.id);
      setNewTeamUser({
        name: ownAccount?.name || user.name || "",
        email: ownAccount?.email || user.email || "",
        sectorIds: getUserSectorIds(user),
        municipalityId: defaultMunId,
        role: ownAccount?.role || normalizeText(user.role || "") || emptyTeamUser.role,
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
  const activeMunicipalities = municipalities.filter((municipality) => municipality.active !== false);
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

      {configArea === "integrations" && configTab === "email" && integrationsTabs.some((tab) => tab.id === "email") && <EmailIntegrationTab key={configMunicipalityScopeId} municipalityId={configMunicipalityScopeId} master={isMasterRole(currentUser?.role)} canManage={canUseIntegration(Boolean(canUseConfigPermissions), configCurrentPermissionGroup, IntegrationConfigItem.EMAIL, canManageAiSettings(currentUser?.role))} />}

      {configArea === "integrations" && configTab === "sms" && integrationsTabs.some((tab) => tab.id === "sms") && <SmsSettings key={configMunicipalityScopeId} municipalityId={configMunicipalityScopeId} master={isMasterRole(currentUser?.role)} canManage={canUseIntegration(Boolean(canUseConfigPermissions), configCurrentPermissionGroup, IntegrationConfigItem.SMS, canManageAiSettings(currentUser?.role))} />}

      {configArea === "integrations" && configTab === "ai_settings" && integrationsTabs.some((tab) => tab.id === "ai_settings") && (
        <div className="config-panel wide">
          <PanelHeader title="IA externa para documentos" />
          {aiConfigStatus !== "ready" ? (
            <Card className="tw:grid tw:justify-items-start tw:gap-3 tw:p-4">
              {aiConfigStatus === "error" ? (
                <>
                  <p role="alert" className="tw:m-0">Não foi possível carregar a configuração de IA.</p>
                  <Button variant="outline" onClick={retryAiConfig}>Tentar novamente</Button>
                </>
              ) : (
                <p role="status" className="tw:m-0">
                  {aiConfigStatus === "unselected" ? "Selecione um município para configurar a IA." : "Carregando a configuração de IA…"}
                </p>
              )}
            </Card>
          ) : <div className="tw:grid tw:items-start tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
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
          </div>}
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
        <NeighborhoodsConfig
          items={neighborhoods}
          onSave={(municipalityId, update) => saveScopedConfigCatalog(CONFIG_KEYS.neighborhoods, municipalityId, update, setNeighborhoods)}
          municipalityScopeId={configMunicipalityScopeId}
        />
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
          <Card as="form" className="workflow-modal config-user-modal" role="dialog" aria-modal="true" aria-busy={savingTeamUser} aria-label={editingTeamUserId ? "Editar usuário" : "Criar usuário"} onSubmit={async (e) => { e.preventDefault(); if (await createTeamUser()) setUserModal(false); }}>
            <ModalHeader
              appearance="config"
              title={editingTeamUserId ? "Editar usuário" : "Criar usuário"}
              onClose={() => { if (!savingTeamUser) { setUserModal(false); setEditingTeamUserId(null); setSectorPickerOpen(false); setUserSaveError(""); } }}
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
              <ConfigField label="Cargo" value={newTeamUser.cargo} placeholder="Ex: Veterinário, Coordenador..." onChange={(value) => setNewTeamUser((c) => ({ ...c, cargo: value }))} />
              <label className="field">
                <span>Perfil de acesso</span>
                <select value={newTeamUser.role} onChange={(event) => setNewTeamUser((current) => ({ ...current, role: event.target.value }))}>
                  {!teamRoleOptions.includes(newTeamUser.role) && <option value={newTeamUser.role}>{userRoleLabel(newTeamUser.role)}</option>}
                  {teamRoleOptions.map((role) => <option key={role} value={role}>{userRoleLabel(role)}</option>)}
                </select>
              </label>
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
                autoComplete="new-password"
                value={newTeamUser.senha}
                placeholder={editingTeamUserId ? "Preencha apenas se quiser alterar" : "Senha inicial"}
                onChange={(value) => setNewTeamUser((c) => ({ ...c, senha: value }))}
              />
              {userSaveError && <p className="form-error-msg" role="alert">{userSaveError}</p>}
            </div>
            <footer className="config-management-footer">
              <Button variant="custom" className={managementSubmitStyle} type="submit" disabled={savingTeamUser || !newTeamUser.name.trim() || !newTeamUser.email.trim() || !newTeamUser.municipalityId || (!editingTeamUserId && !newTeamUser.senha)}>
                {savingTeamUser ? "Salvando..." : editingTeamUserId ? "Salvar" : "Criar usuário"}
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
                  className="tw:justify-start"
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
        <WhatsappIntegrationTab key={configMunicipalityScopeId} municipalityId={configMunicipalityScopeId} readOnly={!canUseIntegration(Boolean(canUseConfigPermissions), configCurrentPermissionGroup, IntegrationConfigItem.WHATSAPP, canManageAiSettings(currentUser?.role))} master={isMasterRole(currentUser?.role)} />
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
      <Card as="article" className={`doc-row tw:flex-wrap ${upload?.status || "empty"}${needsReplacement ? " needs-replacement" : ""}`}>
        <div className="doc-row-icon">{statusIcon}</div>
        <div className="doc-row-info">
          <strong>{document.name}{document.required && <span className="doc-required">*</span>}</strong>
          {upload?.fileName
            ? <small>{upload.fileName}</small>
            : <small className="doc-row-hint">{statusLabel}</small>
          }
          {publicMessage && <small className="doc-row-msg">{publicMessage}</small>}
        </div>
        <div className="tw:ml-auto tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
          <input ref={fileInput} type="file" hidden accept={(document.accept || []).join(",")} onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => onUpload(event.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileInput.current?.click()} aria-label={`${upload ? "Substituir" : "Anexar"} ${document.name}`}>
            <Paperclip size={15} aria-hidden="true" />{upload ? "Substituir" : "Anexar"}
          </Button>
          {onPreview && upload?.dataUrl && <Button variant="outline" onClick={() => onPreview(upload)} aria-label={`Ver ${document.name}`}>Ver arquivo</Button>}
          {upload && <Button variant="danger" onClick={onRemove} aria-label={`Remover ${document.name}`}><Trash2 size={14} aria-hidden="true" />Remover</Button>}
        </div>
      </Card>
      {upload?.status === "checking" && upload?.dataUrl && (
        <DocumentScanningPreview dataUrl={upload.dataUrl} fileType={upload.fileType} />
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

