import type { TooltipPayload } from "recharts";

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string | number;
  format: (value: number) => string;
}

// The hover card of a chart: the value leads, the series follows, keyed by a short stroke of its colour; a bar's extra
// line (its `detail`) comes under it.
export function ChartTooltip({ active, payload, label, format }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      {label !== undefined && label !== "" && <span className="dash-tooltip-title">{label}</span>}
      {payload.map((entry) => {
        const point = (entry.payload || {}) as { detail?: string; fill?: string };
        return (
          <div className="dash-tooltip-row" key={String(entry.dataKey ?? entry.name)}>
            <i style={{ background: entry.color || point.fill }} aria-hidden="true" />
            <strong>{format(Number(entry.value))}</strong>
            {entry.name !== undefined && <span>{entry.name}</span>}
            {point.detail && <small>{point.detail}</small>}
          </div>
        );
      })}
    </div>
  );
}
