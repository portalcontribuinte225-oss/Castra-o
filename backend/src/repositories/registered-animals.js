import { authError } from "../services/auth/auth-security.js";
import { normalizeAnimalData, animalFingerprint, validUuid } from "../services/registered-animals/animal-data.js";

// Compatibility adapter for the existing pg schema. All identity lookups retain municipal predicates.
export async function findOwnedAnimal(client, { id, userId, municipalityId, lock = false, internal = false }) {
  if (!validUuid(id)) throw authError(400, "Identificador do animal inválido.");
  const { rows } = await client.query(`SELECT a.* FROM animals a WHERE a.id = $1
    AND EXISTS (SELECT 1 FROM animal_records r WHERE r.animal_id = a.id AND r.municipality_id = $2)
    ${internal ? "" : "AND EXISTS (SELECT 1 FROM animal_tutors t JOIN users u ON u.id = t.user_id WHERE t.animal_id = a.id AND t.user_id = $3 AND t.active = TRUE AND u.municipality_id = $2)"}
    ${lock ? "FOR UPDATE OF a" : ""}`, internal ? [id, municipalityId] : [id, municipalityId, userId]);
  if (!rows[0]) throw authError(404, "Animal indisponível para esta conta e município.");
  return rows[0];
}

export async function insertCanonicalAnimal(client, { data, request, index, tutorId, municipalityId, sourceFingerprint }) {
  const normalized = normalizeAnimalData(data);
  const identificationTypeId = data.identificationTypeId || request.workflow_data?.identificationTypeId || "animal_com_tutor";
  const metadata = { registration: normalized, declaredMicrochip: normalized.declaredMicrochip,
    identificationTypes: { [municipalityId]: identificationTypeId },
    source: { requestId: request.id, animalIndex: index, fingerprint: sourceFingerprint || animalFingerprint(data) } };
  const { rows } = await client.query(`INSERT INTO animals (microchip,name,species,sex,size,breed,color,birth_date,metadata)
    VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
  [normalized.name || null, normalized.species || null, normalized.sex || null, normalized.size || null,
    normalized.breedDescription || null, normalized.coat || null, normalized.birthDate || null, JSON.stringify(metadata)]);
  const animal = rows[0];
  if (tutorId) await client.query(`INSERT INTO animal_tutors
    (animal_id,user_id,tutor_name,tutor_email,cpf,phone,address,neighborhood,city,state,cep)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [animal.id, tutorId, request.tutor_name, request.tutor_email,
    request.cpf, request.phone, request.address, request.neighborhood, request.city, request.state, request.cep]);
  return animal;
}

export async function recordAnimalRequest(client, { animalId, request, municipalityId, index, actorId }) {
  await client.query(`INSERT INTO animal_records (animal_id,request_id,municipality_id,record_type,title,data,created_by)
    SELECT $1,$2,$3,'SOLICITACAO_PROCEDIMENTO','Solicitação de procedimento aberta',$4::jsonb,$5
    WHERE NOT EXISTS (SELECT 1 FROM animal_records WHERE animal_id=$1 AND request_id=$2 AND record_type='SOLICITACAO_PROCEDIMENTO')`,
  [animalId, request.id, municipalityId, JSON.stringify({ protocol: request.protocol, sourceAnimalIndex: index }), actorId || null]);
}

export async function sourceRequest(client, { requestId, userId, municipalityId, lock = false }) {
  if (!validUuid(requestId)) throw authError(400, "Referência de solicitação inválida.");
  const { rows } = await client.query(`SELECT * FROM requests WHERE id=$1 AND tutor_id=$2 AND municipality_id=$3 ${lock ? "FOR UPDATE" : ""}`,
    [requestId, userId, municipalityId]);
  if (!rows[0]) throw authError(404, "Origem indisponível para esta conta.");
  return rows[0];
}

export async function sourceCanonicalIds(client, request, index) {
  const { rows } = await client.query(`SELECT a.id,r.data->>'sourceAnimalIndex' AS source_index,
    a.metadata->'source'->>'animalIndex' AS metadata_index FROM animal_records r JOIN animals a ON a.id=r.animal_id
    WHERE r.request_id=$1 AND r.municipality_id=$2`, [request.id, request.municipality_id]);
  const known = [request.animals[index]?.id, ...(index === 0 && request.animal_id ? [request.animal_id] : [])].filter(Boolean);
  const matched = rows.filter((row) => request.animals.length === 1 || row.source_index === String(index) || row.metadata_index === String(index));
  if (!known.length && !matched.length && rows.some((row) => row.source_index == null && row.metadata_index == null)) {
    throw authError(409, "O vínculo anterior deste animal precisa de conferência no atendimento.");
  }
  return [...new Set([...known, ...matched.map((row) => row.id)])];
}

export async function saveRequestAnimalIds(client, request, snapshots) {
  const primary = snapshots[0];
  await client.query(`UPDATE requests SET animals=$1::jsonb, animal_id=$2, animal_name=$3, species=$4, size=$5,
    animal_microchip=$6, updated_at=NOW() WHERE id=$7 AND municipality_id=$8`,
  [JSON.stringify(snapshots), primary?.id || null, primary?.name || null, primary?.species || null, primary?.size || null,
    primary?.confirmedMicrochip || null, request.id, request.municipality_id]);
  Object.assign(request, { animals: snapshots, animal_id: primary?.id || null, animal_name: primary?.name || null,
    species: primary?.species || null, size: primary?.size || null, animal_microchip: primary?.confirmedMicrochip || null });
}

export async function trustedTutorSnapshot(client, user, municipalityId) {
  const { rows } = await client.query(`SELECT u.name,p.cpf,p.email,p.phone FROM tutor_profiles p JOIN users u ON u.id=p.user_id
    WHERE p.user_id=$1 AND p.municipality_id=$2 AND u.role='tutor'`, [user.id, municipalityId]);
  if (!rows[0]) throw authError(403, "Perfil de tutor indisponível.");
  const { rows: addresses } = await client.query(`SELECT address,neighborhood,city,state,cep FROM requests
    WHERE tutor_id=$1 AND municipality_id=$2 ORDER BY created_at DESC LIMIT 1`, [user.id, municipalityId]);
  return { tutor: rows[0].name, name: rows[0].name, cpf: rows[0].cpf, email: rows[0].email || "", phone: rows[0].phone || "",
    address: addresses[0]?.address || "", neighborhood: addresses[0]?.neighborhood || "", city: addresses[0]?.city || "", state: addresses[0]?.state || "", cep: addresses[0]?.cep || "", number: "" };
}

export async function listOwnedAnimals(client, { userId, municipalityId, query = "", cursor = "", limit = 25 }) {
  const { rows } = await client.query(`SELECT a.* FROM animals a WHERE a.id::text > $3 AND EXISTS
    (SELECT 1 FROM animal_tutors t JOIN users u ON u.id=t.user_id WHERE t.animal_id=a.id AND t.user_id=$1 AND t.active=TRUE AND u.municipality_id=$2)
    AND EXISTS (SELECT 1 FROM animal_records r WHERE r.animal_id=a.id AND r.municipality_id=$2)
    AND ($4='' OR strpos(lower(COALESCE(a.name,'')),lower($4))>0 OR strpos(lower(COALESCE(a.microchip,'')),lower($4))>0
      OR strpos(lower(COALESCE(a.metadata->>'declaredMicrochip','')),lower($4))>0)
    ORDER BY a.id LIMIT $5`, [userId, municipalityId, cursor, query, limit + 1]);
  return { rows: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
}

export async function listSourceCandidates(client, { userId, municipalityId, query = "", limit = 25 }) {
  const { rows } = await client.query(`SELECT r.id,r.animals,elem.item,elem.ordinality-1 AS animal_index
    FROM requests r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.animals,'[]'::jsonb)) WITH ORDINALITY elem(item,ordinality)
    WHERE r.tutor_id=$1 AND r.municipality_id=$2 AND COALESCE(elem.item->>'id','')=''
      AND COALESCE(r.request_type,'PROCEDIMENTO') NOT IN ('DENUNCIA','ANIMAL_OBITO','TROCA_TUTOR')
      AND ($3='' OR strpos(lower(COALESCE(elem.item->>'name','')),lower($3))>0 OR strpos(lower(COALESCE(elem.item->>'microchip','')),lower($3))>0)
    ORDER BY r.created_at DESC,r.id,elem.ordinality LIMIT $4`, [userId, municipalityId, query, limit]);
  return rows.map((row) => ({ sourceRequestId: row.id, animalIndex: Number(row.animal_index), fingerprint: animalFingerprint(row.item),
    name: row.item.name || "", species: row.item.species || "", declaredMicrochip: row.item.microchip || "" }));
}
