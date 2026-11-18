import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OptionCardGroup } from "./option-card-group";

const noop = () => undefined;
const sizes = [{ value: "Pequeno", label: "Pequeno", subtitle: "0–5 kg" }, { value: "Grande", label: "Grande", subtitle: "A partir de 12 kg" }];

describe("OptionCardGroup", () => {
  it("is a fieldset with the question as legend and one radio per answer, all of the same group", () => {
    const html = renderToStaticMarkup(<OptionCardGroup label="Sexo" value="" options={["Macho", "Fêmea"]} onChange={noop} required />);
    expect(html).toContain("<fieldset class=\"option-card\">");
    expect(html).toMatch(/<legend>Sexo<span class="required-asterisk">\*<\/span><\/legend>/);
    const names = [...html.matchAll(/type="radio" name="([^"]+)"/g)].map((match) => match[1]);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(1);
    expect(html).not.toContain("checked");
  });

  it("marks the answer by its value or by its label, and shows the note beside the label", () => {
    const html = renderToStaticMarkup(<OptionCardGroup label="Qual o porte?" value="Grande" options={sizes} onChange={noop} />);
    expect(html).toMatch(/checked="" value="Grande"/);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain("<small>0–5 kg</small>");
    const food = [{ value: "Ração", label: "Sim" }, { value: "Diversos", label: "Não" }];
    expect(renderToStaticMarkup(<OptionCardGroup label="Come só ração?" value="Diversos" options={food} onChange={noop} />)).toMatch(/checked="" value="Diversos"/);
    const breed = [{ value: "Indefinida", label: "Sem raça definida" }, { value: "Definida", label: "Com raça definida" }];
    expect(renderToStaticMarkup(<OptionCardGroup label="Tem raça definida?" value="Sem raça definida" options={breed} onChange={noop} />)).toMatch(/checked="" value="Indefinida"/);
  });

  it("flags an unanswered required question", () => {
    expect(renderToStaticMarkup(<OptionCardGroup label="Sexo" value="" options={["Macho", "Fêmea"]} onChange={noop} invalid />)).toContain("option-card is-invalid");
  });
});
