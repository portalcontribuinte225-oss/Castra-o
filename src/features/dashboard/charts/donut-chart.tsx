import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartItem } from "../dashboard-data";
import { formatNumber, formatPercent } from "../dashboard-format";
import { percent, sum } from "../metric-math";
import { categoryColor, foldCategories } from "./chart-colors";
import { ChartLegend } from "./chart-legend";
import { ChartEmpty } from "./chart-panel";
import { ChartTable } from "./chart-table";
import { ChartTooltip } from "./chart-tooltip";

interface DonutChartProps {
  items: ChartItem[];
  caption: string;
  // Whether the legend also shows each count, besides its share.
  showCount?: boolean;
}

const PLOT_SIZE = 200;

// One whole split in up to six parts (the rest folds into "Outros"); a 2px gap in the surface colour separates the slices.
// The legend names each part with its share; the count is in the tooltip and in the table twin.
export function DonutChart({ items, caption, showCount = false }: DonutChartProps) {
  const total = sum(items.map((item) => item.value));
  if (!total) return <ChartEmpty />;
  const slices = foldCategories(items).map((item, slot) => ({ ...item, fill: categoryColor(item.label, slot), share: percent(item.value, total) }));
  return (
    <figure className="dash-chart dash-donut">
      <ResponsiveContainer width="100%" height={PLOT_SIZE}>
        <PieChart>
          <Pie data={slices.filter((slice) => slice.value > 0)} dataKey="value" nameKey="label" innerRadius="60%" outerRadius="90%" stroke="var(--surface)" strokeWidth={2} />
          <Tooltip content={(props) => <ChartTooltip active={props.active} payload={props.payload} format={(value) => `${formatNumber(value)} (${formatPercent(percent(value, total))})`} />} />
        </PieChart>
      </ResponsiveContainer>
      <ChartLegend
        stacked
        items={slices.map((slice) => ({
          label: slice.label,
          color: slice.fill,
          value: showCount ? `${formatNumber(slice.value)} · ${formatPercent(slice.share)}` : formatPercent(slice.share),
        }))}
      />
      <ChartTable caption={caption} columns={["Parte", "Quantidade", "Participação"]} rows={slices.map((slice) => [slice.label, formatNumber(slice.value), formatPercent(slice.share)])} />
    </figure>
  );
}
