import { useMemo, useState } from "react";
import { isMicrochipProcedure, isOpenProcedure, resolveRequestProcedures } from "../../../shared/request-procedure-contract.js";
import type { AnyRecord } from "../../types";

export interface HealthDraft {
  doencas: string;
  alergias: string;
}

const chipKey = (animalIndex: number, requestTypeId: string) => `${animalIndex}:${requestTypeId}`;

type HealthDrafts = Record<number, Partial<HealthDraft>>;
type MicrochipDrafts = Record<string, string>;
type ProcedureEdits = Partial<HealthDraft> & { microchip?: string };
interface ProcedureDraft {
  animalIndex: number;
  requestTypeId: string;
  edits: ProcedureEdits;
}

function changedHealth(draft: Partial<HealthDraft> = {}, stored: HealthDraft): Partial<HealthDraft> {
  const edits: Partial<HealthDraft> = {};
  if (draft.doencas !== undefined && draft.doencas !== stored.doencas) edits.doencas = draft.doencas;
  if (draft.alergias !== undefined && draft.alergias !== stored.alergias) edits.alergias = draft.alergias;
  return edits;
}

function changedMicrochip(value: string | undefined, procedure: AnyRecord): ProcedureEdits {
  if (!isMicrochipProcedure(procedure.name) || value === undefined || value === (procedure.microchip || "")) return {};
  return { microchip: value };
}

export function getProcedureDraftEdits(animals: AnyRecord[], health: HealthDrafts, chips: MicrochipDrafts): ProcedureDraft[] {
  return animals.flatMap((animal, animalIndex) => {
    const procedures: AnyRecord[] = animal.procedures.filter(isOpenProcedure);
    const pending = procedures.flatMap((procedure) => {
      const requestTypeId = procedure.requestTypeId;
      const edits = changedMicrochip(chips[chipKey(animalIndex, requestTypeId)], procedure);
      return edits.microchip === undefined ? [] : [{ animalIndex, requestTypeId, edits }];
    });
    const healthEdits = changedHealth(health[animalIndex], { doencas: animal.doencas ?? "", alergias: animal.alergias ?? "" });
    if (Object.keys(healthEdits).length && procedures.length) {
      if (pending.length) Object.assign(pending[0].edits, healthEdits);
      else pending.push({ animalIndex, requestTypeId: procedures[0].requestTypeId, edits: healthEdits });
    }
    return pending;
  });
}

// The animals of the request with their procedures, the one chosen on screen and what the staff typed and did not save yet. Each
// animal keeps its own draft, so going from one animal to another never loses what was typed.
export function useProcessProcedures(request: AnyRecord, requestTypes: AnyRecord[]) {
  const animals: AnyRecord[] = useMemo(() => {
    const workflow = request.workflow_data || request.workflowData || {};
    return resolveRequestProcedures(request, requestTypes).map((animal, index) => ({
      ...animal,
      doencas: animal.doencas ?? (index === 0 ? workflow.doencas : "") ?? "",
      alergias: animal.alergias ?? (index === 0 ? workflow.alergias : "") ?? "",
    }));
  }, [request, requestTypes]);
  const [animalIndex, setAnimalIndex] = useState(0);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [health, setHealth] = useState<HealthDrafts>({});
  const [chips, setChips] = useState<MicrochipDrafts>({});

  const currentIndex = animals[animalIndex] ? animalIndex : 0;
  const animal = animals[currentIndex];
  const procedures: AnyRecord[] = animal?.procedures || [];
  const procedure = procedures.find((item) => item.requestTypeId === chosen[currentIndex]) || procedures[0] || null;

  const storedHealth = { doencas: animal?.doencas ?? "", alergias: animal?.alergias ?? "" };
  const currentKey = procedure ? chipKey(currentIndex, procedure.requestTypeId) : "";
  const currentEdits = procedure && isOpenProcedure(procedure) ? {
    ...changedHealth(health[currentIndex], storedHealth),
    ...changedMicrochip(chips[currentKey], procedure),
  } : {};
  const drafts = getProcedureDraftEdits(animals, health, chips);

  function selectAnimal(index: number) {
    setAnimalIndex(index);
  }

  function selectProcedure(requestTypeId: string) {
    setChosen((current) => ({ ...current, [currentIndex]: requestTypeId }));
  }

  function changeHealth(patch: Partial<HealthDraft>) {
    setHealth((current) => ({ ...current, [currentIndex]: { ...current[currentIndex], ...patch } }));
  }

  function changeMicrochip(value: string) {
    if (!procedure) return;
    setChips((current) => ({ ...current, [chipKey(currentIndex, procedure.requestTypeId)]: value.toUpperCase().replace(/[^A-Z0-9]/g, "") }));
  }

  function clearDraft({ animalIndex, requestTypeId, edits }: ProcedureDraft) {
    if (edits.doencas !== undefined || edits.alergias !== undefined) {
      setHealth(({ [animalIndex]: _saved, ...rest }) => rest);
    }
    if (edits.microchip !== undefined) {
      setChips(({ [chipKey(animalIndex, requestTypeId)]: _saved, ...rest }) => rest);
    }
  }

  return {
    animals, animalIndex: currentIndex, animal, procedure, selectAnimal, selectProcedure,
    health: { ...storedHealth, ...health[currentIndex] }, changeHealth,
    microchip: procedure ? chips[currentKey] ?? procedure.microchip ?? "" : "", changeMicrochip,
    drafts, currentChanged: Object.keys(currentEdits).length > 0, currentEdits, clearDraft,
  };
}
