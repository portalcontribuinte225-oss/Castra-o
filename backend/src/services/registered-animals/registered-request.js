import { isInternalUser } from "../../tenant.js";
import { isProcedureRequest as isProcedureKind } from "../../../../shared/request-contract.js";
import { AnimalStatus } from "../../../../shared/animal-contract.js";
import { authError } from "../auth/auth-security.js";
import { findOwnedAnimal, insertCanonicalAnimal, recordAnimalRequest, saveRequestAnimalIds, trustedTutorSnapshot } from "../../repositories/registered-animals.js";
import { animalView, requireLiveAnimal, registrationGap } from "./animal-data.js";

export function isProcedureRequest(body) {
  return isProcedureKind(body.request_type || body.requestType || body.requestTypeId || body.type);
}

export function identificationForAnimal(animal, settings, municipalityId) {
  const id = animalView(animal, municipalityId).identificationTypeId;
  const type = settings.identificationTypes.find((item) => item && item.id === id && item.active !== false
    && (!item.municipalityId || item.municipalityId === municipalityId));
  if (!type) throw authError(409, "O tipo de identificação deste animal precisa ser conferido pelo atendimento.");
  return type;
}

export async function prepareRegisteredRequest(client, { body, user, municipalityId, settings }) {
  const requestedIds = [...new Set([body.animal_id, body.animalId, ...(Array.isArray(body.animals) ? body.animals.map((item) => item?.id) : [])].filter(Boolean))];
  if (!requestedIds.length || !isProcedureRequest(body)) return body;
  if (!user) return body;
  if (isInternalUser(user)) {
    const resolved = new Map();
    for (const id of [...requestedIds].sort()) {
      const animal = await findOwnedAnimal(client, { id, municipalityId, internal: true, lock: true });
      requireLiveAnimal(animal); resolved.set(id, animalView(animal, municipalityId));
    }
    return { ...body, animals: (body.animals || [{ id: requestedIds[0] }]).map((animal) => animal.id ? resolved.get(animal.id) : animal) };
  }
  if (user.role !== "tutor") return body;
  if (requestedIds.length !== 1 || (Array.isArray(body.animals) && body.animals.length !== 1)) throw authError(400, "Escolha um animal cadastrado por solicitação.");
  const animal = await findOwnedAnimal(client, { id: requestedIds[0], userId: user.id, municipalityId, lock: true });
  requireLiveAnimal(animal);
  const gap = registrationGap(animal, municipalityId);
  if (gap) throw authError(409, gap);
  const identification = identificationForAnimal(animal, settings, municipalityId);
  const tutor = await trustedTutorSnapshot(client, user, municipalityId);
  return { ...body, tutor_name: tutor.name, tutorName: tutor.name, tutor: tutor.name, cpf: tutor.cpf,
    tutor_email: tutor.email, email: tutor.email, phone: tutor.phone, address: tutor.address, neighborhood: tutor.neighborhood,
    city: tutor.city, state: tutor.state, cep: tutor.cep,
    animal_id: animal.id, animalId: animal.id, animal_microchip: animal.microchip || null,
    animal_name: animal.name, species: animal.species, size: animal.size,
    animals: [animalView(animal, municipalityId)],
    workflow_data: { ...(body.workflow_data || body.workflowData || {}), identificationTypeId: identification.id } };
}

export async function registerRequestAnimals(client, { body, request, user, tutorId, municipalityId }) {
  if (!isProcedureRequest(body)) return request;
  const input = Array.isArray(body.animals) ? body.animals : [];
  if (!input.length || input.length > 25) throw authError(400, "Informe de 1 a 25 animais por solicitação.");
  const snapshots = [];
  const existingIds = input.map((animal) => animal?.id).filter(Boolean);
  if (new Set(existingIds).size !== existingIds.length) throw authError(400, "O mesmo animal foi informado mais de uma vez.");
  for (const [index, data] of input.entries()) {
    let animal;
    if (data.id) {
      animal = await findOwnedAnimal(client, { id: data.id, userId: user?.id, municipalityId, lock: true, internal: isInternalUser(user) });
      if (animal.status === AnimalStatus.DECEASED) throw authError(409, "Animal em óbito não pode receber nova solicitação.");
    } else {
      animal = await insertCanonicalAnimal(client, { data: { ...data, identificationTypeId: data.identificationTypeId || request.workflow_data?.identificationTypeId },
        request, index, tutorId, municipalityId });
    }
    snapshots.push(animalView(animal, municipalityId));
    await recordAnimalRequest(client, { animalId: animal.id, request, municipalityId, index, actorId: user?.id });
  }
  await saveRequestAnimalIds(client, request, snapshots);
  return request;
}
