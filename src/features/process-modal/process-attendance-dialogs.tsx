import { useState } from "react";
import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";
import { Button } from "../../components/button";
import { ProcessDialog } from "./process-dialog";
import { procedureStatusLabels } from "./process-labels";
import { procedureTargetKey } from "./process-types";
import type { ProcedureTarget, ProcessAnimal } from "./process-types";
import { processAnimalLabel } from "./procedures-tab";

interface AttendanceDialogProps {
  animals: ProcessAnimal[];
  busy: boolean;
  onClose: () => void;
}

export function AbsenceDialog({ animals, scheduled, initial, busy, onClose, onConfirm }: AttendanceDialogProps & {
  scheduled: ProcedureTarget[]; initial: ProcedureTarget; onConfirm: (results: ProcedureTarget[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set([procedureTargetKey(initial)]));
  const results = scheduled.filter((item) => selected.has(procedureTargetKey(item)));
  function select(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  return (
    <ProcessDialog title="Registrar não comparecimento" busy={busy} onClose={onClose} actions={<>
      <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
      <Button disabled={busy || !results.length} onClick={() => onConfirm(results)}>Confirmar</Button>
    </>}>
      <p className="prm-muted-note">Selecione somente os procedimentos que deseja atualizar.</p>
      {animals.map((animal, index) => {
        const targets = scheduled.filter((item) => item.animalIndex === index);
        return targets.length > 0 && (
          <fieldset className="prm-result-group" key={index} disabled={busy}>
            <legend>{processAnimalLabel(animal, index)}</legend>
            {targets.map((target) => {
              const key = procedureTargetKey(target);
              return <label key={key}><input type="checkbox" checked={selected.has(key)} onChange={(event) => select(key, event.target.checked)} />
                {animal.procedures.find((item) => item.requestTypeId === target.requestTypeId)?.name}</label>;
            })}
          </fieldset>
        );
      })}
    </ProcessDialog>
  );
}

export function FinishAttendanceDialog({ animals, marked, title, busy, onClose, onConfirm }: AttendanceDialogProps & {
  marked: Set<string>; title: string; onConfirm: () => void;
}) {
  const rows = animals.map((animal, index) => ({
    label: processAnimalLabel(animal, index),
    results: animal.procedures.map((item) => ({
      ...item, status: marked.has(procedureTargetKey({ animalIndex: index, requestTypeId: item.requestTypeId })) ? ProcedureStatus.DONE : item.status,
    })),
  }));
  const results = rows.flatMap((row) => row.results);
  const done = results.filter(({ status }) => status === ProcedureStatus.DONE).length;
  const removed = results.filter(({ status }) => status === ProcedureStatus.REMOVED).length;
  return (
    <ProcessDialog title={title} busy={busy} onClose={onClose} actions={<Button disabled={busy} onClick={onConfirm}>Confirmar conclusão</Button>}>
      <p className="prm-muted-note">Confirme o encerramento da solicitação.</p>
      <div className="prm-result-group">
        <strong>{done} realizado(s) · {results.length - done - removed} não realizado(s) · {removed} removido(s)</strong>
        {rows.map(({ label, results: items }, index) => <div key={index}>
          <strong>{label}</strong>
          {items.map(({ requestTypeId, name, status }) => <p className="prm-muted-note" key={requestTypeId}>{name} · {procedureStatusLabels[status] || status}</p>)}
        </div>)}
      </div>
    </ProcessDialog>
  );
}
