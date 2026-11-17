import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatDays, formatNumber } from "../dashboard-format";

// Whether a rise is good news (more completions) or bad news (more days to complete).
export enum TrendGoal {
  RISE = "rise",
  FALL = "fall",
}

export enum TrendUnit {
  COUNT = "count",
  POINTS = "points",
  DAYS = "days",
}

interface KpiTrendProps {
  current: number | null;
  previous: number | null;
  unit?: TrendUnit;
  goal?: TrendGoal;
}

function amountText(amount: number, unit: TrendUnit): string {
  if (unit === TrendUnit.POINTS) return `${formatNumber(amount)} p.p.`;
  if (unit === TrendUnit.DAYS) return formatDays(amount);
  return formatNumber(amount);
}

// The change of a card against the period right before, signed and coloured by whether it is good news, with an arrow so
// the colour never speaks alone.
export function KpiTrend({ current, previous, unit = TrendUnit.COUNT, goal = TrendGoal.RISE }: KpiTrendProps) {
  if (current === null || previous === null) return <>sem base no período anterior</>;
  const change = current - previous;
  if (change === 0) {
    return <span className="dash-trend"><Minus size={13} aria-hidden="true" />igual ao período anterior</span>;
  }
  const good = goal === TrendGoal.RISE ? change > 0 : change < 0;
  const Arrow = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span className={`dash-trend ${good ? "is-good" : "is-bad"}`}>
        <Arrow size={13} aria-hidden="true" />
        {`${change > 0 ? "+" : "−"}${amountText(Math.abs(change), unit)}`}
      </span>
      {" vs. período anterior"}
    </>
  );
}
