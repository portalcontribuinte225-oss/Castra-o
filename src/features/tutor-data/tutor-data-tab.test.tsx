import { createPortal } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TutorDataTab } from "./tutor-data-tab";
import { formFromTutor } from "./tutor-data";
import type { TutorData } from "./tutor-data";
import { useTutorData } from "./use-tutor-data";

vi.mock("react-dom", () => ({ createPortal: vi.fn(() => null) }));
vi.mock("./use-tutor-data", () => ({ useTutorData: vi.fn() }));

const tutor: TutorData = {
  id: "tutor-a", name: "Maria Silva", cpf: "52998224725", email: "maria@example.test", phone: "48999990000",
  hasAccess: true, emailVerified: false, phoneVerified: false, address: "Rua Nova", neighborhood: "Centro",
  city: "Criciúma", state: "SC", cep: "88800000",
};
const footer = {} as HTMLDivElement;

describe("TutorDataTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTutorData).mockReturnValue({
      tutor, form: { ...formFromTutor(tutor), name: "Maria Souza" }, loading: false,
      error: "", saving: false, saveError: "", notice: "", change: vi.fn(), save: vi.fn(), retry: vi.fn(),
    });
  });

  it("associates the footer submit button with the tutor form", () => {
    const html = renderToStaticMarkup(<TutorDataTab requestId="request-a" municipalityId="city-a" neighborhoodNames={[]} readOnly={false} actionsSlot={footer} />);
    const formId = html.match(/<form\b[^>]*id="([^"]+)"/)?.[1];
    expect(formId).toBeTruthy();
    expect(html).not.toContain("Salvar dados do tutor");
    expect(html).not.toContain("O tutor ainda não se identificou nesta solicitação.");
    expect(createPortal).toHaveBeenCalledOnce();
    const [button, target] = vi.mocked(createPortal).mock.calls[0];
    expect(target).toBe(footer);
    const footerHtml = renderToStaticMarkup(button);
    expect(footerHtml).toContain(`form="${formId}"`);
    expect(footerHtml).toContain('type="submit"');
    expect(footerHtml).toContain("Salvar dados do tutor");
    expect(footerHtml).not.toContain("disabled");
  });

  it("keeps the footer free of submit actions for read-only access", () => {
    const html = renderToStaticMarkup(<TutorDataTab requestId="request-a" municipalityId="city-a" neighborhoodNames={[]} readOnly actionsSlot={footer} />);
    expect(html).toContain('readonly=""');
    expect(createPortal).not.toHaveBeenCalled();
  });

  it("shows editable contact fields and allows partial saves for a request without a tutor", () => {
    const contact = { ...tutor, id: null, hasAccess: false, contactOnly: true, name: "", cpf: "", email: "", phone: "" };
    vi.mocked(useTutorData).mockReturnValue({
      tutor: contact, form: { ...formFromTutor(contact), address: "Rua do contato" }, loading: false,
      error: "", saving: false, saveError: "", notice: "", change: vi.fn(), save: vi.fn(), retry: vi.fn(),
    });
    const html = renderToStaticMarkup(<TutorDataTab requestId="request-a" municipalityId="city-a" neighborhoodNames={[]} readOnly={false} actionsSlot={footer} />);
    expect(html).toMatch(/O tutor ainda não se identificou nesta solicitação\.[\s\S]*<span>Nome<\/span>/);
    expect(html).toMatch(/CPF<\/span><input\b(?=[^>]*inputMode="numeric")(?=[^>]*value="")(?=[^>]*data-ui-input="")[^>]*>/);
    expect(html).not.toContain('readonly=""');
    expect(html).not.toContain("Nova senha");
    const [button] = vi.mocked(createPortal).mock.calls[0];
    expect(renderToStaticMarkup(button)).not.toContain("disabled");
  });
});
