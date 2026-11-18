import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnyRecord } from "../../../types";
import { formatNumber } from "../dashboard-format";
import { seriesColor } from "./chart-colors";
import { ChartLegend } from "./chart-legend";
import { ChartEmpty } from "./chart-panel";
import { ChartTable } from "./chart-table";
import { ChartTooltip } from "./chart-tooltip";
import { AXIS_TICK, type ChartSeries } from "./time-line-chart";

export enum BarLayout {
  COLUMNS = "columns",
  BARS = "bars",
}

interface CategoryBarChartProps {
  data: AnyRecord[];
  series: ChartSeries[];
  caption: string;
  layout?: BarLayout;
  format?: (value: number) => string;
  // The top of the value scale when it is fixed, as 100 for shares.
  maxValue?: number;
}

const COLUMNS_HEIGHT = 240;
const BAR_ROW_HEIGHT = 36;
const GROUPED_ROW_HEIGHT = 56;
const MAX_LABELLED_BARS = 12;
const MAX_CATEGORY_CHARS = 22;

function shortLabel(value: unknown): string {
  const text = String(value ?? "");
  return text.length > MAX_CATEGORY_CHARS ? `${text.slice(0, MAX_CATEGORY_CHARS - 1)}…` : text;
}

// Columns (categories along the bottom) or bars (categories down the side, for long names): thin marks capped at 24px with
// rounded data ends, the value at the tip while there are few, and a tooltip on each mark.
export function CategoryBarChart({ data, series, caption, layout = BarLayout.COLUMNS, format = formatNumber, maxValue }: CategoryBarChartProps) {
  if (!data.some((row) => series.some((item) => Number(row[item.key]) > 0))) return <ChartEmpty />;
  const bars = layout === BarLayout.BARS;
  // While every bar carries its value at the tip, the value axis and its grid would only repeat it.
  const labelled = data.length <= MAX_LABELLED_BARS;
  // Bars never get shorter than columns, so two panels side by side keep the same height.
  const rowsHeight = data.length * (series.length > 1 ? GROUPED_ROW_HEIGHT : BAR_ROW_HEIGHT) + (labelled ? 24 : 48);
  const height = bars ? Math.max(COLUMNS_HEIGHT, rowsHeight) : COLUMNS_HEIGHT;
  const longest = Math.max(...data.map((row) => shortLabel(row.label).length));
  const valueAxis = {
    type: "number" as const,
    domain: [0, maxValue ?? "auto"] as [number, number | "auto"],
    allowDecimals: false,
    tickLine: false,
    axisLine: false,
    tick: AXIS_TICK,
    tickFormatter: (value: unknown) => format(Number(value)),
  };
  const categoryAxis = { type: "category" as const, dataKey: "label", tickLine: false, axisLine: { stroke: "var(--dash-axis)" }, tick: AXIS_TICK, tickFormatter: shortLabel };
  return (
    <figure className="dash-chart">
      {series.length > 1 && <ChartLegend items={series.map((item, slot) => ({ label: item.label, color: seriesColor(slot) }))} />}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={bars ? "vertical" : "horizontal"} margin={{ top: 16, right: bars ? 48 : 8, bottom: 0, left: 0 }} barGap={2}>
          {!labelled && <CartesianGrid horizontal={!bars} vertical={bars} stroke="var(--dash-grid)" />}
          {bars ? <XAxis {...valueAxis} hide={labelled} /> : <XAxis {...categoryAxis} interval={0} />}
          {bars ? <YAxis {...categoryAxis} width={Math.min(170, Math.max(56, longest * 7 + 12))} /> : <YAxis {...valueAxis} width={44} hide={labelled} />}
          <Tooltip
            cursor={{ fill: "var(--dash-hover)" }}
            content={(props) => <ChartTooltip active={props.active} payload={props.payload} label={props.label} format={format} />}
          />
          {series.map((item, slot) => (
            <Bar key={item.key} dataKey={item.key} name={item.label} fill={seriesColor(slot)} maxBarSize={24} radius={bars ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
              {labelled && (
                <LabelList dataKey={item.key} position={bars ? "right" : "top"} formatter={(value) => format(Number(value))} fill="var(--type-color-secondary)" fontSize={12} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartTable
        caption={caption}
        columns={["Categoria", ...series.map((item) => item.label)]}
        rows={data.map((row) => [String(row.label), ...series.map((item) => format(Number(row[item.key] || 0)))])}
      />
    </figure>
  );
}
