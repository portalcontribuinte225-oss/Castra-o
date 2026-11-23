import { isInternalUser } from "../../tenant.js";
import { isProcedureRequest as isProcedureKind } from "../../../../shared/request-contract.js";
import { AnimalStatus } from "../../../../shared/animal-contract.js";
import { authError } from "../auth/auth-security.js";
import { findOwnedAnimal, insertCanonicalAnimal, recordAnimalRequest, saveRequestAnimalIds, trustedTutorSnapshot } from "../../repositories/registered-animals.js";
import { animalView, requireLiveAnimal, registrationGap } from "./animal-data.js";
import { animalRequestTypeIds } from "../../../../shared/request-types-contract.js";
import { isAnimalTutorship } from "../../../../shared/request-tutorship-contract.js";
import { resolveRequestProcedures } from "../../../../shared/request-procedure-contract.js";
import { storeResolvedProcedures } from "../procedure-actions/procedure-request-state.js";

// The procedures the client chose for an animal, kept when the registered animal replaces what the client sent about it.
const chosenProcedures = (animal) => animal && typeof animal === "object" && Object.hasOwn(animal, "requestTypeIds")
  ? { requestTypeIds: animal.requestTypeIds } : {};

export function isProcedureRequest(body) {
  return isProcedureKind(body.request_type || body.requestType || body.requestTypeId || body.type);
}

// The answer about the tutor the registered animal was made with: one of the two, or the registration needs the staff's review.
export function tutorshipForAnimal(animal) {
  const { tutorship } = animalView(animal);
  if (!isAnimalTutorship(tutorship)) throw authError(409, "A resposta sobre o tutor deste animal precisa ser conferida pelo atendimento.");
  return tutorship;
}

export async function prepareRegisteredRequest(client, { body, user, municipalityId }) {
  const requestedIds = [...new Set([body.animal_id, body.animalId, ...(Array.isArray(body.animals) ? body.animals.map((item) => item?.id) : [])].filter(Boolean))];
  if (!requestedIds.length || !isProcedureRequest(body)) return body;
  if (!user) return body;
  if (isInternalUser(user)) {
    const resolved = new Map();
    for (const id of [...requestedIds].sort()) {
      const animal = await findOwnedAnimal(client, { id, municipalityId, internal: true, lock: true });
      requireLiveAnimal(animal); resolved.set(id, animalView(animal));
    }
    return { ...body, animals: (body.animals || [{ id: requestedIds[0] }]).map((animal) => animal.id ? { ...resolved.get(animal.id), ...chosenProcedures(animal) } : animal) };
  }
  if (user.role !== "tutor") return body;
  if (requestedIds.length !== 1 || (Array.isArray(body.animals) && body.animals.length !== 1)) throw authError(400, "Escolha um animal cadastrado por solicitação.");
  const animal = await findOwnedAnimal(client, { id: requestedIds[0], userId: user.id, municipalityId, lock: true });
  requireLiveAnimal(animal);
  const gap = registrationGap(animal);
  if (gap) throw authError(409, gap);
  const tutorship = tutorshipForAnimal(animal);
  const tutor = await trustedTutorSnapshot(client, user, municipalityId);
  return { ...body, tutor_name: tutor.name, tutorName: tutor.name, tutor: tutor.name, cpf: tutor.cpf,
    tutor_email: tutor.email, email: tutor.email, phone: tutor.phone, address: tutor.address, neighborhood: tutor.neighborhood,
    city: tutor.city, state: tutor.state, cep: tutor.cep,
    animal_id: animal.id, animalId: animal.id, animal_microchip: animal.microchip || null,
    animal_name: animal.name, species: animal.species, size: animal.size,
    animals: [{ ...animalView(animal), ...chosenProcedures(Array.isArray(body.animals) ? body.animals[0] : null) }],
    workflow_data: { ...(body.workflow_data || body.workflowData || {}), tutorship } };
}

export async function registerRequestAnimals(client, { body, request, user, tutorId, municipalityId, requestTypes = [] }) {
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
      animal = await insertCanonicalAnimal(client, { data: { ...data, tutorship: data.tutorship || request.workflow_data?.tutorship },
        request, index, tutorId });
    }
    // The request keeps what was asked for this animal next to the animal itself.
    const requestTypeIds = animalRequestTypeIds(data);
    snapshots.push({ ...animalView(animal), ...(requestTypeIds.length ? { requestTypeIds } : {}) });
    await recordAnimalRequest(client, { animalId: animal.id, request, municipalityId, index, actorId: user?.id });
  }
  const animals = storeResolvedProcedures(resolveRequestProcedures({ ...request, animals: snapshots }, requestTypes));
  await saveRequestAnimalIds(client, request, animals);
  return request;
}
