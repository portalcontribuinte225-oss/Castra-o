export enum RequestStep {
  TUTOR = 0,
  ANIMAL = 1,
  SCHEDULE = 2,
  DOCUMENTS = 3,
}

export const requestStepLabels: Record<RequestStep, string> = {
  // The first step is about the person: the answer about the tutor, the tutor's data and the acceptance of the notices.
  [RequestStep.TUTOR]: "Você",
  [RequestStep.ANIMAL]: "Animal",
  [RequestStep.SCHEDULE]: "Agenda",
  [RequestStep.DOCUMENTS]: "Documentos",
};

export interface RequestStepItem {
  step: RequestStep;
  label: string;
}

// The same steps, in the same order, for the public form and for the one the staff fills: what the answer about the tutor or a request
// type changes is what a step asks, never which steps exist.
export const requestSteps: readonly RequestStepItem[] = Object.freeze(
  [RequestStep.TUTOR, RequestStep.ANIMAL, RequestStep.SCHEDULE, RequestStep.DOCUMENTS].map((step) => ({ step, label: requestStepLabels[step] })),
);
