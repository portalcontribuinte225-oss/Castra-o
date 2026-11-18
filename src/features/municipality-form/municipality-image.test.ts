import { describe, expect, it } from "vitest";
import { MUNICIPALITY_IMAGE_ERROR, MUNICIPALITY_IMAGE_TYPES, prepareMunicipalityImage } from "./municipality-image";

describe("prepareMunicipalityImage", () => {
  it("offers only the types the public link of an image serves to the e-mails", () => {
    expect(MUNICIPALITY_IMAGE_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });

  it("refuses another type before reading it, with the message the form shows", async () => {
    for (const type of ["image/svg+xml", "image/gif", "text/html", ""]) {
      await expect(prepareMunicipalityImage(new File(["<svg onload=alert(1)></svg>"], "brasao", { type }))).rejects.toThrow(MUNICIPALITY_IMAGE_ERROR);
    }
    expect(MUNICIPALITY_IMAGE_ERROR).toBe("Envie uma imagem PNG, JPG ou WEBP de até 2 MB.");
  });
});
