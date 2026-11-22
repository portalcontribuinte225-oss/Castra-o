import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicReportPanel, complaintIssues } from "./public-report-panel";

const html = () => renderToStaticMarkup(<PublicReportPanel municipalityName="Test Town" onSubmit={vi.fn()} />);
const filled = {
  name: "Maria Silva", cpf: "529.982.247-25", contact: "(48) 99999-1234", email: "", description: "Animal preso sem água", confidential: false,
  cep: "", number: "", address: "", neighborhood: "", city: "", state: "",
};

describe("the complaint form", () => {
  it("marks the name, the CPF, the phone and the description as required in their titles, and the e-mail as optional", () => {
    const markup = html();
    for (const label of ["Nome", "CPF", "Telefone", "Descrição"]) expect(markup).toContain(`>${label}<span class="required-asterisk">*</span></span>`);
    expect(markup.match(/required-asterisk/g)).toHaveLength(4);
    expect(markup).toContain(">E-mail (opcional)</span>");
    expect(markup).not.toMatch(/placeholder="[^"]*\*/);
    expect(markup).toContain("novalidate");
  });

  it("uses the same fields as the request form and places the send button on the right", () => {
    const markup = html();
    expect(markup).toMatch(/<input[^>]*aria-label="Nome"[^>]*data-ui-input=""/);
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*tw:justify-self-end[^"]*"/);
    expect(markup).not.toContain("tw:justify-self-start");
  });

  it("tells, field by field, what is missing or wrong", () => {
    const blank = complaintIssues({ ...filled, name: " ", cpf: "", contact: "", description: "" });
    expect(blank).toEqual({
      name: "Informe o nome do denunciante.", cpf: "Informe um CPF válido do denunciante.", contact: "Informe um telefone válido.", description: "Descreva a situação observada.",
    });
    expect(complaintIssues({ ...filled, cpf: "111.111.111-11" }).cpf).toBe("Informe um CPF válido do denunciante.");
    expect(Object.values(complaintIssues(filled)).some(Boolean)).toBe(false);
  });
});
