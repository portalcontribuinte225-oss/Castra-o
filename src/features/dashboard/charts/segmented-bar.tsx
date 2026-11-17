import type { ChartItem } from "../dashboard-data";
import { formatNumber } from "../dashboard-format";
import { percent, sum } from "../metric-math";
import { categoryColor, foldCategories, textOnColor } from "./chart-colors";
import { ChartLegend } from "./chart-legend";
import { ChartEmpty } from "./chart-panel";

interface SegmentedBarProps {
  items: ChartItem[];
  caption: string;
}

// Below this share a block is too narrow to print its number, which stays in the hover title and the legend count.
const MIN_LABELLED_SHARE = 12;

// A whole split in two or three parts, where a pie would be a poor fit: one 28px bar, each part a block as wide as its share,
// the share printed inside; the legend names the parts in block order with their counts.
export function SegmentedBar({ items, caption }: SegmentedBarProps) {
  const total = sum(items.map((item) => item.value));
  if (!total) return <ChartEmpty />;
  const parts = foldCategories(items).map((item, slot) => ({ ...item, color: categoryColor(item.label, slot), share: percent(item.value, total) ?? 0 }));
  return (
    <figure className="dash-chart">
      <div className="dash-segments" role="img" aria-label={`${caption}: ${parts.map((part) => `${part.label}, ${formatNumber(part.value)} (${part.share}%)`).join("; ")}`}>
        {parts.filter((part) => part.value > 0).map((part) => (
          <span key={part.label} className="dash-segment" style={{ flexGrow: part.value, background: part.color, color: textOnColor(part.color) }} title={`${part.label}: ${formatNumber(part.value)} (${part.share}%)`}>
            {part.share >= MIN_LABELLED_SHARE && `${part.share}%`}
          </span>
        ))}
      </div>
      <ChartLegend items={parts.map((part) => ({ label: part.label, color: part.color, value: formatNumber(part.value) }))} />
    </figure>
  );
}
