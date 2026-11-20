import { Download } from "lucide-react";
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
          <button className="prm-pdf-btn" type="button" disabled={reportLoading} onClick={onReport}>
            <Download size={13} /> {reportLoading ? "Preparando..." : "Relatório"}
          </button>
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
          <button key={tab.id} type="button" role="tab" id={`${panelId}-${tab.id}`} aria-controls={panelId} aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1} disabled={busy} className={`prm-tab${activeTab === tab.id ? " prm-tab--active" : ""}`} onClick={() => onTab(tab.id)}>
            {tab.label}
            {Boolean(tab.count) && <span className="prm-tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>
    </header>
  );
}
