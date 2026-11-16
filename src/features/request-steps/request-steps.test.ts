import { describe, expect, it } from "vitest";
import { RequestStep, requestStepLabels, requestSteps } from "./request-steps";

describe("requestSteps", () => {
  it("are the same four steps, in order and with their labels, for every form", () => {
    expect(requestSteps).toEqual([
      { step: RequestStep.TUTOR, label: "Você" },
      { step: RequestStep.ANIMAL, label: "Animal" },
      { step: RequestStep.SCHEDULE, label: "Agenda" },
      { step: RequestStep.DOCUMENTS, label: "Documentos" },
    ]);
  });

  it("start with the person, and have a label for every step", () => {
    expect(requestSteps[0].step).toBe(RequestStep.TUTOR);
    expect(requestSteps.map((item) => item.label)).toEqual(Object.values(requestStepLabels));
  });

  it("cannot be changed by whoever imports them", () => {
    expect(Object.isFrozen(requestSteps)).toBe(true);
  });
});
