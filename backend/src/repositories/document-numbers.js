import { documentNumberYear, formatDocumentNumber } from "../../../shared/document-number-contract.js";

// The next number of one document of one municipality, inside the caller's transaction: the counter row stays locked until the
// transaction ends, so two requests never receive the same number.
export async function nextDocumentNumber(client, { municipalityId, sequence, now = new Date() }) {
  if (!municipalityId) throw Object.assign(new Error("Vincule o processo a uma prefeitura antes de numerar o documento."), { status: 409 });
  const year = documentNumberYear(now);
  const { rows } = await client.query(
    `INSERT INTO document_counters (municipality_id, sequence, year, next_seq)
     VALUES ($1, $2, $3, 2)
     ON CONFLICT (municipality_id, sequence, year)
     DO UPDATE SET next_seq = document_counters.next_seq + 1
     RETURNING next_seq - 1 AS seq`,
    [municipalityId, sequence, year],
  );
  return formatDocumentNumber(rows[0].seq, year);
}
