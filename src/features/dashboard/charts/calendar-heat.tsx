import { WEEKDAY_NAMES, formatDayMonth, formatMonthYear, formatNumber } from "../dashboard-format";
import { percent } from "../metric-math";
import { ChartLegend } from "./chart-legend";
import { ChartEmpty } from "./chart-panel";

export interface CalendarDay {
  date: Date;
  used: number;
  vacancies: number;
}

// How full an agenda day got: at least 80% of its places, between half and 80%, or under half.
export enum OccupancyBand {
  FULL = "full",
  HALF = "half",
  LOW = "low",
}

// Monday first, as the agenda shows the week.
const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function occupancyBand(used: number, vacancies: number): OccupancyBand {
  const share = percent(used, vacancies) ?? 0;
  if (share >= 80) return OccupancyBand.FULL;
  if (share >= 50) return OccupancyBand.HALF;
  return OccupancyBand.LOW;
}

const BAND_LEGEND = [
  { label: "80% ou mais das vagas", color: "var(--dash-good)" },
  { label: "de 50% a 79%", color: "var(--dash-warning)" },
  { label: "menos de 50%", color: "var(--dash-critical)" },
  { label: "sem agenda", color: "var(--dash-empty-day)" },
];

function describeDay(day: CalendarDay): string {
  return `${formatDayMonth(day.date)}, ${WEEKDAY_NAMES[day.date.getDay()].toLowerCase()}: ${formatNumber(day.used)} de ${formatNumber(day.vacancies)} vagas ocupadas (${percent(day.used, day.vacancies) ?? 0}%)`;
}

// The months of the period as small calendars, each agenda day coloured by how full it got and every other day left blank.
export function CalendarHeat({ days }: { days: CalendarDay[] }) {
  if (!days.length) return <ChartEmpty text="Nenhum dia de agenda no período." />;
  const months = new Map<string, Map<number, CalendarDay>>();
  days.forEach((day) => {
    const key = `${day.date.getFullYear()}-${day.date.getMonth()}`;
    months.set(key, (months.get(key) || new Map()).set(day.date.getDate(), day));
  });
  return (
    <figure className="dash-chart">
      <div className="dash-calendar">
        {[...months].map(([key, monthDays]) => {
          const [year, month] = key.split("-").map(Number);
          const offset = (new Date(year, month, 1).getDay() + 6) % 7;
          const length = new Date(year, month + 1, 0).getDate();
          return (
            <div className="dash-calendar-month" key={key}>
              <strong>{formatMonthYear(new Date(year, month, 1))}</strong>
              <div className="dash-calendar-grid">
                {WEEKDAY_INITIALS.map((initial, index) => <span key={`${initial}-${index}`} className="dash-calendar-weekday" aria-hidden="true">{initial}</span>)}
                {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
                {Array.from({ length }, (_, index) => {
                  const day = monthDays.get(index + 1);
                  if (!day) return <span key={index} className="dash-calendar-day" aria-hidden="true">{index + 1}</span>;
                  return (
                    <span key={index} className={`dash-calendar-day is-${occupancyBand(day.used, day.vacancies)}`} role="img" aria-label={describeDay(day)} title={describeDay(day)}>
                      {index + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <ChartLegend items={BAND_LEGEND} />
    </figure>
  );
}
