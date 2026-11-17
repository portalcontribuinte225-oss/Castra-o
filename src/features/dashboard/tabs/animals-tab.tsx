import { useMemo } from "react";
import { Clock, Heart, HeartHandshake } from "lucide-react";
import { Metric } from "../../../components/ui";
import { adoptionSeries, adoptionSummary, animalProfile, requestOrigins } from "../animal-metrics";
import type { DashboardData } from "../dashboard-data";
import { formatDays, formatNumber } from "../dashboard-format";
import { CategoryBarChart } from "../charts/category-bar-chart";
import { ChartPanel } from "../charts/chart-panel";
import { DonutChart } from "../charts/donut-chart";
import { SegmentedBar } from "../charts/segmented-bar";
import { TimeLineChart } from "../charts/time-line-chart";

export function AnimalsTab({ data }: { data: DashboardData }) {
  const { requests, adoptionAnimals, range, grouping, now } = data;
  const profile = useMemo(() => animalProfile(requests, range), [requests, range]);
  const origins = useMemo(() => requestOrigins(requests, range), [requests, range]);
  const adoption = useMemo(() => adoptionSummary(adoptionAnimals, range), [adoptionAnimals, range]);
  const adoptions = useMemo(() => adoptionSeries(adoptionAnimals, range, grouping, now), [adoptionAnimals, range, grouping, now]);
  return (
    <>
      <div className="dash-kpis">
        <Metric title="Aguardando adoção" value={formatNumber(adoption.waiting)} icon={HeartHandshake} trend="disponíveis ou em triagem hoje" />
        <Metric title="Interesses" value={formatNumber(adoption.interests)} icon={Heart} trend="nos animais que aguardam adoção" />
        <Metric title="Tempo até a adoção" value={formatDays(adoption.averageDaysToAdopt)} icon={Clock} trend="média das adoções do período" />
      </div>
      <div className="dash-grid">
        <ChartPanel title="Espécie" subtitle="Os animais das solicitações do período.">
          <DonutChart items={profile.species} showCount caption="Animais das solicitações do período por espécie" />
        </ChartPanel>
        <ChartPanel title="Porte" subtitle="O tamanho dos animais atendidos.">
          <CategoryBarChart data={profile.size} series={[{ key: "value", label: "Animais" }]} caption="Animais das solicitações do período por porte" />
        </ChartPanel>
        <ChartPanel title="Sexo" subtitle="Machos e fêmeas entre os animais do período.">
          <SegmentedBar items={profile.sex} caption="Animais das solicitações do período por sexo" />
        </ChartPanel>
        <ChartPanel title="Origem das solicitações" subtitle="Por onde a demanda chega.">
          <SegmentedBar items={origins} caption="Solicitações do período por origem" />
        </ChartPanel>
        <ChartPanel wide title="Adoções no tempo" subtitle="Animais adotados, pela data da adoção.">
          <TimeLineChart data={adoptions} series={[{ key: "adoptions", label: "Adoções" }]} caption="Adoções por período" />
        </ChartPanel>
      </div>
    </>
  );
}
