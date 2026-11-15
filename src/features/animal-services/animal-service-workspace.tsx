import React from "react";
import { AnimalDeathForm } from "./animal-death-form";
import { AnimalRecordView } from "./animal-record-view";
import { AnimalService } from "./animal-service-types";
import type { AnimalRecord, AnimalSummary } from "./animal-service-types";
import { AnimalTransferForm } from "./animal-transfer-form";

export interface AnimalServiceSelection {
  animal: AnimalSummary;
  service: AnimalService;
}

export function AnimalServiceWorkspace({ selection, onBack, downloadRecordPdf }: { selection: AnimalServiceSelection; onBack: () => void; downloadRecordPdf: (record: AnimalRecord) => Promise<void> }) {
  switch (selection.service) {
    case AnimalService.RECORD: return <AnimalRecordView key={selection.animal.id} animalId={selection.animal.id} onBack={onBack} downloadRecordPdf={downloadRecordPdf} />;
    case AnimalService.TRANSFER: return <AnimalTransferForm key={selection.animal.id} animal={selection.animal} onBack={onBack} />;
    case AnimalService.DEATH: return <AnimalDeathForm key={selection.animal.id} animal={selection.animal} onBack={onBack} />;
    default: return null;
  }
}
