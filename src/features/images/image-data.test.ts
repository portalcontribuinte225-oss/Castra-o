import { describe, expect, it } from "vitest";
import { dataUrlBytes, fittedSize } from "./image-data";

describe("image data", () => {
  it("fits the longest side into the limit, keeping the proportions, and leaves a small image as it is", () => {
    expect(fittedSize(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fittedSize(1080, 2400, 1280)).toEqual({ width: 576, height: 1280 });
    expect(fittedSize(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fittedSize(0, 0, 1280)).toEqual({ width: 0, height: 0 });
  });

  it("measures the bytes a data URL decodes to", () => {
    expect(dataUrlBytes(`data:image/jpeg;base64,${btoa("abcdefghij")}`)).toBe(10);
    expect(dataUrlBytes(`data:image/png;base64,${btoa("abcd")}`)).toBe(4);
    expect(dataUrlBytes("not a data url")).toBe(0);
  });
});
