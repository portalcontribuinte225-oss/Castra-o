import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AgendaView } from "./agenda-view";

it("names the native agenda filters and renders the active view and calendar days as buttons", () => {
  vi.setSystemTime(new Date(2026, 10, 20, 12));
  try {
    const html = renderToStaticMarkup(<AgendaView scheduleDays={[{ date: "20/11/2026", vacancies: 4 }]} />);

    for (const name of ["Tipo de atendimento", "Status operacional", "Mês", "Ano"]) {
      expect(html).toMatch(new RegExp(`<select[^>]*aria-label="${name}"`));
    }
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Mês<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Semana<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-label="Abrir agenda de 20\/11\/2026, 0 de 4 vagas ocupadas"[^>]*aria-current="date"[^>]*aria-haspopup="dialog"/);
  } finally {
    vi.useRealTimers();
  }
});
