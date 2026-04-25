import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api.js";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
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
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import "./styles.css";

const envUsers = [
  {
    role: "admin",
    name: "Administrador",
    email: import.meta.env.VITE_ADMIN_EMAIL || "admin@castragestao.local",
    password: import.meta.env.VITE_ADMIN_PASSWORD || "Admin@123",
  },
  {
    role: "tutor",
    name: "Tutor",
    email: import.meta.env.VITE_TUTOR_EMAIL || "tutor@castragestao.local",
    password: import.meta.env.VITE_TUTOR_PASSWORD || "Tutor@123",
  },
];

const statuses = [
  "RASCUNHO",
  "AGUARDANDO_ATRIBUIR",
  "SUBMETIDA",
  "TRIAGEM",
  "PENDENCIA_DOCUMENTAL",
  "EM_ANALISE",
  "DEFERIDA",
  "AGUARDANDO_AGENDAMENTO",
  "INDEFERIDA",
  "AGENDADA",
  "REAGENDAMENTO_SOLICITADO",
  "REAGENDADA",
  "CONFIRMADA",
  "REALIZADA",
  "FALTOU",
  "CANCELADA",
];

const statusLabels = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_ATRIBUIR: "Aguardando atribuir",
  SUBMETIDA: "Submetida",
  TRIAGEM: "Triagem",
  PENDENCIA_DOCUMENTAL: "Pendencia documental",
  EM_ANALISE: "Em analise",
  DEFERIDA: "Deferida",
  AGUARDANDO_AGENDAMENTO: "Aguardando agendamento",
  INDEFERIDA: "Indeferida",
  AGENDADA: "Agendada",
  REAGENDAMENTO_SOLICITADO: "Reagendamento solicitado",
  REAGENDADA: "Reagendada",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  FALTOU: "Faltou",
  CANCELADA: "Cancelada",
};

const transitions = {
  RASCUNHO: ["AGUARDANDO_ATRIBUIR"],
  AGUARDANDO_ATRIBUIR: ["TRIAGEM", "SUBMETIDA"],
  SUBMETIDA: ["TRIAGEM"],
  TRIAGEM: ["PENDENCIA_DOCUMENTAL", "EM_ANALISE"],
  PENDENCIA_DOCUMENTAL: ["SUBMETIDA"],
  EM_ANALISE: ["DEFERIDA", "INDEFERIDA"],
  DEFERIDA: ["AGUARDANDO_AGENDAMENTO"],
  AGUARDANDO_AGENDAMENTO: ["AGENDADA"],
  AGENDADA: ["CONFIRMADA", "REAGENDAMENTO_SOLICITADO", "REAGENDADA", "FALTOU", "CANCELADA"],
  REAGENDAMENTO_SOLICITADO: ["AGENDADA", "REAGENDADA"],
  REAGENDADA: ["AGENDADA"],
  CONFIRMADA: ["REALIZADA", "FALTOU", "REAGENDADA"],
  REALIZADA: [],
  INDEFERIDA: [],
  FALTOU: ["REAGENDADA", "CANCELADA"],
  CANCELADA: [],
};

const menu = [
  { id: "admin", label: "Solicitacoes de castracao", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "adocao", label: "Adocao", icon: HeartHandshake },
  { id: "mapas", label: "Mapas", icon: MapPin },
  { id: "relatorios", label: "Relatorios", icon: Activity },
  { id: "config", label: "Configuracoes", icon: Settings },
];

const publicScheduleDays = [
  { date: "04/05/2026", weekday: "Seg", vacancies: 30 },
  { date: "05/05/2026", weekday: "Ter", vacancies: 24 },
  { date: "06/05/2026", weekday: "Qua", vacancies: 0 },
  { date: "07/05/2026", weekday: "Qui", vacancies: 18 },
  { date: "08/05/2026", weekday: "Sex", vacancies: 12 },
  { date: "11/05/2026", weekday: "Seg", vacancies: 30 },
  { date: "12/05/2026", weekday: "Ter", vacancies: 22 },
  { date: "13/05/2026", weekday: "Qua", vacancies: 16 },
  { date: "14/05/2026", weekday: "Qui", vacancies: 10 },
  { date: "15/05/2026", weekday: "Sex", vacancies: 6 },
  { date: "18/05/2026", weekday: "Seg", vacancies: 28 },
  { date: "19/05/2026", weekday: "Ter", vacancies: 20 },
  { date: "02/06/2026", weekday: "Ter", vacancies: 30 },
  { date: "03/06/2026", weekday: "Qua", vacancies: 26 },
  { date: "05/06/2026", weekday: "Sex", vacancies: 18 },
  { date: "09/06/2026", weekday: "Ter", vacancies: 24 },
  { date: "10/06/2026", weekday: "Qua", vacancies: 12 },
  { date: "16/06/2026", weekday: "Ter", vacancies: 28 },
  { date: "01/07/2026", weekday: "Qua", vacancies: 20 },
  { date: "03/07/2026", weekday: "Sex", vacancies: 22 },
  { date: "07/07/2026", weekday: "Ter", vacancies: 30 },
  { date: "08/07/2026", weekday: "Qua", vacancies: 16 },
];

const standardDocumentTemplates = [
  {
    id: "rg_cnh",
    name: "RG ou CNH",
    required: true,
    accept: ["image/jpeg", "image/png", "application/pdf"],
    maxSizeMb: 5,
    modelHint: "Documento oficial com nome, foto e numero legiveis.",
  },
];

const initialDocumentTypes = standardDocumentTemplates.map((document) => ({ ...document, active: true }));
const initialRequestTypes = [
  {
    id: "tipo_castracao",
    name: "Castracao",
    fee: "Gratuito",
    charged: false,
    billingDescription: "",
    billingAmount: "",
    billingDueDate: "",
    active: true,
    documents: initialDocumentTypes,
  },
];
const initialSpecies = [
  { id: "especie_canina", name: "Canina", active: true },
  { id: "especie_felina", name: "Felina", active: true },
];
const initialSizes = [
  { id: "porte_pequeno", name: "Pequeno", description: "Ate 10 kg", active: true },
  { id: "porte_medio", name: "Medio", description: "De 10 a 25 kg", active: true },
  { id: "porte_grande", name: "Grande", description: "Acima de 25 kg", active: true },
];
const initialMunicipalities = [];
const initialAiSettings = {
  active: false,
  provider: "OpenAI",
  model: "",
  apiKey: "",
  endpoint: "",
};
const initialTeams = {
  sectors: [
    { id: "setor_triagem", name: "Triagem", active: true },
    { id: "setor_analise", name: "Analise", active: true },
    { id: "setor_agenda", name: "Agenda", active: true },
  ],
  users: [
    { id: "user_triagem", name: "Equipe Triagem", email: "triagem@castragestao.local", sectorId: "setor_triagem", active: true },
    { id: "user_analise", name: "Equipe Analise", email: "analise@castragestao.local", sectorId: "setor_analise", active: true },
  ],
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [active, setActive] = useState("admin");
  const [requests, setRequests] = useState([]);
  const [adoptionAnimals, setAdoptionAnimals] = useState([]);
  const [requestTypes, setRequestTypes] = useState(initialRequestTypes);
  const [documentTypes, setDocumentTypes] = useState(initialDocumentTypes);
  const [speciesOptions, setSpeciesOptions] = useState(initialSpecies);
  const [sizeOptions, setSizeOptions] = useState(initialSizes);
  const [municipalities, setMunicipalities] = useState(initialMunicipalities);
  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [scheduleDays, setScheduleDays] = useState(publicScheduleDays);
  const [scheduleRules, setScheduleRules] = useState([]);
  const [teams, setTeams] = useState(initialTeams);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const selected = requests.find((request) => request.id === selectedId) || requests[0] || null;
  const metrics = useMemo(() => buildMetrics(requests), [requests]);

  useEffect(() => {
    if (!currentUser) return;
    api.getRequests().then(setRequests).catch(console.error);
    api.getAdoptions().then(setAdoptionAnimals).catch(console.error);
    api.getSchedule().then((days) => { if (days.length) setScheduleDays(days); }).catch(console.error);
  }, [currentUser]);


  if (!currentUser) {
    return <LoginView onLogin={setCurrentUser} adoptionAnimals={adoptionAnimals} />;
  }

  if (currentUser.role === "tutor") {
    return (
      <TutorMobileApp
        currentUser={currentUser}
        requests={requests}
        createRequest={createRequest}
        adoptionAnimals={adoptionAnimals}
        setAdoptionAnimals={setAdoptionAnimals}
        requestTypes={requestTypes}
        aiSettings={aiSettings}
        scheduleDays={scheduleDays}
        speciesOptions={speciesOptions}
        sizeOptions={sizeOptions}
        setCurrentUser={setCurrentUser}
      />
    );
  }

  const visibleMenu = menu;

  async function updateStatus(requestId, status) {
    try {
      const updated = await api.updateRequestStatus(requestId, status, `Status alterado para ${statusLabels[status]}`);
      setRequests((current) => current.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  }

  async function patchRequest(requestId, patch, historyEntry = "") {
    try {
      const updated = await api.patchRequest(requestId, patch);
      setRequests((current) => current.map((r) => (r.id === updated.id ? updated : r)));
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
        request_type: payload.requestType || payload.request_type,
        municipality: payload.municipality,
        notes: payload.notes,
        tutor_name: currentUser.name,
        tutor_email: currentUser.email,
      });
      setRequests((current) => [newRequest, ...current]);
      setSelectedId(newRequest.id);
      setActive("admin");
      return newRequest;
    } catch (err) {
      console.error("Erro ao criar solicitação:", err);
    }
  }

  const ActiveView = {
    admin: AdminDashboard,
    agenda: ScheduleView,
    adocao: AdoptionView,
    mapas: GeoView,
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
            <strong>CastraGestao</strong>
            <span>PWA municipal</span>
          </div>
        </div>

        <nav aria-label="Menu principal">
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id ? "active" : ""}
                onClick={() => {
                  setActive(item.id);
                  setMobileOpen(false);
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <ShieldCheck size={18} />
          <p>Logado como {currentUser.name}. Credenciais carregadas do .env.</p>
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
          <div>
            <span className="eyebrow">25/04/2026</span>
            <h1>Sistema de gestao de castracao animal</h1>
          </div>
          <div className="topbar-actions">
            <span className="sync-pill">
              <span className="online-dot" />
              {currentUser.role === "admin" ? "Admin" : "Tutor"}
            </span>
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
          updateStatus={updateStatus}
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
          setActive={setActive}
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
  setCurrentUser,
}) {
  const [screen, setScreen] = useState("home");
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [selectedRequestType, setSelectedRequestType] = useState("");

  return (
    <main className="tutor-app">
      <header className="tutor-topbar">
        <div className="brand login-brand">
          <div className="brand-mark">
            <PawPrint size={22} />
          </div>
          <div>
            <strong>CastraGestao</strong>
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
            selectedType={selectedRequestType}
            onTypeSelect={setSelectedRequestType}
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
            initialType={selectedRequestType}
          />
        </section>
      )}

      {screen === "consulta" && (
        <section className="tutor-screen">
          <button className="back-button" onClick={() => setScreen("home")}>
            Voltar
          </button>
          <TutorDashboard requests={requests} setActive={() => setScreen("solicitacao")} currentUser={currentUser} compact />
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

function PublicSchedulePicker({
  requests,
  scheduleDays = publicScheduleDays,
  selectedDate = "",
  requestTypes = initialRequestTypes,
  selectedType = "",
  onTypeSelect,
  onSelect,
}) {
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const configuredRequestTypes = requestTypes.filter((type) => type.name.trim() && type.active !== false);
  const scheduleWithUsage = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const used = requests.filter((request) => request.preferredSchedule === day.date).length;
    return { ...day, used, remaining: Math.max(day.vacancies - used, 0), isPast: isPastScheduleDay(day.date) };
  });
  const scheduleMonths = buildScheduleMonths(scheduleWithUsage);
  const activeScheduleMonth = scheduleMonths[scheduleMonthIndex] || "";
  const visibleScheduleDays = scheduleWithUsage.filter((day) => getScheduleMonthKey(day.date) === activeScheduleMonth);

  useEffect(() => {
    setScheduleMonthIndex(Math.max(scheduleMonths.indexOf(getCurrentScheduleMonthKey()), 0));
  }, [scheduleMonths.join("|")]);

  return (
    <section className="panel public-schedule-picker">
      <div className="showcase-header">
        <div>
          <span className="eyebrow">Agenda publica</span>
          <h2>Datas disponiveis</h2>
        </div>
      </div>
      <label className="field schedule-type-field">
        <span>Tipo de solicitacao</span>
        <select value={selectedType} onChange={(event) => onTypeSelect?.(event.target.value)}>
          <option value="">Selecione o servico</option>
          {configuredRequestTypes.map((type) => (
            <option key={type.id} value={type.name}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      {!selectedType && <p className="helper-text">Selecione o tipo de solicitacao para liberar a escolha da data.</p>}
      <div className="calendar-month-header">
        <button
          type="button"
          onClick={() => setScheduleMonthIndex((current) => Math.max(current - 1, 0))}
          disabled={scheduleMonthIndex === 0}
          aria-label="Mes anterior"
        >
          â€¹
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
          aria-label="Proximo mes"
        >
          â€º
        </button>
      </div>
      <div className="calendar-availability">
        {visibleScheduleDays.length === 0 && (
          <div className="calendar-empty-month">Nenhuma data configurada para {formatMonthYear(activeScheduleMonth)}.</div>
        )}
        {visibleScheduleDays.map((day) => (
          <button
            key={day.date}
            className={`${selectedDate === day.date ? "calendar-day-button selected" : "calendar-day-button"} ${day.kind === "Mutirao" ? "mutirao-day" : ""}`}
            type="button"
            disabled={day.remaining === 0 || day.isPast || !selectedType}
            onClick={() => onSelect(day.date)}
          >
            <span>{day.weekday}</span>
            <strong>{day.date.slice(0, 5)}</strong>
            <small>{day.isPast ? "Passado" : day.remaining > 0 ? `${day.remaining} vagas` : "Lotado"}</small>
            {day.kind === "Mutirao" && <em>Mutirao</em>}
            {day.locationName && <small>{day.locationName}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}

function AdoptionCarousel({ adoptionAnimals, onOpenAdoption, limit = 6, showViewAll = true }) {
  const availableAnimals = adoptionAnimals.filter((animal) => animal.status !== "Adotado").slice(0, limit);
  const [selectedAnimal, setSelectedAnimal] = useState(null);

  if (availableAnimals.length === 0) {
    return (
      <button className="adoption-empty-showcase" onClick={onOpenAdoption} type="button">
        <HeartHandshake size={28} />
        <strong>Animais para adocao</strong>
        <span>A galeria publica sera exibida aqui quando houver animais disponiveis.</span>
      </button>
    );
  }

  return (
    <>
    <section className={availableAnimals.length <= 2 ? "adoption-showcase few-animals" : "adoption-showcase"}>
      <div className="showcase-header">
        <div>
          <span className="eyebrow">Adocao</span>
          <h2>Adote um amigo para a vida toda</h2>
        </div>
        {showViewAll && (
          <button className="ghost-button" type="button" onClick={onOpenAdoption}>
            Ver todos
          </button>
        )}
      </div>

      <div className="public-animal-grid">
        {availableAnimals.map((animal) => (
          <button className="public-animal-card" key={animal.id || animal.name} type="button" onClick={() => setSelectedAnimal(animal)}>
            <div className={`public-animal-photo ${animal.gradient}`}>
              {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={animal.name} /> : <PawPrint size={36} />}
            </div>
            <div>
              <strong>Adote {animal.name}</strong>
              <span>{animal.species} - {animal.sex} - {animal.age}</span>
            </div>
          </button>
        ))}
      </div>

    </section>

    {selectedAnimal && (
      <div className="modal-backdrop">
        <div className="animal-detail-modal adoption-profile-modal">
          <button className="modal-close-button" type="button" onClick={() => setSelectedAnimal(null)} aria-label="Fechar">
            x
          </button>
          <div className="adoption-profile-media">
            <div className={`adoption-main-photo ${selectedAnimal.gradient}`}>
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
            <span className="eyebrow">Adote {selectedAnimal.name}</span>
            <h2>{selectedAnimal.name}</h2>
            <div className="adoption-profile-tags">
              <Chip>{selectedAnimal.species}</Chip>
              <Chip>{selectedAnimal.sex}</Chip>
              <Chip>{selectedAnimal.size}</Chip>
              <Chip>{selectedAnimal.age}</Chip>
            </div>
            <p>{selectedAnimal.tone}</p>
            <div className="adoption-health-list">
              {selectedAnimal.health.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <button className="primary-action" type="button" onClick={() => setSelectedAnimal(null)}>
              Tenho interesse
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function getAnimalPhotos(animal) {
  if (Array.isArray(animal.photos) && animal.photos.length > 0) return animal.photos;
  return animal.photo ? [animal.photo] : [];
}

function getAnimalMainPhoto(animal) {
  const photos = getAnimalPhotos(animal);
  return photos[animal.mainPhotoIndex || 0] || photos[0] || "";
}

function LoginView({ onLogin, adoptionAnimals = [] }) {
  const [email, setEmail] = useState(envUsers[0].email);
  const [password, setPassword] = useState(envUsers[0].password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showMobileAdoption, setShowMobileAdoption] = useState(false);
  const [registerData, setRegisterData] = useState({
    tutor: "",
    cpf: "",
    email: "",
    password: "",
    phone: "",
    cep: "",
    address: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
  });

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

  function fillUser(user) {
    setEmail(user.email);
    setPassword(user.password);
    setError("");
  }

  function updateRegisterField(field, value) {
    const masks = {
      cpf: formatCpf,
      phone: formatPhone,
      cep: formatCep,
      state: (input) => input.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase(),
    };
    setRegisterData((current) => ({ ...current, [field]: masks[field] ? masks[field](value) : value }));
  }

  async function lookupRegisterCep(value) {
    const maskedCep = formatCep(value);
    updateRegisterField("cep", maskedCep);
    const cleanCep = maskedCep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return;
      setRegisterData((current) => ({
        ...current,
        cep: maskedCep,
        address: data.logradouro || current.address,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
    } catch {
      // O cadastro continua manual se o CEP nao responder.
    }
  }

  function openAuthMode(mode) {
    setAuthMode(mode);
    setError("");
    setAuthMessage("");
  }

  function closeAuthMode() {
    setAuthMode("login");
    setAuthMessage("");
  }

  async function submitRegister(event) {
    event.preventDefault();
    const cleanCpf = registerData.cpf.replace(/\D/g, "");
    const cleanPhone = registerData.phone.replace(/\D/g, "");
    const cleanCep = registerData.cep.replace(/\D/g, "");
    const missing =
      !registerData.tutor.trim() ||
      cleanCpf.length !== 11 ||
      !registerData.email.includes("@") ||
      registerData.password.length < 6 ||
      cleanPhone.length < 10 ||
      cleanCep.length !== 8 ||
      !registerData.address.trim() ||
      !registerData.number.trim() ||
      !registerData.neighborhood.trim() ||
      !registerData.city.trim() ||
      registerData.state.trim().length !== 2;

    if (missing) {
      setAuthMessage("Preencha todos os dados do tutor. A senha precisa ter no minimo 6 caracteres.");
      return;
    }

    try {
      await api.register(registerData);
      setEmail(registerData.email.trim());
      setPassword(registerData.password);
      setAuthMessage("");
      setAuthMode("login");
    } catch {
      setAuthMessage("Erro ao cadastrar. Tente novamente ou use outro email.");
    }
  }

  function submitForgot(event) {
    event.preventDefault();
    setAuthMessage("Recuperação de senha: entre em contato com o administrador do sistema.");
  }

  return (
    <main className="login-page">
      <div className="login-layout">
        <button className="mobile-adoption-toggle" type="button" onClick={() => setShowMobileAdoption((current) => !current)}>
          {showMobileAdoption ? "Ocultar adoção" : "Ver animais para adoção"}
        </button>

        <section className={showMobileAdoption ? "login-adoption-panel mobile-visible" : "login-adoption-panel"}>
          <PetWelcomeArt />
          <AdoptionCarousel adoptionAnimals={adoptionAnimals} limit={12} showViewAll={false} />
        </section>

        <section className="login-card">
          <div className="brand login-brand">
            <div className="brand-mark">
              <PawPrint size={24} />
            </div>
            <div>
              <strong>CastraGestao</strong>
              <span>Solicitacao municipal</span>
            </div>
          </div>

          <div className="login-welcome">
            <h1>Castração animal gratuita</h1>
            <p>Selecione como deseja continuar</p>
          </div>

          <div className="login-main-actions">
            <button className="login-big-action primary" onClick={() => openAuthMode("register")}>
              <PawPrint size={28} />
              <strong>Solicitar Castração</strong>
              <span>Agendar para o seu animal</span>
            </button>

            <button className="login-big-action secondary" onClick={() => openAuthMode("vet")}>
              <Lock size={28} />
              <strong>Área do Veterinário</strong>
              <span>Acesso interno</span>
            </button>
          </div>
        </section>

      </div>
      {authMode === "register" && (
        <div className="modal-backdrop">
          <form className="auth-modal" onSubmit={submitRegister}>
            <div className="detail-title">
              <div>
                <span className="eyebrow">Cadastro</span>
                <h3>Dados do tutor</h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeAuthMode}>Fechar</button>
            </div>
            <div className="modal-form-grid">
              <Field label="Nome" value={registerData.tutor} onChange={(value) => updateRegisterField("tutor", value)} placeholder="Nome do tutor" />
              <Field label="CPF" value={registerData.cpf} onChange={(value) => updateRegisterField("cpf", value)} placeholder="000.000.000-00" />
              <Field label="Email" value={registerData.email} onChange={(value) => updateRegisterField("email", value)} placeholder="seuemail@exemplo.com" />
              <Field label="Senha" value={registerData.password} onChange={(value) => updateRegisterField("password", value)} placeholder="Minimo 6 caracteres" />
              <Field label="Celular" value={registerData.phone} onChange={(value) => updateRegisterField("phone", value)} placeholder="Digite seu WhatsApp/celular" />
              <Field label="CEP" value={registerData.cep} onChange={lookupRegisterCep} placeholder="00000-000" />
              <Field label="Endereco completo" value={registerData.address} onChange={(value) => updateRegisterField("address", value)} placeholder="Rua, avenida, travessa" />
              <Field label="Numero" value={registerData.number} onChange={(value) => updateRegisterField("number", value)} placeholder="123" />
              <Field label="Bairro" value={registerData.neighborhood} onChange={(value) => updateRegisterField("neighborhood", value)} placeholder="Informe o bairro" />
              <Field label="Cidade" value={registerData.city} onChange={(value) => updateRegisterField("city", value)} placeholder="Cidade" />
              <Field label="UF" value={registerData.state} onChange={(value) => updateRegisterField("state", value)} placeholder="SP" />
            </div>
            {authMessage && <p className="form-error">{authMessage}</p>}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={closeAuthMode}>Cancelar</button>
              <button className="primary-action" type="submit">Criar cadastro</button>
            </div>
          </form>
        </div>
      )}
      {authMode === "vet" && (
        <div className="modal-backdrop">
          <form className="auth-modal compact-auth-modal" onSubmit={submit}>
            <div className="detail-title">
              <div>
                <span className="eyebrow">Acesso interno</span>
                <h3>Área do Veterinário</h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeAuthMode}>Fechar</button>
            </div>
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

function PetWelcomeArt() {
  return (
    <div className="pet-welcome-art" aria-hidden="true">
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
        <span className="eyebrow">Castracao e cuidado animal</span>
        <strong>Solicite castracao com atendimento organizado</strong>
        <p>Tambem conheca a galeria publica de adocao do municipio.</p>
      </div>
    </div>
  );
}

function TutorDashboard({ requests, setActive, currentUser, compact = false }) {
  const next = requests.find((request) => ["AGENDADA", "CONFIRMADA"].includes(request.status));

  return (
    <section className={compact ? "simple-stack" : "content-grid"}>
      {!compact && <div className="hero-panel">
        <div>
          <span className="eyebrow">Area do solicitante</span>
          <h2>Ola, {currentUser.name}. acompanhe protocolos, documentos e agendamentos em um unico lugar.</h2>
          <p>
            O painel prioriza a proxima acao do tutor: enviar pendencias, confirmar presenca, solicitar reagendamento
            ou baixar documentos.
          </p>
        </div>
        <button className="primary-action" onClick={() => setActive("solicitacao")}>
          <Plus size={18} />
          Nova solicitacao
        </button>
      </div>}

      <div className="summary-row">
        <Metric title="Solicitacoes ativas" value={requests.filter((r) => !["REALIZADA", "CANCELADA", "INDEFERIDA"].includes(r.status)).length} icon={ClipboardCheck} />
        <Metric title="Proximo agendamento" value={next ? next.appointment : "Nenhum"} icon={CalendarDays} />
        <Metric title="Notificacoes" value="4" icon={Bell} />
      </div>

      <div className="panel wide">
        <PanelHeader title="Minhas solicitacoes" action="Ver todas" />
        <div className="request-list">
          {requests.length === 0 && (
            <EmptyState
              title="Nenhuma solicitacao cadastrada"
              text="Crie a primeira solicitacao para iniciar os testes do fluxo completo."
              action="Nova solicitacao"
              onAction={() => setActive("solicitacao")}
            />
          )}
          {requests.slice(0, 4).map((request) => (
            <article className="request-card" key={request.id}>
              <div>
                <strong>#{request.protocol}</strong>
                <span>{request.animals.map((animal) => animal.name).join(", ")} - {request.type}</span>
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
  onBack,
  onDone,
  requests = [],
  scheduleDays = publicScheduleDays,
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
      procedure: "",
      coat: "",
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
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const [documentUploads, setDocumentUploads] = useState({});
  const [formStep, setFormStep] = useState(skipTutorStep ? 1 : 0);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [smsCode, setSmsCode] = useState("");
  const [smsInput, setSmsInput] = useState("");
  const [smsConfirmed, setSmsConfirmed] = useState(currentUser.role === "admin" || skipTutorStep);
  const [smsStatus, setSmsStatus] = useState("");
  const [mapsModal, setMapsModal] = useState(false);

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
  const selectedTypeDocuments = (selectedRequestType?.documents || []).filter((document) => document.active !== false);
  const requiredDocsApproved = selectedTypeDocuments
    .filter((document) => document.required)
    .every((document) => ["approved", "attached"].includes(documentUploads[document.id]?.status));
  const requiredIssues = getRequestValidationIssues();
  const canSubmit = requiredIssues.length === 0;
  const formSteps = skipTutorStep
    ? [
        { step: 1, label: "Animal" },
        { step: 2, label: "Documentos" },
      ]
    : [
        { step: 0, label: "Tutor" },
        { step: 1, label: "Animal" },
        { step: 2, label: "Documentos" },
      ];
  const currentStepIndex = Math.max(formSteps.findIndex((item) => item.step === formStep), 0);
  const availableScheduleDays = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const used = requests.filter((request) => request.preferredSchedule === day.date).length;
    return { ...day, used, remaining: Math.max(day.vacancies - used, 0), isPast: isPastScheduleDay(day.date) };
  });
  const scheduleMonths = buildScheduleMonths(availableScheduleDays);
  const activeScheduleMonth = scheduleMonths[scheduleMonthIndex] || "";
  const visibleScheduleDays = availableScheduleDays.filter((day) => {
    const [, month, year] = day.date.split("/");
    return `${month}/${year}` === activeScheduleMonth;
  });

  useEffect(() => {
    const targetMonth = initialSchedule ? getScheduleMonthKey(initialSchedule) : getCurrentScheduleMonthKey();
    setScheduleMonthIndex(Math.max(scheduleMonths.indexOf(targetMonth), 0));
  }, [initialSchedule, scheduleMonths.join("|")]);

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
        procedure: "",
        coat: "",
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
      setSmsStatus("Informe um celular valido antes de enviar o SMS.");
      return;
    }

    const nextCode = String(Math.floor(100000 + Math.random() * 900000));
    setSmsCode(nextCode);
    setSmsInput("");
    setSmsConfirmed(false);
    setSmsStatus(`SMS enviado para ${requestData.phone}. Codigo de teste: ${nextCode}`);
  }

  function confirmSmsCode() {
    if (!smsCode) {
      setSmsStatus("Envie o SMS antes de confirmar.");
      return;
    }

    if (smsInput.trim() !== smsCode) {
      setSmsStatus("Codigo SMS incorreto.");
      return;
    }

    setSmsConfirmed(true);
    setSmsStatus("Celular confirmado por SMS.");
  }

  function getRequestValidationIssues() {
    const issues = [];
    const cleanCpf = requestData.cpf.replace(/\D/g, "");
    const cleanPhone = requestData.phone.replace(/\D/g, "");
    const cleanCep = requestData.cep.replace(/\D/g, "");
    const filledAnimals = animals.length > 0 ? animals : [{}];

    if (!requestData.tutor.trim()) issues.push("Informe o nome do tutor.");
    if (cleanCpf.length !== 11) issues.push("Informe um CPF valido.");
    if (!requestData.email.trim() || !requestData.email.includes("@")) issues.push("Informe um email valido.");
    if (cleanPhone.length < 10) issues.push("Informe um celular valido.");
    if (!smsConfirmed) issues.push("Confirme o codigo SMS recebido no celular cadastrado.");
    if (cleanCep.length !== 8) issues.push("Informe um CEP valido.");
    if (!requestData.address.trim()) issues.push("Informe o endereco.");
    if (!requestData.number.trim()) issues.push("Informe o numero.");
    if (!requestData.neighborhood.trim()) issues.push("Informe o bairro.");
    if (!requestData.city.trim()) issues.push("Informe a cidade.");
    if (requestData.state.trim().length !== 2) issues.push("Informe a UF.");
    if (!requestData.schedule) issues.push("Escolha uma data disponivel.");
    if (!selectedRequestType) issues.push("Selecione o tipo de solicitacao.");
    filledAnimals.forEach((animal, index) => {
      const label = filledAnimals.length > 1 ? ` do animal ${index + 1}` : " do animal";
      if (!animal.name?.trim()) issues.push(`Informe o nome${label}.`);
      if (!animal.age?.trim()) issues.push(`Informe a idade aproximada${label}.`);
      if (!animal.procedure) issues.push(`Selecione o procedimento${label}.`);
      if (!animal.species) issues.push(`Selecione a especie${label}.`);
      if (!animal.sex) issues.push(`Selecione o sexo${label}.`);
      if (!animal.size) issues.push(`Selecione o porte${label}.`);
      if (!animal.breedType) issues.push(`Informe se a raca e definida ou indefinida${label}.`);
    });
    if (!requiredDocsApproved) issues.push("Anexe os documentos obrigatorios.");
    if (!accepted) issues.push("Aceite a declaracao para enviar.");

    return issues;
  }

  function getStepIssues(step = formStep) {
    const cleanCpf = requestData.cpf.replace(/\D/g, "");
    const cleanPhone = requestData.phone.replace(/\D/g, "");
    const cleanCep = requestData.cep.replace(/\D/g, "");

    if (step === 0) {
      return [
        !requestData.tutor.trim(),
        cleanCpf.length !== 11,
        !requestData.email.trim() || !requestData.email.includes("@"),
        cleanPhone.length < 10,
        !smsConfirmed,
        cleanCep.length !== 8,
        !requestData.address.trim(),
        !requestData.number.trim(),
        !requestData.neighborhood.trim(),
        !requestData.city.trim(),
        requestData.state.trim().length !== 2,
      ].filter(Boolean);
    }

    if (step === 1) {
      return animals
        .flatMap((animal) => [
          !animal.name?.trim(),
          !animal.age?.trim(),
          !animal.procedure,
          !animal.species,
          !animal.sex,
          !animal.size,
          !animal.breedType,
        ])
        .filter(Boolean);
    }

    if (step === 2) {
      return [!requestData.schedule, !selectedRequestType, !requiredDocsApproved, !accepted].filter(Boolean);
    }

    return [];
  }

  function showInvalid(field) {
    if (!submitAttempted) return false;
    const cleanCpf = requestData.cpf.replace(/\D/g, "");
    const cleanPhone = requestData.phone.replace(/\D/g, "");
    const cleanCep = requestData.cep.replace(/\D/g, "");
    const firstAnimal = animals[0] || {};
    const checks = {
      tutor: !requestData.tutor.trim(),
      cpf: cleanCpf.length !== 11,
      email: !requestData.email.trim() || !requestData.email.includes("@"),
      phone: cleanPhone.length < 10 || !smsConfirmed,
      sms: !smsConfirmed,
      cep: cleanCep.length !== 8,
      address: !requestData.address.trim(),
      number: !requestData.number.trim(),
      neighborhood: !requestData.neighborhood.trim(),
      city: !requestData.city.trim(),
      state: requestData.state.trim().length !== 2,
      animalName: !firstAnimal.name?.trim(),
      animalAge: !firstAnimal.age?.trim(),
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
      setLocationStatus("Localizacao atual indisponivel neste navegador.");
      return;
    }

    setLocationStatus("Solicitando localizacao atual...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRequestData((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocationStatus("Localizacao atual registrada.");
      },
      () => setLocationStatus("Nao foi possivel obter a localizacao atual."),
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

    setCepStatus("Buscando endereco...");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepStatus("CEP nao encontrado.");
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
      setCepStatus("Endereco preenchido pelo CEP.");
    } catch {
      setCepStatus("Nao foi possivel buscar o CEP agora.");
    }
  }

  async function handleDocumentFile(document, file) {
    if (!file) return;

    setDocumentUploads((current) => ({
      ...current,
      [document.id]: {
        fileName: file.name,
        status: "checking",
        message: aiSettings.active ? "IA analisando legibilidade e regras do documento..." : "Arquivo anexado sem analise de IA...",
      },
    }));

    const [result, dataUrl] = await Promise.all([validateDocumentWithAI(document, file, aiSettings), readFileAsDataUrl(file)]);
    setDocumentUploads((current) => ({
      ...current,
      [document.id]: {
        documentId: document.id,
        documentName: document.name,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        dataUrl,
        ...result,
      },
    }));
  }

  function removeDocumentFile(documentId) {
    setDocumentUploads((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
  }

  function submit() {
    setSubmitAttempted(true);
    if (!canSubmit) return;

    const selectedScheduleDay = scheduleDays.find((day) => day.date === requestData.schedule);
    const uploadedDocuments = selectedTypeDocuments
      .map((document) => documentUploads[document.id])
      .filter(Boolean);
    const newRequest = createRequest({
      tutor: requestData.tutor || currentUser.name,
      neighborhood: requestData.neighborhood || "Bairro nao informado",
      address:
        [requestData.address, requestData.number, requestData.neighborhood, requestData.city, requestData.state]
          .filter(Boolean)
          .join(", ") || "Endereco nao informado",
      type: requestData.type,
      requestTypeId: selectedRequestType?.id || "",
      fee: selectedRequestType?.fee || "",
      phone: requestData.phone || "(nao informado)",
      cpf: requestData.cpf || "***.***.***-**",
      email: requestData.email || "",
      cep: requestData.cep || "",
      preferredSchedule: requestData.schedule || "",
      scheduleLocationName: selectedScheduleDay?.locationName || "",
      latitude: requestData.latitude || selectedScheduleDay?.latitude || "",
      longitude: requestData.longitude || selectedScheduleDay?.longitude || "",
      animals: animals.map((animal, index) => ({
        ...animal,
        name: animal.name || `Animal ${index + 1}`,
        age: animal.age || "Idade nao informada",
      })),
      documents: uploadedDocuments,
    });
    generateRequestPdf(newRequest);
    onDone?.(newRequest);
  }

  return (
    <section className={compact ? "simple-stack" : "content-grid"}>
      <div className="panel wide">
        <div className="simple-form-header">
          <div>
            <span className="eyebrow">Nova solicitacao</span>
            <h2>Informe os dados principais</h2>
            <p>Preencha o que souber. A equipe pode pedir complementos depois.</p>
          </div>
        </div>

        <div className="request-context-bar">
          <div className="selected-schedule-note compact-context">
            <CalendarDays size={18} />
            <div>
              <strong>{requestData.schedule || "Nenhuma data selecionada"}</strong>
              <span>Data escolhida na agenda</span>
            </div>
          </div>
          {configuredRequestTypes.length === 0 ? (
            <div className="document-config-note">
              <Settings size={18} />
              <span>Nenhum tipo de solicitacao configurado.</span>
            </div>
          ) : (
            <div className="selected-schedule-note compact-context request-type-summary">
              <FileText size={18} />
              <div>
                <strong>{requestData.type || "Tipo nao selecionado"}</strong>
                <span>Tipo escolhido na agenda</span>
              </div>
            </div>
          )}
        </div>

        <div className="request-stepper" aria-label="Etapas da solicitacao">
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

        <div className="single-request-form clean-form">
          {formStep === 0 && <FormSection title="Tutor e endereco">
            <Field
              label="Nome"
              value={requestData.tutor}
              onChange={(value) => updateRequestField("tutor", value)}
              placeholder="Nome do tutor ou responsavel"
              invalid={showInvalid("tutor")}
            />
            <Field
              label="CPF"
              value={requestData.cpf}
              onChange={(value) => updateMaskedRequestField("cpf", value)}
              placeholder="000.000.000-00"
              invalid={showInvalid("cpf")}
            />
            <Field
              label="Email"
              value={requestData.email}
              onChange={(value) => updateRequestField("email", value)}
              placeholder="seuemail@exemplo.com"
              invalid={showInvalid("email")}
            />
            <div className="phone-validation-row">
              <Field
                label="Celular"
                value={requestData.phone}
                onChange={(value) => updateMaskedRequestField("phone", value)}
                placeholder="Digite seu WhatsApp/celular"
                invalid={showInvalid("phone")}
              />
              {!smsCode && !smsConfirmed && (
                <button className="secondary-action" type="button" onClick={sendSmsCode}>
                  Validar contato
                </button>
              )}
              {(smsCode || smsConfirmed) && (
                <>
                  <label className={showInvalid("sms") ? "field sms-code-field invalid" : "field sms-code-field"}>
                    <span>Codigo SMS</span>
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
            {smsStatus && <p className={smsConfirmed ? "sms-status confirmed" : "sms-status"}>{smsStatus}</p>}
            <div className="form-subsection-title">Endereco</div>
            <div className="address-lookup-grid">
              <div className="cep-with-map">
                <Field
                  label="CEP"
                  value={requestData.cep}
                  onChange={lookupCep}
                  placeholder="00000-000"
                  invalid={showInvalid("cep")}
                />
                <button className="icon-button map-lookup-button" type="button" onClick={() => setMapsModal(true)} aria-label="Buscar endereco no mapa" title="Buscar endereco no mapa">
                  <MapPin size={18} />
                </button>
              </div>
              <Field
                label="Numero"
                value={requestData.number}
                onChange={(value) => updateRequestField("number", value)}
                placeholder="123"
                invalid={showInvalid("number")}
              />
            </div>
            {cepStatus && <p className="cep-status">{cepStatus}</p>}
            <Field
              label="Endereco completo"
              value={requestData.address}
              onChange={(value) => updateRequestField("address", value)}
              placeholder="Rua, numero, complemento"
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
              <p className="map-selected-place">Localizacao atual registrada: {requestData.latitude}, {requestData.longitude}.</p>
            )}
            {locationStatus && <p className="cep-status">{locationStatus}</p>}
          </FormSection>}

          {false && <FormSection title="Servico e data escolhida">
            {configuredRequestTypes.length === 0 ? (
              <div className="document-config-note">
                <Settings size={18} />
                <span>Nenhum tipo de solicitacao foi configurado pelo servidor ainda.</span>
              </div>
            ) : (
              <label className="field">
                <span>Tipo de solicitacao</span>
                <select value={requestData.type} onChange={(event) => updateRequestField("type", event.target.value)}>
                  <option value="">Selecione</option>
                  {configuredRequestTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(
            <div className="selected-schedule-note">
                <CalendarDays size={18} />
                <div>
                  <strong>{requestData.schedule || "Nenhuma data selecionada"}</strong>
                  <span>Confirme uma data disponivel para seguir com o cadastro.</span>
                </div>
              </div>
            )}
            <div className="public-schedule-note">
              <CalendarDays size={18} />
              <span>Escolha uma data disponivel. Cada solicitacao reduz as vagas do dia.</span>
            </div>
            <div className="calendar-month-header">
              <button
                type="button"
                onClick={() => setScheduleMonthIndex((current) => Math.max(current - 1, 0))}
                disabled={scheduleMonthIndex === 0}
                aria-label="Mes anterior"
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
                aria-label="Proximo mes"
              >
                ›
              </button>
            </div>
            <div className="calendar-availability" aria-label="Calendario de vagas disponiveis">
              {visibleScheduleDays.length === 0 && (
                <div className="calendar-empty-month">Nenhuma data configurada para {formatMonthYear(activeScheduleMonth)}.</div>
              )}
              {visibleScheduleDays.map((day) => (
                <button
                  key={day.date}
                  className={requestData.schedule === day.date ? "calendar-day-button selected" : "calendar-day-button"}
                  onClick={() => updateRequestField("schedule", day.date)}
                  disabled={day.remaining === 0 || day.isPast}
                  type="button"
                >
                  <span>{day.weekday}</span>
                  <strong>{day.date.slice(0, 5)}</strong>
                  <small>{day.isPast ? "Passado" : day.remaining > 0 ? `${day.remaining} vagas` : "Lotado"}</small>
                </button>
              ))}
            </div>
            <p className="helper-text">A equipe confirma a vaga apos triagem dos dados.</p>
          </FormSection>}

          {formStep === 1 && <FormSection title="Dados dos animais">
            {animals.map((animal, index) => (
              <div className="animal-form" key={`animal-${index}`}>
                <strong>Animal {index + 1}</strong>
                <div className="animal-main-grid">
                  <Field
                    label="Nome"
                    value={animal.name}
                    onChange={(value) => updateAnimal(index, "name", value)}
                    placeholder="Nome do animal"
                    invalid={submitAttempted && !animal.name?.trim()}
                  />
                  <Field
                    label="Idade aproximada"
                    value={animal.age}
                    onChange={(value) => updateAnimal(index, "age", value)}
                    placeholder="Ex: 2 anos, 8 meses"
                    invalid={submitAttempted && !animal.age?.trim()}
                  />
                  <Field
                    label="Cor da pelagem"
                    value={animal.coat}
                    onChange={(value) => updateAnimal(index, "coat", value)}
                    placeholder="Ex: preto, caramelo"
                  />
                  <Field
                    label="Microchip"
                    value={animal.microchip}
                    onChange={(value) => updateAnimal(index, "microchip", value)}
                    placeholder="Se ja possuir"
                  />
                </div>
                <SegmentedControl
                  label="Procedimento"
                  value={animal.procedure}
                  options={["Castracao", "Microchipagem", "Ambos"]}
                  onChange={(value) => updateAnimal(index, "procedure", value)}
                  invalid={submitAttempted && !animal.procedure}
                />
                <div className="choice-card">
                  <strong>Caracteristicas</strong>
                  <div className="animal-choice-grid">
                    <CompactChoiceField
                      label="Especie"
                      value={animal.species}
                      options={activeSpecies}
                      onChange={(value) => updateAnimal(index, "species", value)}
                      invalid={submitAttempted && !animal.species}
                    />
                    <CompactChoiceField
                      label="Sexo"
                      value={animal.sex}
                      options={["Macho", "Femea"]}
                      onChange={(value) => updateAnimal(index, "sex", value)}
                      invalid={submitAttempted && !animal.sex}
                    />
                    <CompactChoiceField
                      label="Porte"
                      value={animal.size}
                      options={activeSizes.map((size) => ({ label: size.name, title: size.description }))}
                      onChange={(value) => updateAnimal(index, "size", value)}
                      invalid={submitAttempted && !animal.size}
                    />
                    <CompactChoiceField
                      label="Raca"
                      value={animal.breedType}
                      options={["Indefinida", "Definida"]}
                      onChange={(value) => updateAnimal(index, "breedType", value)}
                      invalid={submitAttempted && !animal.breedType}
                    />
                  </div>
                </div>
                {animal.breedType === "Definida" && (
                  <Field
                    label="Descreva a raca"
                    value={animal.breedDescription}
                    onChange={(value) => updateAnimal(index, "breedDescription", value)}
                    placeholder="Ex: Poodle, Siamês"
                  />
                )}
                <div className="health-card">
                  <strong>Saude e cuidados</strong>
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
                    label="Ja teve cria?"
                    value={animal.hadLitter}
                    onChange={(value) => updateAnimal(index, "hadLitter", value)}
                  />
                  <YesNoField
                    label="Historico de doencas?"
                    value={animal.illnessHistory}
                    onChange={(value) => updateAnimal(index, "illnessHistory", value)}
                  />
                  <CompactChoiceField
                    label="Alimentacao"
                    value={animal.food}
                    options={["Racao", "Diversos"]}
                    onChange={(value) => updateAnimal(index, "food", value)}
                  />
                  </div>
                </div>
              </div>
            ))}
            <button className="secondary-action" onClick={addAnimal}>
              <Plus size={18} />
              Adicionar outro animal
            </button>
          </FormSection>}

          {formStep === 2 && <FormSection title="Documentos comprobatorios">
            <div className="document-upload-list">
              {!selectedRequestType && (
                <EmptyState
                  title="Selecione um tipo de solicitacao"
                  text="Os documentos exigidos aparecem aqui somente apos o admin configurar e o tutor selecionar o tipo."
                />
              )}
              {selectedTypeDocuments.map((document) => {
                const upload = documentUploads[document.id];
                return (
                  <div className="document-upload-card" key={document.id}>
                    <div className="document-upload-title">
                      <strong>
                        {document.name} {document.required && <span>*</span>}
                      </strong>
                      {upload?.fileName && <small>{upload.fileName}</small>}
                    </div>
                    <div className="document-upload-actions">
                      <label className="file-button">
                        Anexar
                        <input
                          type="file"
                          accept={document.accept.join(",")}
                          onChange={(event) => handleDocumentFile(document, event.target.files?.[0])}
                        />
                      </label>
                      {upload && (
                        <button className="ghost-button danger-action" type="button" onClick={() => removeDocumentFile(document.id)}>
                          Excluir
                        </button>
                      )}
                    </div>
                    {aiSettings.active && upload?.status === "checking" && (
                      <div className="document-ai-result checking">
                        <strong>IA analisando documento</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="declaration-box">
              <FileText size={20} />
              <p>
                O tutor declara ciencia dos cuidados pre e pos-cirurgicos, responsabilidades de acompanhamento e
                autorizacao para registro do procedimento.
              </p>
            </div>
            <label className={showInvalid("accepted") ? "checkbox-row invalid" : "checkbox-row"}>
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              Li e aceito a declaracao pos-cirurgica.
            </label>
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
              onClick={goToNextStep}
              disabled={formStep === 0 && !smsConfirmed}
              title={formStep === 0 && !smsConfirmed ? "Confirme o codigo SMS para continuar" : ""}
            >
              Continuar
            </button>
          ) : (
            <button className="primary-action nav-next-action" type="button" disabled={!canSubmit} onClick={submit}>
              Encerrar
            </button>
          )}
        </div>
      </div>
      {mapsModal && (
        <MapsLocationModal
          title="Buscar endereco no mapa"
          initialLocation={{ latitude: requestData.latitude, longitude: requestData.longitude, locationName: requestData.address }}
          onClose={() => setMapsModal(false)}
          onConfirm={(place) => {
            setRequestData((current) => ({
              ...current,
              address: place.address || place.locationName || current.address,
              neighborhood: place.neighborhood || current.neighborhood,
              city: place.city || current.city,
              state: stateToUf(place.state) || current.state,
              cep: place.cep ? formatCep(place.cep) : current.cep,
              latitude: place.latitude,
              longitude: place.longitude,
            }));
            setLocationStatus("Endereco preenchido pela localizacao selecionada.");
            setMapsModal(false);
          }}
        />
      )}
      {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />}
    </section>
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
  const isImage = document.fileType?.startsWith("image/");
  const isPdf = document.fileType === "application/pdf";

  return (
    <div className="modal-backdrop">
      <div className="document-preview-modal" role="dialog" aria-modal="true">
        <div className="detail-title modal-title">
          <div>
            <span className="eyebrow">Anexo</span>
            <h2>{document.documentName || document.fileName}</h2>
            <span>{document.fileName}</span>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="document-preview-frame">
          {isImage && <img src={document.dataUrl} alt={document.documentName || document.fileName} />}
          {isPdf && <iframe title={document.fileName} src={document.dataUrl} />}
          {!isImage && !isPdf && (
            <EmptyState title="Previa indisponivel" text="Este tipo de arquivo foi anexado, mas nao possui previa no navegador." />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ requests, setSelectedId, currentUser, updateStatus, patchRequest, scheduleDays = publicScheduleDays, teams = initialTeams }) {
  const [requestFilter, setRequestFilter] = useState("assignment");
  const [previewRequest, setPreviewRequest] = useState(null);
  const [assignRequest, setAssignRequest] = useState(null);
  const [rescheduleRequest, setRescheduleRequest] = useState(null);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [assignment, setAssignment] = useState({ sectorId: "", userId: "" });
  const [rejectData, setRejectData] = useState({ reason: "", note: "" });

  const archivedStatuses = ["DEFERIDA", "INDEFERIDA", "CANCELADA", "REALIZADA"];
  const filterTabs = [
    { id: "assignment", label: "Aguard. atribuicao", requests: requests.filter((request) => request.status === "AGUARDANDO_ATRIBUIR") },
    { id: "triage", label: "Em triagem", requests: requests.filter((request) => request.status === "TRIAGEM" || request.status === "PENDENCIA_DOCUMENTAL") },
    { id: "analysis", label: "Em analise", requests: requests.filter((request) => request.status === "EM_ANALISE") },
    { id: "rescheduled", label: "Reagendadas", requests: requests.filter((request) => request.status === "REAGENDADA" || request.status === "REAGENDAMENTO_SOLICITADO") },
    { id: "archived", label: "Arquivadas", requests: requests.filter((request) => archivedStatuses.includes(request.status)) },
    { id: "all", label: "Todas", requests },
  ];
  const activeTab = filterTabs.find((tab) => tab.id === requestFilter) || filterTabs[0];
  const activeScheduleDays = scheduleDays.filter((day) => day.active !== false && !isPastScheduleDay(day.date));
  const activeUsers = teams.users?.filter((user) => user.active !== false) || [];
  const activeSectors = teams.sectors?.filter((sector) => sector.active !== false) || [];

  function assumeRequest(request) {
    patchRequest?.(
      request.id,
      { status: "TRIAGEM", responsible: currentUser.name, assignedUserId: currentUser.email, assignedSectorName: "Triagem" },
      `Solicitacao assumida por ${currentUser.name} para triagem`,
    );
  }

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
        status: "TRIAGEM",
        assignedSectorId: sector?.id || "",
        assignedSectorName: sector?.name || "Nao informado",
        assignedUserId: user?.id || "",
        responsible: user?.name || sector?.name || "Equipe",
      },
      `Atribuida para ${sector?.name || "setor"}${user ? ` / ${user.name}` : ""}`,
    );
    setAssignRequest(null);
  }

  function completeTriage(request) {
    patchRequest?.(request.id, { status: "EM_ANALISE" }, `Triagem concluida por ${currentUser.name}. Encaminhada para analise.`);
  }

  function approveRequest(request) {
    patchRequest?.(request.id, { status: "DEFERIDA", archiveReason: "Aprovada" }, `Solicitacao aprovada por ${currentUser.name}`);
    setPreviewRequest(null);
  }

  function openReject(request) {
    setRejectRequest(request);
    setRejectData({ reason: "", note: "" });
  }

  function confirmReject(event) {
    event.preventDefault();
    if (!rejectRequest || !rejectData.reason.trim()) return;
    patchRequest?.(
      rejectRequest.id,
      {
        status: "INDEFERIDA",
        rejectionReason: rejectData.reason.trim(),
        rejectionNote: rejectData.note.trim(),
        archiveReason: "Reprovada",
      },
      `Reprovada por ${currentUser.name}. Motivo: ${rejectData.reason.trim()}`,
    );
    setRejectRequest(null);
    setPreviewRequest(null);
  }

  function confirmReschedule(date) {
    if (!rescheduleRequest) return;
    patchRequest?.(
      rescheduleRequest.id,
      {
        status: "REAGENDADA",
        previousSchedule: rescheduleRequest.preferredSchedule || rescheduleRequest.appointment || "Nao informado",
        preferredSchedule: date,
        appointment: date,
      },
      `Reagendada por ${currentUser.name}: ${rescheduleRequest.preferredSchedule || "sem data"} -> ${date}`,
    );
    setRescheduleRequest(null);
  }

  return (
    <section className="request-workspace triage-workspace">
      <div className="workspace-heading">
        <div>
          <h2>Solicitacoes de castracao</h2>
          <p>Fila operacional com triagem, atribuicao, analise, reagendamento e arquivo.</p>
        </div>
        <div className="toolbar">
          <div className="search-box"><Search size={16} /><span>Protocolo, CPF, tutor...</span></div>
        </div>
      </div>

      <div className="request-filter-tabs">
        {filterTabs.map((tab) => (
          <button key={tab.id} type="button" className={requestFilter === tab.id ? "selected" : ""} onClick={() => setRequestFilter(tab.id)}>
            {tab.label}<span>{tab.requests.length}</span>
          </button>
        ))}
      </div>

      <div className="triage-card-grid">
        {activeTab.requests.length === 0 && <EmptyState title="Nenhuma solicitacao nesta etapa" text="Quando houver registros, eles aparecerao aqui em cards responsivos." />}
        {activeTab.requests.map((request) => (
          <article className="triage-card" key={request.id}>
            <div className="triage-card-top">
              <div><span className="eyebrow">#{request.protocol}</span><h3>{request.tutor}</h3></div>
              <StatusBadge status={request.status} />
            </div>
            <div className="triage-meta-grid">
              <Info label="Tipo" value={request.type || "Castracao"} />
              <Info label="Data" value={request.preferredSchedule || request.appointment || "Aguardando"} />
              <Info label="Responsavel" value={request.responsible || "Nao atribuido"} />
              <Info label="Setor" value={request.assignedSectorName || "Sem setor"} />
            </div>
            {request.status === "REAGENDADA" && <p className="helper-text">Antes: {request.previousSchedule || "Nao informado"} | Nova: {request.preferredSchedule}</p>}
            {request.rejectionReason && <p className="form-error">Justificativa: {request.rejectionReason}</p>}
            <div className="animal-line compact-animal-line"><PawPrint size={16} /><span>{request.animals.map((animal) => animal.name).join(", ") || "Animal nao informado"}</span></div>
            <div className="triage-actions">
              <button className="ghost-button" type="button" onClick={() => { setSelectedId?.(request.id); setPreviewRequest(request); }}>Visualizar</button>
              {request.status === "AGUARDANDO_ATRIBUIR" && <button className="secondary-action" type="button" onClick={() => assumeRequest(request)}>Assumir</button>}
              {!["DEFERIDA", "INDEFERIDA", "REALIZADA", "CANCELADA"].includes(request.status) && <button className="secondary-action" type="button" onClick={() => openAssign(request)}>Atribuir</button>}
              {request.status === "TRIAGEM" && <button className="primary-action" type="button" onClick={() => completeTriage(request)}>Enviar para analise</button>}
              {!["INDEFERIDA", "REALIZADA", "CANCELADA"].includes(request.status) && <button className="ghost-button" type="button" onClick={() => setRescheduleRequest(request)}>Reagendar</button>}
            </div>
          </article>
        ))}
      </div>

      {previewRequest && (
        <RequestPreviewModal request={previewRequest} onClose={() => setPreviewRequest(null)} onApprove={approveRequest} onReject={openReject} />
      )}

      {assignRequest && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={confirmAssign}>
            <div className="detail-title"><div><span className="eyebrow">Atribuir</span><h3>Setor e usuario</h3></div><button className="ghost-button" type="button" onClick={() => setAssignRequest(null)}>Fechar</button></div>
            <label className="field"><span>Setor</span><select value={assignment.sectorId} onChange={(event) => setAssignment((current) => ({ ...current, sectorId: event.target.value, userId: "" }))}>{activeSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></label>
            <label className="field"><span>Usuario</span><select value={assignment.userId} onChange={(event) => setAssignment((current) => ({ ...current, userId: event.target.value }))}><option value="">Somente setor</option>{activeUsers.filter((user) => !assignment.sectorId || user.sectorId === assignment.sectorId).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            <button className="primary-action" type="submit">Confirmar atribuicao</button>
          </form>
        </div>
      )}

      {rescheduleRequest && (
        <div className="modal-backdrop">
          <div className="workflow-modal wide-workflow-modal">
            <div className="detail-title"><div><span className="eyebrow">Reagendar</span><h3>Escolha nova data</h3></div><button className="ghost-button" type="button" onClick={() => setRescheduleRequest(null)}>Fechar</button></div>
            <div className="reschedule-grid">{activeScheduleDays.map((day) => <button key={day.date} className="calendar-day-button" type="button" disabled={day.remaining <= 0} onClick={() => confirmReschedule(day.date)}><span>{day.weekday}</span><strong>{day.date}</strong><small>{day.remaining} vagas</small></button>)}</div>
          </div>
        </div>
      )}

      {rejectRequest && (
        <div className="modal-backdrop">
          <form className="workflow-modal" onSubmit={confirmReject}>
            <div className="detail-title"><div><span className="eyebrow">Reprovar</span><h3>Justificativa obrigatoria</h3></div><button className="ghost-button" type="button" onClick={() => setRejectRequest(null)}>Fechar</button></div>
            <label className="field"><span>Motivo</span><select value={rejectData.reason} onChange={(event) => setRejectData((current) => ({ ...current, reason: event.target.value }))}><option value="">Selecione</option><option>Documento ilegivel</option><option>Dados incompletos</option><option>CPF/documento divergente</option><option>Endereco fora da area atendida</option><option>Animal fora dos criterios</option><option>Tutor nao respondeu</option><option>Outro</option></select></label>
            <label className="field"><span>Observacao interna</span><textarea value={rejectData.note} onChange={(event) => setRejectData((current) => ({ ...current, note: event.target.value }))} /></label>
            <button className="primary-action" type="submit" disabled={!rejectData.reason}>Confirmar reprovação</button>
          </form>
        </div>
      )}
    </section>
  );
}

function RequestPreviewModal({ request, onClose, onApprove, onReject }) {
  const [previewDocument, setPreviewDocument] = useState(null);
  return (
    <div className="modal-backdrop">
      <div className="request-preview-modal" role="dialog" aria-modal="true">
        <div className="detail-title"><div><span className="eyebrow">Solicitacao #{request.protocol}</span><h2>{request.tutor}</h2><span>{request.address}</span></div><button className="ghost-button" type="button" onClick={onClose}>Fechar</button></div>
        <div className="compact-grid"><Info label="CPF" value={request.cpf || "Nao informado"} /><Info label="Telefone" value={request.phone || "Nao informado"} /><Info label="Data" value={request.preferredSchedule || "Aguardando"} /><Info label="Status" value={statusLabels[request.status]} /></div>
        <div><h3>Animais</h3>{request.animals.map((animal, index) => <div className="animal-line" key={`${animal.name}-${index}`}><PawPrint size={18} /><span><strong>{animal.name}</strong> - {animal.species}, {animal.sex}, {animal.size}, {animal.age}</span></div>)}</div>
        <div><h3>Anexos</h3><div className="attachment-list">{(!Array.isArray(request.documents) || request.documents.length === 0) && <EmptyState title="Nenhum anexo" text="Sem documentos enviados." />}{Array.isArray(request.documents) && request.documents.map((item, index) => { const document = typeof item === "string" ? { documentName: item, fileName: "Anexo legado", dataUrl: "" } : item; return <article className="attachment-card" key={`${document.fileName}-${index}`}><FileText size={20} /><div><strong>{document.documentName || document.fileName}</strong><span>{document.fileName}</span></div><button className="ghost-button" type="button" disabled={!document.dataUrl} onClick={() => setPreviewDocument(document)}>Ver</button>{document.dataUrl && <a className="secondary-action" href={document.dataUrl} download={document.fileName}>Baixar</a>}</article>; })}</div></div>
        {request.status === "EM_ANALISE" && <div className="analysis-actions"><button className="primary-action" type="button" onClick={() => onApprove(request)}>Aprovar</button><button className="secondary-action danger-action" type="button" onClick={() => onReject(request)}>Reprovar</button></div>}
        <ol className="timeline">{request.history.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
        {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />}
      </div>
    </div>
  );
}
function ScheduleView({
  requests,
  createRequest,
  currentUser,
  scheduleDays = publicScheduleDays,
  requestTypes = initialRequestTypes,
  aiSettings = initialAiSettings,
  speciesOptions = initialSpecies,
  sizeOptions = initialSizes,
  municipalities = initialMunicipalities,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const scheduled = requests.filter((request) => request.appointment || request.preferredSchedule);
  const scheduleWithUsage = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const used = requests.filter((request) => request.preferredSchedule === day.date).length;
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
        <PanelHeader title="Agenda disponivel" />
        <div className="agenda-main-layout">
          <div>
        <div className="calendar-month-header admin-month-filter">
          <button
            type="button"
            onClick={() => setScheduleMonthIndex((current) => Math.max(current - 1, 0))}
            disabled={scheduleMonthIndex === 0}
            aria-label="Mes anterior"
          >
            â€¹
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
            aria-label="Proximo mes"
          >
            â€º
          </button>
        </div>
        <div className="admin-calendar-grid">
          {visibleScheduleDays.length === 0 && (
            <div className="calendar-empty-month">Nenhuma data configurada para {formatMonthYear(activeScheduleMonth)}.</div>
          )}
          {visibleScheduleDays.map((day) => (
            <button
              className={`${day.remaining === 0 || day.isPast ? "admin-calendar-day full" : "admin-calendar-day"} ${day.kind === "Mutirao" ? "mutirao-day" : ""}`}
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
              {day.kind === "Mutirao" && <em>Mutirao</em>}
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
              text="Ao criar uma solicitacao pela agenda, a data selecionada aparecera vinculada ao cadastro."
            />
          )}
          {scheduled.map((request) => (
            <article className="request-card" key={request.id}>
              <span>{request.appointment || request.preferredSchedule}</span>
              <strong>{request.tutor}</strong>
              <span>{request.animals[0].name} - {request.animals[0].procedure}</span>
              <StatusBadge status={request.status} />
            </article>
          ))}
        </div>
      </div>

      {selectedDay && (
        <div className="modal-backdrop">
          <div className="request-modal">
            <div className="detail-title modal-title">
              <div>
                <span className="eyebrow">Agenda {selectedDay.date}</span>
                <h2>Criar solicitacao presencial</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setSelectedDay(null)}>
                Fechar
              </button>
            </div>
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
  sizeOptions = initialSizes,
}) {
  const activeSpecies = speciesOptions.filter((item) => item.active !== false).map((item) => item.name);
  const activeSizes = sizeOptions.filter((item) => item.active !== false);
  const emptyAnimalForm = {
    name: "",
    species: "",
    sex: "",
    age: "",
    size: "",
    health: "",
    tone: "",
    photos: [],
    mainPhotoIndex: 0,
  };
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [animalForm, setAnimalForm] = useState(emptyAnimalForm);
  const [formError, setFormError] = useState("");
  const [adoptionTab, setAdoptionTab] = useState("available");
  const [editingAnimalId, setEditingAnimalId] = useState(null);
  const canManageAdoptions = currentUser.role === "admin";
  const availableAnimals = adoptionAnimals.filter((animal) => animal.status !== "Adotado");
  const adoptedAnimals = adoptionAnimals.filter((animal) => animal.status === "Adotado");
  const displayedAnimals = canManageAdoptions && adoptionTab === "adopted" ? adoptedAnimals : availableAnimals;

  function getAnimalKey(animal) {
    return animal.id || animal.name;
  }

  function updateAnimalForm(field, value) {
    setAnimalForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  }

  function openAnimalForm() {
    setEditingAnimalId(null);
    setAnimalForm(emptyAnimalForm);
    setFormError("");
    setIsFormOpen(true);
  }

  function closeAnimalForm() {
    setEditingAnimalId(null);
    setAnimalForm(emptyAnimalForm);
    setFormError("");
    setIsFormOpen(false);
  }

  function editAnimal(animal) {
    setEditingAnimalId(getAnimalKey(animal));
    setAnimalForm({
      name: animal.name || "",
      species: animal.species || "",
      sex: animal.sex || "",
      age: animal.age || "",
      size: animal.size || "",
      health: Array.isArray(animal.health) ? animal.health.join(", ") : animal.health || "",
      tone: animal.tone || "",
      photos: getAnimalPhotos(animal),
      mainPhotoIndex: animal.mainPhotoIndex || 0,
    });
    setFormError("");
    setIsFormOpen(true);
  }

  function handlePhotoChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (files.some((file) => !file.type.startsWith("image/"))) {
      setFormError("Envie uma foto em formato de imagem.");
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

  function publishAnimal(event) {
    event.preventDefault();

    if (
      !animalForm.name.trim() ||
      !animalForm.age.trim() ||
      !animalForm.species ||
      !animalForm.sex ||
      !animalForm.size ||
      !animalForm.tone.trim()
    ) {
      setFormError("Preencha nome, idade, especie, sexo, porte e descricao antes de publicar.");
      return;
    }

    const next = {
      id: editingAnimalId || Date.now(),
      name: animalForm.name.trim(),
      species: animalForm.species,
      sex: animalForm.sex,
      age: animalForm.age.trim(),
      size: animalForm.size,
      status: "Disponivel",
      health: animalForm.health
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      tone: animalForm.tone.trim(),
      photos: animalForm.photos,
      mainPhotoIndex: animalForm.mainPhotoIndex,
      gradient: ["photo-teal", "photo-sky", "photo-rose"][adoptionAnimals.length % 3],
    };

    if (next.health.length === 0) {
      next.health = ["Cadastro conferido"];
    }

    if (editingAnimalId) {
      setAdoptionAnimals((current) =>
        current.map((item) =>
          getAnimalKey(item) === editingAnimalId
            ? {
                ...item,
                ...next,
                id: item.id || next.id,
                status: item.status || next.status,
                adoptedAt: item.adoptedAt,
                gradient: item.gradient || next.gradient,
              }
            : item,
        ),
      );
    } else {
      setAdoptionAnimals((current) => [next, ...current]);
    }

    closeAnimalForm();
  }

  function updateAnimalStatus(animal, status) {
    setAdoptionAnimals((current) =>
      current.map((item) =>
        getAnimalKey(item) === getAnimalKey(animal)
          ? {
              ...item,
              status,
              adoptedAt: status === "Adotado" ? "25/04/2026" : "",
            }
          : item,
      ),
    );
  }

  function deleteAnimal(animal) {
    setAdoptionAnimals((current) => current.filter((item) => getAnimalKey(item) !== getAnimalKey(animal)));
  }

  return (
    <section className="content-grid">
      <div className="hero-panel adoption-hero">
        <div>
          <span className="eyebrow">Modulo publico</span>
          <h2>Adicione pets para adocao.</h2>
          <p>Mantenha a galeria publica sempre atualizada.</p>
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
            <PanelHeader title={editingAnimalId ? "Editar animal para adocao" : "Cadastrar animal para adocao"} />
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
                  <CompactChoiceField
                    label="Porte"
                    value={animalForm.size}
                    options={activeSizes.map((size) => ({ label: size.name, title: size.description }))}
                    onChange={(value) => updateAnimalForm("size", value)}
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
                <Field
                  label="Saude e observacoes"
                  value={animalForm.health}
                  placeholder="Vacinado, castrado, vermifugado"
                  onChange={(value) => updateAnimalForm("health", value)}
                />
              </div>
            </div>
            {formError && <p className="form-error">{formError}</p>}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={closeAnimalForm}>
                Cancelar
              </button>
              <button className="primary-action" type="submit">
                {editingAnimalId ? "Salvar alteracoes" : "Publicar na galeria"}
              </button>
            </div>
          </form>
        </div>
      )}

      {canManageAdoptions && (
        <div className="adoption-tabs">
          <button
            className={adoptionTab === "available" ? "selected" : ""}
            type="button"
            onClick={() => setAdoptionTab("available")}
          >
            Disponiveis ({availableAnimals.length})
          </button>
          <button
            className={adoptionTab === "adopted" ? "selected" : ""}
            type="button"
            onClick={() => setAdoptionTab("adopted")}
          >
            Adotados ({adoptedAnimals.length})
          </button>
        </div>
      )}

      <div className="adoption-grid">
        {displayedAnimals.length === 0 && (
          <EmptyState
            title={adoptionTab === "adopted" ? "Nenhum animal adotado" : "Nenhum animal para adocao"}
            text={
              currentUser.role === "admin"
                ? adoptionTab === "adopted"
                  ? "Animais marcados como adotados ficarao aqui como historico interno."
                  : "Cadastre o primeiro animal para testar a galeria publica."
                : "A galeria publica ainda nao possui animais cadastrados."
            }
          />
        )}
        {displayedAnimals.map((animal) => (
          <article className="adoption-card" key={animal.id || animal.name}>
            <div className={`animal-photo ${animal.gradient}`}>
              {getAnimalMainPhoto(animal) ? <img src={getAnimalMainPhoto(animal)} alt={animal.name} /> : <PawPrint size={44} />}
            </div>
            <div>
              <div className="card-title-row">
                <h3>{animal.name}</h3>
                <Chip>{animal.status}</Chip>
              </div>
              <p>{animal.species} - {animal.sex} - {animal.age} - {animal.size}</p>
              <p>{animal.tone}</p>
              <div className="compact-grid">
                {animal.health.map((item) => (
                  <Chip key={item}>{item}</Chip>
                ))}
              </div>
            </div>
            {canManageAdoptions ? (
              <div className="adoption-card-actions">
                <button className="ghost-button" type="button" onClick={() => editAnimal(animal)}>
                  Editar
                </button>
                {animal.status === "Adotado" ? (
                  <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(animal, "Disponivel")}>
                    Reativar
                  </button>
                ) : (
                  <button className="secondary-action" type="button" onClick={() => updateAnimalStatus(animal, "Adotado")}>
                    Adotado
                  </button>
                )}
                <button className="ghost-button danger-action" type="button" onClick={() => deleteAnimal(animal)}>
                  Excluir
                </button>
              </div>
            ) : (
              <button
                className="secondary-action"
                type="button"
                disabled={animal.status === "Interesse registrado"}
                onClick={() => updateAnimalStatus(animal, "Interesse registrado")}
              >
                {animal.status === "Interesse registrado" ? "Interesse registrado" : "Tenho interesse"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function GeoView({ requests, scheduleDays = publicScheduleDays, setScheduleDays, scheduleRules = [], setScheduleRules, municipalities = initialMunicipalities }) {
  const neighborhoods = Array.from(new Set(requests.map((request) => request.neighborhood).filter(Boolean)));
  const activeSchedules = scheduleDays.filter((day) => day.active !== false);
  const completedRequests = requests.filter((request) => request.status === "REALIZADA");
  const mutiraoCount = activeSchedules.filter((day) => day.kind === "Mutirao").length;
  const [isMutiraoModalOpen, setIsMutiraoModalOpen] = useState(false);

  return (
    <section className="map-dashboard">
      <div className="map-kpi-grid">
        <Metric title="Agendas" value={activeSchedules.length} icon={CalendarDays} />
        <Metric title="Mutiroes" value={mutiraoCount} icon={MapPin} />
        <Metric title="Realizadas" value={completedRequests.length} icon={CheckCircle2} />
        <Metric title="Municipios" value={municipalities.length} icon={MapPin} />
      </div>

      <div className="map-dashboard-grid">
        <div className="map-side-stack">
          <div className="panel">
            <PanelHeader title="Agenda" />
            <DonutChart
              segments={[
                { label: "Agenda", value: Math.max(activeSchedules.length - mutiraoCount, 0), color: "var(--teal)" },
                { label: "Mutirao", value: mutiraoCount, color: "#f97316" },
              ]}
            />
          </div>
          <div className="panel">
            <PanelHeader title="Execucao" />
            <DonutChart
              segments={[
                { label: "Realizadas", value: completedRequests.length, color: "#16a34a" },
                { label: "Pendentes", value: Math.max(requests.length - completedRequests.length, 0), color: "#94a3b8" },
              ]}
            />
          </div>
          <div className="panel">
            <PanelHeader title="Analise de lacunas" action="Agendar mutirao" onAction={() => setIsMutiraoModalOpen(true)} />
        <div className="gap-list">
          {neighborhoods.length === 0 && (
            <EmptyState title="Nenhum bairro mapeado" text="Crie solicitacoes com bairro informado para gerar cobertura territorial." />
          )}
          {neighborhoods.map((name, index) => {
            const count = requests.filter((request) => request.neighborhood === name).length;
            const target = Math.max(10, count * 10);
            return (
              <div className="gap-row" key={name}>
                <div>
                  <strong>{name}</strong>
                  <span>Gap estimado: {Math.max(target - count, 0)} procedimentos</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${Math.min((count / target) * 100, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
          </div>
        </div>

        <div className="panel map-panel">
          <PanelHeader title="Mapa de agendas e castracoes" action="Criar mutirao" onAction={() => setIsMutiraoModalOpen(true)} />
          <GoogleDashboardMap
            schedules={activeSchedules}
            completedRequests={completedRequests}
            municipalities={municipalities}
          />
        </div>
      </div>
      {isMutiraoModalOpen && (
        <QuickScheduleModal
          municipalities={municipalities}
          setScheduleDays={setScheduleDays}
          setScheduleRules={setScheduleRules}
          initialKind="Mutirao"
          onClose={() => setIsMutiraoModalOpen(false)}
        />
      )}
    </section>
  );
}

function GoogleDashboardMap({ schedules = [], completedRequests = [], municipalities = [] }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState(apiKey ? "Carregando Google Maps..." : "Configure a chave do Google Maps para visualizar o dashboard.");

  const points = useMemo(() => {
    const schedulePoints = schedules
      .filter((day) => Number.isFinite(Number(day.latitude)) && Number.isFinite(Number(day.longitude)))
      .map((day) => ({
        lat: Number(day.latitude),
        lng: Number(day.longitude),
        label: day.kind === "Mutirao" ? "Mutirao" : "Agenda",
        title: `${day.kind === "Mutirao" ? "Mutirao" : "Agenda"} ${day.date}`,
        detail: [day.locationName, day.municipalityName, `${day.remaining ?? day.vacancies} vagas`].filter(Boolean).join(" - "),
        color: day.kind === "Mutirao" ? "#f97316" : "#38a8e8",
      }));
    const completedPoints = completedRequests
      .filter((request) => Number.isFinite(Number(request.latitude)) && Number.isFinite(Number(request.longitude)))
      .map((request) => ({
        lat: Number(request.latitude),
        lng: Number(request.longitude),
        label: "Realizada",
        title: request.tutor || "Castracao realizada",
        detail: request.scheduleLocationName || request.neighborhood || request.address || "Local informado",
        color: "#16a34a",
      }));
    const municipalityPoints = municipalities
      .filter((municipality) => Number.isFinite(Number(municipality.latitude)) && Number.isFinite(Number(municipality.longitude)))
      .map((municipality) => ({
        lat: Number(municipality.latitude),
        lng: Number(municipality.longitude),
        label: "Municipio",
        title: municipality.name,
        detail: municipality.state,
        color: "#64748b",
      }));

    return [...schedulePoints, ...completedPoints, ...municipalityPoints];
  }, [schedules, completedRequests, municipalities]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let active = true;
    window.gm_authFailure = () => {
      setStatus("Google Maps recusou a chave configurada. Verifique restricoes, billing e Maps JavaScript API.");
    };

    loadGoogleMapsApi(apiKey)
      .then((google) => {
        if (!active) return;
        const center = points[0] ? { lat: points[0].lat, lng: points[0].lng } : { lat: -14.235, lng: -51.9253 };
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: points.length ? 10 : 4,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        setStatus(points.length ? "" : "Nenhum ponto com coordenadas para exibir.");
      })
      .catch(() => setStatus("Nao foi possivel carregar o Google Maps."));

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

    const bounds = new google.maps.LatLngBounds();
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
      bounds.extend(position);
    });

    map.fitBounds(bounds);
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
        <span><i className="legend-dot schedule" /> Agenda</span>
        <span><i className="legend-dot mutirao" /> Mutirao</span>
        <span><i className="legend-dot completed" /> Realizada</span>
      </div>
    </div>
  );
}

function LayeredMap({
  schedules = [],
  completedRequests = [],
  municipalities = [],
  compact = false,
  publicMode = false,
  pickerMode = false,
  onScheduleSelect,
  selectedSchedule = "",
}) {
  const [layers, setLayers] = useState({ mapType: "roadmap", schedules: true, completed: !publicMode, municipalities: !publicMode });
  const [zoom, setZoom] = useState(compact ? 12 : 4);
  const [expanded, setExpanded] = useState(false);
  const [mapCenter, setMapCenter] = useState(() => getMapCenter(schedules, municipalities));
  const [dragState, setDragState] = useState(null);

  useEffect(() => {
    setMapCenter(getMapCenter(schedules, municipalities));
  }, [schedules.length, municipalities.length]);
  const schedulePoints = schedules.map((day, index) => ({
    id: `${day.date}-${index}`,
    type: day.kind === "Mutirao" ? "mutirao" : "schedule",
    label: day.kind === "Mutirao" ? `Mutirao ${day.date}` : day.date,
    detail: [day.locationName, day.municipalityName, `${day.remaining ?? day.vacancies} vagas`].filter(Boolean).join(" - "),
    ...projectMapPoint(day.latitude, day.longitude, mapCenter, zoom, 18 + ((index * 17) % 66), 18 + ((index * 23) % 62)),
    day,
  }));
  const completedPoints = completedRequests.map((request, index) => ({
    id: `done-${request.id || index}`,
    type: "completed",
    label: request.tutor || "Castracao realizada",
    detail: request.scheduleLocationName || request.neighborhood || request.address || "Local informado",
    ...projectMapPoint(request.latitude, request.longitude, mapCenter, zoom, 20 + ((index * 19) % 58), 22 + ((index * 29) % 54)),
  }));
  const municipalityPoints = municipalities.map((municipality, index) => ({
    id: municipality.id,
    type: "municipality",
    label: municipality.name,
    detail: municipality.state,
    x: 15 + ((index * 24) % 68),
    y: 18 + ((index * 21) % 60),
  }));
  const showCompleted = !publicMode && layers.completed;
  const showMunicipalities = !publicMode && layers.municipalities;
  const [municipalityShapes, setMunicipalityShapes] = useState({});

  useEffect(() => {
    if (publicMode || !layers.municipalities) return;
    municipalities
      .filter((municipality) => municipality.name && municipality.state && !municipalityShapes[municipality.id])
      .slice(0, 4)
      .forEach((municipality) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=1&city=${encodeURIComponent(municipality.name)}&state=${encodeURIComponent(municipality.state)}&country=Brasil`;
        fetch(url)
          .then((response) => response.ok ? response.json() : [])
          .then((items) => {
            const geometry = items?.[0]?.geojson;
            if (geometry) {
              setMunicipalityShapes((current) => ({ ...current, [municipality.id]: geometry }));
            }
          })
          .catch(() => {});
      });
  }, [layers.municipalities, municipalities, publicMode]);

  return (
    <div className={`${compact ? "layer-map compact" : "layer-map"} ${expanded ? "expanded" : ""}`}>
      <div
        className={dragState ? "layer-map-canvas dragging" : "layer-map-canvas"}
        onPointerDown={(event) => setDragState({ x: event.clientX, y: event.clientY, center: mapCenter })}
        onPointerMove={(event) => {
          if (!dragState) return;
          setMapCenter(panMapCenter(dragState.center, zoom, dragState.x - event.clientX, dragState.y - event.clientY));
        }}
        onPointerUp={() => setDragState(null)}
        onPointerLeave={() => setDragState(null)}
        onWheel={(event) => { event.preventDefault(); setZoom((current) => Math.max(2, Math.min(17, current + (event.deltaY < 0 ? 1 : -1)))); }}
      >
        <SlippyTiles center={mapCenter} zoom={zoom} mapType={layers.mapType} />
        <div className="leaflet-zoom-control" aria-label="Zoom do mapa">
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((current) => Math.min(current + 1, 17))}>+</button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((current) => Math.max(current - 1, 2))}>-</button>
        </div>
        <button className="leaflet-expand-button" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Reduzir" : "Expandir"}
        </button>
        <div className="leaflet-layer-box" onPointerDown={(event) => event.stopPropagation()}>
          <strong>Camadas</strong>
          <label><input type="checkbox" checked={layers.mapType === "satellite"} onChange={(event) => setLayers((current) => ({ ...current, mapType: event.target.checked ? "satellite" : "roadmap" }))} /> Satelite</label>
          <label><input type="checkbox" checked={layers.schedules} onChange={(event) => setLayers((current) => ({ ...current, schedules: event.target.checked }))} /> Agendas</label>
          {!publicMode && <label><input type="checkbox" checked={layers.municipalities} onChange={(event) => setLayers((current) => ({ ...current, municipalities: event.target.checked }))} /> Municipios</label>}
          {!publicMode && <label><input type="checkbox" checked={layers.completed} onChange={(event) => setLayers((current) => ({ ...current, completed: event.target.checked }))} /> Realizadas</label>}
        </div>
        {showMunicipalities && (
          <MunicipalityBoundaryLayer shapes={municipalityShapes} municipalities={municipalities} center={mapCenter} zoom={zoom} />
        )}
        {showMunicipalities && municipalityPoints.map((point) => <MapPoint point={point} key={point.id} />)}
        {layers.schedules && schedulePoints.map((point) => (
          <MapPoint
            point={point}
            key={point.id}
            selected={selectedSchedule === point.day.date}
            onClick={pickerMode ? () => onScheduleSelect?.(point.day) : undefined}
          />
        ))}
        {showCompleted && completedPoints.map((point) => <MapPoint point={point} key={point.id} />)}
      </div>
      <div className="map-legend">
        <span><i className="legend-dot schedule" /> Agenda</span>
        <span><i className="legend-dot mutirao" /> Mutirao</span>
        {!publicMode && <span><i className="legend-dot completed" /> Realizada</span>}
      </div>
    </div>
  );
}

function SlippyTiles({ center, zoom, mapType }) {
  const centerPixel = latLngToWorldPixel(center.lat, center.lng, zoom);
  const centerTile = {
    x: Math.floor(centerPixel.x / 256),
    y: Math.floor(centerPixel.y / 256),
  };
  const tiles = [];
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const tileX = centerTile.x + x;
      const tileY = centerTile.y + y;
      tiles.push({
        key: `${tileX}-${tileY}`,
        left: tileX * 256 - centerPixel.x,
        top: tileY * 256 - centerPixel.y,
        src: getTileUrl(tileX, tileY, zoom, mapType),
      });
    }
  }

  return (
    <div className="slippy-tile-layer">
      {tiles.map((tile) => (
        <img
          alt=""
          draggable="false"
          key={tile.key}
          src={tile.src}
          style={{
            left: `calc(50% + ${tile.left}px)`,
            top: `calc(50% + ${tile.top}px)`,
          }}
        />
      ))}
      <span className="leaflet-attribution">Leaflet | OpenStreetMap contributors</span>
    </div>
  );
}

function MunicipalityBoundaryLayer({ shapes, municipalities, center, zoom }) {
  const paths = municipalities
    .map((municipality) => {
      const shape = shapes[municipality.id];
      const ring = extractOuterRing(shape);
      if (!ring) return null;
      const points = ring
        .filter((_, index) => index % Math.max(1, Math.floor(ring.length / 120)) === 0)
        .map(([lng, lat]) => {
          const projected = projectMapPoint(lat, lng, center, zoom, 50, 50);
          return `${projected.x},${projected.y}`;
        })
        .join(" ");
      return points ? { id: municipality.id, points } : null;
    })
    .filter(Boolean);

  if (paths.length === 0) return null;

  return (
    <svg className="municipality-boundary-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((path) => (
        <polygon key={path.id} points={path.points} />
      ))}
    </svg>
  );
}

function extractOuterRing(shape) {
  if (!shape) return null;
  if (shape.type === "Polygon") return shape.coordinates?.[0] || null;
  if (shape.type === "MultiPolygon") return shape.coordinates?.[0]?.[0] || null;
  return null;
}

function MapPoint({ point, selected = false, onClick }) {
  return (
    <button
      className={`map-point ${point.type} ${selected ? "selected" : ""}`}
      type="button"
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
      onClick={onClick}
      title={`${point.label} - ${point.detail}`}
    >
      <span />
      <strong>{point.label}</strong>
      {point.detail && <small>{point.detail}</small>}
    </button>
  );
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

function parseGoogleAddress(place) {
  const components = place.address_components || [];
  const find = (type, short = false) => {
    const component = components.find((item) => item.types.includes(type));
    return component ? (short ? component.short_name : component.long_name) : "";
  };
  const route = find("route");
  const number = find("street_number");
  const city =
    find("administrative_area_level_2") ||
    find("locality") ||
    find("sublocality_level_1");

  return {
    address: [route, number].filter(Boolean).join(", "),
    neighborhood: find("sublocality_level_1") || find("sublocality") || find("neighborhood"),
    city,
    state: find("administrative_area_level_1", true),
    cep: formatCep(find("postal_code")),
  };
}

function MapCoordinatePicker({ latitude, longitude, locationName = "", onChange }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef(null);
  const inputRef = useRef(null);
  const googleMapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [status, setStatus] = useState(apiKey ? "Carregando Google Maps..." : "Configure VITE_GOOGLE_MAPS_API_KEY para habilitar o Google Maps integrado.");
  const [query, setQuery] = useState(locationName);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!apiKey || !mapRef.current || !inputRef.current) return;

    let active = true;
    window.gm_authFailure = () => {
      setMapReady(false);
      setStatus("Google Maps recusou a chave configurada. Verifique restricoes, billing e Maps JavaScript API.");
    };
    loadGoogleMapsApi(apiKey)
      .then((google) => {
        if (!active) return;
        const center = {
          lat: Number(latitude) || -28.6775,
          lng: Number(longitude) || -49.3697,
        };
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: latitude && longitude ? 16 : 13,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        const marker = new google.maps.Marker({
          map,
          position: latitude && longitude ? center : null,
          draggable: true,
        });
        const geocoder = new google.maps.Geocoder();
        googleMapRef.current = map;
        markerRef.current = marker;
        geocoderRef.current = geocoder;
        setMapReady(true);
        setStatus("Digite um endereco ou clique no mapa.");

        map.addListener("click", (event) => reverseGeocodeLatLng(google, event.latLng));
        marker.addListener("dragend", (event) => reverseGeocodeLatLng(google, event.latLng));
      })
      .catch(() => {
        setMapReady(false);
        setStatus("Nao foi possivel carregar o Google Maps. Verifique a chave e as APIs liberadas.");
      });

    return () => {
      active = false;
      if (window.gm_authFailure) window.gm_authFailure = undefined;
    };
  }, [apiKey]);

  function applyGooglePlace(place) {
    const location = place.geometry.location;
    const parsed = parseGoogleAddress(place);
    const label = place.formatted_address || query || "Local selecionado";
    googleMapRef.current?.panTo(location);
    googleMapRef.current?.setZoom(17);
    markerRef.current?.setPosition(location);
    setQuery(label);
    setStatus("Local selecionado no Google Maps.");
    onChange({
      ...parsed,
      latitude: location.lat().toFixed(6),
      longitude: location.lng().toFixed(6),
      locationName: label,
      address: parsed.address || label,
    });
  }

  function reverseGeocodeLatLng(google, latLng) {
    markerRef.current?.setPosition(latLng);
    googleMapRef.current?.panTo(latLng);
    geocoderRef.current?.geocode({ location: latLng }, (results, resultStatus) => {
      if (resultStatus !== "OK" || !results?.[0]) {
        setStatus("Ponto marcado. Nao foi possivel identificar o endereco completo.");
        onChange({
          latitude: latLng.lat().toFixed(6),
          longitude: latLng.lng().toFixed(6),
          locationName: "Local selecionado no mapa",
        });
        return;
      }
      applyGooglePlace(results[0]);
    });
  }

  function searchAddress() {
    const term = query.trim();
    if (!term) {
      setStatus("Digite um endereco para buscar.");
      return;
    }

    setStatus("Buscando endereco no Google Maps...");
    geocoderRef.current?.geocode({ address: term, componentRestrictions: { country: "BR" } }, (results, resultStatus) => {
      if (resultStatus !== "OK" || !results?.[0]) {
        setStatus("Endereco nao encontrado no Google Maps.");
        return;
      }
      applyGooglePlace(results[0]);
    });
  }

  function openGoogleMaps() {
    const value = query || locationName || "Brasil";
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`, "_blank", "noopener,noreferrer");
  }

  if (!apiKey) {
    return (
      <div className="google-map-fallback">
        <label className="field">
          <span>Buscar no Google Maps</span>
          <input value={query} placeholder="Digite endereco, bairro ou ponto de referencia" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button className="primary-action" type="button" onClick={openGoogleMaps}>
          Abrir Google Maps
        </button>
        <p>{status}</p>
      </div>
    );
  }

  return (
    <div className="google-map-picker">
      <div className="google-map-search">
        <label className="field">
          <span>Buscar endereco no Google Maps</span>
          <input ref={inputRef} value={query} placeholder="Digite o endereco" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              searchAddress();
            }
          }} />
        </label>
        <button className="primary-action" type="button" onClick={searchAddress} disabled={!mapReady}>
          Buscar
        </button>
      </div>
      <div className={mapReady ? "google-map-canvas" : "google-map-canvas loading"} ref={mapRef} />
      <p className="helper-text">{status}</p>
      {latitude && longitude && <p className="map-selected-place">{locationName || "Local selecionado no Google Maps"}</p>}
    </div>
  );
}

function MapsLocationModal({ title = "Usar Maps", initialLocation = {}, onClose, onConfirm }) {
  const [selectedPlace, setSelectedPlace] = useState({
    latitude: initialLocation.latitude || "",
    longitude: initialLocation.longitude || "",
    locationName: initialLocation.locationName || "",
  });

  return (
    <div className="modal-backdrop map-modal-backdrop" onClick={onClose}>
      <div className="maps-location-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <PanelHeader title={title} />
        <MapCoordinatePicker
          latitude={selectedPlace.latitude}
          longitude={selectedPlace.longitude}
          locationName={selectedPlace.locationName}
          onChange={(place) => setSelectedPlace((current) => ({ ...current, ...place }))}
        />
        <div className="form-actions">
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-action" type="button" onClick={() => onConfirm?.(selectedPlace)} disabled={!selectedPlace.latitude || !selectedPlace.longitude}>
            Definir local
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickScheduleModal({ municipalities = [], setScheduleDays, setScheduleRules, initialKind = "Agenda", onClose }) {
  const [form, setForm] = useState({
    kind: initialKind,
    description: initialKind === "Mutirao" ? "Mutirao de castracao" : "",
    municipalityId: "",
    locationName: "",
    latitude: "",
    longitude: "",
    date: "",
    time: "08:00",
    vacancies: "20",
  });

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!form.description.trim() || !form.date) return;
    const municipality = municipalities.find((item) => item.id === form.municipalityId);
    const scheduleRuleId = `agenda_${Date.now()}`;
    const [year, month, day] = form.date.split("-");
    const date = `${day}/${month}/${year}`;
    const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][new Date(`${form.date}T12:00:00`).getDay()];
    const vacancies = Math.max(Number(form.vacancies) || 0, 0);
    const shared = {
      scheduleRuleId,
      description: form.description.trim(),
      kind: form.kind,
      municipalityId: form.municipalityId,
      municipalityName: municipality ? `${municipality.name}/${municipality.state}` : "",
      locationName: form.locationName,
      latitude: form.latitude,
      longitude: form.longitude,
    };

    setScheduleRules?.((current) => [{
      id: scheduleRuleId,
      ...shared,
      createdAt: "25/04/2026 as 20:16",
      active: true,
      unavailable: false,
      type: "Dia especifico",
      repeatEvery: 1,
      weekdays: [new Date(`${form.date}T12:00:00`).getDay()],
      start: date,
      end: date,
      time: form.time,
      vacancies,
    }, ...current]);

    setScheduleDays?.((current) => {
      const byDate = new Map(current.map((item) => [item.date, item]));
      byDate.set(date, { date, weekday, vacancies, active: true, startTime: form.time, ...shared });
      return Array.from(byDate.values()).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));
    });
    onClose?.();
  }

  return (
    <div className="modal-backdrop">
      <form className="config-modal" onSubmit={submit} role="dialog" aria-modal="true">
        <PanelHeader title="Criar agenda" />
        <div className="agenda-modal-layout">
          <section className="agenda-modal-block">
            <strong>Dados</strong>
            <AgendaKindSelector value={form.kind} onChange={(value) => patch("kind", value)} />
            <Field label="Descricao" value={form.description} placeholder="Ex: Mutirao bairro Centro" onChange={(value) => patch("description", value)} />
          </section>
          <section className="agenda-modal-block">
            <strong>Local</strong>
            <div className="modal-form-grid">
              <label className="field">
                <span>Cidade/estado</span>
                <select value={form.municipalityId} onChange={(event) => patch("municipalityId", event.target.value)}>
                  <option value="">Selecione</option>
                  {municipalities.filter((item) => item.active !== false).map((municipality) => (
                    <option key={municipality.id} value={municipality.id}>{municipality.name}/{municipality.state}</option>
                  ))}
                </select>
              </label>
            </div>
            <MapCoordinatePicker latitude={form.latitude} longitude={form.longitude} locationName={form.locationName} onChange={(coords) => setForm((current) => ({ ...current, ...coords }))} />
          </section>
          <section className="agenda-modal-block">
            <strong>Periodo e capacidade</strong>
            <div className="modal-form-grid">
              <label className="field">
                <span>Data</span>
                <input type="date" value={form.date} onChange={(event) => patch("date", event.target.value)} />
              </label>
              <label className="field">
                <span>Hora de inicio</span>
                <input type="time" value={form.time} onChange={(event) => patch("time", event.target.value)} />
              </label>
              <Field label="Numero de castracoes" value={form.vacancies} onChange={(value) => patch("vacancies", value)} />
            </div>
          </section>
        </div>
        <div className="form-actions">
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-action" type="submit">Salvar</button>
        </div>
      </form>
    </div>
  );
}

function AgendaKindSelector({ value, onChange }) {
  return (
    <div className="agenda-kind-selector">
      {["Agenda", "Mutirao"].map((option) => (
        <button key={option} className={value === option ? "selected" : ""} type="button" onClick={() => onChange(option)}>
          {option === "Agenda" ? "Agenda normal" : "Mutirao"}
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
      <p>{text}</p>
      {action && (
        <button className="secondary-action" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function ReportsView({ metrics }) {
  return (
    <section className="content-grid">
      <div className="summary-row">
        <Metric title="Solicitacoes" value={metrics.total} icon={FileText} />
        <Metric title="Fila ativa" value={metrics.pending} icon={RefreshCw} />
        <Metric title="Realizadas" value={metrics.done} icon={CheckCircle2} />
        <Metric title="Exportacoes" value="PDF, XLSX, CSV" icon={Download} />
      </div>
      <div className="panel wide">
        <PanelHeader title="Dashboard executivo" action="Comparar periodo" />
        <div className="charts-grid">
          <Chart title="Evolucao mensal" type="line" />
          <Chart title="Distribuicao por status" type="donut" />
          <Chart title="Top bairros" type="bar" />
          <Chart title="Ocupacao da agenda" type="area" />
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
  scheduleDays = publicScheduleDays,
  setScheduleDays,
  scheduleRules = [],
  setScheduleRules,
  teams = initialTeams,
  setTeams,
}) {
  const roles = ["Super Admin", "Coordenador", "Triagem", "Analista", "Agendador", "Veterinario", "Adocao", "Auditor"];
  const emptyRequestType = { name: "", charged: false, fee: "Gratuito", billingDescription: "", billingAmount: "", billingDueDate: "" };
  const emptyAgendaForm = {
    description: "",
    active: true,
    unavailable: false,
    kind: "Agenda",
    type: "Recorrencia",
    repeatEvery: "1",
    weekdays: [],
    start: "",
    end: "",
    time: "08:00",
    vacancies: "20",
    municipalityId: "",
    locationName: "",
    latitude: "",
    longitude: "",
  };
  const [configTab, setConfigTab] = useState("requests");
  const [configModal, setConfigModal] = useState(null);
  const [editingScheduleRuleId, setEditingScheduleRuleId] = useState(null);
  const [editingMunicipalityId, setEditingMunicipalityId] = useState(null);
  const [agendaLocationStatus, setAgendaLocationStatus] = useState("");
  const [newRequestType, setNewRequestType] = useState(emptyRequestType);
  const [newSpeciesName, setNewSpeciesName] = useState("");
  const [newSize, setNewSize] = useState({ name: "", description: "" });
  const [newMunicipality, setNewMunicipality] = useState({ name: "", state: "", population: "", cnpj: "", ibgeId: "" });
  const [newDocument, setNewDocument] = useState({ name: "", modelHint: "", required: true });
  const [newSectorName, setNewSectorName] = useState("");
  const [newTeamUser, setNewTeamUser] = useState({ name: "", email: "", sectorId: "" });
  const [agendaForm, setAgendaForm] = useState(emptyAgendaForm);
  const [singleDate, setSingleDate] = useState("");
  const [singleVacancies, setSingleVacancies] = useState("20");
  const [recurringStart, setRecurringStart] = useState("");
  const [recurringEnd, setRecurringEnd] = useState("");
  const [recurringVacancies, setRecurringVacancies] = useState("20");
  const [recurringWeekdays, setRecurringWeekdays] = useState([]);
  const configTabs = [
    { id: "requests", label: "Tipo de Solicitacao" },
    { id: "agenda", label: "Agenda" },
    { id: "sizes", label: "Portes" },
    { id: "species", label: "Especie" },
    { id: "municipalities", label: "Cidades" },
    { id: "teams", label: "Setores e usuarios" },
    { id: "ai", label: "IA externa" },
    { id: "documents", label: "Tipo de Documentos" },
  ];

  const providerLinks = {
    OpenAI: "https://platform.openai.com/api-keys",
    Anthropic: "https://console.anthropic.com/settings/keys",
    Gemini: "https://aistudio.google.com/app/apikey",
    Custom: "",
  };

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
        active: true,
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
    setDocumentTypes?.((current) => [
      ...current,
      {
        id: `doc_${Date.now()}`,
        name: payload.name || "",
        required: payload.required !== false,
        active: true,
        accept: ["image/jpeg", "image/png", "application/pdf"],
        maxSizeMb: 5,
        modelHint: payload.modelHint || "",
      },
    ]);
  }

  function patchDocumentType(documentId, patch) {
    setDocumentTypes?.((current) => current.map((document) => (document.id === documentId ? { ...document, ...patch } : document)));
    setRequestTypes?.((current) =>
      current.map((type) => ({
        ...type,
        documents: (type.documents || []).map((document) => (document.id === documentId ? { ...document, ...patch } : document)),
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

  function createMunicipality(payload = {}) {
    setMunicipalities?.((current) => {
      const nextMunicipality = {
        id: `municipio_${Date.now()}`,
        name: payload.name || "",
        state: (payload.state || "").toUpperCase(),
        population: payload.population || "",
        cnpj: payload.cnpj || "",
        ibgeId: payload.ibgeId || "",
        active: true,
      };
      return editingMunicipalityId
        ? current.map((item) => (item.id === editingMunicipalityId ? { ...item, ...nextMunicipality, id: item.id, active: item.active } : item))
        : [...current, nextMunicipality];
    });
  }

  function openMunicipalityModal(municipality = null) {
    if (municipality) {
      setEditingMunicipalityId(municipality.id);
      setNewMunicipality({
        name: municipality.name || "",
        state: municipality.state || "",
        population: municipality.population || "",
        cnpj: municipality.cnpj || "",
        ibgeId: municipality.ibgeId || "",
      });
    } else {
      setEditingMunicipalityId(null);
      setNewMunicipality({ name: "", state: "", population: "", cnpj: "", ibgeId: "" });
    }
    setConfigModal("municipality");
  }

  function createSpecies(name = "") {
    setSpeciesOptions?.((current) => [...current, { id: `especie_${Date.now()}`, name, active: true }]);
  }

  function createSize(payload = {}) {
    setSizeOptions?.((current) => [
      ...current,
      { id: `porte_${Date.now()}`, name: payload.name || "", description: payload.description || "", active: true },
    ]);
  }

  function patchListItem(setter, itemId, patch) {
    setter?.((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  function deleteListItem(setter, itemId) {
    setter?.((current) => current.filter((item) => item.id !== itemId));
  }

  function createSector() {
    if (!newSectorName.trim()) return;
    setTeams?.((current) => ({
      ...current,
      sectors: [...(current.sectors || []), { id: `setor_${Date.now()}`, name: newSectorName.trim(), active: true }],
    }));
    setNewSectorName("");
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
    setTeams?.((current) => ({
      ...current,
      users: [
        ...(current.users || []),
        {
          id: `usuario_${Date.now()}`,
          name: newTeamUser.name.trim(),
          email: newTeamUser.email.trim(),
          sectorId: newTeamUser.sectorId,
          active: true,
        },
      ],
    }));
    setNewTeamUser({ name: "", email: "", sectorId: "" });
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

  function upsertScheduleDay(dateValue, vacanciesValue) {
    if (!dateValue) return;
    const date = toScheduleDate(dateValue);
    const weekday = getWeekdayLabel(dateValue);
    const vacancies = Math.max(Number(vacanciesValue) || 0, 0);
    setScheduleDays?.((current) => {
      const nextDay = { date, weekday, vacancies, active: true };
      const exists = current.some((day) => day.date === date);
      return exists
        ? current.map((day) => (day.date === date ? { ...day, ...nextDay } : day))
        : [...current, nextDay].sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));
    });
  }

  function createRecurringSchedule() {
    if (!recurringStart || !recurringEnd || recurringWeekdays.length === 0) return;
    const start = new Date(`${recurringStart}T12:00:00`);
    const end = new Date(`${recurringEnd}T12:00:00`);
    const nextDays = [];

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (recurringWeekdays.includes(date.getDay())) {
        const value = date.toISOString().slice(0, 10);
        nextDays.push({
          date: toScheduleDate(value),
          weekday: getWeekdayLabel(value),
          vacancies: Math.max(Number(recurringVacancies) || 0, 0),
          active: true,
        });
      }
    }

    setScheduleDays?.((current) => {
      const byDate = new Map(current.map((day) => [day.date, day]));
      nextDays.forEach((day) => byDate.set(day.date, day));
      return Array.from(byDate.values()).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));
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
        type: rule.type || "Recorrencia",
        repeatEvery: String(rule.repeatEvery || "1"),
        weekdays: rule.weekdays || [],
        start: toInputDate(rule.start),
        end: toInputDate(rule.end || rule.start),
        time: rule.time || "08:00",
        vacancies: String(rule.vacancies || "20"),
        municipalityId: rule.municipalityId || "",
        locationName: rule.locationName || "",
        latitude: rule.latitude || "",
        longitude: rule.longitude || "",
      });
    } else {
      setEditingScheduleRuleId(null);
      setAgendaForm(emptyAgendaForm);
    }
    setConfigModal("agenda");
  }

  function createScheduleFromModal(event) {
    event.preventDefault();
    const isRecurring = agendaForm.type === "Recorrencia";
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
          latitude: agendaForm.latitude,
          longitude: agendaForm.longitude,
        });
      }
    }

    const nextRule = {
      id: scheduleRuleId,
      description: agendaForm.description.trim(),
      createdAt: "25/04/2026 as 20:16",
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
      latitude: agendaForm.latitude,
      longitude: agendaForm.longitude,
    };

    setScheduleRules?.((current) => editingScheduleRuleId
      ? current.map((rule) => (rule.id === editingScheduleRuleId ? nextRule : rule))
      : [nextRule, ...current]);
    setScheduleDays?.((current) => {
      const keptDays = editingScheduleRuleId ? current.filter((day) => day.scheduleRuleId !== editingScheduleRuleId) : current;
      const byDate = new Map(keptDays.map((day) => [day.date, day]));
      nextDays.forEach((day) => byDate.set(day.date, { ...day, scheduleRuleId }));
      return Array.from(byDate.values()).sort((left, right) => parseScheduleDate(left.date) - parseScheduleDate(right.date));
    });
    setAgendaForm(emptyAgendaForm);
    setEditingScheduleRuleId(null);
    setConfigModal(null);
  }

  function formatScheduleWeekdays(weekdays) {
    const names = ["domingo", "segunda-feira", "terca-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sabado"];
    return weekdays.map((weekday) => names[weekday]).join(", ");
  }

  return (
    <section className="config-workspace">
      <div className="panel wide">
        <PanelHeader title="Configuracoes" />
        <div className="config-tabs">
          {configTabs.map((tab) => (
            <button key={tab.id} className={configTab === tab.id ? "selected" : ""} type="button" onClick={() => setConfigTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {configTab === "requests" && (
        <div className="panel wide">
          <PanelHeader title="Tipos de solicitacao" />
          <button className="secondary-action config-inline-action" type="button" onClick={() => setConfigModal("requestType")}>
            <Plus size={18} />
            Criar tipo
          </button>
          <div className="config-editor-grid">
            {requestTypes.map((type) => (
              <article className="request-type-card" key={type.id}>
                <Field label="Nome" value={type.name} placeholder="Ex: Castracao" onChange={(value) => patchRequestType(type.id, { name: value })} />
                <div className="billing-method-field">
                  <span>Metodo</span>
                  <div>
                    <button
                      className={!type.charged ? "selected" : ""}
                      type="button"
                      onClick={() => patchRequestType(type.id, { charged: false, fee: "Gratuito", billingDescription: "", billingAmount: "", billingDueDate: "" })}
                    >
                      Gratuito
                    </button>
                    <button
                      className={type.charged ? "selected" : ""}
                      type="button"
                      onClick={() => patchRequestType(type.id, { charged: true, fee: type.billingAmount || type.fee || "", billingAmount: type.billingAmount || type.fee || "" })}
                    >
                      Boleto
                    </button>
                  </div>
                </div>
                {type.charged && (
                  <div className="billing-grid">
                    <Field label="Descricao" value={type.billingDescription || ""} placeholder="Ex: Taxa de castracao" onChange={(value) => patchRequestType(type.id, { billingDescription: value })} />
                    <Field label="Valor" value={type.billingAmount || type.fee || ""} placeholder="Ex: R$ 20,00" onChange={(value) => patchRequestType(type.id, { billingAmount: value, fee: value })} />
                    <label className="field">
                      <span>Vencimento</span>
                      <input type="date" value={type.billingDueDate || ""} onChange={(event) => patchRequestType(type.id, { billingDueDate: event.target.value })} />
                    </label>
                  </div>
                )}
                <DocumentButtonPicker
                  documents={documentTypes}
                  selectedDocuments={type.documents || []}
                  onToggle={(document) => toggleRequestDocument(type.id, document)}
                />
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => patchRequestType(type.id, { active: type.active === false })}>
                    {type.active === false ? "Ativar" : "Desativar"}
                  </button>
                  <button className="ghost-button" type="button">
                    Editar
                  </button>
                  <button className="ghost-button danger-action" type="button" onClick={() => deleteListItem(setRequestTypes, type.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {configTab === "agenda" && (
        <div className="panel wide">
          <PanelHeader title="Agenda" />
          <button className="secondary-action config-inline-action" type="button" onClick={() => openAgendaModal()}>
            <Plus size={18} />
            Criar agenda
          </button>
          <div className="config-editor-grid">
            {scheduleRules.length === 0 && (
              <EmptyState title="Nenhuma agenda cadastrada" text="Crie uma agenda para gerar dias disponiveis para castracao." />
            )}
            {scheduleRules.map((rule) => (
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
                  {rule.type === "Recorrencia" && <span>{formatScheduleWeekdays(rule.weekdays)}</span>}
                </div>
                <div className="form-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => openAgendaModal(rule)}
                  >
                    Editar
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      {
                        setScheduleRules?.((current) =>
                          current.map((item) => (item.id === rule.id ? { ...item, active: !item.active } : item)),
                        );
                        setScheduleDays?.((current) =>
                          current.map((day) => (day.scheduleRuleId === rule.id ? { ...day, active: !rule.active } : day)),
                        );
                      }
                    }
                  >
                    {rule.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    className="ghost-button danger-action"
                    type="button"
                    onClick={() => {
                      setScheduleRules?.((current) => current.filter((item) => item.id !== rule.id));
                      setScheduleDays?.((current) => current.filter((day) => day.scheduleRuleId !== rule.id));
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {configTab === "sizes" && (
        <SimpleConfigList title="Portes" items={sizeOptions} onCreate={() => setConfigModal("size")} onPatch={(id, patch) => patchListItem(setSizeOptions, id, patch)} onDelete={(id) => deleteListItem(setSizeOptions, id)} showDescription />
      )}

      {configTab === "species" && (
        <SimpleConfigList title="Especies" items={speciesOptions} onCreate={() => setConfigModal("species")} onPatch={(id, patch) => patchListItem(setSpeciesOptions, id, patch)} onDelete={(id) => deleteListItem(setSpeciesOptions, id)} />
      )}

      {configTab === "municipalities" && (
        <div className="panel wide">
          <PanelHeader title="Cidades" />
          <button className="secondary-action config-inline-action" type="button" onClick={() => openMunicipalityModal()}>
            <Plus size={18} />
            Criar cidade
          </button>
          <div className="config-editor-grid">
            {municipalities.map((municipality) => (
              <article className="request-type-card" key={municipality.id}>
                <div className="city-card-title">
                  <strong>{municipality.name || "Cidade sem nome"}</strong>
                  <span>{municipality.state || "UF"}</span>
                </div>
                <div className="config-card-details">
                  <span>Populacao: {municipality.population || "Nao informada"}</span>
                  <span>CNPJ: {municipality.cnpj || "Nao informado"}</span>
                  {municipality.ibgeId && <span>IBGE: {municipality.ibgeId}</span>}
                </div>
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => openMunicipalityModal(municipality)}>
                    Editar
                  </button>
                  <button className="ghost-button" type="button" onClick={() => patchListItem(setMunicipalities, municipality.id, { active: municipality.active === false })}>
                    {municipality.active === false ? "Ativar" : "Desativar"}
                  </button>
                  <button className="ghost-button danger-action" type="button" onClick={() => deleteListItem(setMunicipalities, municipality.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {configTab === "teams" && (
        <div className="panel wide">
          <PanelHeader title="Setores e usuarios" />
          <div className="team-config-layout">
            <section className="team-config-column">
              <h3>Setores</h3>
              <div className="inline-create-row">
                <Field label="Novo setor" value={newSectorName} placeholder="Ex: Triagem documental" onChange={setNewSectorName} />
                <button className="primary-action" type="button" onClick={createSector}>Adicionar</button>
              </div>
              <div className="team-list">
                {(teams.sectors || []).map((sector) => (
                  <article className="team-item" key={sector.id}>
                    <Field label="Nome" value={sector.name} onChange={(value) => patchSector(sector.id, { name: value })} />
                    <div className="form-actions">
                      <button className="ghost-button" type="button" onClick={() => patchSector(sector.id, { active: sector.active === false })}>
                        {sector.active === false ? "Ativar" : "Desativar"}
                      </button>
                      <button className="ghost-button danger-action" type="button" onClick={() => deleteSector(sector.id)}>Excluir</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="team-config-column">
              <h3>Usuarios</h3>
              <div className="team-user-create">
                <Field label="Nome" value={newTeamUser.name} placeholder="Nome do usuario" onChange={(value) => setNewTeamUser((current) => ({ ...current, name: value }))} />
                <Field label="Email" value={newTeamUser.email} placeholder="email@dominio.com" onChange={(value) => setNewTeamUser((current) => ({ ...current, email: value }))} />
                <label className="field">
                  <span>Setor vinculado</span>
                  <select value={newTeamUser.sectorId} onChange={(event) => setNewTeamUser((current) => ({ ...current, sectorId: event.target.value }))}>
                    <option value="">Sem setor</option>
                    {(teams.sectors || []).map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                  </select>
                </label>
                <button className="primary-action" type="button" onClick={createTeamUser}>Adicionar usuario</button>
              </div>
              <div className="team-list">
                {(teams.users || []).map((user) => (
                  <article className="team-item" key={user.id}>
                    <div className="team-item-title">
                      <strong>{user.name || "Usuario sem nome"}</strong>
                      <span>{user.email}</span>
                    </div>
                    <label className="field">
                      <span>Setor</span>
                      <select value={user.sectorId || ""} onChange={(event) => patchTeamUser(user.id, { sectorId: event.target.value })}>
                        <option value="">Sem setor</option>
                        {(teams.sectors || []).map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                      </select>
                    </label>
                    <div className="form-actions">
                      <button className="ghost-button" type="button" onClick={() => patchTeamUser(user.id, { active: user.active === false })}>
                        {user.active === false ? "Ativar" : "Desativar"}
                      </button>
                      <button className="ghost-button danger-action" type="button" onClick={() => deleteTeamUser(user.id)}>Excluir</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {configTab === "ai" && (
        <div className="panel wide">
          <PanelHeader title="IA externa para documentos" />
          <div className="ai-settings-layout">
            <article className="request-type-card ai-settings-card">
              <ToggleSwitch
                label="Validacao por IA"
                checked={Boolean(aiSettings.active)}
                onChange={(checked) => setAiSettings?.((current) => ({ ...current, active: checked }))}
                onText="Ativa"
                offText="Inativa"
              />
              <label className="field">
                <span>Provedor</span>
                <select value={aiSettings.provider} onChange={(event) => setAiSettings?.((current) => ({ ...current, provider: event.target.value }))}>
                  <option>OpenAI</option>
                  <option>Anthropic</option>
                  <option>Gemini</option>
                  <option>Custom</option>
                </select>
              </label>
              <Field label="Modelo" value={aiSettings.model} placeholder="Ex: gpt-4.1-mini, claude-3-5-sonnet, gemini-1.5-flash" onChange={(value) => setAiSettings?.((current) => ({ ...current, model: value }))} />
              <label className="field">
                <span>Chave API</span>
                <input
                  value={aiSettings.apiKey}
                  type="password"
                  placeholder="Cole a chave do provedor"
                  onChange={(event) => setAiSettings?.((current) => ({ ...current, apiKey: event.target.value }))}
                />
              </label>
              <Field label="Endpoint customizado" value={aiSettings.endpoint} placeholder="Opcional para proxy/backend proprio" onChange={(value) => setAiSettings?.((current) => ({ ...current, endpoint: value }))} />
              {providerLinks[aiSettings.provider] && (
                <a className="external-provider-link" href={providerLinks[aiSettings.provider]} target="_blank" rel="noreferrer">
                  Criar chave em {aiSettings.provider}
                </a>
              )}
            </article>
            <article className="ai-rules-card">
              <strong>Como a IA sera usada</strong>
              <p>
                Ao anexar um documento, a IA usa a descricao/instrucao do tipo de documento como regra. Se o comprovante
                exigir residencia em Criciuma, por exemplo, a analise deve recusar arquivos que indiquem outra cidade.
              </p>
              <p>
                Com a IA inativa, o arquivo fica apenas anexado e nao passa por analise automatica.
              </p>
            </article>
          </div>
        </div>
      )}

      {configTab === "documents" && (
        <div className="panel wide">
          <PanelHeader title="Tipos de documentos" />
          <button className="secondary-action config-inline-action" type="button" onClick={() => setConfigModal("document")}>
            <Plus size={18} />
            Criar documento
          </button>
          <div className="config-editor-grid">
            {documentTypes.map((document) => (
              <article className="request-type-card" key={document.id}>
                <Field label="Nome" value={document.name} placeholder="Ex: RG ou CNH" onChange={(value) => patchDocumentType(document.id, { name: value })} />
                <label className="field">
                  <span>Descricao/instrucao para IA</span>
                  <textarea value={document.modelHint} onChange={(event) => patchDocumentType(document.id, { modelHint: event.target.value })} />
                </label>
                <ToggleSwitch
                  label="Documento obrigatorio"
                  checked={document.required !== false}
                  onChange={(checked) => patchDocumentType(document.id, { required: checked })}
                  onText="Obrigatorio"
                  offText="Opcional"
                />
                <div className="form-actions">
                  <button className="ghost-button" type="button">
                    Editar
                  </button>
                  <button className="ghost-button" type="button" onClick={() => patchDocumentType(document.id, { active: document.active === false })}>
                    {document.active === false ? "Ativar" : "Desativar"}
                  </button>
                  <button className="ghost-button danger-action" type="button" onClick={() => deleteDocumentType(document.id)}>
                    Excluir
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
            <PanelHeader title={editingScheduleRuleId ? "Editar agenda" : "Criar agenda"} />
            <div className="agenda-modal-layout">
              <section className="agenda-modal-block">
                <div className="agenda-block-title">
                  <strong>Dados</strong>
                  <ToggleSwitch
                    label="Agenda"
                    checked={agendaForm.active}
                    onChange={(checked) => patchAgendaForm("active", checked)}
                    onText="Ativa"
                    offText="Inativa"
                  />
                </div>
                <Field label="Descricao" value={agendaForm.description} placeholder="Ex: Data padrao automacao" onChange={(value) => patchAgendaForm("description", value)} />
                <div className="modal-form-grid">
                  <label className="field">
                    <span>Tipo de agenda</span>
                    <select value={agendaForm.type} onChange={(event) => patchAgendaForm("type", event.target.value)}>
                      <option>Recorrencia</option>
                      <option>Dia especifico</option>
                    </select>
                  </label>
                  {agendaForm.type === "Recorrencia" && (
                    <Field label="Repetir a cada" value={agendaForm.repeatEvery} onChange={(value) => patchAgendaForm("repeatEvery", value)} />
                  )}
                </div>
                <AgendaKindSelector value={agendaForm.kind} onChange={(value) => patchAgendaForm("kind", value)} />
                {agendaForm.type === "Recorrencia" && (
                  <div className="weekday-picker">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((weekday, index) => (
                      <button
                        key={`${weekday}-${index}`}
                        type="button"
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
                        {weekday}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="agenda-modal-block">
                <strong>Local</strong>
                <div className="modal-form-grid">
                  <label className="field">
                    <span>Cidade/estado</span>
                    <select value={agendaForm.municipalityId} onChange={(event) => patchAgendaForm("municipalityId", event.target.value)}>
                      <option value="">Selecione</option>
                      {municipalities.filter((item) => item.active !== false).map((municipality) => (
                        <option key={municipality.id} value={municipality.id}>
                          {municipality.name}/{municipality.state}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className="secondary-action map-use-button" type="button" onClick={useAgendaCurrentLocation}>
                  <Navigation size={18} />
                  Usar localizacao atual
                </button>
                {agendaForm.locationName && <p className="map-selected-place">{agendaForm.locationName}</p>}
                {agendaForm.latitude && agendaForm.longitude && (
                  <p className="map-selected-place">{agendaForm.latitude}, {agendaForm.longitude}</p>
                )}
                {agendaLocationStatus && <p className="cep-status">{agendaLocationStatus}</p>}
              </section>

              <section className="agenda-modal-block">
                <strong>Periodo e capacidade</strong>
                <div className="modal-form-grid">
                  <label className="field">
                    <span>Inicio da agenda</span>
                    <input type="date" value={agendaForm.start} onChange={(event) => patchAgendaForm("start", event.target.value)} />
                  </label>
                  {agendaForm.type === "Recorrencia" && (
                    <label className="field">
                      <span>Final da agenda</span>
                      <input type="date" value={agendaForm.end} onChange={(event) => patchAgendaForm("end", event.target.value)} />
                    </label>
                  )}
                  <label className="field">
                    <span>Hora de inicio das castracoes</span>
                    <input type="time" value={agendaForm.time} onChange={(event) => patchAgendaForm("time", event.target.value)} />
                  </label>
                  <Field label="Numero de castracoes por dia" value={agendaForm.vacancies} onChange={(value) => patchAgendaForm("vacancies", value)} />
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
              createRequestType(newRequestType);
              setNewRequestType(emptyRequestType);
              setConfigModal(null);
            }}
          >
            <PanelHeader title="Criar tipo de solicitacao" />
            <Field label="Nome" value={newRequestType.name} placeholder="Ex: Castracao" onChange={(value) => setNewRequestType((current) => ({ ...current, name: value }))} />
            <div className="billing-method-field">
              <span>Metodo</span>
              <div>
                <button
                  className={!newRequestType.charged ? "selected" : ""}
                  type="button"
                  onClick={() => setNewRequestType((current) => ({ ...current, charged: false, fee: "Gratuito", billingDescription: "", billingAmount: "", billingDueDate: "" }))}
                >
                  Gratuito
                </button>
                <button
                  className={newRequestType.charged ? "selected" : ""}
                  type="button"
                  onClick={() => setNewRequestType((current) => ({ ...current, charged: true, fee: current.billingAmount || current.fee || "", billingAmount: current.billingAmount || current.fee || "" }))}
                >
                  Boleto
                </button>
              </div>
            </div>
            {newRequestType.charged && (
              <div className="billing-grid">
                <Field label="Descricao" value={newRequestType.billingDescription} placeholder="Ex: Taxa de castracao" onChange={(value) => setNewRequestType((current) => ({ ...current, billingDescription: value }))} />
                <Field label="Valor" value={newRequestType.billingAmount} placeholder="Ex: R$ 20,00" onChange={(value) => setNewRequestType((current) => ({ ...current, billingAmount: value, fee: value }))} />
                <label className="field">
                  <span>Vencimento</span>
                  <input type="date" value={newRequestType.billingDueDate} onChange={(event) => setNewRequestType((current) => ({ ...current, billingDueDate: event.target.value }))} />
                </label>
              </div>
            )}
            <DocumentButtonPicker
              documents={documentTypes}
              selectedDocuments={newRequestType.documents || documentTypes.filter((document) => document.active !== false)}
              onToggle={(document) =>
                setNewRequestType((current) => {
                  const selectedDocuments = current.documents || documentTypes.filter((item) => item.active !== false);
                  const exists = selectedDocuments.some((item) => item.id === document.id);
                  return {
                    ...current,
                    documents: exists
                      ? selectedDocuments.filter((item) => item.id !== document.id)
                      : [...selectedDocuments, document],
                  };
                })
              }
            />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setConfigModal(null)}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "municipality" && (
        <div className="modal-backdrop">
          <form className="config-modal compact" onSubmit={(event) => { event.preventDefault(); createMunicipality(newMunicipality); setNewMunicipality({ name: "", state: "", population: "", cnpj: "", ibgeId: "" }); setEditingMunicipalityId(null); setConfigModal(null); }}>
            <PanelHeader title={editingMunicipalityId ? "Editar cidade" : "Criar cidade"} />
            <div className="modal-form-grid">
              <Field label="Nome" value={newMunicipality.name} placeholder="Ex: Sao Paulo" onChange={(value) => setNewMunicipality((current) => ({ ...current, name: value }))} />
              <Field label="UF" value={newMunicipality.state} placeholder="SP" onChange={(value) => setNewMunicipality((current) => ({ ...current, state: value.toUpperCase() }))} />
            </div>
            <div className="modal-form-grid">
              <Field label="Populacao" value={newMunicipality.population} placeholder="Ex: 120000" onChange={(value) => setNewMunicipality((current) => ({ ...current, population: value }))} />
              <Field label="CNPJ" value={newMunicipality.cnpj} placeholder="00.000.000/0001-00" onChange={(value) => setNewMunicipality((current) => ({ ...current, cnpj: value }))} />
            </div>
            <Field label="Codigo IBGE" value={newMunicipality.ibgeId} onChange={(value) => setNewMunicipality((current) => ({ ...current, ibgeId: value }))} />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setConfigModal(null); setEditingMunicipalityId(null); setNewMunicipality({ name: "", state: "", population: "", cnpj: "", ibgeId: "" }); }}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "species" && (
        <div className="modal-backdrop">
          <form className="config-modal compact" onSubmit={(event) => { event.preventDefault(); createSpecies(newSpeciesName); setNewSpeciesName(""); setConfigModal(null); }}>
            <PanelHeader title="Criar especie" />
            <Field label="Nome" value={newSpeciesName} onChange={setNewSpeciesName} />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setConfigModal(null)}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "size" && (
        <div className="modal-backdrop">
          <form className="config-modal compact" onSubmit={(event) => { event.preventDefault(); createSize(newSize); setNewSize({ name: "", description: "" }); setConfigModal(null); }}>
            <PanelHeader title="Criar porte" />
            <Field label="Nome" value={newSize.name} onChange={(value) => setNewSize((current) => ({ ...current, name: value }))} />
            <Field label="Tooltip / categoria de peso" value={newSize.description} placeholder="Ex: Ate 10 kg" onChange={(value) => setNewSize((current) => ({ ...current, description: value }))} />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setConfigModal(null)}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {configModal === "document" && (
        <div className="modal-backdrop">
          <form className="config-modal compact" onSubmit={(event) => { event.preventDefault(); createDocumentType(newDocument); setNewDocument({ name: "", modelHint: "", required: true }); setConfigModal(null); }}>
            <PanelHeader title="Criar documento" />
            <Field label="Nome" value={newDocument.name} placeholder="Ex: RG ou CNH" onChange={(value) => setNewDocument((current) => ({ ...current, name: value }))} />
            <label className="field">
              <span>Descricao/instrucao para IA</span>
              <textarea value={newDocument.modelHint} onChange={(event) => setNewDocument((current) => ({ ...current, modelHint: event.target.value }))} />
            </label>
            <ToggleSwitch
              label="Documento obrigatorio"
              checked={newDocument.required}
              onChange={(checked) => setNewDocument((current) => ({ ...current, required: checked }))}
              onText="Obrigatorio"
              offText="Opcional"
            />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setConfigModal(null)}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );

  function addRequestType() {
    const nextType = {
      id: `tipo_${Date.now()}`,
      name: "",
      fee: "",
      documents: [
        { ...standardDocumentTemplates[0], id: `rg_cnh_${Date.now()}` },
      ],
    };
    setRequestTypes?.((current) => [...current, nextType]);
  }

  function updateRequestType(typeId, field, value) {
    setRequestTypes?.((current) =>
      current.map((type) => (type.id === typeId ? { ...type, [field]: value } : type)),
    );
  }

  function addDocumentToType(typeId) {
    const nextDocument = {
      id: `doc_${Date.now()}`,
      name: "",
      required: true,
      accept: ["image/jpeg", "image/png", "application/pdf"],
      maxSizeMb: 5,
      modelHint: "",
    };
    setRequestTypes?.((current) =>
      current.map((type) =>
        type.id === typeId ? { ...type, documents: [...type.documents, nextDocument] } : type,
      ),
    );
  }

  function updateTypeDocument(typeId, documentId, field, value) {
    setRequestTypes?.((current) =>
      current.map((type) =>
        type.id === typeId
          ? {
              ...type,
              documents: type.documents.map((document) =>
                document.id === documentId ? { ...document, [field]: value } : document,
              ),
            }
          : type,
      ),
    );
  }

  return (
    <section className="content-grid">
      <div className="panel wide">
        <PanelHeader title="Configuracoes do sistema" action="Salvar parametros" />
        <div className="settings-grid">
          <ConfigTile icon={Users} title="Setores e usuarios" text="Criacao por Super Admin, ativacao por email e termo de confidencialidade." />
          <ConfigTile icon={Lock} title="RBAC e auditoria" text="Permissoes por perfil, logs de IP, alteracoes e acesso a dados sensiveis." />
          <ConfigTile icon={CalendarDays} title="Agenda" text="Horarios, feriados, capacidade, duracao, buffer e regras de reagendamento." />
          <ConfigTile icon={Bell} title="Notificacoes" text="Templates de SMS, email, push e resumos administrativos." />
        </div>
      </div>

      <div className="panel wide">
        <PanelHeader title="Tipos de solicitacao e documentos" action="Criar tipo" />
        <button className="secondary-action config-inline-action" onClick={addRequestType}>
          <Plus size={18} />
          Criar tipo de solicitacao
        </button>
        <div className="request-type-grid">
          {requestTypes.length === 0 && (
            <EmptyState
              title="Nenhum tipo configurado"
              text="Crie os tipos de solicitacao que o tutor podera escolher. Cada tipo define taxa e documentos exigidos."
            />
          )}
          {requestTypes.map((type) => (
            <article className="request-type-card" key={type.id}>
              <Field
                label="Nome do tipo"
                value={type.name}
                placeholder="Ex: Castracao"
                onChange={(value) => updateRequestType(type.id, "name", value)}
              />
              <Field
                label="Taxa"
                value={type.fee}
                placeholder="Ex: Gratuito ou R$ 20,00"
                onChange={(value) => updateRequestType(type.id, "fee", value)}
              />
              <div className="document-rule-list">
                {type.documents.map((document) => (
                  <div className="document-rule-editor" key={document.id}>
                    <Field
                      label="Documento"
                      value={document.name}
                      placeholder="Ex: Comprovante de residencia"
                      onChange={(value) => updateTypeDocument(type.id, document.id, "name", value)}
                    />
                    <Field
                      label="Descricao para IA"
                      value={document.modelHint}
                      placeholder="O que precisa estar legivel neste arquivo?"
                      onChange={(value) => updateTypeDocument(type.id, document.id, "modelHint", value)}
                    />
                  </div>
                ))}
              </div>
              <button className="ghost-button" onClick={() => addDocumentToType(type.id)}>
                <Plus size={16} />
                Adicionar documento
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="panel wide">
        <PanelHeader title="IA documental" action="Treinar modelo" />
        <div className="ai-config-grid">
          <ConfigTile
            icon={ShieldCheck}
            title="Regras de recusa"
            text="Recusa tipo de arquivo incorreto, arquivo muito pequeno, imagem abaixo da resolucao minima ou imagem que nao pode ser lida."
          />
          <ConfigTile
            icon={FileText}
            title="Modelo por documento"
            text="Cada documento possui uma descricao do que deve aparecer, como RG com foto e numero ou comprovante com endereco legivel."
          />
          <ConfigTile
            icon={UploadCloud}
            title="Amostras futuras"
            text="Em producao, esta area deve receber exemplos aceitos e recusados para calibrar a IA com casos reais do municipio."
          />
        </div>
      </div>

      <div className="panel wide">
        <PanelHeader title="Perfis do MVP" action="Customizar" />
        <div className="role-grid">
          {roles.map((role) => (
            <Chip key={role}>{role}</Chip>
          ))}
        </div>
      </div>

      <div className="panel wide">
        <PanelHeader title="Estados oficiais do fluxo" action="Exportar matriz" />
        <div className="workflow-grid">
          {statuses.map((status) => (
            <div className="workflow-item" key={status}>
              <StatusBadge status={status} />
              <span>{(transitions[status] || []).map((next) => statusLabels[next]).join(", ") || "Final"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SimpleConfigList({ title, items, onCreate, onPatch, onDelete, showDescription = false }) {
  return (
    <div className="panel wide">
      <PanelHeader title={title} />
      <button className="secondary-action config-inline-action" type="button" onClick={onCreate}>
        <Plus size={18} />
        Criar item
      </button>
      <div className="config-editor-grid">
        {items.map((item) => (
          <article className="request-type-card" key={item.id}>
            <Field label="Nome" value={item.name} onChange={(value) => onPatch(item.id, { name: value })} />
            {showDescription && (
              <Field
                label="Tooltip / categoria de peso"
                value={item.description || ""}
                placeholder="Ex: Ate 10 kg"
                onChange={(value) => onPatch(item.id, { description: value })}
              />
            )}
            <div className="form-actions">
              <button className="ghost-button" type="button">
                Editar
              </button>
              <button className="ghost-button" type="button" onClick={() => onPatch(item.id, { active: item.active === false })}>
                {item.active === false ? "Ativar" : "Desativar"}
              </button>
              <button className="ghost-button danger-action" type="button" onClick={() => onDelete(item.id)}>
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
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

function PanelHeader({ title, action, onAction }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {action && <button className="ghost-button" type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}

function Field({ label, value, onChange, placeholder, readOnly = false, invalid = false }) {
  return (
    <label className={invalid ? "field invalid" : "field"}>
      <span>{label}</span>
      <input
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
            onClick={() => onChange(option)}
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
          return (
          <button
            key={optionLabel}
            type="button"
            title={optionTitle}
            className={value === optionLabel ? "selected" : ""}
            onClick={() => onChange(optionLabel)}
          >
            {optionLabel}
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
      <span>{label}</span>
      <strong>{checked ? onText : offText}</strong>
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

function validateDocumentWithAI(document, file, aiSettings = initialAiSettings) {
  return new Promise((resolve) => {
    const maxBytes = document.maxSizeMb * 1024 * 1024;

    if (!document.accept.includes(file.type)) {
      resolve({
        status: "rejected",
        message: "Recusado: tipo de arquivo diferente do solicitado.",
      });
      return;
    }

    if (file.size > maxBytes) {
      resolve({
        status: "rejected",
        message: `Recusado: arquivo maior que ${document.maxSizeMb}MB.`,
      });
      return;
    }

    if (file.size < 40 * 1024) {
      resolve({
        status: "rejected",
        message: "Recusado: arquivo muito pequeno ou com baixa qualidade.",
      });
      return;
    }

    if (!aiSettings.active) {
      resolve({
        status: "attached",
        message: "Anexado sem analise de IA. Validacao automatica inativa nas configuracoes.",
      });
      return;
    }

    if (file.type === "application/pdf") {
      resolve({
        status: "approved",
        message: buildAiValidationMessage(document, aiSettings),
      });
      return;
    }

    const image = new Image();
    const imageUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      const lowResolution = image.width < 900 || image.height < 700;

      if (lowResolution) {
        resolve({
          status: "rejected",
          message: "Recusado: imagem com baixa resolucao ou dificil de ler.",
        });
        return;
      }

      resolve({
        status: "approved",
        message: buildAiValidationMessage(document, aiSettings),
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      resolve({
        status: "rejected",
        message: "Recusado: nao foi possivel ler a imagem enviada.",
      });
    };

    image.src = imageUrl;
  });
}

function buildAiValidationMessage(document, aiSettings) {
  const rule = document.modelHint?.trim();
  const provider = aiSettings.provider || "IA externa";
  return rule
    ? `Aprovado por ${provider}: arquivo compativel com a regra "${rule}".`
    : `Aprovado por ${provider}: arquivo compativel e com qualidade minima.`;
}

function formatMonthYear(monthYear) {
  const [month, year] = monthYear.split("/");
  const names = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Marco",
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

function stateToUf(value = "") {
  const normalized = normalizeText(value);
  const states = {
    acre: "AC",
    alagoas: "AL",
    amapa: "AP",
    amazonas: "AM",
    bahia: "BA",
    ceara: "CE",
    "distrito federal": "DF",
    "espirito santo": "ES",
    goias: "GO",
    maranhao: "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    para: "PA",
    paraiba: "PB",
    parana: "PR",
    pernambuco: "PE",
    piaui: "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    rondonia: "RO",
    roraima: "RR",
    "santa catarina": "SC",
    "sao paulo": "SP",
    sergipe: "SE",
    tocantins: "TO",
  };
  if (/^[a-zA-Z]{2}$/.test(value.trim())) return value.trim().toUpperCase();
  return states[normalized] || "";
}

function formatBytes(value = 0) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function generateRequestPdf(request) {
  const animals = request.animals || [];
  const documents = request.documents || [];
  const animalRows = animals
    .map(
      (animal) => `
        <tr>
          <td>${escapeHtml(animal.name)}</td>
          <td>${escapeHtml(animal.species)}</td>
          <td>${escapeHtml(animal.sex)}</td>
          <td>${escapeHtml(animal.size)}</td>
          <td>${escapeHtml(animal.age)}</td>
          <td>${escapeHtml(animal.procedure)}</td>
        </tr>
      `,
    )
    .join("");
  const documentRows = documents
    .map(
      (document) => `
        <div class="document-item">
          <span>${escapeHtml(document.documentName || "Documento")}</span>
          <strong>${escapeHtml(document.fileName || "Arquivo anexado")}</strong>
        </div>
      `,
    )
    .join("");
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Solicitacao ${escapeHtml(request.protocol)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #172026; margin: 0; line-height: 1.45; }
          .page { min-height: 268mm; page-break-after: always; display: flex; flex-direction: column; gap: 14px; }
          .page:last-child { page-break-after: auto; }
          .pdf-header {
            border-radius: 14px;
            background: linear-gradient(135deg, #10364f, #1479b8);
            color: #ffffff;
            padding: 20px 22px;
            display: flex;
            justify-content: space-between;
            gap: 18px;
          }
          .kicker, .summary-card span, .data-item span, .document-item span {
            color: #5b6b7a;
            display: block;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .pdf-header .kicker { color: #b9f3ff; }
          h1 { margin: 6px 0 0; font-size: 25px; line-height: 1.08; }
          .protocol-box {
            min-width: 156px;
            border: 1px solid rgba(255, 255, 255, 0.32);
            border-radius: 12px;
            padding: 12px;
            text-align: right;
            align-self: flex-start;
          }
          .protocol-box span { display: block; color: #b9f3ff; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          .protocol-box strong { display: block; font-size: 18px; }
          .summary-grid, .data-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
          .data-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .summary-card, .data-item, .document-item {
            border: 1px solid #dbeaf3;
            border-radius: 10px;
            background: #f8fbfd;
            padding: 10px 12px;
            min-height: 58px;
          }
          .summary-card strong, .data-item strong, .document-item strong {
            display: block;
            margin-top: 3px;
            overflow-wrap: anywhere;
          }
          .section { display: grid; gap: 9px; }
          .section-title { display: flex; align-items: center; gap: 10px; color: #10364f; font-weight: 900; }
          .section-title::before { content: ""; width: 8px; height: 24px; border-radius: 999px; background: #38a8e8; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #dbeaf3; border-radius: 10px; }
          th, td { padding: 9px 10px; text-align: left; font-size: 11px; border-bottom: 1px solid #e8f1f5; }
          th { background: #e6f5ff; color: #10364f; font-size: 10px; text-transform: uppercase; }
          tr:last-child td { border-bottom: 0; }
          .documents-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .declaration-page { page-break-before: always; }
          .declaration-card { border: 1px solid #dbeaf3; border-radius: 14px; padding: 20px; background: #f8fbfd; font-size: 14px; }
          .declaration-card p { margin: 0 0 14px; text-align: justify; }
          .signature { margin-top: auto; padding-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
          .signature div { text-align: center; border-top: 1px solid #172026; padding-top: 8px; font-size: 12px; }
          .footer { margin-top: auto; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        </style>
      </head>
      <body>
        <section class="page">
          <header class="pdf-header">
            <div>
              <span class="kicker">Requerimento municipal</span>
              <h1>Solicitacao de castracao animal</h1>
            </div>
            <div class="protocol-box"><span>Protocolo</span><strong>${escapeHtml(request.protocol)}</strong></div>
          </header>
          <div class="summary-grid">
            <div class="summary-card"><span>Data de abertura</span><strong>${escapeHtml(request.createdAt)}</strong></div>
            <div class="summary-card"><span>Status</span><strong>${escapeHtml(statusLabels[request.status] || request.status)}</strong></div>
            <div class="summary-card"><span>Data escolhida</span><strong>${escapeHtml(request.preferredSchedule || "Nao informada")}</strong></div>
            <div class="summary-card"><span>Tipo</span><strong>${escapeHtml(request.type || "Nao informado")}</strong></div>
            <div class="summary-card"><span>Local da agenda</span><strong>${escapeHtml(request.scheduleLocationName || "A confirmar")}</strong></div>
            <div class="summary-card"><span>Responsavel</span><strong>${escapeHtml(request.responsible || "Sistema")}</strong></div>
          </div>
          <section class="section">
            <div class="section-title">Dados do tutor</div>
            <div class="data-grid two">
              <div class="data-item"><span>Nome</span><strong>${escapeHtml(request.tutor)}</strong></div>
              <div class="data-item"><span>CPF</span><strong>${escapeHtml(request.cpf)}</strong></div>
              <div class="data-item"><span>Email</span><strong>${escapeHtml(request.email || "Nao informado")}</strong></div>
              <div class="data-item"><span>Telefone</span><strong>${escapeHtml(request.phone)}</strong></div>
              <div class="data-item"><span>CEP</span><strong>${escapeHtml(request.cep || "Nao informado")}</strong></div>
              <div class="data-item"><span>Endereco</span><strong>${escapeHtml(request.address)}</strong></div>
            </div>
          </section>
          <section class="section">
            <div class="section-title">Animais vinculados</div>
            <table>
              <thead><tr><th>Nome</th><th>Especie</th><th>Sexo</th><th>Porte</th><th>Idade</th><th>Procedimento</th></tr></thead>
              <tbody>${animalRows}</tbody>
            </table>
          </section>
          <section class="section">
            <div class="section-title">Documentos anexados</div>
            <div class="documents-grid">${documentRows || '<div class="document-item"><span>Documentos</span><strong>Nenhum anexo informado</strong></div>'}</div>
          </section>
          <footer class="footer"><span>CastraGestao</span><span>Pagina 1 de 2</span></footer>
        </section>
        <section class="page declaration-page">
          <header class="pdf-header">
            <div>
              <span class="kicker">Declaracao do tutor</span>
              <h1>Responsabilidade e autorizacao</h1>
            </div>
            <div class="protocol-box"><span>Protocolo</span><strong>${escapeHtml(request.protocol)}</strong></div>
          </header>
          <div class="declaration-card">
            <p>Eu, <strong>${escapeHtml(request.tutor)}</strong>, inscrito(a) no CPF <strong>${escapeHtml(request.cpf)}</strong>, declaro que as informacoes prestadas neste requerimento sao verdadeiras e autorizo o registro dos dados para triagem, agendamento e acompanhamento do procedimento solicitado.</p>
            <p>Declaro ciencia dos cuidados pre e pos-cirurgicos, das responsabilidades de acompanhamento do animal, da necessidade de cumprir as orientacoes fornecidas pela equipe responsavel e de manter os contatos informados disponiveis para comunicacoes sobre a solicitacao.</p>
            <p>Estou ciente de que a solicitacao podera passar por analise documental, validacao das informacoes, confirmacao de agenda e eventuais solicitacoes de complementacao antes da realizacao do atendimento.</p>
          </div>
          <div class="signature">
            <div>Assinatura do tutor/responsavel</div>
            <div>Assinatura/validacao da equipe</div>
          </div>
          <footer class="footer"><span>CastraGestao</span><span>Pagina 2 de 2</span></footer>
        </section>
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.title = `Solicitacao ${request.protocol}`;
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 300);
  };

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

function coordinateToPercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(8, Math.min(92, Math.abs(number * 7) % 84));
}

function getMapCenter(schedules = [], municipalities = []) {
  const located = schedules.find((day) => Number.isFinite(Number(day.latitude)) && Number.isFinite(Number(day.longitude)));
  if (located) return { lat: Number(located.latitude), lng: Number(located.longitude) };
  return municipalities.length > 0 ? { lat: -14.235, lng: -51.9253 } : { lat: -22.9068, lng: -43.1729 };
}

function latLngToTile(lat, lng, zoom) {
  const pixel = latLngToWorldPixel(lat, lng, zoom);
  return {
    x: Math.floor(pixel.x / 256),
    y: Math.floor(pixel.y / 256),
  };
}

function projectMapPoint(lat, lng, center, zoom, fallbackX, fallbackY) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { x: fallbackX, y: fallbackY };
  const point = latLngToWorldPixel(latitude, longitude, zoom);
  const centerPoint = latLngToWorldPixel(center.lat, center.lng, zoom);
  return {
    x: Math.max(4, Math.min(96, 50 + (point.x - centerPoint.x) / 7)),
    y: Math.max(4, Math.min(96, 50 + (point.y - centerPoint.y) / 5)),
  };
}

function latLngToWorldPixel(lat, lng, zoom) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function worldPixelToLatLng(x, y, zoom) {
  const scale = 256 * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat: Math.max(-85, Math.min(85, lat)), lng };
}

function panMapCenter(center, zoom, deltaX, deltaY) {
  const pixel = latLngToWorldPixel(center.lat, center.lng, zoom);
  return worldPixelToLatLng(pixel.x + deltaX, pixel.y + deltaY, zoom);
}

function getTileUrl(x, y, zoom, mapType) {
  if (mapType === "satellite") {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
  }
  const wrappedX = ((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
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

function FormSection({ title, children }) {
  return (
    <div className="form-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="info-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Chip({ children }) {
  return <span className="chip">{children}</span>;
}

function Chart({ title, type }) {
  return (
    <div className={`chart-card ${type}`}>
      <div className="chart-head">
        <strong>{title}</strong>
        <span>Interativo</span>
      </div>
      <div className="chart-visual">
        <span />
        <span />
        <span />
        <span />
        <span />
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
  return {
    total: requests.length,
    pending: requests.filter((request) => !["REALIZADA", "CANCELADA", "INDEFERIDA"].includes(request.status)).length,
    done: requests.filter((request) => request.status === "REALIZADA").length,
  };
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(<App />);
