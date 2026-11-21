import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidebarMunicipalityBrand } from "./sidebar-municipality-brand";

describe("sidebar municipal identification", () => {
  it("displays the crest and identification of the resolved municipality", () => {
    const html = renderToStaticMarkup(<SidebarMunicipalityBrand
      municipality={{ name: "Criciúma", brasao: "/brasao.svg", department_name: "Bem-estar animal" }}
      defaultLabel="Plataforma"
    />);
    expect(html).toContain('alt="Brasão de Criciúma"');
    expect(html).toContain("Bem-estar animal");
    expect(html.match(/<img\b/g)).toHaveLength(1);
  });

  it("keeps identification as text where there is no crest or municipality selected", () => {
    const city = renderToStaticMarkup(<SidebarMunicipalityBrand municipality={{ name: "Criciúma" }} defaultLabel="Plataforma" />);
    const global = renderToStaticMarkup(<SidebarMunicipalityBrand defaultLabel="Plataforma" />);
    expect(city).toContain("<strong>Criciúma</strong>");
    expect(global).toContain("<strong>Plataforma</strong>");
    expect(city + global).not.toMatch(/<img\b|<svg\b|brand-mark/);
  });
});
