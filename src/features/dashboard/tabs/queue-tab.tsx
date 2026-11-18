import { useMemo } from "react";
import { CalendarClock, CircleX, History, Hourglass, Inbox, Repeat2 } from "lucide-react";
import { Metric } from "../../../components/ui";
import type { DashboardData } from "../dashboard-data";
import { formatDays, formatNumber, formatPercent } from "../dashboard-format";
import { cancelCauses, completionTimeSeries, conversionFunnel, queueAges, queueSnapshot } from "../queue-metrics";
import { BarLayout, CategoryBarChart } from "../charts/category-bar-chart";
import { ChartPanel } from "../charts/chart-panel";
import { SharePie } from "../charts/pie-chart";
import { TimeLineChart } from "../charts/time-line-chart";

export function QueueTab({ data }: { data: DashboardData }) {
  const { requests, range, grouping, now } = data;
  const snapshot = useMemo(() => queueSnapshot(requests, range, now), [requests, range, now]);
  const ages = useMemo(() => queueAges(requests, now), [requests, now]);
  const funnel = useMemo(() => conversionFunnel(requests, range), [requests, range]);
  const causes = useMemo(() => cancelCauses(requests, range), [requests, range]);
  const times = useMemo(() => completionTimeSeries(requests, range, grouping, now), [requests, range, grouping, now]);
  return (
    <>
      <div className="dash-kpis">
        <Metric title="Em análise" value={formatNumber(snapshot.inAnalysis)} icon={Inbox} trend="aguardam a triagem" />
        <Metric title="Na agenda" value={formatNumber(snapshot.waitingProcedure)} icon={CalendarClock} trend="aguardam o procedimento" />
        <Metric title="Espera média" value={formatDays(snapshot.averageWait)} icon={Hourglass} trend="da fila em aberto" />
        <Metric title="Mais antiga na fila" value={formatDays(snapshot.oldestWait)} icon={History} trend="a que espera há mais tempo" />
        <Metric title="Canceladas" value={formatNumber(snapshot.cancelled)} icon={CircleX} trend="saíram no período" />
        <Metric title="Reagendadas" value={formatNumber(snapshot.rescheduled)} icon={Repeat2} trend="entre as do período" />
      </div>
      <div className="dash-grid">
        <ChartPanel title="Idade da fila" subtitle="Há quanto tempo as solicitações em aberto hoje esperam.">
          <CategoryBarChart data={ages} series={[{ key: "value", label: "Solicitações" }]} caption="Solicitações em aberto por tempo de espera" />
        </ChartPanel>
        <ChartPanel title="Até onde as solicitações chegam" subtitle="Das que entraram no período, quantas foram agendadas e quantas realizadas.">
          <CategoryBarChart
            data={funnel}
            series={[{ key: "value", label: "Das recebidas" }]}
            layout={BarLayout.BARS}
            format={formatPercent}
            maxValue={100}
            caption="Parte das solicitações do período que chegou a cada etapa"
          />
        </ChartPanel>
        <ChartPanel title="Motivos de cancelamento" subtitle="Por que as solicitações canceladas no período saíram da fila.">
          <SharePie items={causes} caption="Cancelamentos do período por motivo" />
        </ChartPanel>
        <ChartPanel title="Tempo até realizar" subtitle="Média de dias entre a entrada e o procedimento, pela data do procedimento.">
          <TimeLineChart data={times} series={[{ key: "days", label: "Dias até realizar" }]} format={formatDays} caption="Média de dias até realizar, por período" />
        </ChartPanel>
      </div>
    </>
  );
}
