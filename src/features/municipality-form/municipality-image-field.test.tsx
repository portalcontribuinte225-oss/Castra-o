import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MunicipalityImageField } from "./municipality-image-field";

const noop = () => undefined;

describe("MunicipalityImageField", () => {
  it("offers to choose an image of the types the e-mails can show", () => {
    const html = renderToStaticMarkup(<MunicipalityImageField label="Logo do órgão" value="" onChange={noop} />);
    expect(html).toContain("<span>Logo do órgão</span>");
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).toContain("PNG, JPG ou WEBP");
    expect(html).not.toContain("<img");
  });

  it("shows the chosen image with a button to remove it, and the image itself picks another one", () => {
    const html = renderToStaticMarkup(<MunicipalityImageField label="Brasão do município" value="data:image/png;base64,AAAA" onChange={noop} />);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('alt="Brasão do município"');
    expect(html).toContain('aria-label="Remover brasão do município"');
    expect(html.indexOf('type="file"')).toBeLessThan(html.indexOf("<button"));
  });
});
