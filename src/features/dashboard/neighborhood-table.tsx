import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { NOT_INFORMED_LABEL } from "./dashboard-data";
import { EMPTY_VALUE, formatDate, formatNumber, formatPercent } from "./dashboard-format";
import { NeighborhoodColumn, sortNeighborhoodRows, type NeighborhoodRow } from "./neighborhood-metrics";

interface ColumnSpec {
  id: NeighborhoodColumn;
  label: string;
  title: string;
  numeric: boolean;
}

const COLUMNS: ColumnSpec[] = [
  { id: NeighborhoodColumn.NAME, label: "Bairro", title: "Bairro do animal, ou do tutor quando o animal não tem", numeric: false },
  { id: NeighborhoodColumn.REQUESTED, label: "Solicitadas", title: "Solicitações que entraram no período", numeric: true },
  { id: NeighborhoodColumn.ANIMALS_SERVED, label: "Animais atendidos", title: "Animais das solicitações realizadas no período", numeric: true },
  { id: NeighborhoodColumn.OPEN, label: "Na fila", title: "Solicitações em aberto hoje", numeric: true },
  { id: NeighborhoodColumn.COMPLETED, label: "Realizadas", title: "Solicitações realizadas no período", numeric: true },
  { id: NeighborhoodColumn.CANCELLED, label: "Canceladas", title: "Solicitações canceladas no período", numeric: true },
  { id: NeighborhoodColumn.COMPLETION_RATE, label: "% concluído", title: "Realizadas ÷ (realizadas + na fila)", numeric: true },
  { id: NeighborhoodColumn.TOP_TYPE, label: "Tipo mais pedido", title: "O tipo de solicitação mais pedido no período", numeric: false },
  { id: NeighborhoodColumn.LAST_SERVED, label: "Último atendimento", title: "A realização mais recente, em todo o histórico", numeric: false },
];

function RateCell({ value }: { value: number | null }) {
  if (value === null) return <>{EMPTY_VALUE}</>;
  return (
    <span className="dash-rate">
      <i aria-hidden="true"><b style={{ width: `${value}%` }} /></i>
      {formatPercent(value)}
    </span>
  );
}

// Every neighborhood with its requests, queue, completions and last visit; a click on a heading sorts by it.
export function NeighborhoodTable({ rows }: { rows: NeighborhoodRow[] }) {
  const [sort, setSort] = useState({ column: NeighborhoodColumn.REQUESTED, descending: true });
  const sorted = useMemo(() => sortNeighborhoodRows(rows, sort.column, sort.descending), [rows, sort]);
  const sortBy = (column: NeighborhoodColumn) => setSort((current) => ({
    column,
    descending: current.column === column ? !current.descending : column !== NeighborhoodColumn.NAME,
  }));
  return (
    <div className="dash-table-scroll">
      <table className="reports-table dash-table">
        <caption className="dash-sr-only">Bairros com solicitações, fila, realizações e último atendimento</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort.column === column.id;
              const Arrow = sort.descending ? ArrowDown : ArrowUp;
              return (
                <th key={column.id} scope="col" className={column.numeric ? "is-numeric" : ""} aria-sort={active ? (sort.descending ? "descending" : "ascending") : "none"}>
                  <button className="dash-sort" type="button" title={column.title} onClick={() => sortBy(column.id)}>
                    {column.label}
                    {active && <Arrow size={12} aria-hidden="true" />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.key || NOT_INFORMED_LABEL}>
              <th scope="row">
                {row.name}
                {!row.registered && row.key && <small>não cadastrado</small>}
              </th>
              <td className="is-numeric">{formatNumber(row.requested)}</td>
              <td className="is-numeric">{formatNumber(row.animalsServed)}</td>
              <td className="is-numeric">{formatNumber(row.open)}</td>
              <td className="is-numeric">{formatNumber(row.completed)}</td>
              <td className="is-numeric">{formatNumber(row.cancelled)}</td>
              <td className="is-numeric"><RateCell value={row.completionRate} /></td>
              <td>{row.topType || EMPTY_VALUE}</td>
              <td>{row.lastServedAt ? formatDate(row.lastServedAt) : <span className="dash-never">Nunca atendido</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
