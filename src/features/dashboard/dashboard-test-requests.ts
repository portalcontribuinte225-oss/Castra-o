import type { AnyRecord } from "../../types";
import { normalizeRequest } from "../../domain";

// A fixed "now" for the dashboard tests: 17/11/2026, midday, local time.
export const TEST_NOW = new Date(2026, 10, 17, 12, 0, 0);

// A request as the dashboard reads it (already normalized), from fake values only.
export function testRequest(fields: AnyRecord = {}): AnyRecord {
  return normalizeRequest({
    id: `req-${Math.random().toString(36).slice(2, 10)}`,
    status: "NOVA",
    tutor: "Tutor Teste",
    phone: "(48) 99999-1234",
    cpf: "000.000.000-00",
    address: "Rua Teste, 1",
    neighborhood: "Centro",
    cep: "88800-000",
    createdAt: "2026-11-10T10:00:00",
    animals: [{ name: "Animal Teste", species: "Cão", sex: "Macho", size: "Pequeno" }],
    ...fields,
  });
}
