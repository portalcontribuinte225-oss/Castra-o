/**
 * Script de migracao de status do banco de dados.
 *
 * Converte o modelo antigo de tres status + tags de controle de fluxo para o
 * novo modelo de quatro status semanticos:
 *
 *   EM_ANALISE              → NOVA
 *   AGUARDANDO_CIRURGIA     → AGENDADA
 *   ARQUIVADA + COMPARECEU  → REALIZADA
 *   ARQUIVADA (demais)      → CANCELADA
 *
 * Tags removidas (viraram status): DEFERIDA, INDEFERIDA, COMPARECEU, NAO_COMPARECEU, CANCELADA
 * Tags mantidas: REAGENDADA, ATRIBUIDA, PRIORIDADE, RETORNO_TUTOR, MUTIRAO, MICROCHIP, OBITO, TROCA_TUTOR
 *
 * Uso:
 *   node src/db/migrate_status.js
 */

import "../env.js";
import { pool } from "./index.js";

const REMOVED_TAGS = new Set(["DEFERIDA", "INDEFERIDA", "COMPARECEU", "NAO_COMPARECEU", "CANCELADA"]);

async function migrateStatus() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. EM_ANALISE → NOVA
    const { rowCount: novaCount } = await client.query(
      "UPDATE requests SET status = 'NOVA' WHERE status = 'EM_ANALISE'"
    );
    console.log(`[1/5] EM_ANALISE → NOVA: ${novaCount} registro(s) atualizado(s).`);

    // 2. AGUARDANDO_CIRURGIA → AGENDADA
    const { rowCount: agendadaCount } = await client.query(
      "UPDATE requests SET status = 'AGENDADA' WHERE status = 'AGUARDANDO_CIRURGIA'"
    );
    console.log(`[2/5] AGUARDANDO_CIRURGIA → AGENDADA: ${agendadaCount} registro(s) atualizado(s).`);

    // 3. ARQUIVADA + tag COMPARECEU → REALIZADA
    const { rowCount: realizadaCount } = await client.query(
      `UPDATE requests SET status = 'REALIZADA'
       WHERE status = 'ARQUIVADA'
         AND COALESCE(tags, '[]'::jsonb) ? 'COMPARECEU'`
    );
    console.log(`[3/5] ARQUIVADA+COMPARECEU → REALIZADA: ${realizadaCount} registro(s) atualizado(s).`);

    // 4. ARQUIVADA + tag INDEFERIDA ou NAO_COMPARECEU ou CANCELADA → CANCELADA
    const { rowCount: canceladaTagCount } = await client.query(
      `UPDATE requests SET status = 'CANCELADA'
       WHERE status = 'ARQUIVADA'
         AND (
           COALESCE(tags, '[]'::jsonb) ? 'INDEFERIDA'
           OR COALESCE(tags, '[]'::jsonb) ? 'NAO_COMPARECEU'
           OR COALESCE(tags, '[]'::jsonb) ? 'CANCELADA'
         )`
    );
    console.log(`[4/5] ARQUIVADA+INDEFERIDA/NAO_COMPARECEU/CANCELADA → CANCELADA: ${canceladaTagCount} registro(s) atualizado(s).`);

    // 5. ARQUIVADA restante (sem tags de controle reconhecidas) → CANCELADA
    const { rowCount: canceladaRestCount } = await client.query(
      "UPDATE requests SET status = 'CANCELADA' WHERE status = 'ARQUIVADA'"
    );
    console.log(`[5/5] ARQUIVADA (restante) → CANCELADA: ${canceladaRestCount} registro(s) atualizado(s).`);

    // 6. Limpar tags que viraram status
    const { rowCount: tagCleanCount } = await client.query(
      `UPDATE requests
       SET tags = (
         SELECT COALESCE(jsonb_agg(tag), '[]'::jsonb)
         FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS tag
         WHERE tag NOT IN ('DEFERIDA', 'INDEFERIDA', 'COMPARECEU', 'NAO_COMPARECEU', 'CANCELADA')
       )
       WHERE COALESCE(tags, '[]'::jsonb) ?| ARRAY['DEFERIDA','INDEFERIDA','COMPARECEU','NAO_COMPARECEU','CANCELADA']`
    );
    console.log(`[6/6] Tags obsoletas removidas em: ${tagCleanCount} registro(s).`);

    // 7. Atualizar o DEFAULT da coluna
    await client.query("ALTER TABLE requests ALTER COLUMN status SET DEFAULT 'NOVA'");
    console.log(`[7/7] DEFAULT da coluna status atualizado para 'NOVA'.`);

    // 8. Atualizar a constraint CHECK
    await client.query("ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check");
    await client.query(
      `ALTER TABLE requests
         ADD CONSTRAINT requests_status_check
         CHECK (status IN ('NOVA', 'AGENDADA', 'REALIZADA', 'CANCELADA'))`
    );
    console.log(`[8/8] Constraint CHECK atualizada para os novos status.`);

    await client.query("COMMIT");
    console.log("\nMigracao concluida com sucesso.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\nErro durante a migracao — rollback realizado:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateStatus();
