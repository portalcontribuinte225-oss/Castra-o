import { useEffect, useState } from "react";
import { CalendarDays, FileText, HeartPulse, History, User } from "lucide-react";
import { RequestHistoryCategory } from "../../../shared/request-history-contract.js";
import { api } from "../../api";
import { Button } from "../../components/button";
import type { ProcessHistoryEvent } from "./process-history";

const dayFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });
const categories = {
  [RequestHistoryCategory.PROCESS]: { label: "Processo", icon: History },
  [RequestHistoryCategory.DOCUMENTS]: { label: "Documentos", icon: FileText },
  [RequestHistoryCategory.SCHEDULE]: { label: "Agendamento", icon: CalendarDays },
  [RequestHistoryCategory.TUTOR]: { label: "Tutor", icon: User },
  [RequestHistoryCategory.HEALTH]: { label: "Saúde", icon: HeartPulse },
};

export function ProcessHistoryTimeline({ events }: { events: ProcessHistoryEvent[] }) {
  const groups = new Map<string, ProcessHistoryEvent[]>();
  const recent = [...events].reverse().sort((first, second) => (second.at || "").localeCompare(first.at || ""));
  for (const event of recent) {
    const day = event.at ? dayFormat.format(new Date(event.at)) : "Data não registrada";
    const group = groups.get(day) || [];
    group.push(event);
    groups.set(day, group);
  }
  return (
    <section aria-label="Linha do tempo do processo">
      <h3 className="prm-history-heading">Histórico do processo</h3>
      {[...groups].map(([day, entries]) => (
        <section key={day} className="prm-history-day">
          <h4>{day}</h4>
          <ol className="prm-history" role="list">
            {entries.map(({ kind, at, label, actor, detail, category }, index) => {
              const { icon: Icon, label: categoryLabel } = categories[category || RequestHistoryCategory.PROCESS] || categories.process;
              return <li key={index} className="prm-history-event" data-kind={kind} data-category={category}>
                <span className="prm-history-icon"><Icon size={16} aria-hidden="true" /></span>
                <div className="prm-history-entry">
                  <div className="prm-history-event-heading">
                    <strong>{label}</strong>
                    {at && <time dateTime={at}>{timeFormat.format(new Date(at))}</time>}
                  </div>
                  {detail && <p>{detail}</p>}
                  <span className="prm-muted-note">{[actor, categoryLabel].filter(Boolean).join(" · ")}</span>
                </div>
              </li>;
            })}
          </ol>
        </section>
      ))}
    </section>
  );
}

export function ProcessHistoryTab({ requestId, onCount }: { requestId: string; onCount: (count: number) => void }) {
  const [events, setEvents] = useState<ProcessHistoryEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.getRequestHistory(requestId, controller.signal)
      .then((history) => {
        if (!controller.signal.aborted) { setEvents(history.events); onCount(history.events.length); }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [requestId, attempt, onCount]);

  if (error) return (
    <div className="prm-section">
      <p className="form-error" role="alert">Não foi possível carregar o histórico do processo.</p>
      <Button variant="outline" onClick={() => { setError(false); setAttempt((current) => current + 1); }}>Tentar novamente</Button>
    </div>
  );
  if (!events) return <p className="prm-muted-note" role="status">Carregando histórico...</p>;
  return <ProcessHistoryTimeline events={events} />;
}
