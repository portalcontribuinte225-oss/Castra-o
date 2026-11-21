import { escapeHtml } from "../../utils";
import { reportColumns, type OperationalReport } from "./operational-report";
import { reportPeriod, type ReportQuery } from "./report-filters";

function rowHtml(cells: (string | number)[], element = "td"): string {
  return `<tr>${cells.map((cell) => `<${element}>${escapeHtml(String(cell))}</${element}>`).join("")}</tr>`;
}

export function buildReportPrintHtml(report: OperationalReport, query: ReportQuery, filters: [string, string][], issuedOn: Date): string {
  const rows = report.rows.map(({ cells }) => rowHtml(cells)).join("");
  const filterRows = filters.map((cells) => rowHtml(cells)).join("");
  const breakdowns = report.breakdowns.map(({ title, items }) => `
    <div><p class="st">${escapeHtml(title)}</p>
      <table><thead>${rowHtml(["Descrição", "Qtd."], "th")}</thead>
      <tbody>${items.length ? items.map(({ label, value }) => rowHtml([label, value])).join("") : rowHtml(["Sem dados", 0])}</tbody></table>
    </div>`).join("");
  const searchLabel = query.search ? ` · Busca: "${escapeHtml(query.search)}"` : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório municipal</title><style>
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
      <div><span>Período${searchLabel}</span><strong>${escapeHtml(reportPeriod(query.report))}</strong></div>
    </header>
    <section class="summary">
      <div class="card"><span>Total</span><strong>${report.rows.length}</strong></div>
      <div class="card"><span>Fila ativa</span><strong>${report.activeCount}</strong></div>
      <div class="card"><span>Realizadas</span><strong>${report.completedCount}</strong></div>
      <div class="card"><span>Emitido em</span><strong>${escapeHtml(issuedOn.toLocaleDateString("pt-BR"))}</strong></div>
    </section>
    <section class="tg">${breakdowns}</section>
    <div><p class="st">Filtros aplicados</p><table><tbody>${filterRows}</tbody></table></div>
    <table><thead>${rowHtml(reportColumns, "th")}</thead>
    <tbody>${rows || `<tr><td colspan="${reportColumns.length}">Nenhum registro encontrado</td></tr>`}</tbody></table>
  </main></body></html>`;
}
