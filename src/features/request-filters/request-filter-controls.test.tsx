import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActiveFiltersBar } from "./active-filters-bar";
import { RequestFiltersDrawer } from "./request-filters-drawer";
import { RequestFiltersToolbar } from "./request-filters-toolbar";
import { buildRequestFacetCounts, initialRequestFilters, RequestFilterDimension } from "./request-filters";
import { RequestStage } from "./request-stage";

const noop = vi.fn();

describe("request filter controls", () => {
  it("keeps Hoje pressed and Filtros expanded with native buttons and counts", () => {
    const html = renderToStaticMarkup(
      <RequestFiltersToolbar
        todayOnly todayCount={9} activePillCount={2} drawerOpen
        onToggleToday={noop} onOpenDrawer={noop}
      />,
    );

    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-ui-button=""/);
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="true"[^>]*data-ui-button=""/);
    expect(html).toMatch(/Hoje<span[^>]*>9<\/span>/);
    expect(html).toMatch(/Filtros<span[^>]*>2<\/span>/);
  });

  it("keeps the result count and a named remove action on every active chip", () => {
    const html = renderToStaticMarkup(
      <ActiveFiltersBar
        filters={{ ...initialRequestFilters, stages: [RequestStage.INBOX] }}
        resultCount={1}
        pills={[{ dimension: RequestFilterDimension.STAGES, label: "Etapa: Novas" }]}
        onClearDimension={noop}
        onClearAll={noop}
      />,
    );

    expect(html).toMatch(/aria-live="polite">1 solicitação<\/span>/);
    expect(html).toMatch(/<button[^>]*aria-label="Remover filtro Etapa: Novas"[^>]*data-ui-button=""/);
    expect(html).toContain("Limpar filtros");
  });

  it("uses a managed dialog with native filter checkboxes, a named search and a close action", () => {
    const html = renderToStaticMarkup(
      <RequestFiltersDrawer
        filters={initialRequestFilters}
        counts={buildRequestFacetCounts([], initialRequestFilters, { today: "" })}
        typeOptions={[]}
        assigneeOptions={Array.from({ length: 7 }, (_, index) => ({ value: String(index), label: `Responsável ${index}` }))}
        resultCount={0}
        onToggleStage={noop} onToggleType={noop} onToggleAssignee={noop}
        onClearAll={noop} onClose={noop}
      />,
    );

    expect(html).toContain('data-managed-dialog=""');
    expect(html).toContain('role="dialog" aria-modal="true" aria-labelledby="request-filters-title"');
    expect(html).toMatch(/<button[^>]*aria-label="Fechar filtros"[^>]*data-ui-close-button=""/);
    expect(html).toMatch(/<input[^>]*aria-label="Buscar responsável\.\.\."[^>]*data-ui-input=""/);
    expect(html).toContain('type="checkbox"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Limpar<\/button>/);
    expect(html).toContain("Ver 0 solicitações");
  });
});
