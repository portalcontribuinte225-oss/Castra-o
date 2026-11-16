// One-off load of the default breeds into the municipalities that already exist (new ones get them when they are created).
//
//   node backend/scripts/seed-default-breeds.js           shows what would change, writes nothing
//   node backend/scripts/seed-default-breeds.js --apply   writes it
//
// A municipality that already has breeds is left alone. In the others it adds the default breeds and links them to the
// request types that link none. It runs against the database in DATABASE_URL, so check the target it prints first.
import { pool } from "../src/db/index.js";
import { BREEDS_CONFIG_KEY, SPECIES_CONFIG_KEY, planBreedSeed } from "../src/services/breed-defaults.js";
import { REQUEST_TYPES_CONFIG_KEY } from "../src/services/request-type-defaults.js";
import { describeTarget, readValue, writeValue } from "./config-store.js";

const apply = process.argv.includes("--apply");

async function main() {
  console.log(`Banco: ${describeTarget()}`);
  console.log(apply ? "Modo: GRAVAR" : "Modo: simulação (nada é gravado; use --apply para gravar)");
  const { rows: municipalities } = await pool.query("SELECT id, name FROM municipalities ORDER BY name");
  let changed = 0;
  for (const municipality of municipalities) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const species = await readValue(client, SPECIES_CONFIG_KEY, municipality.id);
      const breeds = await readValue(client, BREEDS_CONFIG_KEY, municipality.id);
      const requestTypes = await readValue(client, REQUEST_TYPES_CONFIG_KEY, municipality.id);
      const plan = planBreedSeed({ species, breeds, requestTypes });
      if (plan.skip) {
        console.log(`- ${municipality.name}: ignorado, ${plan.skip}`);
      } else {
        const linked = Array.isArray(plan.requestTypes) ? plan.requestTypes.filter((type, index) => type !== requestTypes[index]).length : 0;
        console.log(`- ${municipality.name}: ${plan.breeds.length} raças e ${linked} tipo(s) de solicitação ligados${apply ? "" : " (simulação)"}`);
        if (apply) {
          await writeValue(client, BREEDS_CONFIG_KEY, municipality.id, plan.breeds);
          if (linked) await writeValue(client, REQUEST_TYPES_CONFIG_KEY, municipality.id, plan.requestTypes);
        }
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
