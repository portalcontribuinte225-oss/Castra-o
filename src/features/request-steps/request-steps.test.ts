import { describe, expect, it } from "vitest";
import { RequestStep, getVisibleSteps } from "./request-steps";
import type { VisibleStepsInput } from "./request-steps";

function steps(overrides: Partial<VisibleStepsInput> = {}): RequestStep[] {
  return getVisibleSteps({ internal: false, skipTutor: false, configs: [], ...overrides }).map((item) => item.step);
}

describe("getVisibleSteps", () => {
  it("returns every public step in order with the current labels when no config is given", () => {
    expect(getVisibleSteps({ internal: false, skipTutor: false, configs: [] })).toEqual([
      { step: RequestStep.ANIMAL, label: "Animal" },
      { step: RequestStep.TUTOR, label: "Tutor" },
      { step: RequestStep.SCHEDULE, label: "Agenda" },
      { step: RequestStep.DOCUMENTS, label: "Documentos" },
    ]);
  });

  it("hides only the step whose toggle is false", () => {
    expect(steps({ configs: [{ stepTutor: false }] })).toEqual([RequestStep.ANIMAL, RequestStep.SCHEDULE, RequestStep.DOCUMENTS]);
    expect(steps({ configs: [{ stepAgenda: false }] })).toEqual([RequestStep.ANIMAL, RequestStep.TUTOR, RequestStep.DOCUMENTS]);
    expect(steps({ configs: [{ stepDocuments: false }] })).toEqual([RequestStep.ANIMAL, RequestStep.TUTOR, RequestStep.SCHEDULE]);
  });

  it("always keeps the animal step", () => {
    expect(steps({ configs: [{ stepTutor: false, stepAgenda: false, stepDocuments: false }] })).toEqual([RequestStep.ANIMAL]);
  });

  it("skips the tutor step even when the config allows it", () => {
    expect(steps({ skipTutor: true, configs: [{ stepTutor: true }] })).toEqual([
      RequestStep.ANIMAL,
      RequestStep.SCHEDULE,
      RequestStep.DOCUMENTS,
    ]);
  });

  it("uses the fixed internal steps regardless of configs and skipTutor", () => {
    expect(
      steps({ internal: true, skipTutor: true, configs: [{ stepTutor: false, stepAgenda: false, stepDocuments: false }] }),
    ).toEqual([RequestStep.TUTOR, RequestStep.ANIMAL, RequestStep.SCHEDULE]);
  });

  it("hides a step when any config disallows it", () => {
    expect(steps({ configs: [{ stepAgenda: true }, { stepAgenda: false }] })).not.toContain(RequestStep.SCHEDULE);
    expect(steps({ configs: [{ stepAgenda: true }, { stepAgenda: true }] })).toContain(RequestStep.SCHEDULE);
  });

  it("treats null, undefined, empty configs and missing flags as allowed", () => {
    expect(steps({ configs: [null, undefined, {}, { stepTutor: undefined }] })).toEqual([
      RequestStep.ANIMAL,
      RequestStep.TUTOR,
      RequestStep.SCHEDULE,
      RequestStep.DOCUMENTS,
    ]);
  });
});
