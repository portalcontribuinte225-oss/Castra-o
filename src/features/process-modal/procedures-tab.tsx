import { FileText, Trash2 } from "lucide-react";
import { MAX_HEALTH_TEXT, ProcedureStatus, animalPrescriptionRecords, isOpenProcedure } from "../../../shared/request-procedure-contract.js";
import { Button } from "../../components/button";
import { ConfigField, configFieldStyle, configTextareaStyle } from "../../components/ui";
import { displayText } from "../../domain";
import { procedureStatusLabels } from "./process-labels";
import { procedureTargetKey } from "./process-types";
import type { HealthDraft, ProcedureTarget, ProcessAnimal } from "./process-types";
import { editableMicrochip } from "./use-process-procedures";

interface ProceduresTabProps {
  animals: ProcessAnimal[];
  animalIndex: number;
  selectedType: string;
  health: HealthDraft;
  marked: Set<string>;
  scheduled: ProcedureTarget[];
  readOnly: boolean;
  busy: boolean;
  onAnimal: (index: number, requestTypeId?: string) => void;
  onHealth: (patch: Partial<HealthDraft>) => void;
  onMark: (targets: ProcedureTarget[], checked: boolean) => void;
  onRemove: (target: ProcedureTarget) => void;
  onPrescriptions: () => void;
}

export const processAnimalLabel = (animal: ProcessAnimal, index: number) =>
  displayText(animal.name) || [displayText(animal.species), displayText(animal.sex)].filter(Boolean).join(" · ") || `Animal ${index + 1}`;

export function ProceduresTab({ animals, animalIndex, selectedType, health, marked, scheduled, readOnly, busy,
  onAnimal, onHealth, onMark, onRemove, onPrescriptions }: ProceduresTabProps) {
  const animal = animals[animalIndex];
  if (!animal) return <p className="prm-muted-note">Nenhum animal neste processo.</p>;
  const active = (item: ProcessAnimal) => item.procedures.filter(({ status }) => status !== ProcedureStatus.REMOVED);
  const result = (index: number, requestTypeId: string, status: string) =>
    marked.has(procedureTargetKey({ animalIndex: index, requestTypeId })) ? ProcedureStatus.DONE : status;
  const total = animals.reduce((count, item) => count + active(item).length, 0);
  const completed = animals.reduce((count, item, index) => count + active(item).filter((procedure) => result(index, procedure.requestTypeId, procedure.status) === ProcedureStatus.DONE).length, 0);
  const editable = !busy && !readOnly && animal.procedures.some(isOpenProcedure);
  const hasPrescriptions = animals.some((item) => animalPrescriptionRecords(item).length);
  const hasPending = active(animal).some((procedure) => isOpenProcedure(procedure) && result(animalIndex, procedure.requestTypeId, procedure.status) !== ProcedureStatus.DONE);

  return (
    <div className="prm-procedure-layout">
      <aside className="prm-procedure-list" aria-label="Animais e procedimentos">
        <div className="prm-clinical-list-heading">
          <strong>Animais e procedimentos</strong>
          <span>{animals.length} {animals.length === 1 ? "animal" : "animais"} · <strong>{completed}/{total} realizados</strong></span>
        </div>
        <div className="prm-clinical-all">
          <label><input type="checkbox" checked={scheduled.length ? scheduled.every((item) => marked.has(procedureTargetKey(item))) : total > 0 && total === completed} disabled={readOnly || busy || scheduled.length === 0}
            onChange={(event) => onMark(scheduled, event.target.checked)} /> Todos realizados</label>
          <Button variant="outline" className="prm-icon-button" title="Receita unificada" aria-label="Receita unificada"
            disabled={busy || (readOnly && !hasPrescriptions)} onClick={onPrescriptions}><FileText size={16} aria-hidden="true" /></Button>
        </div>
        {animals.map((item, index) => {
          const label = processAnimalLabel(item, index);
          const procedures = active(item);
          const eligible = scheduled.filter((target) => target.animalIndex === index);
          const done = procedures.filter((procedure) => result(index, procedure.requestTypeId, procedure.status) === ProcedureStatus.DONE).length;
          return (
            <div key={item.id || index} className="prm-clinical-animal" data-selected={index === animalIndex}>
              <div className="prm-clinical-animal-heading">
                <input type="checkbox" aria-label={`Todos os procedimentos de ${label}`} checked={eligible.length ? eligible.every((target) => marked.has(procedureTargetKey(target))) : procedures.length > 0 && done === procedures.length}
                  disabled={readOnly || busy || eligible.length === 0} onChange={(event) => onMark(eligible, event.target.checked)} />
                <button type="button" className="prm-animal-identity" onClick={() => onAnimal(index)}>
                  <strong>{[displayText(item.species), displayText(item.sex)].filter(Boolean).join(" · ") || label}</strong>
                  {item.name && (item.species || item.sex) && <span> · {displayText(item.name)}</span>}
                </button>
                <span>{done}/{procedures.length} realizados</span>
              </div>
              {procedures.map((procedure) => {
                const target = { animalIndex: index, requestTypeId: procedure.requestTypeId };
                const status = result(index, procedure.requestTypeId, procedure.status);
                return (
                  <div key={procedure.requestTypeId} className="prm-clinical-procedure">
                    <input type="checkbox" aria-label={`Realizado: ${label} — ${procedure.name}`} checked={status === ProcedureStatus.DONE}
                      disabled={readOnly || busy || procedure.status !== ProcedureStatus.SCHEDULED} onChange={(event) => onMark([target], event.target.checked)} />
                    <button type="button" className="prm-procedure-item" aria-pressed={index === animalIndex && selectedType === procedure.requestTypeId}
                      onClick={() => onAnimal(index, procedure.requestTypeId)}>{procedure.name}</button>
                    <span data-status={status}>{procedureStatusLabels[status] || status}</span>
                    <button type="button" className="prm-remove-procedure" title="Remover procedimento" aria-label={`Remover ${procedure.name} de ${label}`}
                      disabled={readOnly || busy || !isOpenProcedure(procedure)} onClick={() => onRemove(target)}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                );
              })}
              {!procedures.length && <p className="prm-muted-note">Nenhum procedimento ativo</p>}
            </div>
          );
        })}
      </aside>
      <section className="prm-procedure-detail">
        <div className="prm-section-head">
          <div><strong>{[displayText(animal.species), displayText(animal.sex)].filter(Boolean).join(" · ") || processAnimalLabel(animal, animalIndex)}</strong>
            {animal.name && (animal.species || animal.sex) && <span> · {displayText(animal.name)}</span>}</div>
          <span className="attachment-status attachment-status--generated">{!active(animal).length ? "Sem procedimentos ativos"
            : active(animal).every((item) => result(animalIndex, item.requestTypeId, item.status) === ProcedureStatus.DONE) ? "Realizado"
            : !hasPending ? "Resultados definidos" : active(animal).some((item) => !isOpenProcedure(item) || marked.has(procedureTargetKey({ animalIndex, requestTypeId: item.requestTypeId }))) ? "Parcialmente registrado" : "Pendente"}</span>
        </div>
        <h3 className="prm-section-title">Saúde do animal</h3>
        <ConfigField label="Número do microchip" value={health.microchip} maxLength={32} placeholder="Informe o número do microchip"
          readOnly={!editable || !editableMicrochip(animal)} onChange={(value) => onHealth({ microchip: value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
        {(["doencas", "alergias"] as const).map((key) => (
          <label className={configFieldStyle} key={key}>
            <span>{key === "doencas" ? "Doenças preexistentes" : "Alergias conhecidas"}</span>
            <textarea data-ui-input="" className={configTextareaStyle} value={health[key]} maxLength={MAX_HEALTH_TEXT} rows={3} readOnly={!editable}
              placeholder="Se houver" onChange={(event) => onHealth({ [key]: event.target.value })} />
          </label>
        ))}
      </section>
    </div>
  );
}
