import { PawPrint } from "lucide-react";
import { MAX_HEALTH_TEXT, isMicrochipProcedure, isOpenProcedure } from "../../../shared/request-procedure-contract.js";
import { displayScheduleDate, scheduleDate } from "../../../shared/schedule-contract.js";
import { displayText } from "../../domain";
import type { AnyRecord } from "../../types";
import type { HealthDraft } from "./use-process-procedures";
import { plural, procedureStatusClasses, procedureStatusLabels } from "./process-labels";

interface ProceduresTabProps {
  animals: AnyRecord[];
  animalIndex: number;
  procedure: AnyRecord | null;
  health: HealthDraft;
  microchip: string;
  readOnly: boolean;
  onAnimal: (index: number) => void;
  onProcedure: (requestTypeId: string) => void;
  onHealth: (patch: Partial<HealthDraft>) => void;
  onMicrochip: (value: string) => void;
}

function StatusChip({ status }: { status: string }) {
  return <span className={`attachment-status attachment-status--${procedureStatusClasses[status] || "pending"}`}>{procedureStatusLabels[status] || status}</span>;
}

const animalName = (animal: AnyRecord, index: number) => displayText(animal?.name) || `Animal ${index + 1}`;

// The animals of the process on top; the procedures of the chosen one on the side; the chosen procedure and the animal's health beside.
export function ProceduresTab({ animals, animalIndex, procedure, health, microchip, readOnly, onAnimal, onProcedure, onHealth, onMicrochip }: ProceduresTabProps) {
  const animal = animals[animalIndex] || {};
  const editable = !readOnly && isOpenProcedure(procedure);
  if (!animals.length) return <p className="prm-muted-note">Nenhum animal neste processo.</p>;
  return (
    <div className="prm-section">
      <div className="prm-animal-selector" role="group" aria-label="Animais do processo">
        {animals.map((item, index) => (
          <button key={index} type="button" aria-pressed={index === animalIndex} className={`prm-animal-option${index === animalIndex ? " is-active" : ""}`} onClick={() => onAnimal(index)}>
            <PawPrint size={15} />
            <span>
              <strong>{animalName(item, index)}</strong>
              <small>{plural(item.procedures.length, "procedimento", "procedimentos")}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="prm-procedure-layout">
        <aside className="prm-procedure-list" aria-label={`Procedimentos de ${animalName(animal, animalIndex)}`}>
          <p className="prm-section-title">Procedimentos de {animalName(animal, animalIndex)}</p>
          {(animal.procedures || []).map((item: AnyRecord) => (
            <button key={item.requestTypeId} type="button" aria-pressed={item.requestTypeId === procedure?.requestTypeId} className={`prm-procedure-item${item.requestTypeId === procedure?.requestTypeId ? " is-active" : ""}`} onClick={() => onProcedure(item.requestTypeId)}>
              <strong>{item.name}</strong>
              <span className="prm-procedure-item-meta">
                <small>{displayScheduleDate(scheduleDate(item.schedule?.date)) || "Sem data"}</small>
                <StatusChip status={item.status} />
              </span>
            </button>
          ))}
        </aside>
        {procedure ? (
          <section className="prm-procedure-detail">
            <div className="prm-section-head">
              <div>
                <p className="prm-section-label">{procedure.name}</p>
                <p className="prm-muted-note">{[animalName(animal, animalIndex), animal.species, animal.sex].filter(Boolean).join(" · ")}</p>
              </div>
              <StatusChip status={procedure.status} />
            </div>
            {procedure.rejection && <p className="prm-documents-warning"><strong>Indeferido: {procedure.rejection.reason}.</strong> {procedure.rejection.note}</p>}
            {isMicrochipProcedure(procedure.name) && (
              <label className="field">
                <span>Código do microchip aplicado ou lido</span>
                <input value={microchip} maxLength={32} readOnly={!editable} onChange={(event) => onMicrochip(event.target.value)} placeholder="Código aplicado ou lido" />
                <small>Preencha após ler ou aplicar o microchip. O código informado pelo tutor não é confirmação.</small>
              </label>
            )}
            <div className="prm-section-block">
              <p className="prm-section-title">Saúde do animal</p>
              <div className="prm-animal-data-grid">
                <label className="field">
                  <span>Doenças preexistentes</span>
                  <textarea value={health.doencas} maxLength={MAX_HEALTH_TEXT} rows={4} readOnly={!editable} placeholder="Se houver" onChange={(event) => onHealth({ doencas: event.target.value })} />
                </label>
                <label className="field">
                  <span>Alergias conhecidas</span>
                  <textarea value={health.alergias} maxLength={MAX_HEALTH_TEXT} rows={4} readOnly={!editable} placeholder="Se houver" onChange={(event) => onHealth({ alergias: event.target.value })} />
                </label>
              </div>
            </div>
          </section>
        ) : <p className="prm-muted-note">Nenhum procedimento para este animal.</p>}
      </div>
    </div>
  );
}
