export enum RequestStep {
  TUTOR = 0,
  ANIMAL = 1,
  SCHEDULE = 2,
  DOCUMENTS = 3,
}

export const requestStepLabels: Record<RequestStep, string> = {
  [RequestStep.TUTOR]: "Tutor",
  [RequestStep.ANIMAL]: "Animal",
  [RequestStep.SCHEDULE]: "Agenda",
  [RequestStep.DOCUMENTS]: "Documentos",
};

// Keys are persisted in existing configuration data: do not rename.
export interface StepToggles {
  stepTutor?: boolean;
  stepAgenda?: boolean;
  stepDocuments?: boolean;
}

export interface RequestStepItem {
  step: RequestStep;
  label: string;
}

export interface VisibleStepsInput {
  internal: boolean;
  skipTutor: boolean;
  configs: Array<StepToggles | null | undefined>;
}

const internalStepOrder: RequestStep[] = [RequestStep.TUTOR, RequestStep.ANIMAL, RequestStep.SCHEDULE];

const publicStepOrder: RequestStep[] = [
  RequestStep.ANIMAL,
  RequestStep.TUTOR,
  RequestStep.SCHEDULE,
  RequestStep.DOCUMENTS,
];

const stepToggleKeys: Partial<Record<RequestStep, keyof StepToggles>> = {
  [RequestStep.TUTOR]: "stepTutor",
  [RequestStep.SCHEDULE]: "stepAgenda",
  [RequestStep.DOCUMENTS]: "stepDocuments",
};

function toStepItem(step: RequestStep): RequestStepItem {
  return { step, label: requestStepLabels[step] };
}

// A step is visible only when every config allows it; only an explicit `false` hides a step.
function isAllowedByConfigs(step: RequestStep, configs: VisibleStepsInput["configs"]): boolean {
  const toggleKey = stepToggleKeys[step];
  if (!toggleKey) return true;
  return configs.every((config) => config?.[toggleKey] !== false);
}

export function getVisibleSteps({ internal, skipTutor, configs }: VisibleStepsInput): RequestStepItem[] {
  if (internal) return internalStepOrder.map(toStepItem);

  return publicStepOrder
    .filter((step) => !(step === RequestStep.TUTOR && skipTutor))
    .filter((step) => isAllowedByConfigs(step, configs))
    .map(toStepItem);
}

export function summarizeVisibleSteps(configs: VisibleStepsInput["configs"]): string {
  return getVisibleSteps({ internal: false, skipTutor: false, configs })
    .map((item) => item.label)
    .join(", ");
}
