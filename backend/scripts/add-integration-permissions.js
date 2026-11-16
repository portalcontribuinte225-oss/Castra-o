// One-off load of the SMS and e-mail permissions into the default permission group ("Acesso total") of the municipalities that already
// exist (new ones get them when they are created), so their manager sees those tabs.
//
//   node backend/scripts/add-integration-permissions.js                          shows what would change, writes nothing
//   node backend/scripts/add-integration-permissions.js --apply                  writes it (local database only)
//   node backend/scripts/add-integration-permissions.js --apply --confirm-host=<host>   writes it in a database that is not local
//
// Only the default group is changed, and only by adding what it lacks. It runs against the database in DATABASE_URL, so check the target
// it prints first.
import { pool } from "../src/db/index.js";
import { planIntegrationPermissions } from "../src/services/integration-permission-defaults.js";
import { describeTarget, readValue, writeValue } from "./config-store.js";

const PERMISSION_GROUPS_CONFIG_KEY = "permission_groups";
const apply = process.argv.includes("--apply");
const confirmedHost = process.argv.find((argument) => argument.startsWith("--confirm-host="))?.slice("--confirm-host=".length);

function targetHost() {
  try { return new URL(process.env.DATABASE_URL).hostname; } catch { return ""; }
}

async function main() {
  console.log(`Banco: ${describeTarget()}`);
  console.log(apply ? "Modo: GRAVAR" : "Modo: simulação (nada é gravado; use --apply para gravar)");
  const host = targetHost();
  if (apply && host !== "localhost" && confirmedHost !== host) {
    throw new Error("O banco não é local. Para gravar nele, repita o comando com --apply --confirm-host=<host do banco>.");
  }
  const { rows: municipalities } = await pool.query("SELECT id, name FROM municipalities ORDER BY name");
  let changed = 0;
  for (const municipality of municipalities) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const plan = planIntegrationPermissions(await readValue(client, PERMISSION_GROUPS_CONFIG_KEY, municipality.id));
      if (plan.skip) {
        console.log(`- ${municipality.name}: ignorado, ${plan.skip}`);
      } else {
        console.log(`- ${municipality.name}: ${plan.added.join(", ")} no grupo Acesso total${apply ? "" : " (simulação)"}`);
        if (apply) await writeValue(client, PERMISSION_GROUPS_CONFIG_KEY, municipality.id, plan.groups);
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
