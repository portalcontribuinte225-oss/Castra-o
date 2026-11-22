import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MultiSelectDropdown, MultiSelectPanel } from "./multi-select-dropdown";
import { CHECKLIST_SEARCH_THRESHOLD } from "./scroll-checklist";

const noop = () => undefined;
const items = [
  { id: "castration", label: "Castração", detail: "Gratuito" },
  { id: "microchip", label: "Microchipagem", detail: "Gratuito" },
  { id: "vaccine", label: "Vacinação antirrábica", detail: "R$ 15,00" },
];
const dropdown = (props = {}) => renderToStaticMarkup(
  <MultiSelectDropdown label="Procedimentos" placeholder="Selecione os procedimentos" items={items} selectedIds={[]} onChange={noop} emptyText="Nada cadastrado." {...props} />,
);

describe("MultiSelectDropdown", () => {
  it("starts closed, showing the placeholder while nothing is chosen", () => {
    const html = dropdown();
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("multi-select-value is-placeholder");
    expect(html).toContain("Selecione os procedimentos");
    expect(html).not.toContain("multi-select-panel");
  });

  it("shows the chosen items separated by commas, in the order chosen", () => {
    const html = dropdown({ selectedIds: ["vaccine", "castration"] });
    expect(html).toContain(">Vacinação antirrábica, Castração<");
    expect(html).toContain('aria-label="Procedimentos: Vacinação antirrábica, Castração"');
  });

  it("shows the error only when invalid, and the empty text when there is nothing to choose", () => {
    expect(dropdown({ invalid: true, errorText: "Escolha ao menos um" })).toContain("Escolha ao menos um");
    expect(dropdown({ errorText: "Escolha ao menos um" })).not.toContain("Escolha ao menos um");
    expect(dropdown({ items: [] })).toContain("Nada cadastrado.");
  });
});

describe("MultiSelectPanel", () => {
  it("lists one checkbox per item with its detail, the chosen ones checked", () => {
    const html = renderToStaticMarkup(<MultiSelectPanel id="list" label="Procedimentos" items={items} selectedIds={["microchip"]} onChange={noop} />);
    expect(html.match(/class="multi-select-row"/g)).toHaveLength(3);
    expect(html.match(/type="checkbox" checked=""/g)).toHaveLength(1);
    expect(html).toContain("<small>R$ 15,00</small>");
    expect(html).not.toContain('type="search"');
  });

  it("has a search field only when the list is long", () => {
    const many = Array.from({ length: CHECKLIST_SEARCH_THRESHOLD + 1 }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` }));
    expect(renderToStaticMarkup(<MultiSelectPanel id="list" label="Procedimentos" items={many} selectedIds={[]} onChange={noop} />)).toContain('aria-label="Buscar em procedimentos"');
  });
});
