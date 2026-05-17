import { pool } from "../db/index.js";
import { runMigrations } from "../db/migrations.js";

async function reboot() {
  await runMigrations();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM animal_records");
    await client.query("DELETE FROM requests");
    await client.query("DELETE FROM request_validation_keys");
    await client.query("DELETE FROM request_protocol_counters");
    await client.query("DELETE FROM animal_tutors");
    await client.query("DELETE FROM adoptions");
    await client.query("DELETE FROM animals");
    await client.query("DELETE FROM access_requests");
    await client.query("DELETE FROM schedule_days");
    await client.query("DELETE FROM config");
    await client.query("DELETE FROM user_sectors");
    await client.query("DELETE FROM sectors");
    await client.query(`
      DELETE FROM users
      WHERE municipality_id IS NOT NULL
         OR lower(role) NOT IN ('master', 'suporte')
    `);
    await client.query("DELETE FROM municipalities");

    await client.query("COMMIT");
    console.log("Reboot concluido: municipios, configuracoes, agendas e processos atuais foram removidos.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Falha no reboot:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

reboot();
