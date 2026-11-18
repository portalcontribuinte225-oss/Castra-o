import { useMemo } from "react";
import { CircleCheck, ClipboardList, Clock, FileText, PawPrint, TriangleAlert, UserCheck } from "lucide-react";
import { Metric } from "../../../components/ui";
import { adoptionsInRange } from "../animal-metrics";
import type { DashboardData } from "../dashboard-data";
import { formatDays, formatNumber, formatPercent } from "../dashboard-format";
import { flowSeries, openQueueSize, periodTotals, queueAlerts, volumeParts, type QueueAlert } from "../overview-metrics";
import { ChartPanel } from "../charts/chart-panel";
import { SharePie } from "../charts/pie-chart";
import { KpiTrend, TrendGoal, TrendUnit } from "../charts/kpi-trend";
import { TimeLineChart } from "../charts/time-line-chart";

function AlertList({ items }: { items: QueueAlert[] }) {
  return (
    <ul className="dash-alerts">
      {items.map((item) => {
        const Icon = item.value ? TriangleAlert : CircleCheck;
        return (
          <li key={item.label} className={item.value ? "is-warn" : "is-ok"}>
            <Icon size={18} aria-hidden="true" />
            <strong>{formatNumber(item.value)}</strong>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </li>
        );
      })}
    </ul>
  );
}

export function OverviewTab({ data }: { data: DashboardData }) {
  const { requests, adoptionAnimals, range, previous, grouping, now } = data;
  const current = useMemo(() => periodTotals(requests, range), [requests, range]);
  const before = useMemo(() => periodTotals(requests, previous), [requests, previous]);
  const adoptions = useMemo(() => adoptionsInRange(adoptionAnimals, range), [adoptionAnimals, range]);
  const adoptionsBefore = useMemo(() => adoptionsInRange(adoptionAnimals, previous), [adoptionAnimals, previous]);
  const queue = useMemo(() => openQueueSize(requests), [requests]);
  const flow = useMemo(() => flowSeries(requests, range, grouping, now), [requests, range, grouping, now]);
  const volume = useMemo(() => volumeParts(requests, range), [requests, range]);
  const alerts = useMemo(() => queueAlerts(requests, now), [requests, now]);
  return (
    <>
      <div className="dash-kpis">
        <Metric title="Solicitações" value={formatNumber(current.entries)} icon={FileText} trend={<KpiTrend current={current.entries} previous={before.entries} />} />
        <Metric title="Fila ativa" value={formatNumber(queue)} icon={ClipboardList} trend="em aberto hoje" />
        <Metric title="Realizadas" value={formatNumber(current.completed)} icon={CircleCheck} trend={<KpiTrend current={current.completed} previous={before.completed} />} />
        <Metric
          title="Comparecimento"
          value={formatPercent(current.attendanceRate)}
          icon={UserCheck}
          trend={<KpiTrend current={current.attendanceRate} previous={before.attendanceRate} unit={TrendUnit.POINTS} />}
        />
        <Metric
          title="Tempo até realizar"
          value={formatDays(current.averageDaysToComplete)}
          icon={Clock}
          trend={<KpiTrend current={current.averageDaysToComplete} previous={before.averageDaysToComplete} unit={TrendUnit.DAYS} goal={TrendGoal.FALL} />}
        />
        <Metric title="Adoções" value={formatNumber(adoptions)} icon={PawPrint} trend={<KpiTrend current={adoptions} previous={adoptionsBefore} />} />
      </div>
      <div className="dash-grid">
        <ChartPanel wide title="Entradas e realizadas" subtitle="Quando as entradas passam das realizadas, a fila cresce.">
          <TimeLineChart
            data={flow}
            series={[{ key: "entries", label: "Entradas" }, { key: "completed", label: "Realizadas" }]}
            caption="Solicitações que entraram e que foram realizadas, por período"
          />
        </ChartPanel>
        <ChartPanel title="Onde está o volume" subtitle="A fila de hoje e o que terminou no período.">
          <SharePie items={volume} caption="Distribuição do volume de solicitações" />
        </ChartPanel>
        <ChartPanel title="Pede atenção hoje" subtitle="Solicitações em aberto que precisam de alguém.">
          <AlertList items={alerts} />
        </ChartPanel>
      </div>
    </>
  );
}
