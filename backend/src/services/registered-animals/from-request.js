import { authError } from "../auth/auth-security.js";
import { animalFingerprint, animalView } from "./animal-data.js";
import { sourceRequest, sourceCanonicalIds, findOwnedAnimal, insertCanonicalAnimal, recordAnimalRequest } from "../../repositories/registered-animals.js";
import { isProcedureRequest } from "./registered-request.js";

// Caller holds the municipal lock before this source-row lock. Repeated references resolve the same UUID.
export async function materializeOwnRequestAnimal(client, { sourceRequestId, animalIndex, fingerprint, user, municipalityId }) {
  if (!Number.isInteger(animalIndex) || animalIndex < 0 || animalIndex > 1000 || !/^[a-f0-9]{64}$/.test(String(fingerprint || ""))) throw authError(400, "Referência de animal inválida.");
  const request = await sourceRequest(client, { requestId: sourceRequestId, userId: user.id, municipalityId, lock: true });
  if (!isProcedureRequest(request) || !Array.isArray(request.animals) || !request.animals[animalIndex]) throw authError(404, "Animal de origem indisponível.");
  const data = request.animals[animalIndex];
  if (animalFingerprint(data) !== fingerprint) throw authError(409, "Os dados de origem mudaram. Atualize a lista de animais.");
  const existingIds = await sourceCanonicalIds(client, request, animalIndex);
  if (existingIds.length > 1) throw authError(409, "O vínculo anterior deste animal precisa de conferência no atendimento.");
  let animal;
  if (existingIds.length) {
    // A former owner's request never grants a second ownership after transfer.
    animal = await findOwnedAnimal(client, { id: existingIds[0], userId: user.id, municipalityId, lock: true });
  } else {
    animal = await insertCanonicalAnimal(client, { data, request, index: animalIndex, tutorId: user.id, municipalityId, sourceFingerprint: fingerprint });
    await recordAnimalRequest(client, { animalId: animal.id, request, municipalityId, index: animalIndex, actorId: user.id });
  }
  const snapshots = [...request.animals]; snapshots[animalIndex] = { ...data, id: animal.id };
  // Preserve other unmaterialized positions exactly; the primary is updated only when it is resolved.
  await client.query(`UPDATE requests SET animals=$1::jsonb, animal_id=CASE WHEN $2=0 THEN $3 ELSE animal_id END,
    updated_at=NOW() WHERE id=$4 AND tutor_id=$5 AND municipality_id=$6`,
  [JSON.stringify(snapshots), animalIndex, animal.id, request.id, user.id, municipalityId]);
  return animalView(animal, municipalityId);
}
