import { documentError } from "../services/documents/document-content.js";

export async function listDocumentSources(client, { userId, municipalityId, documentIds }) {
  const { rows } = await client.query(
    `SELECT r.id, r.tutor_id, r.municipality_id, r.created_at, r.request_type, r.animals, r.animal_id,
      (d.ordinality - 1)::int AS document_index,
      (d.document - 'dataUrl' - 'data_url' - 'previewUrl' - 'preview_url' - 'url' - 'content') AS document
     FROM requests r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.documents, '[]'::jsonb))
       WITH ORDINALITY AS d(document, ordinality)
     WHERE r.tutor_id = $1 AND r.municipality_id = $2 AND d.document->>'documentId' = ANY($3::text[])
     ORDER BY r.created_at DESC, r.id, d.ordinality LIMIT 80`, [userId, municipalityId, documentIds],
  );
  return rows;
}

export async function readDocumentSource(client, { userId, municipalityId, sourceRequestId, attachmentId, lock = false }) {
  const match = /^legacy-(\d+)-[a-f0-9]{64}$/.exec(attachmentId || "");
  const index = match ? Number(match[1]) : null;
  if (typeof sourceRequestId !== "string" || typeof attachmentId !== "string" || attachmentId.length > 120
    || (index !== null && (!Number.isSafeInteger(index) || index > 100))) throw documentError("Referência de documento inválida.");
  const { rows } = await client.query(
    `SELECT r.id, r.tutor_id, r.municipality_id, r.created_at, r.request_type, r.animals, r.animal_id,
      (d.ordinality - 1)::int AS document_index, d.document
     FROM requests r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.documents, '[]'::jsonb))
       WITH ORDINALITY AS d(document, ordinality)
     WHERE r.id::text = $1 AND r.tutor_id = $2 AND r.municipality_id = $3
       AND ((d.document->>'attachmentId') = $4 OR (d.ordinality - 1) = $5::int)
     ${lock ? "FOR SHARE OF r" : ""}`, [sourceRequestId, userId, municipalityId, attachmentId, index],
  );
  if (rows.length !== 1) throw documentError("Documento indisponível para este acesso.", 404);
  return rows[0];
}
