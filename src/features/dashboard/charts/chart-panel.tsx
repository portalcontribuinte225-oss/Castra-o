import type { ReactNode } from "react";
import { Card } from "../../../components/card";

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: ReactNode;
}

// A panel of the dashboard: the app's panel with a title, the question it answers right under it, and the chart.
export function ChartPanel({ title, subtitle, wide = false, children }: ChartPanelProps) {
  return (
    <Card as="section" className={`tw:grid tw:min-w-0 tw:content-start tw:gap-4 tw:p-4 tw:sm:p-5${wide ? " tw:col-span-full" : ""}`}>
      <header className="tw:grid tw:gap-1">
        <h2 className="tw:m-0 tw:text-base tw:font-semibold tw:text-ui-ink">{title}</h2>
        {subtitle && <p className="tw:m-0 tw:text-sm tw:text-ui-muted">{subtitle}</p>}
      </header>
      {children}
    </Card>
  );
}

export function ChartEmpty({ text = "Sem dados no período." }: { text?: string }) {
  return <p className="dash-empty">{text}</p>;
}
