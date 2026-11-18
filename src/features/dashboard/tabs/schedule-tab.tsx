import { useMemo } from "react";
import { CalendarCheck, CalendarDays, Gauge, Layers3, Ticket, UserX } from "lucide-react";
import { Metric } from "../../../components/ui";
import type { DashboardData } from "../dashboard-data";
import { formatNumber, formatPercent, pluralize } from "../dashboard-format";
import {
  dayUsages,
  daysInRange,
  pastDaysInRange,
  entryMatrix,
  hourBandLabel,
  noShowCount,
  noShowsByTime,
  occupancyByLocation,
  occupancyByTime,
  occupancyByWeekday,
  scheduleSummary,
} from "../schedule-metrics";
import { CalendarHeat } from "../charts/calendar-heat";
import { BarLayout, CategoryBarChart } from "../charts/category-bar-chart";
import { ChartPanel } from "../charts/chart-panel";
import { HeatMatrix } from "../charts/heat-matrix";

const SHARE_SERIES = [{ key: "value", label: "Ocupação" }];

export function ScheduleTab({ data }: { data: DashboardData }) {
  const { requests, scheduleDays, range, now } = data;
  const usages = useMemo(() => dayUsages(scheduleDays, requests), [scheduleDays, requests]);
  const calendar = useMemo(() => daysInRange(usages, range).map((day) => ({ ...day, ahead: day.date > now })), [usages, range, now]);
  const days = useMemo(() => pastDaysInRange(usages, range, now), [usages, range, now]);
  const summary = useMemo(() => scheduleSummary(usages, range, now), [usages, range, now]);
  const byTime = useMemo(() => occupancyByTime(days), [days]);
  const byWeekday = useMemo(() => occupancyByWeekday(days), [days]);
  const byLocation = useMemo(() => occupancyByLocation(days), [days]);
  const noShows = useMemo(() => noShowsByTime(requests, range), [requests, range]);
  const missed = useMemo(() => noShowCount(requests, range), [requests, range]);
  const entries = useMemo(() => entryMatrix(requests, range), [requests, range]);
  return (
    <>
      <div className="dash-kpis">
        <Metric title="Dias de agenda" value={formatNumber(summary.days)} icon={CalendarDays} trend="já realizados no período" />
        <Metric title="Vagas ofertadas" value={formatNumber(summary.vacancies)} icon={Layers3} trend="nos dias que já passaram" />
        <Metric title="Ocupação" value={formatPercent(summary.occupancy)} icon={Gauge} trend={pluralize(summary.used, "vaga ocupada", "vagas ocupadas")} />
        <Metric title="Faltas" value={formatNumber(missed)} icon={UserX} trend="agendados que não vieram" />
        <Metric title="Vagas livres à frente" value={formatNumber(summary.freeAhead)} icon={Ticket} trend="de hoje em diante" />
        <Metric
          title="Próximo dia com vaga"
          value={summary.nextOpenDay ? summary.nextOpenDay.dateText.slice(0, 5) : "Nenhum"}
          icon={CalendarCheck}
          trend={summary.nextOpenDay ? pluralize(summary.nextOpenDay.remaining, "vaga livre", "vagas livres") : "sem vagas nas próximas agendas"}
        />
      </div>
      <div className="dash-grid">
        <ChartPanel wide title="Ocupação de cada dia" subtitle="Cada dia de agenda colorido por quanto das vagas foi ocupado.">
          <CalendarHeat days={calendar} />
        </ChartPanel>
        <ChartPanel title="Ocupação por horário" subtitle="Qual horário da agenda é mais disputado.">
          <CategoryBarChart data={byTime} series={SHARE_SERIES} layout={BarLayout.BARS} format={formatPercent} maxValue={100} caption="Ocupação das vagas por horário" />
        </ChartPanel>
        <ChartPanel title="Faltas por horário" subtitle="Em que horário mais tutores agendados não vieram.">
          <CategoryBarChart data={noShows} series={[{ key: "value", label: "Faltas" }]} format={formatPercent} maxValue={100} caption="Parte dos agendamentos sem comparecimento, por horário" />
        </ChartPanel>
        <ChartPanel title="Ocupação por dia da semana" subtitle="Que dia da semana rende mais.">
          <CategoryBarChart data={byWeekday} series={SHARE_SERIES} format={formatPercent} maxValue={100} caption="Ocupação das vagas por dia da semana" />
        </ChartPanel>
        {byLocation.length > 0 && (
          <ChartPanel title="Ocupação por local" subtitle="Que local precisa de mais vagas.">
            <CategoryBarChart data={byLocation} series={SHARE_SERIES} layout={BarLayout.BARS} format={formatPercent} maxValue={100} caption="Ocupação das vagas por local" />
          </ChartPanel>
        )}
        <ChartPanel wide title="Quando as solicitações chegam" subtitle="Dia da semana e horário em que as solicitações do período foram registradas.">
          <HeatMatrix
            data={entries}
            caption="Solicitações do período por dia da semana e faixa de horário"
            rowHeader="Dia"
            describe={(row, column, value) => `${row}, ${hourBandLabel(column)}: ${pluralize(value, "solicitação", "solicitações")}`}
          />
        </ChartPanel>
      </div>
    </>
  );
}
