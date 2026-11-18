import type { ReactNode } from "react";
import { PanelHeader } from "../../../components/ui";

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: ReactNode;
}

// A panel of the dashboard: the app's panel with a title, the question it answers right under it, and the chart.
export function ChartPanel({ title, subtitle, wide = false, children }: ChartPanelProps) {
  return (
    <section className={`panel dash-panel${wide ? " is-wide" : ""}`}>
      <div className="dash-panel-head">
        <PanelHeader title={title} />
        {subtitle && <p className="form-hint">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function ChartEmpty({ text = "Sem dados no período." }: { text?: string }) {
  return <p className="dash-empty">{text}</p>;
}
