/**
 * Localiza solicitações sem municipality_id ou com request_type ANIMAL_OBITO
 * e opcionalmente as vincula ao município Criciúma.
 * Usage: node --experimental-vm-modules backend/src/scripts/findOrphanRequests.js
 */
import { pool } from "../db/index.js";

async function run() {
  const client = await pool.connect();
  try {
    // Busca Criciúma
    const { rows: munRows } = await client.query(
      "SELECT id, name FROM municipalities WHERE lower(name) LIKE '%criciuma%' OR lower(name) LIKE '%criciúma%' LIMIT 1",
    );
    const municipality = munRows[0];
    if (municipality) console.log(`Município: ${municipality.name} (${municipality.id})`);

    // Solicitações sem municipality_id (órfãs)
    const { rows: orphans } = await client.query(
      `SELECT id, protocol, request_type, status, tags, created_at
       FROM requests WHERE municipality_id IS NULL ORDER BY created_at DESC LIMIT 20`,
    );
    console.log(`\n=== Solicitações sem municipality_id (${orphans.length}) ===`);
    orphans.forEach((r) => console.log(`  ${r.protocol} | ${r.request_type} | ${r.status} | tags: ${JSON.stringify(r.tags)} | ${r.created_at}`));

    // Solicitações de óbito (ANIMAL_OBITO)
    const { rows: obitos } = await client.query(
      `SELECT id, protocol, request_type, status, tags, municipality_id, created_at
       FROM requests WHERE request_type = 'ANIMAL_OBITO' ORDER BY created_at DESC LIMIT 10`,
    );
    console.log(`\n=== Solicitações de óbito ANIMAL_OBITO (${obitos.length}) ===`);
    obitos.forEach((r) => console.log(`  ${r.protocol} | ${r.status} | mun: ${r.municipality_id} | ${r.created_at}`));

    // Corrige órfãs vinculando ao município
    if (orphans.length > 0 && municipality) {
      await client.query(
        "UPDATE requests SET municipality_id = $1 WHERE municipality_id IS NULL",
        [municipality.id],
      );
      console.log(`\n✓ ${orphans.length} solicitação(ões) vinculada(s) ao município ${municipality.name}.`);
    } else if (orphans.length === 0) {
      console.log("\nNenhuma solicitação órfã encontrada.");
    }
  } catch (err) {
    console.error("Erro:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
