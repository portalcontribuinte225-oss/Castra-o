import { useMemo } from "react";
import { Users } from "lucide-react";
import { Metric } from "../../../components/ui";
import type { DashboardData } from "../dashboard-data";
import { formatPercent, formatNumber } from "../dashboard-format";
import { loadConcentration, personLoads, queueBySector } from "../team-metrics";
import { BarLayout, CategoryBarChart } from "../charts/category-bar-chart";
import { ChartPanel } from "../charts/chart-panel";

export function TeamTab({ data }: { data: DashboardData }) {
  const { requests, range, teams, currentUser } = data;
  const loads = useMemo(() => personLoads(requests, range, teams, currentUser), [requests, range, teams, currentUser]);
  const sectors = useMemo(() => queueBySector(requests, teams), [requests, teams]);
  const concentration = useMemo(() => loadConcentration(requests), [requests]);
  return (
    <>
      <div className="dash-kpis">
        <Metric
          title="Concentração da fila"
          value={formatPercent(concentration?.share ?? null)}
          icon={Users}
          trend={concentration
            ? `${concentration.name} tem ${formatNumber(concentration.count)} de ${formatNumber(concentration.total)} atribuídas em aberto`
            : "nenhuma solicitação em aberto atribuída"}
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
