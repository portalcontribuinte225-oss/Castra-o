// One-off: turns "Animal sem Tutor" on in the municipalities that already exist (new ones start with it on).
//
//   node backend/scripts/activate-default-identification-types.js           shows what would change, writes nothing
//   node backend/scripts/activate-default-identification-types.js --apply   writes it
//
// It runs against the database in DATABASE_URL, so check the target it prints first.
import { pool } from "../src/db/index.js";
import { IDENTIFICATION_TYPES_CONFIG_KEY, planDefaultIdentificationTypes } from "../src/services/identification-type-defaults.js";
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
      const plan = planDefaultIdentificationTypes(await readValue(client, IDENTIFICATION_TYPES_CONFIG_KEY, municipality.id));
      if (plan.skip) {
        console.log(`- ${municipality.name}: ignorado, ${plan.skip}`);
      } else {
        console.log(`- ${municipality.name}: Animal sem Tutor ativado${apply ? "" : " (simulação)"}`);
        if (apply) await writeValue(client, IDENTIFICATION_TYPES_CONFIG_KEY, municipality.id, plan.types);
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
