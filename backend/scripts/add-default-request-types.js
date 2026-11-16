// One-off: adds the default request types a municipality does not have yet (new municipalities start with all of them).
//
//   node backend/scripts/add-default-request-types.js           shows what would change, writes nothing
//   node backend/scripts/add-default-request-types.js --apply   writes it
//
// It only adds: a type the municipality already has (same id or same name) is never changed and nothing is removed. The new
// types are linked to the default breeds the municipality has. It runs against the database in DATABASE_URL, so check the
// target it prints first.
import { pool } from "../src/db/index.js";
import { BREEDS_CONFIG_KEY, buildDefaultBreeds } from "../src/services/breed-defaults.js";
import { REQUEST_TYPES_CONFIG_KEY, planDefaultRequestTypes } from "../src/services/request-type-defaults.js";
import { describeTarget, readValue, writeValue } from "./config-store.js";

const apply = process.argv.includes("--apply");
const defaultBreedIds = buildDefaultBreeds().map(({ id }) => id);

async function main() {
  console.log(`Banco: ${describeTarget()}`);
  console.log(apply ? "Modo: GRAVAR" : "Modo: simulação (nada é gravado; use --apply para gravar)");
  const { rows: municipalities } = await pool.query("SELECT id, name FROM municipalities ORDER BY name");
  let changed = 0;
  for (const municipality of municipalities) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const requestTypes = await readValue(client, REQUEST_TYPES_CONFIG_KEY, municipality.id);
      const breeds = await readValue(client, BREEDS_CONFIG_KEY, municipality.id);
      const owned = new Set((Array.isArray(breeds) ? breeds : []).map((breed) => breed?.id));
      const plan = planDefaultRequestTypes({ requestTypes, breedIds: defaultBreedIds.filter((id) => owned.has(id)) });
      if (plan.skip) {
        console.log(`- ${municipality.name}: ignorado, ${plan.skip}`);
      } else {
        console.log(`- ${municipality.name}: ${plan.added.join(", ")} acrescentado(s)${apply ? "" : " (simulação)"}`);
        if (apply) await writeValue(client, REQUEST_TYPES_CONFIG_KEY, municipality.id, plan.types);
        changed += 1;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  console.log(`${changed} de ${municipalities.length} município(s) ${apply ? "alterado(s)" : "seriam alterados"}.`);
}

main()
  .catch((error) => { console.error("Falhou:", error.message); process.exitCode = 1; })
  .finally(() => pool.end());
