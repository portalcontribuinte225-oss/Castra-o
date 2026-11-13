import { isInternalUser } from "../../tenant.js";
import { AnimalStatus } from "../../../../shared/animal-contract.js";
import { RequestKind, RequestStatus } from "../../../../shared/request-contract.js";
import { authError } from "../auth/auth-security.js";
import { findOwnedAnimal } from "../../repositories/registered-animals.js";
import { normalizeChip } from "./animal-data.js";
import { isValidCpf, normalizeCpf } from "../../utils.js";
import { AUDIT_ACTIONS } from "../audit.js";

async function auditAnimal(client, { animalId, request, user, action }) {
  await client.query(`INSERT INTO audit_logs (user_id,municipality_id,action,entity_type,entity_id,changes)
    VALUES ($1,$2,$3,'animal',$4,$5::jsonb)`, [user.id, request.municipality_id, action, animalId, JSON.stringify({ requestId: request.id })]);
}

export async function confirmAnimalMicrochip(client, { animal, microchip, municipalityId, user, requestId = null }) {
  if (!isInternalUser(user)) throw authError(403, "Conferência restrita à equipe de atendimento.");
  const chip = normalizeChip(microchip);
  if (chip.length < 4 || chip.length > 32) throw authError(400, "Microchip deve ter entre 4 e 32 caracteres.");
  if (animal.microchip && animal.microchip !== chip) throw authError(409, "O microchip confirmado precisa de correção pelo atendimento.");
  if (animal.microchip === chip) return animal;
  const collision = await client.query("SELECT id FROM animals WHERE microchip=$1 AND id<>$2", [chip, animal.id]);
  if (collision.rows.length) throw authError(409, "Microchip indisponível. A identificação precisa de conferência no atendimento.");
  const metadata = { ...(animal.metadata || {}), microchipConfirmedAt: new Date().toISOString(), microchipConfirmedBy: user.id };
  let rows;
  try {
    ({ rows } = await client.query("UPDATE animals SET microchip=$2,metadata=$3::jsonb,updated_at=NOW() WHERE id=$1 RETURNING *", [animal.id, chip, JSON.stringify(metadata)]));
  } catch (error) {
    if (error.code === "23505") throw authError(409, "Microchip indisponível. A identificação precisa de conferência no atendimento.");
    throw error;
  }
  await client.query(`INSERT INTO animal_records (animal_id,request_id,municipality_id,record_type,title,data,created_by)
    VALUES ($1,$2,$3,'MICROCHIP_CONFIRMADO','Microchip conferido pela equipe',$4::jsonb,$5)`, [animal.id, requestId, municipalityId, JSON.stringify({ microchip: chip }), user.id]);
  await auditAnimal(client, { animalId: animal.id, request: { id: requestId, municipality_id: municipalityId }, user, action: AUDIT_ACTIONS.ANIMAL_MICROCHIP_CONFIRMED });
  return rows[0];
}

async function transferAnimal(client, { animal, request, user }) {
  const municipalityId = request.municipality_id;
  const { rows: applied } = await client.query(`SELECT 1 FROM animal_records
    WHERE animal_id=$1 AND request_id=$2 AND municipality_id=$3 AND record_type='TROCA_TUTOR_EFETIVADA'`, [animal.id, request.id, municipalityId]);
  if (applied.length) return;
  const targetCpf = normalizeCpf(request.target_tutor_cpf);
  if (!isValidCpf(targetCpf)) throw authError(400, "Informe um CPF válido para o novo tutor.");
  const { rows: ambiguous } = await client.query(`SELECT t.id FROM animal_tutors t WHERE t.animal_id=$1 AND t.active=TRUE
    AND t.user_id IS NULL AND NOT EXISTS (SELECT 1 FROM animal_records r
      WHERE r.animal_id=t.animal_id AND r.data->>'tutorRelationshipId'=t.id::text) FOR UPDATE OF t`, [animal.id]);
  if (ambiguous.length) throw authError(409, "O vínculo anterior precisa de conferência no atendimento antes da transferência.");
  const { rows: relationships } = await client.query(`SELECT t.id FROM animal_tutors t LEFT JOIN users u ON u.id=t.user_id
    WHERE t.animal_id=$1 AND t.active=TRUE AND (u.municipality_id=$2 OR
      (t.user_id IS NULL AND EXISTS (SELECT 1 FROM animal_records r WHERE r.animal_id=t.animal_id AND r.municipality_id=$2
        AND r.data->>'tutorRelationshipId'=t.id::text))) FOR UPDATE OF t`, [animal.id, municipalityId]);
  const { rows: target } = await client.query(`SELECT u.id,u.name,p.email,p.phone,p.cpf FROM tutor_profiles p JOIN users u ON u.id=p.user_id
    WHERE p.municipality_id=$1 AND p.cpf=$2 AND u.role='tutor' AND u.active=TRUE`, [municipalityId, targetCpf]);
  if (relationships.length) await client.query("UPDATE animal_tutors SET active=FALSE,ended_at=NOW() WHERE id=ANY($1::uuid[]) AND animal_id=$2", [relationships.map((row) => row.id), animal.id]);
  const owner = target[0];
  const { rows: added } = await client.query(`INSERT INTO animal_tutors
    (animal_id,user_id,tutor_name,tutor_email,cpf,phone,address,neighborhood,city,state,cep)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [animal.id, owner?.id || null,
    owner?.name || request.target_tutor_name, owner?.email || request.target_tutor_email, targetCpf,
    owner?.phone || request.target_tutor_phone, request.target_tutor_address, request.target_tutor_neighborhood,
    request.target_tutor_city, request.target_tutor_state, request.target_tutor_cep]);
  await client.query(`INSERT INTO animal_records (animal_id,request_id,municipality_id,record_type,title,data,created_by)
    SELECT $1,$2,$3,'TROCA_TUTOR_EFETIVADA','Troca de tutor efetivada',$4::jsonb,$5
    WHERE NOT EXISTS (SELECT 1 FROM animal_records WHERE animal_id=$1 AND request_id=$2 AND record_type='TROCA_TUTOR_EFETIVADA')`,
  [animal.id, request.id, municipalityId, JSON.stringify({ tutorRelationshipId: added[0].id }), user.id]);
  await auditAnimal(client, { animalId: animal.id, request, user, action: AUDIT_ACTIONS.ANIMAL_TUTOR_TRANSFER });
}

export async function applyAnimalRequestTransition(client, { previous, request, user }) {
  if (request.status !== RequestStatus.COMPLETED || previous.status === RequestStatus.COMPLETED) return;
  if (request.request_type === RequestKind.COMPLAINT) return;
  if (!isInternalUser(user)) throw authError(403, "Operação restrita à equipe de atendimento.");
  const ids = [...new Set([request.animal_id, ...(Array.isArray(request.animals) ? request.animals.map((animal) => animal?.id) : [])].filter(Boolean))].sort();
  for (const id of ids) {
    let animal = await findOwnedAnimal(client, { id, municipalityId: request.municipality_id, internal: true, lock: true });
    if (request.request_type === RequestKind.DEATH) {
      if (animal.status === AnimalStatus.DECEASED) continue;
      await client.query("UPDATE animals SET status=$2,updated_at=NOW() WHERE id=$1", [id, AnimalStatus.DECEASED]);
      await auditAnimal(client, { animalId: id, request, user, action: AUDIT_ACTIONS.ANIMAL_DEATH_CONFIRMED });
    } else if (request.request_type === RequestKind.TRANSFER) {
      if (!request.target_tutor_cpf || !request.target_tutor_name) throw authError(400, "Dados do novo tutor obrigatórios.");
      await transferAnimal(client, { animal, request, user });
    } else {
      if (animal.status === AnimalStatus.DECEASED) throw authError(409, "Animal em óbito não pode receber procedimento.");
      const data = request.animals?.find((item) => item.id === id);
      const chip = (id === request.animal_id ? request.workflow_data?.attendanceMicrochip : "") || data?.confirmedMicrochip;
      if (chip) animal = await confirmAnimalMicrochip(client, { animal, microchip: chip, municipalityId: request.municipality_id, user, requestId: request.id });
      await client.query(`INSERT INTO animal_records (animal_id,request_id,municipality_id,record_type,title,notes,data,created_by)
        SELECT $1,$2,$3,'CIRURGIA_REALIZADA','Atendimento realizado',$4,$5::jsonb,$6
        WHERE NOT EXISTS (SELECT 1 FROM animal_records WHERE animal_id=$1 AND request_id=$2 AND record_type='CIRURGIA_REALIZADA')`,
      [id, request.id, request.municipality_id, request.workflow_data?.attendanceNote || null,
        JSON.stringify({ performedProcedures: request.workflow_data?.performedProcedures || "" }), user.id]);
    }
  }
}
