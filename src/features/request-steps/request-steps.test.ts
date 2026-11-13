import { describe, expect, it } from "vitest";
import { RequestStep, getVisibleSteps, summarizeVisibleSteps } from "./request-steps";
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
      { step: RequestStep.FOLLOW_UP, label: "Acompanhamento" },
    ]);
  });

  it("hides only the step whose toggle is false", () => {
    expect(steps({ configs: [{ stepTutor: false }] })).toEqual([RequestStep.ANIMAL, RequestStep.SCHEDULE, RequestStep.DOCUMENTS, RequestStep.FOLLOW_UP]);
    expect(steps({ configs: [{ stepAgenda: false }] })).toEqual([RequestStep.ANIMAL, RequestStep.TUTOR, RequestStep.DOCUMENTS, RequestStep.FOLLOW_UP]);
    expect(steps({ configs: [{ stepDocuments: false }] })).toEqual([RequestStep.ANIMAL, RequestStep.TUTOR, RequestStep.SCHEDULE, RequestStep.FOLLOW_UP]);
  });

  it("always keeps the animal step", () => {
    expect(steps({ configs: [{ stepTutor: false, stepAgenda: false, stepDocuments: false }] })).toEqual([RequestStep.ANIMAL, RequestStep.FOLLOW_UP]);
  });

  it("skips the tutor step even when the config allows it", () => {
    expect(steps({ skipTutor: true, configs: [{ stepTutor: true }] })).toEqual([
      RequestStep.ANIMAL,
      RequestStep.SCHEDULE,
      RequestStep.DOCUMENTS,
      RequestStep.FOLLOW_UP,
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
      RequestStep.FOLLOW_UP,
    ]);
  });

  it("keeps follow-up last for every public toggle combination", () => {
    for (const stepTutor of [true, false]) {
      for (const stepAgenda of [true, false]) {
        for (const stepDocuments of [true, false]) {
          const visible = steps({ configs: [{ stepTutor, stepAgenda, stepDocuments }] });
          expect(visible[visible.length - 1]).toBe(RequestStep.FOLLOW_UP);
          expect(visible.filter((step) => step === RequestStep.FOLLOW_UP)).toHaveLength(1);
        }
      }
    }
  });
});

describe("summarizeVisibleSteps", () => {
  it("lists every public step label when no config restricts anything", () => {
    expect(summarizeVisibleSteps([])).toBe("Animal, Tutor, Agenda, Documentos");
  });

  it("omits the steps a config hides", () => {
    expect(summarizeVisibleSteps([{ stepTutor: false }])).toBe("Animal, Agenda, Documentos");
  });

  it("combines several configs", () => {
    expect(summarizeVisibleSteps([{ stepAgenda: false }, { stepDocuments: false }])).toBe("Animal, Tutor");
  });
});
