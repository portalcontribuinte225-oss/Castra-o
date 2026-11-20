import { CalendarDays, ClipboardList } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorkspaceMobileNavigation } from "./workspace-mobile-navigation";

it("shows permitted shortcuts and keeps the menu available for other permitted screens", () => {
  const html = renderToStaticMarkup(<WorkspaceMobileNavigation
    items={[
      { id: "credenciamento", label: "Credenciamentos", icon: ClipboardList },
      { id: "agenda", label: "Agenda", icon: CalendarDays },
    ]}
    active="agenda"
    menuOpen
    onNavigate={() => {}}
    onOpenMenu={() => {}}
  />);

  expect(html).toMatch(/aria-label="Agenda" aria-current="page"/);
  expect(html).toMatch(/aria-label="Mais opções" aria-controls="workspace-sidebar" aria-expanded="true"/);
  expect(html).not.toMatch(/Credenciamentos|Solicitações|Dashboard|Relatórios/);
});
