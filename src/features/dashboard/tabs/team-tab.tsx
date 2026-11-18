import { useMemo } from "react";
import { Building2, CircleCheck, ListTodo, UserCog, Users, UsersRound } from "lucide-react";
import { Metric } from "../../../components/ui";
import type { DashboardData } from "../dashboard-data";
import { EMPTY_VALUE, formatNumber, formatPercent } from "../dashboard-format";
import { loadConcentration, personLoads, queueBySector, teamSummary } from "../team-metrics";
import { BarLayout, CategoryBarChart } from "../charts/category-bar-chart";
import { ChartPanel } from "../charts/chart-panel";

function formatAverage(value: number | null): string {
  return value === null ? EMPTY_VALUE : formatNumber(value);
}

export function TeamTab({ data }: { data: DashboardData }) {
  const { requests, range, teams, currentUser } = data;
  const summary = useMemo(() => teamSummary(requests, range, teams, currentUser), [requests, range, teams, currentUser]);
  const loads = useMemo(() => personLoads(requests, range, teams, currentUser), [requests, range, teams, currentUser]);
  const sectors = useMemo(() => queueBySector(requests, teams), [requests, teams]);
  const concentration = useMemo(() => loadConcentration(requests, teams, currentUser), [requests, teams, currentUser]);
  return (
    <>
      <div className="dash-kpis">
        <Metric title="Usuários ativos" value={formatNumber(summary.activeUsers)} icon={UsersRound} trend="na equipe" />
        <Metric title="Setores" value={formatNumber(summary.activeSectors)} icon={Building2} trend="ativos" />
        <Metric title="Pessoas com fila" value={formatNumber(summary.peopleWithQueue)} icon={UserCog} trend="responsáveis hoje" />
        <Metric title="Fila por pessoa" value={formatAverage(summary.queuePerPerson)} icon={ListTodo} trend="média em aberto" />
        <Metric title="Encerradas por pessoa" value={formatAverage(summary.closedPerPerson)} icon={CircleCheck} trend="média no período" />
        <Metric
          title="Concentração da fila"
          value={formatPercent(concentration?.share ?? null)}
          icon={Users}
          trend={concentration ? `com ${concentration.name}` : "sem fila atribuída"}
        />
      </div>
      <div className="dash-grid">
        <ChartPanel title="Recebidas e encerradas por pessoa" subtitle="O que cada pessoa recebeu no período e o que encerrou nele.">
          <CategoryBarChart
            data={loads}
            series={[{ key: "assigned", label: "Recebidas" }, { key: "closed", label: "Encerradas" }]}
            layout={BarLayout.BARS}
            caption="Solicitações recebidas e encerradas no período, por pessoa"
          />
        </ChartPanel>
        <ChartPanel title="Fila por setor" subtitle="Onde as solicitações em aberto hoje estão paradas.">
          <CategoryBarChart data={sectors} series={[{ key: "value", label: "Em aberto" }]} layout={BarLayout.BARS} caption="Solicitações em aberto por setor" />
        </ChartPanel>
      </div>
    </>
  );
}
