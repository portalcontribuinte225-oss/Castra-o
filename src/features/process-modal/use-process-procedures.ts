import { useMemo, useState } from "react";
import { ProcedureStatus, isMicrochipProcedure, isOpenProcedure, resolveRequestProcedures } from "../../../shared/request-procedure-contract.js";
import type { AnyRecord } from "../../types";
import { procedureTargetKey } from "./process-types";
import type { HealthDraft, HealthEdit, ProcedureTarget, ProcessAnimal } from "./process-types";

type HealthDrafts = Record<number, Partial<HealthDraft>>;

export function editableMicrochip(animal?: ProcessAnimal) {
  return animal?.procedures.find((item) => isOpenProcedure(item) && isMicrochipProcedure(item.name));
}

function healthOf(animal?: ProcessAnimal): HealthDraft {
  return { doencas: animal?.doencas || "", alergias: animal?.alergias || "", microchip: editableMicrochip(animal)?.microchip ?? animal?.confirmedMicrochip ?? animal?.microchip ?? "" };
}

export function getHealthEdits(animals: ProcessAnimal[], health: HealthDrafts): HealthEdit[] {
  return animals.flatMap((animal, animalIndex) => {
    if (!animal.procedures.some(isOpenProcedure)) return [];
    const draft = health[animalIndex];
    if (!draft) return [];
    const stored = healthOf(animal);
    const edits: HealthEdit = { animalIndex };
    for (const key of ["doencas", "alergias", "microchip"] as const) {
      const value = draft[key]?.trim();
      if (value === undefined || value === stored[key] || (key === "microchip" && !editableMicrochip(animal))) continue;
      edits[key] = value;
    }
    return Object.keys(edits).length > 1 ? [edits] : [];
  });
}

export function useProcessProcedures(request: AnyRecord, requestTypes: AnyRecord[]) {
  const animals: ProcessAnimal[] = useMemo(() => {
    const workflow = request.workflow_data || request.workflowData || {};
    return resolveRequestProcedures(request, requestTypes).map((animal, index) => ({
      ...animal,
      doencas: animal.doencas ?? (index === 0 ? workflow.doencas : "") ?? "",
      alergias: animal.alergias ?? (index === 0 ? workflow.alergias : "") ?? "",
    }));
  }, [request, requestTypes]);
  const [animalIndex, setAnimalIndex] = useState(0);
  const [selectedType, setSelectedType] = useState("");
  const [health, setHealth] = useState<HealthDrafts>({});
  const [marked, setMarked] = useState<Set<string>>(() => new Set());

  const currentIndex = animals[animalIndex] ? animalIndex : 0;
  const animal = animals[currentIndex];
  const currentProcedures = animal?.procedures.filter(({ status }) => status !== ProcedureStatus.REMOVED) || [];
  const selectedProcedure = currentProcedures.find((item) => item.requestTypeId === selectedType) || currentProcedures[0] || null;
  const scheduled = animals.flatMap(({ procedures }, index) => procedures
    .filter((item) => item.status === ProcedureStatus.SCHEDULED)
    .map(({ requestTypeId }) => ({ animalIndex: index, requestTypeId })));
  const results = scheduled.filter((target) => marked.has(procedureTargetKey(target)));
  const healthEdits = getHealthEdits(animals, health);

  function selectAnimal(index: number, requestTypeId = "") {
    setAnimalIndex(index);
    setSelectedType(requestTypeId);
  }

  function changeHealth(patch: Partial<HealthDraft>) {
    setHealth((current) => ({ ...current, [currentIndex]: { ...current[currentIndex], ...patch } }));
  }

  function toggleResults(targets: ProcedureTarget[], checked: boolean) {
    setMarked((current) => {
      const next = new Set(current);
      for (const target of targets) {
        const key = procedureTargetKey(target);
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function clearDrafts() {
    setHealth({});
    setMarked(new Set());
  }

  return {
    animals, animalIndex: currentIndex, selectedProcedure, selectAnimal, health: { ...healthOf(animal), ...health[currentIndex] },
    changeHealth, marked, toggleResults, scheduled, clearDrafts, batch: { health: healthEdits, results },
    dirty: Boolean(results.length || healthEdits.length),
  };
}
