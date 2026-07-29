import { useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import type { AnyRecord } from "../types";
import {
  initialRequestTypes,
  initialTeams,
  isRequestOnScheduleDate,
  normalizeRequest,
  requestHasTag,
  requestResultLabel,
} from "../domain";
import { EmptyState } from "../components/ui";
import { escapeHtml } from "../utils";
import { normalizeSearchKey, normalizeText } from "../utils";
import {
  countBy,
  getRequestDate,
  getRequestTypeName,
  getRequestUserName,
  isInPeriod,
  sumValues,
  topItems,
} from "../analytics";

const operationalStatusOptions = [
  { id: "inbox", label: "Novas" },
  { id: "analysis", label: "Em análise" },
  { id: "scheduled", label: "Agendadas" },
  { id: "rescheduled", label: "Reagendadas" },
  { id: "done", label: "Realizadas" },
  { id: "canceled", label: "Canceladas" },
];

const agendaKindOptions = [
  { id: "mutirao", label: "Mutirão" },
  { id: "agenda", label: "Agenda normal" },
];

function detectSearchType(search: string): "microchip" | "cpf" | "text" | null {
  const digits = search.replace(/\D/g, "");
  if (digits.length === 11) return "cpf";
  if (digits.length >= 13 && digits.length <= 15) return "microchip";
  if (search.trim()) return "text";
  return null;
}

function matchesSearch(request: AnyRecord, query: string): boolean {
  if (!query.trim()) return true;
  const key = normalizeSearchKey(query);
  const animalNames = request.animals?.map((a) => a.name).join(" ") || "";
  const animalMicrochips = (request.animals?.map((a) => a.microchip).filter(Boolean) || []).join(" ");
  const searchable = normalizeSearchKey([
    request.protocol,
    request.tutor,
    request.tutor_name,
    request.cpf,
    request.email,
    request.phone,
    request.animalMicrochip,
    request.animal_microchip,
    animalNames,
    animalMicrochips,
  ].filter(Boolean).join(" "));
  return searchable.includes(key) || normalizeText(searchable).includes(normalizeText(key));
}

function getRequestAgendaKind(request: AnyRecord, scheduleDays: AnyRecord[]): "mutirao" | "agenda" | "" {
  const day = scheduleDays.find((d) => isRequestOnScheduleDate(request, d.date));
  if (!day) return "";
  return day.kind === "Mutirao" ? "mutirao" : "agenda";
}

export function ReportsView({
  requests = [],
  metrics,
  requestTypes = initialRequestTypes,
  teams = initialTeams,
  scheduleDays = [],
  globalSearch = "",
  onConsultAnimal,
  onGenerateProntuario,
}: AnyRecord) {
  const emptyFilters = { start: "", end: "", type: "", status: "", fee: "", agendaKind: "" };
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<AnyRecord | null>(null);
  const [prmLoading, setPrmLoading] = useState(false);
  const [prmError, setPrmError] = useState("");

  const activeUsers = teams.users?.filter((u) => u.active !== false) || [];
  const normalizedReportRequests = requests.map(normalizeRequest);

  const filteredRequests = appliedFilters
    ? normalizedReportRequests.filter((request) => {
        const date = getRequestDate(request);
        const typeName = getRequestTypeName(request, requestTypes);
        const feeValue = request.fee || request.billingAmount || "";
        const hasFee = feeValue && feeValue !== "Gratuito";
        if (!isInPeriod(date, appliedFilters.start, appliedFilters.end)) return false;
        if (appliedFilters.type && typeName !== appliedFilters.type) return false;
        if (appliedFilters.status && getOperationalStatusId(request) !== appliedFilters.status) return false;
        if (appliedFilters.fee === "charged" && !hasFee) return false;
        if (appliedFilters.fee === "free" && hasFee) return false;
        if (appliedFilters.agendaKind && getRequestAgendaKind(request, scheduleDays) !== appliedFilters.agendaKind) return false;
        if (appliedFilters.search && !matchesSearch(request, appliedFilters.search)) return false;
        return true;
      })
    : [];

  const typeOptions = countBy(requests, (r) => getRequestTypeName(r, requestTypes)).map((i) => i.label);
  const userOptions = Array.from(
    new Set([...activeUsers.map((u) => u.name), ...requests.map(getRequestUserName)])
  ).filter(Boolean);

  const statusSeries = countBy(filteredRequests, getOperationalStatusLabel);
  const resultSeries = countBy(filteredRequests, requestResultLabel);
  const typeSeries = countBy(filteredRequests, (r) => getRequestTypeName(r, requestTypes));
  const userSeries = topItems(countBy(filteredRequests, getRequestUserName));
  const feeSeries = countBy(filteredRequests, (r) => {
    const v = r.fee || r.billingAmount || "";
    return v && v !== "Gratuito" ? "Com taxa" : "Gratuito";
  });

  const reportBreakdowns = [
    { title: "Status", items: statusSeries },
    { title: "Resultado", items: resultSeries },
    { title: "Tipos de solicitação", items: typeSeries },
    { title: "Responsáveis", items: userSeries },
    { title: "Taxas", items: feeSeries },
  ];

  const currentSearchType = detectSearchType(globalSearch);
  const canProntuario = currentSearchType === "cpf" || currentSearchType === "microchip";

  function patchFilter(field: string, value: string) {
    setFilters((f) => ({ ...f, [field]: value }));
    setPrmError("");
  }

  function applyFilters() {
    setAppliedFilters({ ...filters, search: globalSearch });
    setPrmError("");
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(null);
    setPrmError("");
  }

  function exportPdf() {
    generateReportsPdf(
      filteredRequests,
      appliedFilters || emptyFilters,
      { statusSeries, resultSeries, typeSeries, userSeries, feeSeries },
      requestTypes
    );
  }

  async function handleProntuario() {
    const type = detectSearchType(globalSearch);
    if (!type || type === "text") return;
    const digits = globalSearch.replace(/\D/g, "");
    const query = type === "cpf" ? { cpf: digits } : { microchip: globalSearch.trim() };
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
    <section className="content-grid">
      <div className="page-toolbar reports-controls wide">
          <div className="reports-filter-grid">
            <label className="field reports-filter-field">
              <span>Início</span>
              <input type="date" value={filters.start} onChange={(e) => patchFilter("start", e.target.value)} />
            </label>
            <label className="field reports-filter-field">
              <span>Fim</span>
              <input type="date" value={filters.end} onChange={(e) => patchFilter("end", e.target.value)} />
            </label>
            <label className="field reports-filter-field">
              <span>Tipo</span>
              <select value={filters.type} onChange={(e) => patchFilter("type", e.target.value)}>
                <option value="">Todos</option>
                {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="field reports-filter-field">
              <span>Status</span>
              <select value={filters.status} onChange={(e) => patchFilter("status", e.target.value)}>
                <option value="">Todos</option>
                {operationalStatusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="field reports-filter-field">
              <span>Taxas</span>
              <select value={filters.fee} onChange={(e) => patchFilter("fee", e.target.value)}>
                <option value="">Todas</option>
                <option value="charged">Com taxa</option>
                <option value="free">Gratuitas</option>
              </select>
            </label>
            <label className="field reports-filter-field">
              <span>Agenda</span>
              <select value={filters.agendaKind} onChange={(e) => patchFilter("agendaKind", e.target.value)}>
                <option value="">Todas</option>
                {agendaKindOptions.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>

            <div className="page-actions reports-filter-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={clearFilters}
                disabled={!appliedFilters && !filters.start && !filters.end}
              >
                Limpar
              </button>
              <button className="primary-action" type="button" onClick={applyFilters}>
                <Search size={15} />
                Buscar
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={exportPdf}
                disabled={!appliedFilters}
                title={!appliedFilters ? "Faça uma busca primeiro" : "Exportar relatório operacional"}
              >
                <Download size={15} />
                Exportar
              </button>
              <button
                className={`secondary-action${canProntuario ? "" : " disabled-look"}`}
                type="button"
                onClick={handleProntuario}
                disabled={!canProntuario || prmLoading}
                title={!canProntuario ? "Informe um microchip ou CPF na busca para gerar o prontuário" : "Gerar prontuário completo do animal"}
              >
                <FileText size={15} />
                {prmLoading ? "Gerando..." : "Prontuário"}
              </button>
            </div>
          </div>

          {prmError && (
            <p className="reports-prm-error">{prmError}</p>
          )}
      </div>
      <div className="panel wide reports-summary-panel">
        <div className="reports-breakdown-grid">
          {reportBreakdowns.map((group) => (
            <div className="reports-breakdown" key={group.title}>
              <div className="reports-breakdown-head">
                <span>{group.title}</span>
                <strong>{sumValues(group.items)}</strong>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.items.length ? group.items : [{ label: "Sem dados", value: 0 }]).map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Tutor</th>
                <th>Microchip</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Resultado</th>
                <th>Usuário</th>
                <th>Taxa</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.slice(0, 50).map((request) => (
                <tr key={request.id || request.protocol}>
                  <td>{request.protocol || request.id}</td>
                  <td>{request.tutor || request.tutor_name || "Não informado"}</td>
                  <td>{getRequestMicrochip(request) || "-"}</td>
                  <td>{getRequestTypeName(request, requestTypes)}</td>
                  <td>{getOperationalStatusLabel(request)}</td>
                  <td>{requestResultLabel(request)}</td>
                  <td>{getRequestUserName(request)}</td>
                  <td>{request.fee || request.billingAmount || "Gratuito"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length === 0 && (
            <EmptyState
              title={appliedFilters ? "Nenhum registro encontrado" : "Nenhum filtro aplicado"}
              text={appliedFilters ? "Tente ajustar os filtros." : "Use os filtros acima e clique em Buscar."}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function getOperationalStatusId(request: AnyRecord = {}) {
  if (request.status === "NOVA") return requestHasTag(request, "ATRIBUIDA") ? "analysis" : "inbox";
  if (request.status === "AGENDADA") return requestHasTag(request, "REAGENDADA") ? "rescheduled" : "scheduled";
  if (request.status === "REALIZADA") return "done";
  if (request.status === "CANCELADA") return "canceled";
  return "";
}

function getOperationalStatusLabel(request: AnyRecord = {}) {
  const id = getOperationalStatusId(request);
  return operationalStatusOptions.find((s) => s.id === id)?.label || "Sem status";
}

function getRequestMicrochip(request: AnyRecord = {}) {
  return (
    request.animalMicrochip ||
    request.animal_microchip ||
    request.animals?.find((a) => a.microchip)?.microchip ||
    ""
  );
}

function generateReportsPdf(requests = [], filters: AnyRecord = {}, series: AnyRecord = {}, requestTypes = []) {
  const normalizedRequests = requests.map(normalizeRequest);
  const rows = normalizedRequests
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.protocol || r.id || "")}</td>
      <td>${escapeHtml(r.tutor || r.tutor_name || "Não informado")}</td>
      <td>${escapeHtml(getRequestMicrochip(r) || "-")}</td>
      <td>${escapeHtml(getRequestTypeName(r, requestTypes))}</td>
      <td>${escapeHtml(getOperationalStatusLabel(r))}</td>
      <td>${escapeHtml(requestResultLabel(r))}</td>
      <td>${escapeHtml(getRequestUserName(r))}</td>
      <td>${escapeHtml(r.fee || r.billingAmount || "Gratuito")}</td>
    </tr>`
    )
    .join("");

  const buildRows = (items = []) =>
    (items.length ? items : [{ label: "Sem dados", value: 0 }])
      .map((i) => `<tr><td>${escapeHtml(i.label)}</td><td>${i.value}</td></tr>`)
      .join("");

  const period = [filters.start || "início", filters.end || "hoje"].join(" até ");
  const searchLabel = filters.search ? ` · Busca: "${escapeHtml(filters.search)}"` : "";
  const filterRows = [
    ["Tipo", filters.type || "Todos"],
    ["Status", filters.status ? operationalStatusOptions.find((s) => s.id === filters.status)?.label || filters.status : "Todos"],
    ["Taxa", filters.fee === "charged" ? "Com taxa" : filters.fee === "free" ? "Gratuitas" : "Todas"],
    ["Agenda", filters.agendaKind ? agendaKindOptions.find((k) => k.id === filters.agendaKind)?.label || filters.agendaKind : "Todas"],
  ]
    .map(([l, v]) => `<tr><td>${escapeHtml(l)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("");

  const html = `<html><head><title>Relatório municipal</title><style>
    *{box-sizing:border-box}body{margin:0;color:#172026;font-family:Arial,sans-serif}
    .page{padding:28px;display:grid;gap:18px;align-content:start}
    .header{background:#10364f;color:#fff;border-radius:14px;padding:20px;display:flex;justify-content:space-between;gap:20px}
    .header span,th{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    h1{margin:4px 0 0;font-size:25px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .card{border:1px solid #dbeaf3;border-radius:10px;background:#f8fbfd;padding:12px}
    .card span{display:block;color:#5b6b7a;font-size:10px;font-weight:800;text-transform:uppercase}
    .card strong{display:block;margin-top:5px;font-size:18px}
    .tg{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
    .st{margin:0 0 8px;color:#10364f;font-size:12px;font-weight:800;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;border:1px solid #dbeaf3}
    th,td{padding:7px 8px;border-bottom:1px solid #e8f1f5;text-align:left;font-size:10px}
    th{background:#e6f5ff;color:#10364f}td:last-child,th:last-child{text-align:right}
  </style></head><body><main class="page">
    <header class="header">
      <div><span>Relatório municipal</span><h1>Solicitações de castração</h1></div>
      <div><span>Período${searchLabel}</span><strong>${escapeHtml(period)}</strong></div>
    </header>
    <section class="summary">
      <div class="card"><span>Total</span><strong>${normalizedRequests.length}</strong></div>
      <div class="card"><span>Fila ativa</span><strong>${normalizedRequests.filter((r) => r.status === "NOVA" || r.status === "AGENDADA").length}</strong></div>
      <div class="card"><span>Realizadas</span><strong>${normalizedRequests.filter((r) => r.status === "REALIZADA").length}</strong></div>
      <div class="card"><span>Emitido em</span><strong>${new Date().toLocaleDateString("pt-BR")}</strong></div>
    </section>
    <section class="tg">
      <div><p class="st">Status</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${buildRows(series.statusSeries)}</tbody></table></div>
      <div><p class="st">Resultado</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${buildRows(series.resultSeries)}</tbody></table></div>
      <div><p class="st">Tipos</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${buildRows(series.typeSeries)}</tbody></table></div>
      <div><p class="st">Responsáveis</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${buildRows(series.userSeries)}</tbody></table></div>
      <div><p class="st">Taxas</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${buildRows(series.feeSeries)}</tbody></table></div>
    </section>
    <div><p class="st">Filtros aplicados</p><table><tbody>${filterRows}</tbody></table></div>
    <table><thead><tr><th>Protocolo</th><th>Tutor</th><th>Microchip</th><th>Tipo</th><th>Status</th><th>Resultado</th><th>Usuário</th><th>Taxa</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8">Nenhum registro encontrado</td></tr>'}</tbody></table>
  </main></body></html>`;

  const iframe = document.createElement("iframe");
  iframe.title = "Relatório municipal";
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => iframe.remove(), 300);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 30000);
  };
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open(); doc.write(html); doc.close();
}
