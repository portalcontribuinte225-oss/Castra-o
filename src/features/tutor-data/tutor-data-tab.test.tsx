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

function view(item: TutorData, readOnly = false) {
  vi.mocked(useTutorData).mockReturnValue({
    tutor: item, form: formFromTutor(item), loading: false,
    error: "", saving: false, saveError: "", notice: "", change: vi.fn(), save: vi.fn(), retry: vi.fn(),
  });
  return renderToStaticMarkup(<TutorDataTab requestId="request-a" municipalityId="city-a" neighborhoodNames={[]} readOnly={readOnly} actionsSlot={footer} />);
}

describe("TutorDataTab", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("shows view-only fields by default and places Editar dados in the footer", () => {
    const html = view(tutor);
    expect(html).toContain('readonly=""');
    expect(html).not.toContain("Nova senha");
    const [button, target] = vi.mocked(createPortal).mock.calls[0];
    expect(target).toBe(footer);
    expect(renderToStaticMarkup(button)).toContain("Editar dados");
  });

  it("leaves the footer free of editing actions for read-only access", () => {
    expect(view(tutor, true)).toContain('readonly=""');
    expect(createPortal).not.toHaveBeenCalled();
  });

  it("shows that a contact-only request still needs to identify the tutor", () => {
    const contact = { ...tutor, id: null, hasAccess: false, contactOnly: true, name: "", cpf: "", email: "", phone: "" };
    const html = view(contact);
    expect(html).toMatch(/O tutor ainda não se identificou nesta solicitação\.[\s\S]*<span>Nome<\/span>/);
    expect(html).toMatch(/CPF<\/span><input\b(?=[^>]*inputMode="numeric")(?=[^>]*value="")[^>]*>/);
    expect(html).not.toContain("Nova senha");
    expect(renderToStaticMarkup(vi.mocked(createPortal).mock.calls[0][0])).toContain("Editar dados");
  });
});
