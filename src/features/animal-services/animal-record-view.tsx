import React, { useState } from "react";
import { Cat, Clock, Dog, Download, MapPin, Phone, ScanLine, User } from "lucide-react";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { InfoTile } from "../../components/ui";
import { statusLabels } from "../../domain";
import { formatDateTime, maskCpf } from "../../utils";
import { maskFollowUpEmail, maskFollowUpPhone } from "../request-follow-up/follow-up";
import { AnimalHistoryIcon } from "./animal-history-icon";
import {
  AnimalRecordType, animalHistoryTitle, animalHistoryTone, getAnimalHistoryMunicipality, getAnimalHistorySchedule, isScheduledHistoryItem,
} from "./animal-history";
import type { AnimalRecord } from "./animal-service-types";
import { useAnimalRecord } from "./use-animal-record";

const VISIBLE_HISTORY_ITEMS = 8;

export function AnimalRecordView({ animalId, onBack, downloadRecordPdf }: { animalId: string; onBack: () => void; downloadRecordPdf: (record: AnimalRecord) => Promise<void> }) {
  const state = useAnimalRecord(animalId);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  async function download(record: AnimalRecord) {
    if (downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadRecordPdf(record);
    } catch {
      setDownloadError("Não foi possível gerar o prontuário agora. Tente novamente em instantes.");
    } finally {
      setDownloading(false);
    }
  }

  if (state.loading) return <p role="status">Carregando prontuário...</p>;
  if (state.error || !state.record) {
    return <Card as="section" className="tw:grid tw:gap-3 tw:p-5">
      <p className="form-error" role="alert">{state.error || "Prontuário indisponível."}</p>
      <div className="svc-modal-footer">
        <Button variant="outline" onClick={onBack}>Voltar aos meus animais</Button>
        <Button onClick={state.retry}>Tentar novamente</Button>
      </div>
    </Card>;
  }

  const { animal, tutor } = state.record;
  const history = Array.isArray(state.record.history) ? state.record.history : [];
  const latest = history[0] || null;
  const nextScheduled = history.find((item) => isScheduledHistoryItem(item) && getAnimalHistorySchedule(item));
  const latestProcedure = history.find((item) => item.type === AnimalRecordType.SURGERY_DONE || item.type === AnimalRecordType.PROCEDURE_REQUEST);
  const municipalities = [...new Set(history.map(getAnimalHistoryMunicipality).filter(Boolean))];
  const summary = [animal.species, animal.sex, animal.size].filter(Boolean).join(" · ") || "Dados do animal em atualização";
  const AnimalIcon = String(animal.species || "").toLowerCase().includes("gat") ? Cat : Dog;
  const contact = [maskFollowUpPhone(tutor?.phone || ""), maskFollowUpEmail(tutor?.tutor_email || "")].filter(Boolean).join(" · ") || "Não informado";
  const address = [tutor?.address, tutor?.neighborhood, tutor?.city, tutor?.state].filter(Boolean).join(", ") || "Endereço não informado";
  const summaryCards = [
    { icon: User, label: "Tutor atual", value: tutor?.tutor_name || tutor?.name || "Não informado", detail: maskCpf(tutor?.cpf || "") },
    { icon: Phone, label: "Contato", value: contact, detail: address },
    { icon: Clock, label: "Situação", value: latest ? animalHistoryTitle(latest) : "Sem eventos", detail: latest?.occurred_at ? formatDateTime(latest.occurred_at) : "Sem data registrada" },
  ];

  return <section className="tw:grid tw:min-w-0 tw:gap-3.5">
    <Card tone="page" className="tw:flex tw:flex-col tw:items-start tw:justify-between tw:gap-3 tw:p-4 tw:min-[761px]:flex-row">
      <div className="animal-record-identity">
        <div className="animal-record-avatar" aria-hidden="true"><AnimalIcon size={28} /></div>
        <div>
          <h3>{animal.name || "Animal sem nome"}</h3>
          <p>{summary}</p>
          <div className="animal-record-meta">
            <span><ScanLine size={14} /> {animal.microchip || "Microchip não informado"}</span>
            {municipalities.length > 0 && <span><MapPin size={14} /> {municipalities.join(", ")}</span>}
          </div>
        </div>
      </div>
      <div className="animal-record-header-tools">
        <span className="animal-status-chip">{animal.status || "ativo"}</span>
        <Button variant="outline" title="Baixar prontuário PDF" aria-label="Baixar prontuário PDF" disabled={downloading} onClick={() => download(state.record)}>
          <Download size={15} aria-hidden="true" />
        </Button>
      </div>
    </Card>
    {downloadError && <p className="form-error" role="alert">{downloadError}</p>}

    <div className="animal-record-summary">
      {summaryCards.map(({ icon: Icon, label, value, detail }) => (
        <Card key={label} className="tw:grid tw:min-w-0 tw:content-start tw:gap-1 tw:p-3.5 tw:[overflow-wrap:anywhere]">
          <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-sm tw:font-semibold tw:text-ui-muted">
            <Icon size={14} aria-hidden="true" /> {label}
          </span>
          <strong className="tw:text-ui-ink">{value}</strong>
          <small className="tw:text-ui-muted">{detail}</small>
        </Card>
      ))}
    </div>

    <div className="animal-record-grid">
      <InfoTile label="Microchip" value={animal.microchip || "Não informado"} />
      <InfoTile label="Espécie / sexo / porte" value={summary} />
      <InfoTile label="Próxima agenda" value={nextScheduled ? getAnimalHistorySchedule(nextScheduled) : "Sem agenda"} />
      <InfoTile label="Último procedimento" value={latestProcedure ? animalHistoryTitle(latestProcedure) : "Não informado"} />
      <InfoTile label="Municípios" value={municipalities.join(", ") || "Não informado"} />
      <InfoTile label="Eventos" value={`${history.length} registro(s)`} />
    </div>

    <div className="animal-history">
      <div className="animal-history-heading">
        <div>
          <h4>Histórico do animal</h4>
          <p>{history.length} evento(s) registrado(s) para este animal</p>
        </div>
      </div>
      {history.length === 0 && <p className="helper-text">Nenhum evento registrado para este animal.</p>}
      {history.slice(0, VISIBLE_HISTORY_ITEMS).map((item, index) => (
        <article className={`animal-history-item ${animalHistoryTone(item)}`} key={`${item.source || "history"}-${item.request_id || item.id || index}`}>
          <div className="animal-history-marker"><AnimalHistoryIcon item={item} /></div>
          <div className="animal-history-content">
            <div className="animal-history-topline">
              <span>{formatDateTime(item.occurred_at) || "Sem data"}</span>
              {getAnimalHistoryMunicipality(item) && <em>{getAnimalHistoryMunicipality(item)}</em>}
            </div>
            <strong>{animalHistoryTitle(item)}</strong>
            {(item.protocol || item.status || item.notes) && (
              <p>{[item.protocol ? `#${item.protocol}` : "", item.status ? statusLabels[item.status] || item.status : "", item.notes].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </article>
      ))}
    </div>

    <div className="svc-modal-footer">
      <Button variant="outline" onClick={onBack}>Voltar aos meus animais</Button>
    </div>
  </section>;
}
