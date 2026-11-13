import { randomUUID } from "node:crypto";

export const ANIMAL_TEST_MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
export const ANIMAL_TEST_OTHER = "22222222-2222-4222-8222-222222222222";
export const ANIMAL_TEST_USER = "33333333-3333-4333-8333-333333333333";
export const ANIMAL_TEST_REQUEST = "44444444-4444-4444-8444-444444444444";

export function registeredAnimalDatabase() {
  const state = { animals: new Map(), owners: [], records: [], requests: new Map(), calls: [], profiles: new Map(), failAudit: false };
  const query = async (sql, values = []) => {
    state.calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("INSERT INTO animals")) {
      const row = { id: randomUUID(), microchip: null, name: values[0], species: values[1], sex: values[2], size: values[3],
        breed: values[4], color: values[5], birth_date: values[6], metadata: JSON.parse(values[7]), status: "ATIVO" };
      state.animals.set(row.id, row); return { rows: [structuredClone(row)] };
    }
    if (sql.includes("SELECT a.* FROM animals a WHERE a.id = $1")) {
      const row = state.animals.get(values[0]);
      const municipality = state.records.some((record) => record.animal_id === values[0] && record.municipality_id === values[1]);
      const owner = values.length < 3 || state.owners.some((record) => record.animal_id === values[0] && record.user_id === values[2] && record.municipality_id === values[1] && record.active);
      return { rows: row && municipality && owner ? [structuredClone(row)] : [] };
    }
    if (sql.includes("INSERT INTO animal_tutors")) {
      const id = randomUUID(); const profile = state.profiles.get(values[1]);
      state.owners.push({ id, animal_id: values[0], user_id: values[1], active: true,
        municipality_id: profile?.municipality_id || ANIMAL_TEST_MUNICIPALITY, cpf: values[4] });
      return { rows: [{ id }] };
    }
    if (sql.includes("INSERT INTO animal_records")) {
      const type = sql.includes("'CIRURGIA_REALIZADA'") ? "CIRURGIA_REALIZADA" : sql.includes("'TROCA_TUTOR_EFETIVADA'") ? "TROCA_TUTOR_EFETIVADA" : sql.includes("'MICROCHIP_CONFIRMADO'") ? "MICROCHIP_CONFIRMADO" : "SOLICITACAO_PROCEDIMENTO";
      if (!state.records.some((row) => row.animal_id === values[0] && row.request_id === values[1] && row.type === type)) {
        state.records.push({ animal_id: values[0], request_id: values[1], municipality_id: values[2], type,
          data: JSON.parse(values[type === "CIRURGIA_REALIZADA" ? 4 : 3] || "{}") });
      }
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE requests SET animals")) {
      const conditional = sql.includes("animal_id=CASE"); const request = state.requests.get(values[conditional ? 3 : 6]);
      if (request) { request.animals = JSON.parse(values[0]); if (!conditional || values[1] === 0) request.animal_id = conditional ? values[2] : values[1]; }
      return { rows: [] };
    }
    if (sql.startsWith("SELECT * FROM requests WHERE id=$1")) {
      const row = state.requests.get(values[0]);
      return { rows: row && row.tutor_id === values[1] && row.municipality_id === values[2] ? [structuredClone(row)] : [] };
    }
    if (sql.startsWith("SELECT a.id,r.data")) return { rows: state.records.filter((record) => record.request_id === values[0] && record.municipality_id === values[1])
      .map((record) => ({ id: record.animal_id, source_index: record.data.sourceAnimalIndex == null ? null : String(record.data.sourceAnimalIndex), metadata_index: state.animals.get(record.animal_id)?.metadata?.source?.animalIndex?.toString() })) };
    if (sql.startsWith("SELECT u.name,p.cpf")) {
      const profile = state.profiles.get(values[0]); return { rows: profile?.municipality_id === values[1] ? [profile] : [] };
    }
    if (sql.startsWith("SELECT address,neighborhood")) return { rows: [{ address: "Endereço próprio", neighborhood: "Centro", city: "Cidade" }] };
    if (sql.startsWith("SELECT id FROM animals WHERE microchip")) return { rows: [...state.animals.values()].filter((row) => row.microchip === values[0] && row.id !== values[1]).map((row) => ({ id: row.id })) };
    if (sql.startsWith("SELECT 1 FROM animal_records")) return { rows: state.records.filter((row) => row.animal_id === values[0] && row.request_id === values[1] && row.municipality_id === values[2] && row.type === "TROCA_TUTOR_EFETIVADA").map(() => ({ exists: true })) };
    if (sql.startsWith("UPDATE animals SET microchip")) {
      const row = state.animals.get(values[0]); row.microchip = values[1]; row.metadata = JSON.parse(values[2]); return { rows: [structuredClone(row)] };
    }
    if (sql.startsWith("UPDATE animals SET status")) { state.animals.get(values[0]).status = values[1]; return { rows: [] }; }
    if (sql.startsWith("SELECT t.id FROM animal_tutors t WHERE")) return { rows: state.owners.filter((row) => row.animal_id === values[0] && row.active && !row.user_id && row.ambiguous).map((row) => ({ id: row.id })) };
    if (sql.startsWith("SELECT t.id FROM animal_tutors t LEFT JOIN users")) return { rows: state.owners.filter((row) => row.animal_id === values[0] && row.active && row.municipality_id === values[1]).map((row) => ({ id: row.id })) };
    if (sql.startsWith("SELECT u.id,u.name,p.email")) return { rows: [...state.profiles.values()].filter((row) => row.municipality_id === values[0] && row.cpf === values[1] && row.active !== false) };
    if (sql.startsWith("UPDATE animal_tutors SET active")) { state.owners.forEach((row) => { if (values[0].includes(row.id) && row.animal_id === values[1]) row.active = false; }); return { rows: [] }; }
    if (sql.includes("INSERT INTO audit_logs")) { if (state.failAudit) throw new Error("Audit unavailable"); return { rows: [] }; }
    throw new Error(`Unhandled registered animal test query: ${sql}`);
  };
  return { ...state, query, state };
}
