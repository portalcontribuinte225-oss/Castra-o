import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareAdoptionButton } from "./share-adoption-button";

const animal = { id: "animal-1", name: "Mel" };

describe("share adoption button", () => {
  it("shows only the icon on a card, named after the animal", () => {
    const html = renderToStaticMarkup(<ShareAdoptionButton animal={animal} />);

    expect(html).toMatch(/<button[^>]*aria-label="Compartilhar Mel"[^>]*title="Compartilhar Mel"/);
    expect(html).toContain("<svg");
    expect(html).toContain('aria-live="polite"></span>');
    expect(html).not.toMatch(/>Compartilhar</);
  });

  it("falls back to a generic name when the animal has none", () => {
    const html = renderToStaticMarkup(<ShareAdoptionButton animal={{ id: "animal-2" }} />);

    expect(html).toContain('aria-label="Compartilhar o animal"');
  });
});
