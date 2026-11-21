import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHECKLIST_SEARCH_THRESHOLD, ScrollChecklist, filterChecklistGroups, toggleSelection } from "../../components/scroll-checklist";
import { BreedChecklist } from "../breeds/breed-checklist";
import { AnimalAccordionCard } from "./animal-accordion-card";
import { AnimalFields } from "./animal-fields";
import { RequestProcedureList } from "./request-procedure-list";
import { blankAnimal } from "./request-procedures";

const noop = () => {};
const types = [
  { id: "castration", name: "Castração", charged: false },
  { id: "microchip", name: "Microchipagem", charged: false },
  { id: "vaccine", name: "Vacinação antirrábica", charged: true, billingAmount: "R$ 15,00" },
];
const rows = (html: string) => (html.match(/class="scroll-checklist-row"/g) || []).length;
const checked = (html: string) => (html.match(/<input type="checkbox" checked=""/g) || []).length;

describe("checklist selection", () => {
  it("adds an id at the end, or removes it, so the order is the order chosen", () => {
    expect(toggleSelection([], "a")).toEqual(["a"]);
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    const selected = ["a"];
    toggleSelection(selected, "b");
    expect(selected).toEqual(["a"]);
  });

  it("filters the items by what is typed, ignoring case and accents, and drops the groups left empty", () => {
    const groups = [
      { id: "dogs", label: "Canino", items: [{ id: "1", label: "Pastor Alemão" }, { id: "2", label: "Poodle" }] },
      { id: "cats", label: "Felino", items: [{ id: "3", label: "Siamês" }] },
    ];
    expect(filterChecklistGroups(groups, "")).toEqual(groups);
    expect(filterChecklistGroups(groups, "ALEMAO")).toEqual([{ id: "dogs", label: "Canino", items: [{ id: "1", label: "Pastor Alemão" }] }]);
    expect(filterChecklistGroups(groups, "siames").map((group) => group.id)).toEqual(["cats"]);
    expect(filterChecklistGroups(groups, "xyz")).toEqual([]);
  });
});

describe("ScrollChecklist", () => {
  const items = Array.from({ length: CHECKLIST_SEARCH_THRESHOLD + 1 }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` }));
  const render = (props = {}) => renderToStaticMarkup(
    <ScrollChecklist legend="Procedimentos" required groups={[{ id: "all", items: items.slice(0, 3) }]} selectedIds={["item-1"]} onChange={noop} emptyText="Nada cadastrado." {...props} />,
  );

  it("is a fieldset with its legend, one checkbox row per item and the selected ones checked", () => {
    const html = render();
    expect(html).toContain("<fieldset");
    expect(html).toContain("Procedimentos");
    expect(html).toContain("required-asterisk");
    expect(rows(html)).toBe(3);
    expect(checked(html)).toBe(1);
    expect(html).toContain("scroll-checklist-box");
  });

  it("has a search field only when the list is long, and tells when there is nothing to list", () => {
    expect(render()).not.toContain('type="search"');
    expect(render({ groups: [{ id: "all", items }] })).toContain('type="search"');
    const empty = render({ groups: [{ id: "all", items: [] }] });
    expect(empty).toContain("Nada cadastrado.");
    expect(empty).not.toContain("<fieldset");
  });

  it("shows group titles when the groups have one, and an error only when invalid", () => {
    const grouped = render({ groups: [{ id: "a", label: "Canino", items: items.slice(0, 2) }, { id: "b", label: "Felino", items: items.slice(2, 3) }] });
    expect(grouped).toContain("Canino");
    expect(grouped).toContain("Felino");
    expect(render({ invalid: true, errorText: "Escolha ao menos um" })).toContain("Escolha ao menos um");
    expect(render({ invalid: true, errorText: "Escolha ao menos um" })).toContain("is-invalid");
    expect(render({ errorText: "Escolha ao menos um" })).not.toContain("Escolha ao menos um");
  });
});

describe("RequestProcedureList", () => {
  it("asks which procedure to request in a closed field that shows the chosen ones, in the order chosen", () => {
    const html = renderToStaticMarkup(<RequestProcedureList types={types} selectedIds={["vaccine", "castration"]} onChange={noop} />);
    expect(html).toContain("Qual procedimento solicitar?"); expect(html).toContain("Pode marcar mais de um.");
    expect(html).toContain("Vacinação antirrábica, Castração");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("multi-select-row");
    expect(renderToStaticMarkup(<RequestProcedureList types={types} selectedIds={[]} onChange={noop} />)).toContain("Selecione os procedimentos");
  });

  it("shows the error when invalid and skips a type that has no id", () => {
    const html = renderToStaticMarkup(<RequestProcedureList types={[...types, { name: "Sem id" }]} selectedIds={["castration"]} onChange={noop} invalid />);
    expect(html).toContain("Escolha ao menos um procedimento");
    expect(html).toContain("multi-select is-invalid");
    expect(html).not.toContain("Sem id");
  });

  it("explains where to register types when there are none", () => {
    expect(renderToStaticMarkup(<RequestProcedureList types={[]} selectedIds={[]} onChange={noop} />)).toContain("Nenhum tipo de solicitação cadastrado");
  });
});

describe("BreedChecklist", () => {
  const species = [{ id: "canino", name: "Canino", active: true, municipalityId: "m1" }, { id: "felino", name: "Felino", active: true, municipalityId: "m1" }];
  const breeds = [
    { id: "poodle", name: "Poodle", speciesId: "canino", active: true, municipalityId: "m1" },
    { id: "siames", name: "Siamês", speciesId: "felino", active: true, municipalityId: "m1" },
    { id: "other", name: "Raça de outro município", speciesId: "canino", active: true, municipalityId: "m2" },
    { id: "off", name: "Raça desativada", speciesId: "canino", active: false, municipalityId: "m1" },
  ];

  it("groups the municipality's active breeds by species and marks the linked ones", () => {
    const html = renderToStaticMarkup(<BreedChecklist breeds={breeds} species={species} municipalityId="m1" selectedIds={["siames"]} onChange={noop} />);
    expect(html).toContain("Raças vinculadas");
    expect(html).toContain("Canino");
    expect(html).toContain("Felino");
    expect(html).toContain("Poodle");
    expect(html).not.toContain("Raça de outro município");
    expect(html).not.toContain("Raça desativada");
    expect(rows(html)).toBe(2);
    expect(checked(html)).toBe(1);
  });

  it("says where to register breeds when there are none", () => {
    expect(renderToStaticMarkup(<BreedChecklist breeds={[]} species={species} municipalityId="m1" selectedIds={[]} onChange={noop} />)).toContain("Nenhuma raça cadastrada");
  });
});

describe("AnimalAccordionCard", () => {
  const render = (props = {}) => renderToStaticMarkup(
    <AnimalAccordionCard index={1} title="Animal 2" detail="Mel · Felino" open collapsible onToggle={noop} {...props}><p>conteúdo</p></AnimalAccordionCard>,
  );

  it("has a header with only the number, the title and the detail, and shows the content when open", () => {
    const html = render();
    expect(html).toContain("Animal 2");
    expect(html).toContain("Mel · Felino");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("conteúdo");
    expect(html).toContain('<span class="animal-title-badge" aria-hidden="true">2</span>');
  });

  it("hides the content when folded, and has no header when there is a single animal", () => {
    const folded = render({ open: false });
    expect(folded).toContain('aria-expanded="false"');
    expect(folded).not.toContain("conteúdo");
    const single = render({ collapsible: false });
    expect(single).not.toContain("aria-expanded");
    expect(single).toContain("conteúdo");
  });

  it("leaves the detail out when it is empty", () => {
    expect(render({ detail: "" })).not.toContain("animal-accordion-summary");
  });
});

describe("AnimalFields", () => {
  const props = { animal: { ...blankAnimal(), species: "Canino", breedType: "Definida", breedDescription: "" }, speciesNames: ["Canino", "Felino"],
    sizeChoices: [{ value: "Pequeno", label: "Pequeno", subtitle: "0–5 kg" }], breedOptions: [], submitAttempted: false, onChange: noop, onSelectSpecies: noop };

  it("asks for the species, sex, breed, size, name, coat, age and the health of the animal", () => {
    const html = renderToStaticMarkup(<AnimalFields {...props} />);
    for (const label of ["Como ele é?", "Espécie", "Sexo", "Tem raça definida?", "Qual o porte?", "Como ele se chama?", "Cor da pelagem", "Idade aproximada", "Em que bairro ele vive?", "Saúde e cuidados", "Já tomou vermífugo?", "As vacinas estão em dia?", "Já teve alguma doença?", "Come só ração?"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Microchipado");
    expect(html).not.toContain("toggle-switch");
  });

  it("shows eight groups of choice buttons with no answer selected initially in both forms", () => {
    const blank = renderToStaticMarkup(<AnimalFields {...props} animal={blankAnimal()} />);
    expect(blank.match(/class="option-card"/g)).toHaveLength(8);
    for (const internal of [false, true]) {
      const html = renderToStaticMarkup(<AnimalFields {...props} animal={blankAnimal()} internal={internal} />);
      expect(html.match(/class="option-card-tiles\b/g)).toHaveLength(8);
      expect(html.match(/class="option-card-tiles option-card-tiles--stacked"/g)).toHaveLength(3);
    }
    expect(blank.match(/type="radio"/g)).toHaveLength(2 + 2 + 2 + 1 + 2 * 4);
    expect(blank).not.toContain("checked");
    expect(blank).toContain("0–5 kg");
    const answered = renderToStaticMarkup(<AnimalFields {...props} animal={{ ...props.animal, sex: "Fêmea", dewormed: "Não", food: "Diversos" }} />);
    expect(answered.match(/checked=""/g)).toHaveLength(5);
    expect(answered).toMatch(/checked="" value="Diversos"/);
    expect(renderToStaticMarkup(<AnimalFields {...props} submitAttempted animal={blankAnimal()} />).match(/option-card is-invalid/g)).toHaveLength(4);
  });

  it("labels the breed answers Sim and Não while keeping the saved values and the breed detail field", () => {
    const defined = renderToStaticMarkup(<AnimalFields {...props} />);
    expect(defined).toContain('checked="" value="Definida"/><span>Sim</span>');
    expect(defined).toContain('value="Indefinida"/><span>Não</span>');
    expect(defined).toMatch(/<input[^>]*type="text"[^>]*aria-label="Raça"/);
    const withOptions = renderToStaticMarkup(<AnimalFields {...props} breedOptions={[{ id: "poodle", name: "Poodle" }]} />);
    expect(withOptions).toMatch(/<select[^>]*aria-label="Raça"[^>]*data-ui-select=""/);
    expect(withOptions).toContain('<option value="Poodle">Poodle</option>');
    const withoutSpecies = renderToStaticMarkup(<AnimalFields {...props} animal={{ ...props.animal, species: "" }} />);
    expect(withoutSpecies).toMatch(/<select[^>]*aria-label="Raça"[^>]*disabled=""/);
    expect(withoutSpecies).toContain("Selecione a espécie");
    expect(renderToStaticMarkup(<AnimalFields {...props} animal={{ ...props.animal, breedType: "Indefinida" }} />)).not.toContain('aria-label="Raça"');
  });

  it("asks for the neighborhood of the animal: a select of the registered ones, or text while there are none", () => {
    expect(renderToStaticMarkup(<AnimalFields {...props} />)).toContain("Ex.: Centro");
    const withNames = renderToStaticMarkup(<AnimalFields {...props} neighborhoodNames={["Centro", "Pinheirinho"]} />);
    expect(withNames).toMatch(/<select[^>]*aria-label="Em que bairro ele vive\?"[^>]*required=""[^>]*data-ui-select=""/);
    expect(withNames).toContain("Selecione o bairro");
    expect(withNames).toContain("Pinheirinho");
    expect(withNames).not.toContain("Ex.: Centro");
    expect(renderToStaticMarkup(<AnimalFields {...props} submitAttempted />)).toMatch(/aria-label="Em que bairro ele vive\?" aria-invalid="true"/);
    expect(renderToStaticMarkup(<AnimalFields {...props} submitAttempted animal={{ ...props.animal, neighborhood: "Centro" }} />)).toMatch(/aria-label="Em que bairro ele vive\?" aria-invalid="false"/);
  });

  it("shows the registered spelling of a saved neighborhood and retains a saved breed outside the current list", () => {
    const animal = { ...props.animal, neighborhood: "sao joao", breedDescription: "Raça cadastrada anteriormente" };
    const html = renderToStaticMarkup(<AnimalFields {...props} animal={animal} breedOptions={[{ id: "poodle", name: "Poodle" }]} neighborhoodNames={["São João"]} />);
    expect(html).toContain('<option value="São João" selected="">São João</option>');
    expect(html).toContain('<option value="Raça cadastrada anteriormente" selected="">Raça cadastrada anteriormente</option>');
  });

  it("adds the microchip only for staff", () => {
    const html = renderToStaticMarkup(<AnimalFields {...props} internal />);
    expect(html).toContain("Microchipado");
    expect(html).toMatch(/<input(?=[^>]*aria-label="Microchip")(?=[^>]*readonly="")(?=[^>]*placeholder="Não informado")(?=[^>]*data-ui-input)/i);
  });

});
