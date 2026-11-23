import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActiveFiltersBar } from "./active-filters-bar";
import { RequestFiltersDrawer } from "./request-filters-drawer";
import { RequestFiltersToolbar } from "./request-filters-toolbar";
import { buildRequestFacetCounts, initialRequestFilters, RequestFilterDimension } from "./request-filters";

const noop = vi.fn();

describe("request filter controls", () => {
  it("keeps Hoje pressed and Filtros expanded with native buttons and counts", () => {
    const html = renderToStaticMarkup(
      <RequestFiltersToolbar today={{ active: true, count: 9, onToggle: noop }} activePillCount={2} drawerOpen onOpenDrawer={noop} />,
    );

    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-ui-button=""/);
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="true"[^>]*data-ui-button=""/);
    expect(html).toMatch(/Hoje<span[^>]*>9<\/span>/);
    expect(html).toMatch(/Filtros<span[^>]*>2<\/span>/);
  });

  it("shows only Filtros on a screen without the Hoje toggle", () => {
    const html = renderToStaticMarkup(
      <RequestFiltersToolbar sectionLabel="Agenda" activePillCount={0} drawerOpen={false} onOpenDrawer={noop} />,
    );

    expect(html).toContain('aria-label="Filtros de agenda"');
    expect(html).not.toContain("Hoje");
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*data-ui-button=""/);
  });

  it("keeps the result count and a named remove action on every active chip", () => {
    const html = renderToStaticMarkup(
      <ActiveFiltersBar
        resultCount={1}
        pills={[{ dimension: RequestFilterDimension.STAGES, label: "Etapa: Novas" }]}
        canClear
        onClearDimension={noop}
        onClearAll={noop}
      />,
    );

    expect(html).toMatch(/aria-live="polite">1 solicitação<\/span>/);
    expect(html).toMatch(/<button[^>]*aria-label="Remover filtro Etapa: Novas"[^>]*data-ui-button=""/);
    expect(html).toContain("Limpar filtros");
  });

  it("offers Limpar filtros only when the screen says there is something to clear", () => {
    const html = renderToStaticMarkup(
      <ActiveFiltersBar resultCount={3} pills={[]} canClear={false} onClearDimension={noop} onClearAll={noop} />,
    );

    expect(html).toContain("3 solicitações");
    expect(html).not.toContain("Limpar filtros");
  });

  it("uses a managed side dialog with native filter checkboxes, a named search, a close action and Ativar", () => {
    const html = renderToStaticMarkup(
      <RequestFiltersDrawer
        filters={initialRequestFilters}
        counts={buildRequestFacetCounts([], initialRequestFilters, { today: "" })}
        typeOptions={[]}
        assigneeOptions={Array.from({ length: 7 }, (_, index) => ({ value: String(index), label: `Responsável ${index}` }))}
        onToggleStage={noop} onToggleType={noop} onToggleAssignee={noop}
        onClearAll={noop} onClose={noop} onApply={noop}
      />,
    );

    expect(html).toContain('data-managed-dialog=""');
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="([^"]+)"[\s\S]*<h3[^>]*id="\1"[^>]*>Filtros<\/h3>/);
    expect(html).toMatch(/<button[^>]*aria-label="Fechar filtros"[^>]*data-ui-close-button=""/);
    expect(html).toMatch(/<input[^>]*aria-label="Buscar responsável\.\.\."[^>]*data-ui-input=""/);
    expect(html).toContain('type="checkbox"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Limpar<\/button>/);
    expect(html).toMatch(/<button[^>]*>Ativar<\/button>/);
    expect(html).not.toMatch(/Ver \d+ solicita/);
  });
});
