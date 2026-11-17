import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EMPTY_VALUE, formatNumber } from "../dashboard-format";
import type { SeriesPoint } from "../time-series";
import { seriesColor } from "./chart-colors";
import { ChartLegend, LegendMark } from "./chart-legend";
import { ChartEmpty } from "./chart-panel";
import { ChartTable } from "./chart-table";
import { ChartTooltip } from "./chart-tooltip";

export interface ChartSeries {
  key: string;
  label: string;
}

interface TimeLineChartProps {
  data: SeriesPoint[];
  series: ChartSeries[];
  caption: string;
  format?: (value: number) => string;
}

export const AXIS_TICK = { fill: "var(--type-color-muted)", fontSize: 12 };
const PLOT_HEIGHT = 240;
// Up to this many points each one gets its marker; beyond it the line alone reads better.
const MAX_MARKED_POINTS = 14;

function hasValue(value: SeriesPoint[string]): value is number {
  return typeof value === "number";
}

// A line over time: 2px lines, a hairline grid, a crosshair tooltip that lists every series at the hovered point.
export function TimeLineChart({ data, series, caption, format = formatNumber }: TimeLineChartProps) {
  if (!data.some((point) => series.some((item) => {
    const value = point[item.key];
    return hasValue(value) && value > 0;
  }))) return <ChartEmpty />;
  const marked = data.length <= MAX_MARKED_POINTS;
  return (
    <figure className="dash-chart">
      {series.length > 1 && <ChartLegend items={series.map((item, slot) => ({ label: item.label, color: seriesColor(slot) }))} mark={LegendMark.LINE} />}
      <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--dash-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--dash-axis)" }} tick={AXIS_TICK} minTickGap={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={40} tickFormatter={(value) => formatNumber(Number(value))} />
          <Tooltip
            cursor={{ stroke: "var(--dash-axis)", strokeWidth: 1 }}
            content={(props) => <ChartTooltip active={props.active} payload={props.payload} label={props.label} format={format} />}
          />
          {series.map((item, slot) => (
            <Line
              key={item.key}
              type="linear"
              dataKey={item.key}
              name={item.label}
              stroke={seriesColor(slot)}
              strokeWidth={2}
              dot={marked ? { r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: seriesColor(slot) } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <ChartTable
        caption={caption}
        columns={["Período", ...series.map((item) => item.label)]}
        rows={data.map((point) => [point.label, ...series.map((item) => {
          const value = point[item.key];
          return hasValue(value) ? format(value) : EMPTY_VALUE;
        })])}
      />
    </figure>
  );
}
