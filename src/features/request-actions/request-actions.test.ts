import { describe, expect, it } from "vitest";
import { canEditRequests } from "./request-actions";

describe("request operation visibility", () => {
  it("allows only global and internal municipal roles to edit requests", () => {
    for (const role of ["master", "suporte", "admin_municipal", "analista", "servidor_publico"]) {
      expect(canEditRequests(role)).toBe(true);
    }
    for (const role of ["tutor", "ong", "protetor", "", "coordenador"]) {
      expect(canEditRequests(role)).toBe(false);
    }
  });
});
