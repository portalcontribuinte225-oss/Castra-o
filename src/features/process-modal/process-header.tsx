import { Download } from "lucide-react";
import { Button } from "../../components/button";
import { CloseButton } from "../../components/close-button";
import { StatusBadge } from "../../components/ui";
import { ProcessTab } from "./process-labels";

interface ProcessHeaderProps {
  protocol: string;
  title: string;
  subtitle: string;
  status: string;
  reportLoading: boolean;
  tabs: { id: ProcessTab; label: string; count?: number }[];
  activeTab: ProcessTab;
  panelId: string;
  busy: boolean;
  onTab: (tab: ProcessTab) => void;
  onReport: () => void;
  onClose: () => void;
}

// The fixed top of the process: protocol, who it is about, the status, the report and the tabs.
export function ProcessHeader({ protocol, title, subtitle, status, reportLoading, tabs, activeTab, panelId, busy, onTab, onReport, onClose }: ProcessHeaderProps) {
  return (
    <header className="prm-header">
      <div className="prm-header-identity">
        <div className="prm-header-identity-text">
          <span className="prm-eyebrow">Processo {protocol}</span>
          <h2 className="prm-headline-name" id={`${panelId}-title`}>{title}</h2>
          <p className="prm-animal-summary">{subtitle}</p>
        </div>
        <div className="prm-header-actions">
          <StatusBadge status={status} />
          <Button variant="outline" disabled={reportLoading} onClick={onReport}>
            <Download size={13} aria-hidden="true" /> {reportLoading ? "Preparando..." : "Relatório"}
          </Button>
          <CloseButton disabled={busy} onClick={onClose} />
        </div>
      </div>
      <div className="prm-tabs" role="tablist" aria-label="Abas do processo" onKeyDown={(event) => {
        const index = tabs.findIndex((tab) => tab.id === activeTab);
        const next = { ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
        if (next === undefined || busy) return;
        event.preventDefault();
        onTab(tabs[next].id);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}>
        {tabs.map((tab) => (
          <Button key={tab.id} variant="custom" role="tab" id={`${panelId}-${tab.id}`} aria-controls={panelId} aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1} disabled={busy}
            className="tw:max-w-full tw:border-card-border tw:bg-card-surface tw:text-left tw:leading-snug tw:font-semibold tw:whitespace-normal tw:text-ui-text tw:aria-selected:border-ui-accent tw:aria-selected:bg-ui-accent-soft tw:aria-selected:text-ui-accent-strong tw:max-[760px]:px-2.5 tw:max-[760px]:text-xs"
            onClick={() => onTab(tab.id)}>
            {tab.label}
            {Boolean(tab.count) && <span className="prm-tab-count">{tab.count}</span>}
          </Button>
        ))}
      </div>
    </header>
  );
}
