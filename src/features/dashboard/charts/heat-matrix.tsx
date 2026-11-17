import type { MatrixData } from "../dashboard-data";
import { formatNumber } from "../dashboard-format";
import { ChartEmpty } from "./chart-panel";

interface HeatMatrixProps {
  data: MatrixData;
  caption: string;
  rowHeader: string;
  // The sentence a cell reads out on hover and to screen readers.
  describe: (row: string, column: number, value: number) => string;
}

const HEAT_STEPS = 5;

// Which of the five steps of the blue scale a value takes against the largest value of the matrix; zero stays blank.
export function heatStep(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(HEAT_STEPS, Math.ceil((value / max) * HEAT_STEPS));
}

// A table whose cells darken with their count (one hue, light to dark), the count printed in each cell; the table itself is
// the accessible view.
export function HeatMatrix({ data, caption, rowHeader, describe }: HeatMatrixProps) {
  const max = Math.max(0, ...data.rows.flatMap((row) => row.values));
  if (!max) return <ChartEmpty />;
  return (
    <figure className="dash-chart">
      <div className="dash-heat-scroll">
        <table className="dash-heat">
          <caption className="dash-sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{rowHeader}</th>
              {data.columns.map((column) => <th key={column} scope="col">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, column) => (
                  <td key={data.columns[column]} className={`dash-heat-cell is-step-${heatStep(value, max)}`} title={describe(row.label, column, value)}>
                    {value ? formatNumber(value) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dash-heat-scale" aria-hidden="true">
        <span>menos</span>
        {Array.from({ length: HEAT_STEPS }, (_, step) => <i key={step} className={`dash-heat-swatch is-step-${step + 1}`} />)}
        <span>mais</span>
      </div>
    </figure>
  );
}
