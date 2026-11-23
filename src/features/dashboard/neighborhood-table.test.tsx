import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { NeighborhoodTable } from "./neighborhood-table";

it("shows the column headings as plain sortable text with the sorted column marked", () => {
  const html = renderToStaticMarkup(<NeighborhoodTable rows={[]} />);

  expect(html).toMatch(/<th scope="col" aria-sort="none"><button type="button"[^>]*>Bairro<\/button><\/th>/);
  expect(html).toMatch(/<th scope="col" aria-sort="descending"><button type="button"[^>]*title="Solicitações que entraram no período"[^>]*>Solicitadas<svg/);
  expect(html).not.toContain("tw:rounded-full");
  expect(html).not.toContain("is-numeric");
});
