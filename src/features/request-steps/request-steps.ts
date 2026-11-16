import { configsAllowStep } from "../../../shared/notification-contract.js";

export enum RequestStep {
  TUTOR = 0,
  ANIMAL = 1,
  SCHEDULE = 2,
  DOCUMENTS = 3,
  FOLLOW_UP = 4,
}

export const requestStepLabels: Record<RequestStep, string> = {
  [RequestStep.TUTOR]: "Tutor",
  [RequestStep.ANIMAL]: "Animal",
  [RequestStep.SCHEDULE]: "Agenda",
  [RequestStep.DOCUMENTS]: "Documentos",
  [RequestStep.FOLLOW_UP]: "Acompanhamento",
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

// Animal first, as in the public form: the identification type chosen there is what decides whether the Tutor step exists.
const internalStepOrder: RequestStep[] = [RequestStep.ANIMAL, RequestStep.TUTOR, RequestStep.SCHEDULE, RequestStep.DOCUMENTS, RequestStep.FOLLOW_UP];

const publicStepOrder: RequestStep[] = [
  RequestStep.ANIMAL,
  RequestStep.TUTOR,
  RequestStep.SCHEDULE,
  RequestStep.DOCUMENTS,
  RequestStep.FOLLOW_UP,
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
  return configsAllowStep(configs, toggleKey);
}

export function getVisibleSteps({ internal, skipTutor, configs }: VisibleStepsInput): RequestStepItem[] {
  // The internal form has the public one's steps, except that the agenda is always there (the staff schedules). An explicit `stepTutor: false`
  // in the configs it is given (the request types and the identification type) takes the Tutor step away, and with no tutor there is nobody
  // to follow up; an explicit `stepDocuments: false` takes the Documents step away.
  if (internal) {
    const tutorVisible = isAllowedByConfigs(RequestStep.TUTOR, configs);
    const hasTutorSteps = (step: RequestStep) => step !== RequestStep.TUTOR && step !== RequestStep.FOLLOW_UP || tutorVisible;
    return internalStepOrder
      .filter((step) => hasTutorSteps(step) && (step !== RequestStep.DOCUMENTS || isAllowedByConfigs(step, configs)))
      .map(toStepItem);
  }

  return publicStepOrder
    .filter((step) => !(step === RequestStep.TUTOR && skipTutor))
    .filter((step) => isAllowedByConfigs(step, configs))
    .map(toStepItem);
}

export function summarizeVisibleSteps(configs: VisibleStepsInput["configs"]): string {
  return getVisibleSteps({ internal: false, skipTutor: false, configs })
    .filter((item) => item.step !== RequestStep.FOLLOW_UP)
    .map((item) => item.label)
    .join(", ");
}
