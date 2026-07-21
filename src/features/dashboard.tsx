import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Layers3,
  LineChart,
  MapPin,
  PawPrint,
  ShieldCheck,
  Stethoscope,
  XCircle,
} from "lucide-react";
import type { AnyRecord } from "../types";
import {
  initialRequestTypes,
  initialTeams,
  normalizeRequest,
  normalizeScheduleDateText,
  requestHasTag,
  requestTypeLabel,
} from "../domain";
import { escapeHtml, normalizeText } from "../utils";
import { countBy, getRequestClosedByName, getRequestTypeName, getRequestUserName, parseAnyDate, topItems } from "../analytics";

type PeriodKey = "30" | "90" | "365" | "all";
type DashboardTab = "gestao" | "operacao" | "processos" | "produtividade" | "territorio" | "estatisticas";

const PERIOD_OPTIONS: { id: PeriodKey; label: string }[] = [
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "365", label: "12 meses" },
  { id: "all", label: "Tudo" },
];

const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: "gestao", label: "Gestão" },
  { id: "operacao", label: "Operação" },
  { id: "processos", label: "Processos" },
  { id: "produtividade", label: "Produtividade" },
  { id: "territorio", label: "Território" },
  { id: "estatisticas", label: "Estatísticas" },
];

const PROCESS_STAGES = [
  { id: "NOVA", label: "Novas" },
  { id: "AGENDADA", label: "Agendadas" },
  { id: "REALIZADA", label: "Realizadas" },
  { id: "CANCELADA", label: "Canceladas" },
];

export function DashboardView({
  requests = [],
  adoptionAnimals = [],
  scheduleDays = [],
  requestTypes = initialRequestTypes,
  teams = initialTeams,
  currentUser = null,
}: AnyRecord) {
  const [period, setPeriod] = useState<PeriodKey>("90");
  const [activeTab, setActiveTab] = useState<DashboardTab>("gestao");

  const normalizedRequests = useMemo(() => requests.map(normalizeRequest), [requests]);

  const filteredRequests = useMemo(() => {
    const periodStart = getPeriodStart(period);
    return normalizedRequests.filter((request) => {
      const requestDate = getOperationalDate(request);
      return isInDashboardPeriod(requestDate, periodStart);
    });
  }, [normalizedRequests, period]);

  const filteredAdoptions = useMemo(() => {
    const periodStart = getPeriodStart(period);
    return adoptionAnimals.filter((animal: AnyRecord) => {
      const date = parseAnyDate(animal.adopted_at || animal.adoptedAt || animal.createdAt || animal.created_at);
      return isInDashboardPeriod(date, periodStart);
    });
  }, [adoptionAnimals, period]);

  const filteredSchedules = useMemo(() => {
    const periodStart = getPeriodStart(period);
    return scheduleDays.filter((day: AnyRecord) => {
      if (day.active === false) return false;
      const date = parseAnyDate(normalizeScheduleDateText(day.date));
      return isInDashboardPeriod(date, periodStart);
    });
  }, [scheduleDays, period]);

  const filteredUsers = useMemo(() => {
    return teams.users || [];
  }, [teams]);

  const intelligence = useMemo(() => {
    const total = filteredRequests.length;
    const activeQueue = filteredRequests.filter((request) => request.status === "NOVA" || request.status === "AGENDADA").length;
    const inAnalysis = filteredRequests.filter((request) => request.status === "NOVA").length;
    const approved = filteredRequests.filter((request) => request.status === "AGENDADA").length;
    const waitingProcedure = filteredRequests.filter((request) => request.status === "AGENDADA").length;
    const completed = filteredRequests.filter((request) => request.status === "REALIZADA").length;
    const absent = 0;
    const canceled = filteredRequests.filter((request) => request.status === "CANCELADA").length;
    const archived = filteredRequests.filter((request) => request.status === "REALIZADA" || request.status === "CANCELADA").length;
    const rejected = filteredRequests.filter((request) => {
      const cancelReason = (request.workflow_data || request.workflowData || {}).cancelReason || "";
      return request.status === "CANCELADA" && cancelReason === "Indeferido";
    }).length;
    const attendanceBase = completed + canceled;
    const attendanceRate = pct(completed, attendanceBase);
    const conclusionRate = pct(completed + canceled, total);
    const approvalRate = pct(approved, total);
    const activeSchedules = filteredSchedules.length;
    const mutirons = filteredSchedules.filter((day: AnyRecord) => normalizeText(day.kind).includes("mutirao")).length;
    const totalCapacity = filteredSchedules.reduce((sum: number, day: AnyRecord) => sum + Number(day.vacancies || 0), 0);
    const usedCapacity = filteredRequests.filter((request) => request.preferredSchedule || request.appointment).length;
    const averageFlowDays = averageDays(filteredRequests);
    const staleQueue = filteredRequests.filter((request) => {
      if (request.status === "REALIZADA" || request.status === "CANCELADA") return false;
      const createdAt = parseAnyDate(request.createdAt);
      return createdAt ? daysSince(createdAt) >= 7 : false;
    }).length;
    const capacityUsage = pct(usedCapacity, totalCapacity);
    const openRate = pct(activeQueue, total);

    return {
      total,
      activeQueue,
      inAnalysis,
      approved,
      waitingProcedure,
      completed,
      absent,
      canceled,
      archived,
      rejected,
      attendanceRate,
      conclusionRate,
      approvalRate,
      activeSchedules,
      mutirons,
      totalCapacity,
      usedCapacity,
      averageFlowDays,
      staleQueue,
      capacityUsage,
      openRate,
    };
  }, [filteredRequests, filteredSchedules]);

  const operational = useMemo(() => {
    const byResponsible = topItems(countBy(filteredRequests, (request) => getRequestUserName(request)), 7);
    const bySector = topItems(countBy(filteredRequests, (request) => request.assignedSectorName || getTeamSectorName(request.assignedSectorId, teams) || "Sem setor"), 7);
    const byCloser = topItems(countBy(filteredRequests.filter((request) => request.status === "REALIZADA" || request.status === "CANCELADA"), (request) => getRequestClosedByName(request, teams, currentUser)), 6);
    const byMonth = buildMonthlySeries(filteredRequests);
    const byStatus = PROCESS_STAGES.map((stage) => ({ label: stage.label, value: countStage(filteredRequests, stage.id) })).filter((item) => item.value > 0);
    const bottlenecks = topItems(byStatus.filter((item) => !["Realizadas", "Arquivadas"].includes(item.label)).sort((a, b) => b.value - a.value), 5);
    const byType = topItems(countBy(filteredRequests, (request) => getRequestTypeName(request, requestTypes)), 6);
    return { byResponsible, bySector, byCloser, byMonth, byStatus, bottlenecks, byType };
  }, [filteredRequests, teams, currentUser, requestTypes]);

  const operationQueue = useMemo(() => {
    const openRequests = filteredRequests.filter((request) => request.status === "NOVA" || request.status === "AGENDADA");
    const unassigned = openRequests.filter((request) => !request.assignedUserId && !request.responsible).length;
    const waiting3 = openRequests.filter((request) => isOlderThan(request, 3)).length;
    const waiting7 = openRequests.filter((request) => isOlderThan(request, 7)).length;
    const waiting15 = openRequests.filter((request) => isOlderThan(request, 15)).length;
    return { unassigned, waiting3, waiting7, waiting15 };
  }, [filteredRequests]);

  const upcomingSchedules = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredSchedules
      .map((day: AnyRecord) => {
        const date = parseAnyDate(normalizeScheduleDateText(day.date));
        const used = filteredRequests.filter((request) => normalizeScheduleDateText(request.preferredSchedule || request.appointment) === normalizeScheduleDateText(day.date)).length;
        return {
          label: day.date || "Agenda",
          value: used,
          total: Number(day.vacancies || 0),
          secondary: `${Math.max(Number(day.vacancies || 0) - used, 0)} vagas`,
          date,
        };
      })
      .filter((item) => item.date && item.date >= today)
      .sort((left, right) => Number(left.date) - Number(right.date))
      .slice(0, 5);
  }, [filteredRequests, filteredSchedules]);

  const operationSignals = useMemo(() => [
    {
      label: "Sem responsável",
      value: operationQueue.unassigned,
      detail: "processos abertos sem dono",
      tone: operationQueue.unassigned ? "warn" : "ok",
    },
    {
      label: "Fila há 3+ dias",
      value: operationQueue.waiting3,
      detail: "pedem acompanhamento",
      tone: operationQueue.waiting3 ? "warn" : "ok",
    },
    {
      label: "Fila há 7+ dias",
      value: operationQueue.waiting7,
      detail: "atraso relevante",
      tone: operationQueue.waiting7 ? "warn" : "ok",
    },
    {
      label: "Fila há 15+ dias",
      value: operationQueue.waiting15,
      detail: "risco operacional",
      tone: operationQueue.waiting15 ? "warn" : "ok",
    },
  ], [operationQueue]);

  const processSignals = useMemo(() => [
    {
      label: "Conclusão",
      value: `${intelligence.conclusionRate}%`,
      detail: `${intelligence.archived} processos encerrados`,
      tone: intelligence.conclusionRate >= 80 ? "ok" : "info",
    },
    {
      label: "Fila há 7+ dias",
      value: operationQueue.waiting7,
      detail: "retenção relevante",
      tone: operationQueue.waiting7 ? "warn" : "ok",
    },
    {
      label: "Canceladas",
      value: intelligence.canceled,
      detail: "interrupções no fluxo",
      tone: intelligence.canceled ? "warn" : "ok",
    },
    {
      label: "Ausências",
      value: intelligence.absent,
      detail: `${intelligence.attendanceRate}% de comparecimento`,
      tone: intelligence.absent ? "warn" : "ok",
    },
  ], [intelligence, operationQueue]);

  const adoption = useMemo(() => {
    const adopted = filteredAdoptions.filter((animal: AnyRecord) => animal.status === "adotado");
    const available = filteredAdoptions.filter((animal: AnyRecord) => animal.status !== "adotado");
    const interests = filteredAdoptions.reduce((sum: number, animal: AnyRecord) => sum + (animal.interests?.length || 0), 0);
    return {
      total: filteredAdoptions.length,
      adopted: adopted.length,
      available: available.length,
      interests,
      adoptionRate: pct(adopted.length, filteredAdoptions.length),
      averageAdoptionDays: averageAdoptionDays(adopted),
      bySpecies: topItems(countBy(filteredAdoptions, (animal) => animal.species || "Não informado"), 6),
      byProfile: topItems(countBy(filteredAdoptions, (animal) => animal.sex || "Não informado"), 6),
      monthly: buildAdoptionSeries(filteredAdoptions),
    };
  }, [filteredAdoptions]);

  const castration = useMemo(() => {
    const castrationRequests = filteredRequests.filter((request) => normalizeText(requestTypeLabel(request)).includes("castracao"));
    const completed = castrationRequests.filter((request) => request.status === "REALIZADA").length;
    const approved = castrationRequests.filter((request) => request.status === "AGENDADA").length;
    const waiting = castrationRequests.filter((request) => request.status === "AGENDADA").length;
    const absent = 0;
    return {
      total: castrationRequests.length,
      completed,
      approved,
      waiting,
      attendanceRate: pct(completed, completed + absent),
      byNeighborhood: topItems(countBy(castrationRequests, (request) => request.neighborhood || "Não informado"), 6),
      byPeriod: buildMonthlySeries(castrationRequests),
      scheduleUsage: topItems(filteredSchedules.map((day: AnyRecord) => {
        const used = filteredRequests.filter((request) => normalizeScheduleDateText(request.preferredSchedule || request.appointment) === normalizeScheduleDateText(day.date)).length;
        return { label: day.date || "Agenda", value: used, secondary: `${Math.max(Number(day.vacancies || 0) - used, 0)} vagas` };
      }), 6),
    };
  }, [filteredRequests, filteredSchedules]);

  const territorial = useMemo(() => {
    const realizadas = filteredRequests.filter((request) => request.status === "REALIZADA");
    const byNeighborhood = topItems(countBy(realizadas, (request) => request.neighborhood || "Não informado"), 8);
    const neighborhoodsReached = new Set(realizadas.map((request) => request.neighborhood).filter(Boolean)).size;
    const total = realizadas.length;
    return { byNeighborhood, neighborhoodsReached, total };
  }, [filteredRequests]);

  const decisionAnalysis = useMemo(() => {
    const waitingProcedureRequests = filteredRequests.filter((request) => request.status === "AGENDADA");
    const incompleteRegistrations = filteredRequests.filter(hasIncompleteRegistration).length;
    const futureSchedules = filteredSchedules
      .map((day: AnyRecord) => {
        const date = parseAnyDate(normalizeScheduleDateText(day.date));
        const used = filteredRequests.filter((request) => normalizeScheduleDateText(request.preferredSchedule || request.appointment) === normalizeScheduleDateText(day.date)).length;
        const vacancies = Number(day.vacancies || 0);
        return { date, vacancies, used };
      })
      .filter((day) => day.date && day.date >= startOfDay(new Date()) && day.vacancies > 0);
    const averageScheduleCapacity = futureSchedules.length
      ? Math.max(1, Math.round(futureSchedules.reduce((sum, day) => sum + day.vacancies, 0) / futureSchedules.length))
      : 0;
    const queueAgendaEquivalent = averageScheduleCapacity
      ? Math.ceil(waitingProcedureRequests.length / averageScheduleCapacity)
      : 0;
    const scheduleRisk = futureSchedules.filter((day) => {
      const usage = pct(day.used, day.vacancies);
      return usage < 50 || usage >= 95;
    }).length;
    const priorityNeighborhood = getPriorityNeighborhood(filteredRequests);

    return [
      {
        label: "Território",
        value: priorityNeighborhood.label,
        detail: priorityNeighborhood.value ? `${priorityNeighborhood.value} casos pedem foco` : "sem bairro crítico",
        tone: priorityNeighborhood.value ? "warn" : "ok",
      },
      {
        label: "Fila",
        value: waitingProcedureRequests.length,
        detail: queueAgendaEquivalent ? `${queueAgendaEquivalent} agenda(s) para absorver` : "sem capacidade futura",
        tone: waitingProcedureRequests.length ? "warn" : "ok",
      },
      {
        label: "Cadastro",
        value: incompleteRegistrations,
        detail: "registros incompletos",
        tone: incompleteRegistrations ? "warn" : "ok",
      },
      {
        label: "Agenda",
        value: scheduleRisk,
        detail: "datas com risco",
        tone: scheduleRisk ? "info" : "ok",
      },
    ];
  }, [filteredRequests, filteredSchedules]);

  const users = useMemo(() => {
    const active = filteredUsers.filter((user: AnyRecord) => user.active !== false).length;
    const inactive = filteredUsers.filter((user: AnyRecord) => user.active === false).length;
    const scopedSectors = (teams.sectors || []).filter((sector: AnyRecord) => {
      if (sector.active === false) return false;
      return true;
    });
    return {
      total: filteredUsers.length,
      active,
      inactive,
      sectors: scopedSectors.length,
      byRole: topItems(countBy(filteredUsers, (user) => user.role || user.cargo || "Não informado"), 7),
      bySector: topItems(countBy(filteredUsers, (user) => getPrimaryUserSectorName(user, teams) || "Sem setor"), 7),
    };
  }, [filteredUsers, teams]);

  const productivity = useMemo(() => {
    const assignedVolume = operational.byResponsible.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const closedVolume = operational.byCloser.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const topResponsible = operational.byResponsible[0];
    const concentrationRate = pct(Number(topResponsible?.value || 0), assignedVolume);
    return {
      assignedVolume,
      closedVolume,
      concentrationRate,
      topResponsible: topResponsible?.label || "Sem responsável",
    };
  }, [operational]);

  const productivitySignals = useMemo(() => [
    {
      label: "Usuários ativos",
      value: users.active,
      detail: `${users.inactive} inativos`,
      tone: users.active ? "ok" : "warn",
    },
    {
      label: "Sem responsável",
      value: operationQueue.unassigned,
      detail: "processos abertos sem dono",
      tone: operationQueue.unassigned ? "warn" : "ok",
    },
    {
      label: "Encerramentos",
      value: productivity.closedVolume,
      detail: "produção concluída",
      tone: productivity.closedVolume ? "ok" : "info",
    },
    {
      label: "Concentração de carga",
      value: `${productivity.concentrationRate}%`,
      detail: productivity.topResponsible,
      tone: productivity.concentrationRate >= 70 ? "warn" : "info",
    },
  ], [operationQueue, productivity, users]);

  const statisticsSignals = useMemo(() => [
    {
      label: "Comparecimento",
      value: `${intelligence.attendanceRate}%`,
      detail: `${intelligence.absent} ausências`,
      tone: intelligence.attendanceRate >= 80 ? "ok" : "warn",
    },
    {
      label: "Agendamento",
      value: `${intelligence.approvalRate}%`,
      detail: `${intelligence.approved} agendadas`,
      tone: intelligence.approvalRate >= 80 ? "ok" : "info",
    },
    {
      label: "Conclusão",
      value: `${intelligence.conclusionRate}%`,
      detail: `${intelligence.archived} encerrados`,
      tone: intelligence.conclusionRate >= 80 ? "ok" : "info",
    },
    {
      label: "Adoção",
      value: `${adoption.adoptionRate}%`,
      detail: `${adoption.adopted} adotados`,
      tone: adoption.adoptionRate ? "info" : "warn",
    },
  ], [adoption, intelligence]);

  const managementSignals = useMemo(() => {
    return [
      {
        label: "Fila ativa",
        value: intelligence.activeQueue,
        detail: `${intelligence.openRate}% do volume ainda em aberto`,
        tone: intelligence.openRate >= 50 ? "warn" : "info",
      },
      {
        label: "Processos há 7+ dias",
        value: intelligence.staleQueue,
        detail: intelligence.staleQueue ? "pedem acompanhamento" : "sem acumulação relevante",
        tone: intelligence.staleQueue ? "warn" : "ok",
      },
      {
        label: "Uso da agenda",
        value: `${intelligence.capacityUsage}%`,
        detail: `${intelligence.usedCapacity}/${intelligence.totalCapacity || 0} vagas ocupadas`,
        tone: intelligence.capacityUsage >= 80 ? "ok" : intelligence.capacityUsage ? "info" : "warn",
      },
      {
        label: "Comparecimento",
        value: `${intelligence.attendanceRate}%`,
        detail: `${intelligence.absent} ausências registradas`,
        tone: intelligence.attendanceRate >= 80 ? "ok" : intelligence.attendanceRate ? "warn" : "info",
      },
    ];
  }, [intelligence]);

  const territorialSignals = useMemo(() => [
    {
      label: "Realizadas",
      value: intelligence.completed,
      detail: "processos concluídos no período",
      tone: intelligence.completed ? "ok" : "info",
    },
    {
      label: "Bairros cobertos",
      value: territorial.neighborhoodsReached,
      detail: "com ao menos uma realização",
      tone: territorial.neighborhoodsReached ? "ok" : "info",
    },
    {
      label: "Aguardando procedimento",
      value: intelligence.waitingProcedure,
      detail: "fila pré-execução",
      tone: intelligence.waitingProcedure ? "warn" : "ok",
    },
    {
      label: "Taxa de execução",
      value: `${pct(castration.completed, Math.max(territorial.total, 1))}%`,
      detail: `${castration.completed} castrações realizadas`,
      tone: pct(castration.completed, Math.max(territorial.total, 1)) >= 50 ? "ok" : "info",
    },
  ], [territorial, intelligence, castration]);

  const kpisByTab: Record<DashboardTab, AnyRecord[]> = {
    gestao: [
      { label: "Solicitações", value: intelligence.total, helper: "volume no período", icon: FileText },
      { label: "Fila ativa", value: intelligence.activeQueue, helper: "processos em andamento", icon: ClipboardList },
      { label: "Conclusão", value: `${intelligence.conclusionRate}%`, helper: "solicitações concluídas", icon: CheckCircle2, tone: "ok" },
      { label: "Tramitação média", value: `${intelligence.averageFlowDays}d`, helper: "tempo operacional", icon: Clock },
      { label: "Bairros", value: territorial.neighborhoodsReached, helper: "com demanda registrada", icon: MapPin },
      { label: "Adoção", value: `${adoption.adoptionRate}%`, helper: "taxa de adoção", icon: PawPrint, tone: "info" },
    ],
    operacao: [
      { label: "Fila ativa", value: intelligence.activeQueue, helper: "processos em andamento", icon: ClipboardList },
      { label: "Em análise", value: intelligence.inAnalysis, helper: "aguardam triagem", icon: Clock },
      { label: "Agendadas", value: intelligence.approved, helper: `${intelligence.approvalRate}% do total`, icon: ShieldCheck },
      { label: "Aguardando procedimento", value: intelligence.waitingProcedure, helper: "fila pré-execução", icon: CalendarDays },
      { label: "Agendas ativas", value: intelligence.activeSchedules, helper: "dias operacionais", icon: CalendarDays },
      { label: "Capacidade", value: `${intelligence.usedCapacity}/${intelligence.totalCapacity}`, helper: "ocupação de agendas", icon: Layers3 },
    ],
    processos: [
      { label: "Em análise", value: intelligence.inAnalysis, helper: "etapa inicial", icon: Clock },
      { label: "Agendadas", value: intelligence.approved, helper: "aprovadas no fluxo", icon: ShieldCheck },
      { label: "Encerradas", value: intelligence.archived, helper: "processos encerrados", icon: ClipboardCheck },
      { label: "Canceladas", value: intelligence.canceled, helper: "interrupções registradas", icon: XCircle, tone: "warn" },
      { label: "Realizadas", value: intelligence.completed, helper: "execução confirmada", icon: CheckCircle2, tone: "ok" },
      { label: "Ausências", value: intelligence.absent, helper: "não comparecimento", icon: Activity },
    ],
    produtividade: [
      { label: "Usuários", value: users.total, helper: "cadastrados no recorte", icon: ClipboardList },
      { label: "Ativos", value: users.active, helper: "aptos para operação", icon: ShieldCheck, tone: "ok" },
      { label: "Inativos", value: users.inactive, helper: "fora da operação", icon: XCircle, tone: "warn" },
      { label: "Setores", value: users.sectors, helper: "equipes estruturadas", icon: Layers3 },
      { label: "Responsáveis", value: operational.byResponsible.length, helper: "com demanda atribuída", icon: Activity },
      { label: "Encerramentos", value: operational.byCloser.reduce((sum, item) => sum + Number(item.value || 0), 0), helper: "produção concluída", icon: ClipboardCheck },
    ],
    territorio: [
      { label: "Realizadas", value: intelligence.completed, helper: "processos realizados", icon: ShieldCheck, tone: "ok" },
      { label: "Bairros cobertos", value: territorial.neighborhoodsReached, helper: "com ao menos uma realização", icon: MapPin },
      { label: "Castrações", value: castration.completed, helper: "procedimentos executados", icon: Stethoscope },
      { label: "Fila ativa", value: intelligence.activeQueue, helper: "processos em andamento", icon: ClipboardList },
      { label: "Aguardando", value: intelligence.waitingProcedure, helper: "fila pré-procedimento", icon: CalendarDays },
      { label: "Ausências", value: intelligence.absent, helper: "não comparecimento", icon: Activity },
    ],
    estatisticas: [
      { label: "Solicitações", value: intelligence.total, helper: "base estatística", icon: FileText },
      { label: "Comparecimento", value: `${intelligence.attendanceRate}%`, helper: `${intelligence.absent} ausências`, icon: Activity, tone: "info" },
      { label: "Deferimento", value: `${intelligence.approvalRate}%`, helper: "taxa de aprovação", icon: ShieldCheck },
      { label: "Conclusão", value: `${intelligence.conclusionRate}%`, helper: "taxa geral", icon: CheckCircle2, tone: "ok" },
      { label: "Adoção", value: `${adoption.adoptionRate}%`, helper: `${adoption.adopted} adotados`, icon: PawPrint },
      { label: "Tempo médio", value: `${intelligence.averageFlowDays}d`, helper: "tramitação", icon: Clock },
    ],
  };

  const kpis = kpisByTab[activeTab];

  return (
    <section className={`opdash-root is-${activeTab}`}>
      <header className="opdash-hero">
        <div className="opdash-hero-copy">
          <span>Fluxo operacional</span>
          <h2>Dashboard de gestão</h2>
          <p>Leitura geral de solicitações, agenda, castrações, adoções e território.</p>
        </div>

        <nav className="opdash-nav" aria-label="Navegação do BI">
          <div className="opdash-tabs">
            {DASHBOARD_TABS.map((tab) => (
              <button key={tab.id} type="button" className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="opdash-toolbar" aria-label="Filtro de período">
            <span>Período</span>
            <div className="opdash-segment">
              {PERIOD_OPTIONS.map((item) => (
                <button key={item.id} type="button" className={period === item.id ? "is-active" : ""} onClick={() => setPeriod(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </header>

      <div className="opdash-kpis">
        {kpis.map((item) => <KpiCard key={item.label} item={item} />)}
      </div>

      {activeTab === "gestao" && (
        <div className="opdash-management-layout">
          <div className="opdash-management-main">
            <Panel title="Pulso gerencial" meta="leitura executiva do período">
              <div className="opdash-two-col opdash-two-col--management">
                <Trend title="Volume operacional por período" items={operational.byMonth} />
                <Funnel items={operational.byStatus} total={intelligence.total} />
              </div>
            </Panel>
            <div className="opdash-management-support">
              <Panel className="opdash-panel--fill" title="Demanda por tipo" meta="serviços mais solicitados">
                <Ranking title="Tipos de solicitação" items={operational.byType} />
              </Panel>
              <div className="opdash-management-territory-stack">
                <Panel className="opdash-panel--fill" title="Cobertura territorial" meta="onde a demanda se concentra">
                  <Ranking title="Bairros com maior demanda" items={territorial.byNeighborhood} />
                </Panel>
                <Panel className="opdash-panel--protection" title="Proteção animal" meta="adoção no período">
                  <div className="opdash-mini-kpis opdash-mini-kpis--protection">
                    <MiniMetric label="Disponíveis" value={adoption.available} />
                    <MiniMetric label="Adotados" value={adoption.adopted} />
                    <MiniMetric label="Interesses" value={adoption.interests} />
                    <MiniMetric label="Taxa" value={`${adoption.adoptionRate}%`} />
                  </div>
                </Panel>
              </div>
            </div>
          </div>
          <div className="opdash-management-side">
            <Panel className="opdash-panel--priority" title="Prioridades agora" meta="pontos que merecem decisão">
              <DecisionList items={decisionAnalysis} />
              <SignalList items={managementSignals} />
              <Ranking title="Gargalos principais" items={operational.bottlenecks} compact />
            </Panel>
          </div>
        </div>
      )}

      {activeTab === "operacao" && (
        <div className="opdash-operation-layout">
          <div className="opdash-operation-main">
            <Panel title="Fila operacional" meta="o que exige ação agora">
              <div className="opdash-two-col opdash-two-col--operation">
                <SignalList items={operationSignals} />
                <Funnel items={operational.byStatus} total={intelligence.total} />
              </div>
            </Panel>
            <div className="opdash-operation-support">
              <Panel className="opdash-panel--fill" title="Carga da equipe" meta="distribuição do trabalho">
                <Ranking title="Atendimentos por responsável" items={operational.byResponsible} />
              </Panel>
              <Panel className="opdash-panel--fill" title="Processos por setor" meta="onde a fila está concentrada">
                <Ranking title="Setores" items={operational.bySector} />
              </Panel>
            </div>
          </div>
          <div className="opdash-operation-side">
            <Panel title="Agenda operacional" meta="próximos dias e vagas">
              <ScheduleList items={upcomingSchedules} />
              <ProgressLine label="Capacidade ocupada" value={intelligence.usedCapacity} total={Math.max(intelligence.totalCapacity, 1)} />
            </Panel>
            <Panel className="opdash-panel--castration" title="Execução de castração" meta="resultado no período">
              <div className="opdash-mini-kpis opdash-mini-kpis--compact">
                <MiniMetric label="Realizadas" value={castration.completed} />
                <MiniMetric label="Deferidas" value={castration.approved} />
                <MiniMetric label="Aguardando" value={castration.waiting} />
                <MiniMetric label="Comparecimento" value={`${castration.attendanceRate}%`} />
              </div>
              <Ranking title="Execução por bairro" items={castration.byNeighborhood} />
            </Panel>
          </div>
        </div>
      )}

      {activeTab === "processos" && (
        <div className="opdash-process-layout">
          <div className="opdash-process-main">
            <Panel title="Fluxo processual" meta="tramitação, retenção e saídas">
              <Funnel items={operational.byStatus} total={intelligence.total} />
            </Panel>
            <div className="opdash-process-support">
              <Panel className="opdash-panel--fill" title="Gargalos principais" meta="onde o fluxo concentra retenção">
                <Ranking title="Etapas críticas" items={operational.bottlenecks} />
              </Panel>
              <Panel className="opdash-panel--fill" title="Encerramentos" meta="saídas do fluxo">
                <div className="opdash-mini-kpis">
                  <MiniMetric label="Realizadas" value={intelligence.completed} />
                  <MiniMetric label="Arquivadas" value={intelligence.archived} />
                  <MiniMetric label="Canceladas" value={intelligence.canceled} />
                  <MiniMetric label="Ausências" value={intelligence.absent} />
                </div>
              </Panel>
            </div>
          </div>
          <div className="opdash-process-side">
            <Panel title="Saúde do processo" meta="qualidade e envelhecimento">
              <SignalList items={processSignals} />
            </Panel>
            <Panel title="Tempo de tramitação" meta="leitura do período">
              <div className="opdash-mini-kpis opdash-mini-kpis--two">
                <MiniMetric label="Média" value={`${intelligence.averageFlowDays}d`} />
                <MiniMetric label="Fila ativa" value={intelligence.activeQueue} />
              </div>
              <ProgressLine label="Conclusão geral" value={intelligence.archived} total={Math.max(intelligence.total, 1)} />
            </Panel>
          </div>
        </div>
      )}

      {activeTab === "produtividade" && (
        <div className="opdash-productivity-layout">
          <div className="opdash-productivity-main">
            <Panel title="Carga e entrega" meta="demanda atribuída versus produção concluída">
              <div className="opdash-two-col">
                <Ranking title="Carga por responsável" items={operational.byResponsible} />
                <Ranking title="Encerramentos por responsável" items={operational.byCloser} />
              </div>
            </Panel>
            <div className="opdash-productivity-support">
              <Panel className="opdash-panel--fill" title="Processos por setor" meta="distribuição da demanda">
                <Ranking title="Setores com maior demanda" items={operational.bySector} />
              </Panel>
              <Panel className="opdash-panel--fill" title="Estrutura da equipe" meta="distribuição interna">
                <Ranking title="Usuários por setor" items={users.bySector} />
                <Ranking title="Usuários por cargo" items={users.byRole} compact />
              </Panel>
            </div>
          </div>
          <div className="opdash-productivity-side">
            <Panel title="Saúde da equipe" meta="capacidade e equilíbrio">
              <SignalList items={productivitySignals} />
            </Panel>
            <Panel title="Resumo de produção" meta="leitura do período">
              <div className="opdash-mini-kpis opdash-mini-kpis--two">
                <MiniMetric label="Atribuídos" value={productivity.assignedVolume} />
                <MiniMetric label="Encerrados" value={productivity.closedVolume} />
              </div>
              <ProgressLine label="Conclusão geral" value={intelligence.archived} total={Math.max(intelligence.total, 1)} />
            </Panel>
          </div>
        </div>
      )}

      {activeTab === "territorio" && (
        <div className="opdash-territory-layout">
          <div className="opdash-territory-main">
            <Panel title="Distribuição por bairro" meta={`${territorial.neighborhoodsReached} bairros com realizações`}>
              <Ranking title="Realizados" items={territorial.byNeighborhood} />
              <Ranking title="Castrações por bairro" items={castration.byNeighborhood} compact />
            </Panel>
            <Panel title="Perfil da demanda" meta="tipo de solicitação no território">
              <Ranking title="Tipos de procedimento" items={operational.byType} />
            </Panel>
          </div>
          <div className="opdash-territory-side">
            <Panel title="Saúde territorial" meta="execução e cobertura">
              <SignalList items={territorialSignals} />
            </Panel>
            <Panel title="Bairros prioritários" meta="maior demanda pendente">
              <Ranking title="Com fila ativa" items={topItems(countBy(filteredRequests.filter((r) => r.status === "NOVA" || r.status === "AGENDADA"), (r) => r.neighborhood || "Não informado"), 6)} compact />
            </Panel>
          </div>
        </div>
      )}

      {activeTab === "estatisticas" && (
        <div className="opdash-statistics-layout">
          <div className="opdash-statistics-main">
            <Panel title="Evolução estatística" meta="volume, castração e adoção">
              <div className="opdash-statistics-trends">
                <Trend title="Volume operacional por período" items={operational.byMonth} />
                <Trend title="Evolução mensal de castrações" items={castration.byPeriod} />
                <Trend title="Evolução mensal de adoções" items={adoption.monthly} />
              </div>
            </Panel>
            <div className="opdash-statistics-support">
              <Panel className="opdash-panel--fill" title="Perfil da demanda" meta="tipo e território">
                <Ranking title="Tipos de solicitação" items={operational.byType} />
                <Ranking title="Solicitações por bairro" items={territorial.byNeighborhood} compact />
              </Panel>
              <Panel className="opdash-panel--fill" title="Perfil animal" meta="espécies e adoção">
                <Ranking title="Espécies" items={adoption.bySpecies} />
                <Ranking title="Perfil" items={adoption.byProfile} compact />
              </Panel>
            </div>
          </div>
          <div className="opdash-statistics-side">
            <Panel title="Taxas do período" meta="eficiência operacional">
              <SignalList items={statisticsSignals} />
            </Panel>
            <Panel title="Resumo estatístico" meta="leitura consolidada">
              <div className="opdash-mini-kpis opdash-mini-kpis--two">
                <MiniMetric label="Solicitações" value={intelligence.total} />
                <MiniMetric label="Tempo médio" value={`${intelligence.averageFlowDays}d`} />
              </div>
              <ProgressLine label="Conclusão geral" value={intelligence.archived} total={Math.max(intelligence.total, 1)} />
            </Panel>
          </div>
        </div>
      )}
    </section>
  );
}

function KpiCard({ item }: { item: AnyRecord }) {
  const Icon = item.icon;
  return (
    <article className={`opdash-kpi ${item.tone ? `is-${item.tone}` : ""}`}>
      <div className="opdash-kpi-head">
        <span>{item.label}</span>
        <span className="opdash-kpi-icon">{Icon && <Icon size={17} />}</span>
      </div>
      <strong>{item.value}</strong>
      <small>{item.helper}</small>
    </article>
  );
}

function Panel({ title, meta, className = "", children }: AnyRecord) {
  return (
    <section className={`opdash-panel ${className}`}>
      <div className="opdash-panel-head">
        <div>
          <strong>{title}</strong>
          {meta && <span>{meta}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Ranking({ title, items = [], compact = false }: AnyRecord) {
  const max = Math.max(...items.map((item: AnyRecord) => Number(item.value || 0)), 1);
  return (
    <div className={`opdash-ranking ${compact ? "is-compact" : ""}`}>
      <h3>{title}</h3>
      {!items.length && <p className="opdash-empty">Sem dados no período.</p>}
      {items.map((item: AnyRecord) => (
        <div className="opdash-rank-row" key={item.label}>
          <div>
            <span>{item.label}</span>
            {item.secondary && <small>{item.secondary}</small>}
          </div>
          <div className="opdash-rank-track"><i style={{ width: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%` }} /></div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function Trend({ title, items = [] }: AnyRecord) {
  const max = Math.max(...items.map((item: AnyRecord) => Number(item.value || 0)), 1);
  return (
    <div className="opdash-trend">
      <h3><LineChart size={15} /> {title}</h3>
      <div className="opdash-trend-bars">
        {items.map((item: AnyRecord) => (
          <div key={item.label} title={`${item.label}: ${item.value}`}>
            <i style={{ height: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%` }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Funnel({ items = [], total = 0 }: AnyRecord) {
  const max = Math.max(...items.map((item: AnyRecord) => Number(item.value || 0)), total, 1);
  return (
    <div className="opdash-funnel">
      {items.map((item: AnyRecord) => (
        <div className="opdash-funnel-row" key={item.label}>
          <span>{item.label}</span>
          <div><i style={{ width: `${Math.max(6, (Number(item.value || 0) / max) * 100)}%` }} /></div>
          <strong>{item.value}</strong>
        </div>
      ))}
      {!items.length && <p className="opdash-empty">Sem dados processuais.</p>}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: any }) {
  return (
    <div className="opdash-mini">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProgressLine({ label, value, total }: { label: string; value: number; total: number }) {
  const percentage = Math.min(100, Math.round((value / total) * 100));
  return (
    <div className="opdash-progress">
      <div><span>{label}</span><strong>{percentage}%</strong></div>
      <i><b style={{ width: `${percentage}%` }} /></i>
    </div>
  );
}

function SignalList({ items = [] }: AnyRecord) {
  return (
    <div className="opdash-signals">
      {items.map((item: AnyRecord) => (
        <div className={`opdash-signal is-${item.tone || "info"}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  );
}

function DecisionList({ items = [] }: AnyRecord) {
  return (
    <div className="opdash-decisions">
      {items.map((item: AnyRecord) => (
        <div className={`opdash-decision is-${item.tone || "info"}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  );
}

function ScheduleList({ items = [] }: AnyRecord) {
  return (
    <div className="opdash-schedule-list">
      {!items.length && <p className="opdash-empty">Sem agendas futuras no período.</p>}
      {items.map((item: AnyRecord) => (
        <div className="opdash-schedule-row" key={item.label}>
          <div>
            <span>{item.label}</span>
            <small>{item.secondary}</small>
          </div>
          <strong>{item.value}/{item.total}</strong>
        </div>
      ))}
    </div>
  );
}


function getPeriodStart(period: PeriodKey) {
  if (period === "all") return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(period));
  date.setHours(0, 0, 0, 0);
  return date;
}

function getOperationalDate(request: AnyRecord) {
  return parseAnyDate(request.createdAt || request.created_at || request.preferredSchedule || request.appointment);
}

function isInDashboardPeriod(date: Date | null, periodStart: Date | null) {
  if (!periodStart) return true;
  if (!date) return false;
  return date >= periodStart;
}

function averageDays(requests: AnyRecord[]) {
  const values = requests.map((request) => {
    const start = parseAnyDate(request.createdAt);
    const end = parseAnyDate(request.updatedAt || request.signedAt) || new Date();
    if (!start || !end || end < start) return null;
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }).filter((value): value is number => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function isOlderThan(request: AnyRecord, days: number) {
  const createdAt = parseAnyDate(request.createdAt || request.created_at);
  return createdAt ? daysSince(createdAt) >= days : false;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function averageAdoptionDays(animals: AnyRecord[]) {
  const values = animals.map((animal) => {
    const start = parseAnyDate(animal.createdAt || animal.created_at);
    const end = parseAnyDate(animal.adopted_at || animal.adoptedAt || animal.updatedAt || animal.updated_at);
    if (!start || !end || end < start) return null;
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }).filter((value): value is number => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function countStage(requests: AnyRecord[], stage: string) {
  return requests.filter((request) => request.status === stage).length;
}

function buildMonthlySeries(requests: AnyRecord[]) {
  const months = new Map<string, number>();
  requests.forEach((request) => {
    const date = getOperationalDate(request);
    if (!date) return;
    const key = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
    months.set(key, (months.get(key) || 0) + 1);
  });
  return Array.from(months, ([label, value]) => ({ label, value })).slice(-8);
}

function buildAdoptionSeries(animals: AnyRecord[]) {
  const months = new Map<string, number>();
  animals.forEach((animal) => {
    const date = parseAnyDate(animal.adopted_at || animal.adoptedAt || animal.createdAt || animal.created_at);
    if (!date) return;
    const key = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
    months.set(key, (months.get(key) || 0) + 1);
  });
  return Array.from(months, ([label, value]) => ({ label, value })).slice(-8);
}

function getTeamSectorName(id = "", teams: AnyRecord = initialTeams) {
  return (teams.sectors || []).find((sector: AnyRecord) => sector.id === id)?.name || "";
}

function getPrimaryUserSectorName(user: AnyRecord = {}, teams: AnyRecord = initialTeams) {
  const sectorIds = Array.isArray(user.sectorIds) ? user.sectorIds : [user.sectorId].filter(Boolean);
  return sectorIds.map((id: string) => getTeamSectorName(id, teams)).filter(Boolean)[0] || "";
}

function hasIncompleteRegistration(request: AnyRecord = {}) {
  return !request.phone || !request.cpf || !request.address || !request.neighborhood || !request.cep;
}

function getPriorityNeighborhood(requests: AnyRecord[]) {
  const scores = new Map<string, number>();
  requests.forEach((request) => {
    const neighborhood = request.neighborhood || "Não informado";
    if (neighborhood === "Não informado") return;
    let score = 0;
    if (request.status === "NOVA" || request.status === "AGENDADA") score += 2;
    if (request.status === "AGENDADA") score += 3;
    if (request.status === "REALIZADA") score -= 1;
    if (score > 0) scores.set(neighborhood, (scores.get(neighborhood) || 0) + score);
  });
  const [label = "Sem prioridade", value = 0] = Array.from(scores.entries()).sort((left, right) => right[1] - left[1])[0] || [];
  return { label, value };
}
