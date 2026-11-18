import { useMemo } from "react";
import { Clock, Cpu, Heart, HeartHandshake, PawPrint, Stethoscope } from "lucide-react";
import { Metric } from "../../../components/ui";
import { adoptionSeries, adoptionSummary, animalCounts, animalProfile, requestOrigins } from "../animal-metrics";
import type { DashboardData } from "../dashboard-data";
import { formatDays, formatNumber, formatPercent } from "../dashboard-format";
import { ChartPanel } from "../charts/chart-panel";
import { SharePie } from "../charts/pie-chart";
import { TimeLineChart } from "../charts/time-line-chart";

export function AnimalsTab({ data }: { data: DashboardData }) {
  const { requests, adoptionAnimals, range, grouping, now } = data;
  const counts = useMemo(() => animalCounts(requests, range), [requests, range]);
  const profile = useMemo(() => animalProfile(requests, range), [requests, range]);
  const origins = useMemo(() => requestOrigins(requests, range), [requests, range]);
  const adoption = useMemo(() => adoptionSummary(adoptionAnimals, range), [adoptionAnimals, range]);
  const adoptions = useMemo(() => adoptionSeries(adoptionAnimals, range, grouping, now), [adoptionAnimals, range, grouping, now]);
  return (
    <>
      <div className="dash-kpis">
        <Metric title="Animais solicitados" value={formatNumber(counts.requested)} icon={PawPrint} trend="no período" />
        <Metric title="Animais atendidos" value={formatNumber(counts.served)} icon={Stethoscope} trend="procedimentos do período" />
        <Metric title="Com microchip" value={formatPercent(counts.microchipShare)} icon={Cpu} trend="dos animais solicitados" />
        <Metric title="Aguardando adoção" value={formatNumber(adoption.waiting)} icon={HeartHandshake} trend="disponíveis ou em triagem" />
        <Metric title="Interesses" value={formatNumber(adoption.interests)} icon={Heart} trend="nos que aguardam adoção" />
        <Metric title="Tempo até a adoção" value={formatDays(adoption.averageDaysToAdopt)} icon={Clock} trend="média do período" />
      </div>
      <div className="dash-grid">
        <ChartPanel title="Espécie" subtitle="Os animais das solicitações do período.">
          <SharePie items={profile.species} showCount caption="Animais das solicitações do período por espécie" />
        </ChartPanel>
        <ChartPanel title="Porte" subtitle="O tamanho dos animais solicitados.">
          <SharePie items={profile.size} showCount caption="Animais das solicitações do período por porte" />
        </ChartPanel>
        <ChartPanel title="Sexo" subtitle="Machos e fêmeas entre os animais do período.">
          <SharePie items={profile.sex} showCount caption="Animais das solicitações do período por sexo" />
        </ChartPanel>
        <ChartPanel title="Origem das solicitações" subtitle="Por onde a demanda chega.">
          <SharePie items={origins} showCount caption="Solicitações do período por origem" />
        </ChartPanel>
        <ChartPanel wide title="Adoções no tempo" subtitle="Animais adotados, pela data da adoção.">
          <TimeLineChart data={adoptions} series={[{ key: "adoptions", label: "Adoções" }]} caption="Adoções por período" />
        </ChartPanel>
      </div>
    </>
  );
}
