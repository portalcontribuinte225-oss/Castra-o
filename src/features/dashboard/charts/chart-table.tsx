interface ChartTableProps {
  caption: string;
  columns: string[];
  rows: string[][];
}

// The table twin of a chart, for screen readers: every value the chart draws, without depending on hover.
export function ChartTable({ caption, columns, rows }: ChartTableProps) {
  return (
    <table className="dash-sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) => (index === 0 ? <th key={columns[index]} scope="row">{cell}</th> : <td key={columns[index]}>{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
