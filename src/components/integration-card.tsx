import type { ReactNode } from "react";
import { Card } from "./card";

export const integrationFieldsStyle = "tw:grid tw:gap-3 tw:grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]";
export const integrationActionFieldStyle = "tw:grid tw:gap-3 tw:sm:grid-cols-[minmax(0,1fr)_auto] tw:sm:items-end";

export function IntegrationCard({ title, actions, children }: { title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <Card as="section" className="tw:grid tw:min-w-0 tw:gap-3 tw:p-4">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <h3 className="tw:m-0 tw:text-sm tw:font-semibold tw:text-ui-ink">{title}</h3>
        {actions}
      </div>
      {children}
    </Card>
  );
}

// Whether the server found the integration's credentials in its variables; nothing of them ever reaches the screen.
export function IntegrationStatusBadge({ integrated }: { integrated: boolean }) {
  return (
    <span role="status" className={`tw:inline-flex tw:items-center tw:gap-1.5 tw:text-sm tw:font-semibold ${integrated ? "tw:text-ui-accent" : "tw:text-ui-danger"}`}>
      <span aria-hidden="true" className="tw:size-2 tw:rounded-full tw:bg-current" />
      {integrated ? "Integrado" : "Não integrado"}
    </span>
  );
}
