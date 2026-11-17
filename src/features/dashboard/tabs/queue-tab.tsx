import { useMemo } from "react";
import type { DashboardData } from "../dashboard-data";
import { formatDays, formatPercent } from "../dashboard-format";
import { cancelCauses, completionTimeSeries, conversionFunnel, queueAges } from "../queue-metrics";
import { BarLayout, CategoryBarChart } from "../charts/category-bar-chart";
import { ChartPanel } from "../charts/chart-panel";
import { DonutChart } from "../charts/donut-chart";
import { TimeLineChart } from "../charts/time-line-chart";

export function QueueTab({ data }: { data: DashboardData }) {
  const { requests, range, grouping, now } = data;
  const ages = useMemo(() => queueAges(requests, now), [requests, now]);
  const funnel = useMemo(() => conversionFunnel(requests, range), [requests, range]);
  const causes = useMemo(() => cancelCauses(requests, range), [requests, range]);
  const times = useMemo(() => completionTimeSeries(requests, range, grouping, now), [requests, range, grouping, now]);
  return (
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
        <DonutChart items={causes} showCount caption="Cancelamentos do período por motivo" />
      </ChartPanel>
      <ChartPanel title="Tempo até realizar" subtitle="Média de dias entre a entrada e o procedimento, pela data do procedimento.">
        <TimeLineChart data={times} series={[{ key: "days", label: "Dias até realizar" }]} format={formatDays} caption="Média de dias até realizar, por período" />
      </ChartPanel>
    </div>
  );
}
