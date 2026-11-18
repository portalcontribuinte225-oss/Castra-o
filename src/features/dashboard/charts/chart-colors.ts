import { NOT_INFORMED_LABEL, OTHERS_LABEL } from "../dashboard-data";

// The categorical colours live in the stylesheet (`.dash-root`), in a fixed order checked for colour-blind separation on
// the white panel. A category keeps its slot whatever its size; past the last slot the chart folds into "Outros".
export const SERIES_SLOTS = 6;

const NEUTRAL_COLOR = "var(--dash-series-other)";

export function seriesColor(slot: number): string {
  return slot < SERIES_SLOTS ? `var(--dash-series-${slot + 1})` : NEUTRAL_COLOR;
}

// "Não informado" and "Outros" are not categories of their own, so they take the neutral grey and leave the slots alone.
export function categoryColor(label: string, slot: number): string {
  return label === NOT_INFORMED_LABEL || label === OTHERS_LABEL ? NEUTRAL_COLOR : seriesColor(slot);
}

// The text set inside a coloured slice: near-black on the yellow slot and on the neutral grey, white on every other.
export function textOnColor(color = ""): string {
  return color === seriesColor(3) || color === NEUTRAL_COLOR ? "#0b0b0b" : "#ffffff";
}

// Keeps the largest categories and folds the rest into "Outros", so no colour is ever generated past the palette.
export function foldCategories<T extends { label: string; value: number }>(items: T[], keep = SERIES_SLOTS - 1): { label: string; value: number }[] {
  if (items.length <= keep + 1) return items;
  const kept = items.slice(0, keep);
  const rest = items.slice(keep).reduce((total, item) => total + item.value, 0);
  return [...kept, { label: OTHERS_LABEL, value: rest }];
}
