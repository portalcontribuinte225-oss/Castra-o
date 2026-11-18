import { describe, expect, it, vi } from "vitest";
import { ShareOutcome, adoptionShareDetails, adoptionShareUrl, shareAdoptionLink } from "./share-adoption";

const ID = "33333333-3333-4333-8333-333333333333";
const details = adoptionShareDetails({ id: ID, name: "Luna" }, "https://app.example.test");

describe("adoption share link", () => {
  it("points to the animal's page on the app's own address, with its name in the title and the text", () => {
    expect(adoptionShareUrl("https://app.example.test", ID)).toBe(`https://app.example.test/adocao/${ID}`);
    expect(details).toEqual({
      title: "Luna para adoção",
      text: "Conheça Luna, que está esperando por um lar.",
      url: `https://app.example.test/adocao/${ID}`,
    });
    expect(adoptionShareDetails({ id: ID, animal_name: " " }, "https://app.example.test").title).toBe("Animal para adoção");
  });

  it("opens the device's share menu when there is one, and closing it is not an error", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareAdoptionLink(details, { share, clipboard: { writeText } })).toBe(ShareOutcome.SHARED);
    expect(share).toHaveBeenCalledWith(details);
    expect(writeText).not.toHaveBeenCalled();
    const cancel = vi.fn().mockRejectedValue(Object.assign(new Error("closed"), { name: "AbortError" }));
    expect(await shareAdoptionLink(details, { share: cancel, clipboard: { writeText } })).toBe(ShareOutcome.CANCELLED);
  });

  it("copies the link without a share menu, or when the menu fails, and says when it cannot", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareAdoptionLink(details, { clipboard: { writeText } })).toBe(ShareOutcome.COPIED);
    expect(writeText).toHaveBeenCalledWith(details.url);
    const broken = vi.fn().mockRejectedValue(new Error("not allowed"));
    expect(await shareAdoptionLink(details, { share: broken, clipboard: { writeText } })).toBe(ShareOutcome.COPIED);
    expect(await shareAdoptionLink(details, { clipboard: { writeText: broken } })).toBe(ShareOutcome.FAILED);
    expect(await shareAdoptionLink(details, {})).toBe(ShareOutcome.FAILED);
  });
});
