import { useState } from "react";
import { Download, Search } from "lucide-react";
import type { AnyRecord } from "../types";
import {
  initialRequestTypes,
  initialTeams,
  normalizeRequest,
  requestHasTag,
  requestResultLabel,
} from "../domain";
import { EmptyState } from "../components/ui";
import { escapeHtml } from "../utils";
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

export function ReportsView({ requests = [], metrics, requestTypes = initialRequestTypes, teams = initialTeams }: AnyRecord) {
  const emptyFilters = { start: "", end: "", type: "", status: "", user: "", fee: "" };
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(null);
  const activeUsers = teams.users?.filter((user) => user.active !== false) || [];
  const normalizedReportRequests = requests.map(normalizeRequest);
  const filteredRequests = appliedFilters ? normalizedReportRequests.filter((request) => {
    const date = getRequestDate(request);
    const typeName = getRequestTypeName(request, requestTypes);
    const feeValue = request.fee || request.billingAmount || "";
    const hasFee = feeValue && feeValue !== "Gratuito";
    if (!isInPeriod(date, appliedFilters.start, appliedFilters.end)) return false;
    if (appliedFilters.type && typeName !== appliedFilters.type) return false;
    if (appliedFilters.status && getOperationalStatusId(request) !== appliedFilters.status) return false;
    if (appliedFilters.user && getRequestUserName(request) !== appliedFilters.user) return false;
    if (appliedFilters.fee === "charged" && !hasFee) return false;
    if (appliedFilters.fee === "free" && hasFee) return false;
    return true;
  }) : [];
  const typeOptions = countBy(requests, (request) => getRequestTypeName(request, requestTypes)).map((item) => item.label);
  const userOptions = Array.from(new Set([...activeUsers.map((user) => user.name), ...requests.map(getRequestUserName)])).filter(Boolean);
  const statusSeries = countBy(filteredRequests, getOperationalStatusLabel);
  const resultSeries = countBy(filteredRequests, requestResultLabel);
  const typeSeries = countBy(filteredRequests, (request) => getRequestTypeName(request, requestTypes));
  const userSeries = topItems(countBy(filteredRequests, getRequestUserName));
  const feeSeries = countBy(filteredRequests, (request) => {
    const feeValue = request.fee || request.billingAmount || "";
    return feeValue && feeValue !== "Gratuito" ? "Com taxa" : "Gratuito";
  });
  const reportBreakdowns = [
    { title: "Status", items: statusSeries },
    { title: "Resultado", items: resultSeries },
    { title: "Tipos de solicitação", items: typeSeries },
    { title: "Responsáveis", items: userSeries },
    { title: "Taxas", items: feeSeries },
  ];

  function patchFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applyFilters() {
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(null);
  }

  function exportPdf() {
    generateReportsPdf(filteredRequests, appliedFilters || emptyFilters, { statusSeries, resultSeries, typeSeries, userSeries, feeSeries }, requestTypes);
  }

  return (
    <section className="content-grid">
      <div className="hero-panel reports-hero">
        <div className="reports-filter-grid">
          <label className="field reports-hero-field">
            <span>Início</span>
            <input type="date" value={filters.start} onChange={(event) => patchFilter("start", event.target.value)} />
          </label>
          <label className="field reports-hero-field">
            <span>Fim</span>
            <input type="date" value={filters.end} onChange={(event) => patchFilter("end", event.target.value)} />
          </label>
          <label className="field reports-hero-field">
            <span>Tipo</span>
            <select value={filters.type} onChange={(event) => patchFilter("type", event.target.value)}>
              <option value="">Todos</option>
              {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="field reports-hero-field">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => patchFilter("status", event.target.value)}>
              <option value="">Todos</option>
              {operationalStatusOptions.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </label>
          <label className="field reports-hero-field">
            <span>Usuário</span>
            <select value={filters.user} onChange={(event) => patchFilter("user", event.target.value)}>
              <option value="">Todos</option>
              {userOptions.map((user) => <option key={user} value={user}>{user}</option>)}
            </select>
          </label>
          <label className="field reports-hero-field">
            <span>Taxas</span>
            <select value={filters.fee} onChange={(event) => patchFilter("fee", event.target.value)}>
              <option value="">Todas</option>
              <option value="charged">Com taxa</option>
              <option value="free">Gratuitas</option>
            </select>
          </label>
          <div className="reports-filter-actions">
            <button className="ghost-button reports-clear-btn" type="button" onClick={clearFilters} disabled={!appliedFilters}>
              Limpar
            </button>
            <button className="primary-action" type="button" onClick={applyFilters}>
              <Search size={16} />
              Buscar
            </button>
            <button className="primary-action" type="button" onClick={exportPdf} disabled={!appliedFilters}>
              <Download size={16} />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>
      <div className="panel wide">
        {!appliedFilters ? (
          <EmptyState title="Nenhum filtro aplicado" text="Defina os filtros acima e clique em Buscar para gerar o relatório." />
        ) : (<>
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
              {filteredRequests.slice(0, 12).map((request) => (
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
          {filteredRequests.length === 0 && <EmptyState title="Nenhum registro encontrado" text="Tente ajustar os filtros." />}
        </div>
        </>)}
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
  return operationalStatusOptions.find((item) => item.id === id)?.label || "Sem status";
}

function getRequestMicrochip(request: AnyRecord = {}) {
  return request.animalMicrochip
    || request.animal_microchip
    || request.animals?.find((animal) => animal.microchip)?.microchip
    || "";
}

function generateReportsPdf(requests = [], filters: AnyRecord = {}, series: AnyRecord = {}, requestTypes = []) {
  const normalizedRequests = requests.map(normalizeRequest);
  const rows = normalizedRequests.map((request) => `
    <tr>
      <td>${escapeHtml(request.protocol || request.id || "")}</td>
      <td>${escapeHtml(request.tutor || request.tutor_name || "Não informado")}</td>
      <td>${escapeHtml(getRequestMicrochip(request) || "-")}</td>
      <td>${escapeHtml(getRequestTypeName(request, requestTypes))}</td>
      <td>${escapeHtml(getOperationalStatusLabel(request))}</td>
      <td>${escapeHtml(requestResultLabel(request))}</td>
      <td>${escapeHtml(getRequestUserName(request))}</td>
      <td>${escapeHtml(request.fee || request.billingAmount || "Gratuito")}</td>
    </tr>
  `).join("");
  const buildSummaryRows = (items = []) => (items.length ? items : [{ label: "Sem dados", value: 0 }]).map((item) => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${item.value}</td>
    </tr>
  `).join("");
  const statusRows = buildSummaryRows(series.statusSeries);
  const resultRows = buildSummaryRows(series.resultSeries);
  const typeRows = buildSummaryRows(series.typeSeries);
  const userRows = buildSummaryRows(series.userSeries);
  const feeRows = buildSummaryRows(series.feeSeries);
  const period = [filters.start || "início", filters.end || "hoje"].join(" até ");
  const filterRows = [
    ["Tipo", filters.type || "Todos"],
    ["Status", filters.status ? operationalStatusOptions.find((item) => item.id === filters.status)?.label || filters.status : "Todos"],
    ["Usuário", filters.user || "Todos"],
    ["Taxa", filters.fee === "charged" ? "Com taxa" : filters.fee === "free" ? "Gratuitas" : "Todas"],
  ].map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("");
  const html = `
    <html>
      <head>
        <title>Relatório municipal</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; color: #172026; font-family: Arial, sans-serif; background: #ffffff; }
          .page { min-height: 100vh; padding: 28px; display: grid; gap: 18px; align-content: start; }
          .header { background: #10364f; color: #ffffff; border-radius: 14px; padding: 20px; display: flex; justify-content: space-between; gap: 20px; }
          .header span, th { font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
          h1 { margin: 4px 0 0; font-size: 25px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .card { border: 1px solid #dbeaf3; border-radius: 10px; background: #f8fbfd; padding: 12px; }
          .card span { display: block; color: #5b6b7a; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          .card strong { display: block; margin-top: 5px; font-size: 18px; }
          .tables-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
          .section-title { margin: 0 0 8px; color: #10364f; font-size: 12px; font-weight: 800; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbeaf3; }
          th, td { padding: 7px 8px; border-bottom: 1px solid #e8f1f5; text-align: left; font-size: 10px; }
          th { background: #e6f5ff; color: #10364f; }
          td:last-child, th:last-child { text-align: right; }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="header">
            <div><span>Relatório municipal</span><h1>Solicitações de castração</h1></div>
            <div><span>Período</span><strong>${escapeHtml(period)}</strong></div>
          </header>
          <section class="summary">
            <div class="card"><span>Total</span><strong>${normalizedRequests.length}</strong></div>
            <div class="card"><span>Fila ativa</span><strong>${normalizedRequests.filter((request) => request.status === "NOVA" || request.status === "AGENDADA").length}</strong></div>
            <div class="card"><span>Realizadas</span><strong>${normalizedRequests.filter((request) => request.status === "REALIZADA").length}</strong></div>
            <div class="card"><span>Emitido em</span><strong>${new Date().toLocaleDateString("pt-BR")}</strong></div>
          </section>
          <section class="tables-grid">
            <div><p class="section-title">Status</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${statusRows}</tbody></table></div>
            <div><p class="section-title">Resultado</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${resultRows}</tbody></table></div>
            <div><p class="section-title">Tipos</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${typeRows}</tbody></table></div>
            <div><p class="section-title">Responsáveis</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${userRows}</tbody></table></div>
            <div><p class="section-title">Taxas</p><table><thead><tr><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${feeRows}</tbody></table></div>
          </section>
          <div><p class="section-title">Filtros aplicados</p><table><tbody>${filterRows}</tbody></table></div>
          <table class="records">
            <thead><tr><th>Protocolo</th><th>Tutor</th><th>Microchip</th><th>Tipo</th><th>Status</th><th>Resultado</th><th>Usuário</th><th>Taxa</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="8">Nenhum registro encontrado</td></tr>'}</tbody>
          </table>
        </main>
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.title = "Relatório municipal";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => iframe.remove(), 300);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 30000);
  };
  const printDocument = iframe.contentWindow?.document;
  if (!printDocument) {
    iframe.remove();
    return;
  }
  printDocument.open();
  printDocument.write(html);
  printDocument.close();
}
