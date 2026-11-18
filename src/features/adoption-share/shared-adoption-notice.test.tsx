import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SharedAdoptionNotice } from "./shared-adoption-notice";
import { SharedAdoptionState } from "./use-shared-adoption";

const ID = "33333333-3333-4333-8333-333333333333";

describe("shared adoption notice", () => {
  it("says an adopted animal found a family and that a missing one is no longer available", () => {
    const adopted = renderToStaticMarkup(<SharedAdoptionNotice shared={{ id: ID, state: SharedAdoptionState.ADOPTED, animal: { animal_name: "Luna" } }} />);
    expect(adopted).toContain("Luna já encontrou uma família");
    expect(adopted).toContain('role="status"');
    const missing = renderToStaticMarkup(<SharedAdoptionNotice shared={{ id: ID, state: SharedAdoptionState.MISSING, animal: null }} />);
    expect(missing).toContain("Este animal não está mais disponível para adoção");
  });

  it("says nothing while the animal loads, when it is available or without a shared link", () => {
    for (const state of [SharedAdoptionState.NONE, SharedAdoptionState.LOADING, SharedAdoptionState.AVAILABLE]) {
      expect(renderToStaticMarkup(<SharedAdoptionNotice shared={{ id: ID, state, animal: { animal_name: "Luna" } }} />)).toBe("");
    }
  });
});
