export enum LegendMark {
  BOX = "box",
  LINE = "line",
}

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

interface ChartLegendProps {
  items: LegendItem[];
  mark?: LegendMark;
  stacked?: boolean;
}

// Names every series beside a swatch of its colour, so identity never rests on colour alone; the text keeps the text colours.
export function ChartLegend({ items, mark = LegendMark.BOX, stacked = false }: ChartLegendProps) {
  return (
    <ul className={`dash-legend${stacked ? " is-stacked" : ""}${mark === LegendMark.LINE ? " is-lines" : ""}`}>
      {items.map((item) => (
        <li key={item.label}>
          <i style={{ background: item.color }} aria-hidden="true" />
          <span>{item.label}</span>
          {item.value !== undefined && <strong>{item.value}</strong>}
        </li>
      ))}
    </ul>
  );
}
