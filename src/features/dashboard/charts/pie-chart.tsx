import { Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from "recharts";
import type { ChartItem } from "../dashboard-data";
import { formatNumber, formatPercent } from "../dashboard-format";
import { percent, sum } from "../metric-math";
import { categoryColor, foldCategories, textOnColor } from "./chart-colors";
import { ChartLegend } from "./chart-legend";
import { ChartEmpty } from "./chart-panel";
import { ChartTable } from "./chart-table";
import { ChartTooltip } from "./chart-tooltip";

interface SharePieProps {
  items: ChartItem[];
  caption: string;
  // Whether the legend also shows each count beside its name.
  showCount?: boolean;
}

const PLOT_HEIGHT = 240;
// Below this share a slice is too thin to print its percentage, which stays in the tooltip and the table twin.
const MIN_LABELLED_SHARE = 0.06;
const RADIAN = Math.PI / 180;

function SliceLabel({ cx, cy, midAngle, outerRadius, percent: share, payload }: PieLabelRenderProps) {
  if (!share || share < MIN_LABELLED_SHARE) return null;
  const radius = Number(outerRadius) * 0.62;
  const angle = -Number(midAngle) * RADIAN;
  return (
    <text
      x={Number(cx) + radius * Math.cos(angle)}
      y={Number(cy) + radius * Math.sin(angle)}
      fill={textOnColor(payload?.fill)}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${Math.round(share * 100)}%`}
    </text>
  );
}

// A whole split in up to six parts (the rest folds into "Outros"), as a full pie: each slice prints its share, a 2px gap
// in the surface colour separates them, and the legend names them in the same order.
export function SharePie({ items, caption, showCount = false }: SharePieProps) {
  const total = sum(items.map((item) => item.value));
  if (!total) return <ChartEmpty />;
  const slices = foldCategories(items).map((item, slot) => ({ ...item, fill: categoryColor(item.label, slot), share: percent(item.value, total) }));
  return (
    <figure className="dash-chart dash-pie">
      <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
        <PieChart>
          <Pie
            data={slices.filter((slice) => slice.value > 0)}
            dataKey="value"
            nameKey="label"
            outerRadius="92%"
            stroke="var(--surface)"
            strokeWidth={2}
            labelLine={false}
            label={SliceLabel}
          />
          <Tooltip content={(props) => <ChartTooltip active={props.active} payload={props.payload} format={(value) => `${formatNumber(value)} (${formatPercent(percent(value, total))})`} />} />
        </PieChart>
      </ResponsiveContainer>
      <ChartLegend stacked items={slices.map((slice) => ({ label: slice.label, color: slice.fill, value: showCount ? formatNumber(slice.value) : undefined }))} />
      <ChartTable caption={caption} columns={["Parte", "Quantidade", "Participação"]} rows={slices.map((slice) => [slice.label, formatNumber(slice.value), formatPercent(slice.share)])} />
    </figure>
  );
}
