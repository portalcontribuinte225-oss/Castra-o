import { useMemo } from "react";
import { CircleCheck, MapPin, MapPinOff, Percent } from "lucide-react";
import { Metric } from "../../../components/ui";
import type { DashboardData } from "../dashboard-data";
import { formatNumber, formatPercent, pluralize } from "../dashboard-format";
import { neighborhoodReport, neighborhoodTypeMatrix } from "../neighborhood-metrics";
import { NeighborhoodTable } from "../neighborhood-table";
import { ChartPanel } from "../charts/chart-panel";
import { HeatMatrix } from "../charts/heat-matrix";

export function NeighborhoodsTab({ data }: { data: DashboardData }) {
  const { requests, neighborhoods, requestTypes, range } = data;
  const report = useMemo(() => neighborhoodReport(requests, neighborhoods, requestTypes, range), [requests, neighborhoods, requestTypes, range]);
  const matrix = useMemo(() => neighborhoodTypeMatrix(report.rows), [report]);
  return (
    <>
      <div className="dash-kpis">
        <Metric title="Bairros cadastrados" value={formatNumber(report.registeredCount)} icon={MapPin} trend="ativos no município" />
        <Metric title="Com atendimento" value={formatNumber(report.servedCount)} icon={CircleCheck} trend="ao menos uma realização" />
        <Metric title="Nunca atendidos" value={formatNumber(report.neverServedCount)} icon={MapPinOff} trend="nenhuma realização até hoje" />
        <Metric title="Cobertura" value={formatPercent(report.coverage)} icon={Percent} trend="dos bairros cadastrados já atendidos" />
      </div>
      <div className="dash-grid">
        <ChartPanel
          wide
          title="Bairros"
          subtitle={report.registeredCount
            ? "Onde já houve trabalho e onde falta. Clique no título de uma coluna para ordenar."
            : "Nenhum bairro cadastrado: cadastre em Configurar Ambiente → Bairros para ver também os que nunca foram atendidos."}
        >
          <NeighborhoodTable rows={report.rows} />
        </ChartPanel>
        <ChartPanel wide title="O que se pede em cada bairro" subtitle="Solicitações do período por bairro e tipo; quanto mais escura a célula, mais pedidos.">
          <HeatMatrix
            data={matrix}
            caption="Solicitações do período por bairro e tipo de solicitação"
            rowHeader="Bairro"
            describe={(row, column, value) => `${row}, ${matrix.columns[column]}: ${pluralize(value, "solicitação", "solicitações")}`}
          />
        </ChartPanel>
      </div>
    </>
  );
}
