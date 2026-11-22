import { useMemo, useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/ui";
import { formatScheduleDate, initialTeams, normalizeRequest } from "../domain";
import type { AnyRecord } from "../types";
import { animalNeighborhoodsOf, neighborhoodFilterOptions, tutorNeighborhoodOf } from "./neighborhoods/neighborhood-report";
import { printHtmlViaIframe } from "./reports/print-html";
import { ActiveFiltersBar } from "./request-filters/active-filters-bar";
import { RequestFiltersDrawer } from "./request-filters/request-filters-drawer";
import { RequestFiltersToolbar } from "./request-filters/request-filters-toolbar";
import { requestFiltersReducer, RequestFiltersActionType, type RequestFiltersAction } from "./request-filters/use-request-filters";
import { buildOperationalReport, reportColumns } from "./reports/operational-report";
import { ReportFilterFields } from "./reports/report-filter-fields";
import {
  buildReportFilterDetails, buildReportPills, buildReportScope, clearReportFilter,
  emptyReportQuery, hasInvalidReportPeriod, hasReportFilters,
} from "./reports/report-filters";
import type { ReportDimension, ReportQuery } from "./reports/report-filters";
import { buildReportPrintHtml } from "./reports/report-print";

const REPORT_PAGE_SIZE = 50;

function detectSearchType(search: string): "microchip" | "cpf" | null {
  const digits = search.replace(/\D/g, "");
  if (digits.length === 11) return "cpf";
  if (digits.length >= 13 && digits.length <= 15) return "microchip";
  return null;
}

export function ReportsView({
  requests = [],
  teams = initialTeams,
  scheduleDays = [],
  scheduleRules = [],
  neighborhoods = [],
  globalSearch = "",
  onConsultAnimal,
  onGenerateProntuario,
}: AnyRecord) {
  const [applied, setApplied] = useState<ReportQuery | null>(null);
  const [draft, setDraft] = useState<ReportQuery | null>(null);
  const [page, setPage] = useState(1);
  const [prmLoading, setPrmLoading] = useState(false);
  const [prmError, setPrmError] = useState("");

  const today = formatScheduleDate(new Date());
  const search = globalSearch.trim();
  const initialPreview = useMemo(() => ({ ...emptyReportQuery, search, today }), [search, today]);
  const activeQuery = applied || initialPreview;
  const normalized = useMemo(() => requests.map(normalizeRequest), [requests]);
  const users = teams.users || [];
  const activeScope = useMemo(
    () => buildReportScope(normalized, activeQuery, users, scheduleDays, scheduleRules),
    [normalized, activeQuery, users, scheduleDays, scheduleRules],
  );
  const preview = useMemo(() => {
    if (!draft) return null;
    return buildReportScope(normalized, { ...draft, today }, users, scheduleDays, scheduleRules);
  }, [normalized, draft, today, users, scheduleDays, scheduleRules]);
  const report = useMemo(
    () => buildOperationalReport(applied ? activeScope.activeRequests : [], activeScope.assigneeOptions),
    [applied, activeScope],
  );
  const pills = applied ? buildReportPills(activeQuery, activeScope.pills) : [];
  const pageCount = Math.max(1, Math.ceil(report.rows.length / REPORT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * REPORT_PAGE_SIZE;
  const pageRows = report.rows.slice(firstIndex, firstIndex + REPORT_PAGE_SIZE);
  const searchType = detectSearchType(search);

  function apply(query: ReportQuery) {
    setApplied({ ...query, today });
    setPage(1);
    setPrmError("");
  }

  function editDraft(action: RequestFiltersAction) {
    setDraft((current) => current && { ...current, filters: requestFiltersReducer(current.filters, action) });
  }

  function exportPdf() {
    const filters = buildReportFilterDetails(activeQuery, activeScope.typeOptions, activeScope.assigneeOptions);
    printHtmlViaIframe(buildReportPrintHtml(report, activeQuery, filters, new Date()));
  }

  async function handleProntuario() {
    if (!searchType || prmLoading) return;
    const query = searchType === "cpf" ? { cpf: search.replace(/\D/g, "") } : { microchip: search };
    setPrmLoading(true);
    setPrmError("");
    try {
      const result = await onConsultAnimal(query);
      await onGenerateProntuario(result);
    } catch {
      setPrmError("Animal não encontrado. Verifique o microchip ou CPF informado.");
    } finally {
      setPrmLoading(false);
    }
  }

  return (
    <section className="tw:grid tw:min-w-0 tw:gap-4">
      <Card className="tw:grid tw:min-w-0 tw:gap-3 tw:p-4">
        <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
          <RequestFiltersToolbar
            sectionLabel="Relatórios"
            todayOnly={activeQuery.filters.todayOnly}
            todayCount={activeScope.counts.today}
            activePillCount={pills.length}
            drawerOpen={draft !== null}
            onToggleToday={() => {
              const query = applied || initialPreview;
              apply({ ...query, filters: requestFiltersReducer(query.filters, { type: RequestFiltersActionType.TOGGLE_TODAY }) });
            }}
            onOpenDrawer={() => setDraft(applied || initialPreview)}
          />
          <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:gap-2">
            <Button onClick={() => apply({ ...activeQuery, search })}>
              <Search size={15} aria-hidden="true" />
              Buscar
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={!applied} title={applied ? "Exportar relatório operacional" : "Faça uma busca primeiro"}>
              <Download size={15} aria-hidden="true" />
              Exportar
            </Button>
            <Button
              variant="outline"
              onClick={handleProntuario}
              disabled={!searchType || prmLoading}
              aria-busy={prmLoading}
              title={searchType ? "Gerar prontuário completo do animal" : "Informe um microchip ou CPF na busca para gerar o prontuário"}
            >
              <FileText size={15} aria-hidden="true" />
              {prmLoading ? "Gerando..." : "Prontuário"}
            </Button>
          </div>
        </div>
        {applied && (
          <ActiveFiltersBar
            filters={activeQuery.filters}
            pills={pills}
            resultCount={report.rows.length}
            onClearDimension={(dimension: ReportDimension) => apply(clearReportFilter(activeQuery, dimension))}
            onClearAll={() => {
              setApplied(null);
              setPage(1);
              setPrmError("");
            }}
          />
        )}
        {prmError && (
          <p className="tw:m-0 tw:rounded-[var(--ui-radius-md)] tw:border tw:border-solid tw:border-ui-danger tw:bg-ui-danger-soft tw:px-3 tw:py-2 tw:text-sm tw:text-ui-danger" role="alert">{prmError}</p>
        )}
      </Card>
      <section className="tw:grid tw:min-w-0 tw:gap-4" aria-label="Resumo e resultados da busca">
        <div className="tw:grid tw:min-w-0 tw:grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] tw:gap-2.5">
          {report.breakdowns.map((group) => (
            <Card as="section" className="reports-breakdown tw:min-w-0 tw:overflow-hidden" key={group.title} aria-label={group.title}>
              <header className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-solid tw:border-card-border tw:p-3">
                <h2 className="tw:m-0 tw:min-w-0 tw:break-words tw:text-sm tw:font-medium tw:text-ui-muted">{group.title}</h2>
                <strong className="tw:shrink-0 tw:text-lg tw:font-semibold tw:text-ui-ink tw:tabular-nums">{group.total}</strong>
              </header>
              <table>
                <thead><tr><th scope="col">Descrição</th><th scope="col">Qtd.</th></tr></thead>
                <tbody>
                  {(group.items.length ? group.items : [{ label: "Sem dados", value: 0 }]).map((item) => (
                    <tr key={item.label}><td>{item.label}</td><td>{item.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
        {pageRows.length ? (
          <>
            <Card role="region" aria-label="Solicitações do relatório" tabIndex={0} className="tw:min-w-0 tw:overflow-x-auto tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent">
              <table className="reports-table">
                <caption className="tw:sr-only">Solicitações encontradas no relatório</caption>
                <thead><tr>{reportColumns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
                <tbody>{pageRows.map(({ key, cells }) => (
                  <tr key={key}>{cells.map((cell, index) => <td key={reportColumns[index]}>{cell}</td>)}</tr>
                ))}</tbody>
              </table>
            </Card>
            {pageCount > 1 && (
              <nav className="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2" aria-label="Paginação de solicitações do relatório">
                <span className="tw:text-sm tw:text-ui-muted" aria-live="polite">
                  {firstIndex + 1}–{firstIndex + pageRows.length} de {report.rows.length}
                </span>
                <Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
                <Button variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            title={applied ? "Nenhum registro encontrado" : "Nenhum filtro aplicado"}
            text={applied ? "Tente ajustar os filtros." : "Selecione os filtros ou clique em Buscar."}
          />
        )}
      </section>
      {draft && preview && (
        <RequestFiltersDrawer
          sectionLabel="Relatórios"
          filters={draft.filters}
          counts={preview.counts}
          typeOptions={preview.typeOptions}
          assigneeOptions={preview.assigneeOptions}
          resultCount={preview.activeRequests.length}
          hasAdditionalFilters={hasReportFilters(draft.report) || Boolean(draft.search)}
          additionalFilters={
            <ReportFilterFields
              filters={draft.report}
              tutorNeighborhoods={neighborhoodFilterOptions(normalized.map((request) => [tutorNeighborhoodOf(request)]), neighborhoods)}
              animalNeighborhoods={neighborhoodFilterOptions(normalized.map(animalNeighborhoodsOf), neighborhoods)}
              onChange={(field, value) => setDraft((current) => current && { ...current, report: { ...current.report, [field]: value } })}
            />
          }
          onToggleStage={(stage) => editDraft({ type: RequestFiltersActionType.TOGGLE_STAGE, stage })}
          onToggleType={(value) => editDraft({ type: RequestFiltersActionType.TOGGLE_TYPE, value })}
          onToggleAssignee={(value) => editDraft({ type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value })}
          onClearAll={() => setDraft(emptyReportQuery)}
          onClose={() => setDraft(null)}
          onApply={() => {
            apply(draft);
            setDraft(null);
          }}
          applyDisabled={hasInvalidReportPeriod(draft.report)}
        />
      )}
    </section>
  );
}
