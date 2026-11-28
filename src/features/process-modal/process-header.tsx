import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../components/button";
import { CloseButton } from "../../components/close-button";
import { ProcessTab } from "./process-labels";

interface ProcessHeaderProps {
  protocol: string;
  title: string;
  subtitle: string;
  appointment: ReactNode;
  tabs: { id: ProcessTab; label: string; count?: number; icon?: ReactNode }[];
  activeTab: ProcessTab;
  panelId: string;
  busy: boolean;
  reportLoading: boolean;
  onTab: (tab: ProcessTab) => void;
  onReport: () => void;
  onClose: () => void;
}

export function ProcessHeader({ protocol, title, subtitle, appointment, tabs, activeTab, panelId, busy, reportLoading, onTab, onReport, onClose }: ProcessHeaderProps) {
  return (
    <header className="prm-header">
      <div className="prm-header-identity">
        <div className="prm-header-identity-text">
          <span className="prm-eyebrow">Processo {protocol}</span>
          <h2 className="prm-headline-name" id={`${panelId}-title`}>{title}</h2>
          <div className="prm-animal-summary"><span>{subtitle}</span>{appointment}</div>
        </div>
        <div className="prm-header-actions">
          <Button variant="outline" className="prm-icon-button" title="Baixar relatório" aria-label={reportLoading ? "Preparando relatório" : "Baixar relatório"}
            disabled={busy || reportLoading} onClick={onReport}><Download size={16} aria-hidden="true" /></Button>
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
            className="tw:border-card-border tw:bg-card-surface tw:text-left tw:font-semibold tw:text-ui-text tw:max-[760px]:px-2.5 tw:max-[760px]:text-xs"
            onClick={() => onTab(tab.id)}>
            {tab.icon}{tab.label}
            {Boolean(tab.count) && <span className="prm-tab-count">{tab.count}</span>}
          </Button>
        ))}
      </div>
    </header>
  );
}
