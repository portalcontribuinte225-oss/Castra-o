import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestFormLayout } from "./request-form-layout";
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

describe("RequestFormLayout", () => {
  it("keeps navigation and one error message outside the content region for every step", () => {
    const noop = () => {};
    for (const [stepIndex, { label }] of requestSteps.entries()) {
      const html = renderToStaticMarkup(createElement(RequestFormLayout, {
        stepIndex, stepInvalid: false, internal: false, onNavigate: noop, onSubmit: noop,
        submitting: false, submitDisabled: false, error: "Revise os dados", children: "Campos da etapa",
      }));

      expect(html).toContain(`role="region" aria-label="${label}"`);
      const steps = html.match(/<ol[^>]*aria-label="Etapas da solicitação">(.*?)<\/ol>/)?.[1];
      expect(steps?.match(/<li\b/g)).toHaveLength(requestSteps.length);
      expect(steps?.match(/aria-current="step"/g)).toHaveLength(1);
      expect(steps?.match(/<li[^>]*aria-current="step"[^>]*>(.*?)<\/li>/)?.[1]).toContain(label);
      expect(steps).not.toContain("<button");
      expect(html).toMatch(/Campos da etapa<\/div><\/div><p[^>]*role="alert">Revise os dados<\/p><div class="nr-nav-row">/);
      expect(html.match(/Revise os dados/g)).toHaveLength(1);
      const footer = html.split('<div class="nr-nav-row">')[1];
      expect(footer).toContain(stepIndex === requestSteps.length - 1 ? "Enviar" : "Próximo");
      expect(footer.includes(">Voltar<")).toBe(stepIndex > 0);
    }
  });
});
