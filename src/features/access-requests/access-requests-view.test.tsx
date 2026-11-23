import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AccessRequestsView } from "./access-requests-view";

it("shows the active filter and a native button for each pending accreditation", () => {
  const html = renderToStaticMarkup(<AccessRequestsView accessRequests={[
    { id: "pending", status: "PENDENTE", organizationName: "Instituto Um" },
    { id: "approved", status: "APROVADO", organizationName: "Instituto Dois" },
  ]} />);

  expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Pendentes<span[^>]*>1<\/span>/);
  expect(html).toMatch(/<button[^>]*aria-label="Abrir credenciamento de Instituto Um"/);
  expect(html).not.toContain("Instituto Dois");
  expect(html).not.toContain('role="button"');
});
