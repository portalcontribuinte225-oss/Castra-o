import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdoptionPhotoCarousel, AdoptionPhotoThumb, carouselStartIndex } from "./adoption-photo-carousel";

const noop = () => {};
const photo = (n: number) => `https://fotos.teste.local/animal-${n}.jpg`;

function render(photos: string[], startIndex = 0) {
  return renderToStaticMarkup(
    <AdoptionPhotoCarousel photos={photos} startIndex={startIndex} name="Mel" fallbackClassName="photo-teal" onIndexChange={noop} />,
  );
}

describe("adoption photo carousel", () => {
  it("shows one dot per photo and marks the main photo it opens on", () => {
    const html = render([photo(1), photo(2), photo(3)], 1);
    expect(html.match(/aria-label="Foto \d de 3"/g)).toEqual(['aria-label="Foto 1 de 3"', 'aria-label="Foto 2 de 3"', 'aria-label="Foto 3 de 3"']);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="Foto 2 de 3" aria-current="true"/);
    expect(html).toContain('aria-label="Foto anterior"');
    expect(html).toContain('aria-label="Próxima foto"');
  });

  it("loads the main photo at once and the others only near the screen", () => {
    const html = render([photo(1), photo(2), photo(3)], 1);
    expect(html).toMatch(/<img[^>]*src="https:\/\/fotos\.teste\.local\/animal-2\.jpg"[^>]*loading="eager"|<img[^>]*loading="eager"[^>]*animal-2\.jpg/);
    expect(html.match(/loading="lazy"/g)).toHaveLength(2);
  });

  it("shows at most five photos", () => {
    const html = render([1, 2, 3, 4, 5, 6].map(photo));
    expect(html.match(/<img/g)).toHaveLength(5);
    expect(html).not.toContain("animal-6.jpg");
  });

  it("shows a single photo without arrows or dots", () => {
    const html = render([photo(1)]);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).not.toContain("Foto anterior");
    expect(html).not.toContain("de 1");
  });

  it("shows the paw on the animal's background when there is no photo", () => {
    const html = render([]);
    expect(html).not.toContain("<img");
    expect(html).toContain("photo-teal");
    expect(html).toContain("<svg");
  });

  it("keeps the photo that was showing as a thumbnail, or the paw without a photo", () => {
    expect(renderToStaticMarkup(<AdoptionPhotoThumb photo={photo(2)} fallbackClassName="photo-sky" />)).toMatch(/<img src="https:\/\/fotos\.teste\.local\/animal-2\.jpg" alt=""/);
    const paw = renderToStaticMarkup(<AdoptionPhotoThumb photo="" fallbackClassName="photo-sky" />);
    expect(paw).toContain("photo-sky");
    expect(paw).not.toContain("<img");
  });

  it("opens on a photo that exists", () => {
    expect(carouselStartIndex(3, 2)).toBe(1);
    expect(carouselStartIndex(-1, 3)).toBe(0);
    expect(carouselStartIndex(Number.NaN, 3)).toBe(0);
    expect(carouselStartIndex(2, 0)).toBe(0);
  });
});
