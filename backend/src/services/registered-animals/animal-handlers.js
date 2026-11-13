import { authError } from "../auth/auth-security.js";
import { withAuthTransaction } from "../../repositories/auth-users.js";
import { loadRequestSettings } from "../../repositories/request-settings.js";
import { findOwnedAnimal, listOwnedAnimals, listSourceCandidates, trustedTutorSnapshot } from "../../repositories/registered-animals.js";
import { animalView, validUuid, requireLiveAnimal, registrationGap } from "./animal-data.js";
import { materializeOwnRequestAnimal } from "./from-request.js";
import { identificationForAnimal } from "./registered-request.js";
import { confirmAnimalMicrochip } from "./animal-transitions.js";
import { catalogReusableDocuments, readReusableDocument } from "../documents/document-catalog.js";
import { lockMunicipalSchedule } from "../schedule/schedule-lock.js";
import { isInternalUser, pickMunicipalityId } from "../../tenant.js";
import { AnimalStatus } from "../../../../shared/animal-contract.js";

function requireTutor(req) {
  if (req.user?.role !== "tutor") throw authError(403, "Acesso restrito ao tutor.");
  return { userId: req.user.id, municipalityId: req.user.municipalityId };
}

export async function mine(req, res) {
  const identity = requireTutor(req);
  const query = String(req.query.query || "").trim(); const cursor = String(req.query.cursor || "");
  if (query.length > 100 || (cursor && !validUuid(cursor))) throw authError(400, "Busca de animal inválida.");
  const result = await withAuthTransaction(async (client) => {
    const listing = await listOwnedAnimals(client, { ...identity, query, cursor });
    const candidates = cursor ? [] : await listSourceCandidates(client, { ...identity, query });
    return { animals: listing.rows.map((row) => animalView(row, identity.municipalityId)), candidates, nextCursor: listing.nextCursor };
  });
  res.set("Cache-Control", "no-store").json(result);
}

export async function fromRequest(req, res) {
  const identity = requireTutor(req);
  const animal = await withAuthTransaction(async (client) => {
    await lockMunicipalSchedule(client, identity.municipalityId);
    return materializeOwnRequestAnimal(client, { ...req.body, ...identity, user: req.user });
  });
  res.set("Cache-Control", "no-store").json({ animal });
}

export async function requestContext(req, res) {
  const identity = requireTutor(req);
  const result = await withAuthTransaction(async (client) => {
    const animal = await findOwnedAnimal(client, { id: req.params.id, ...identity });
    const settings = await loadRequestSettings(identity.municipalityId, client);
    const requestTypeId = String(req.query.requestTypeId || "");
    const selected = requestTypeId ? settings.requestTypes.find((type) => type?.id === requestTypeId && type.active !== false
      && (!type.municipalityId || type.municipalityId === identity.municipalityId)) : null;
    if (requestTypeId && !selected) throw authError(400, "Tipo de solicitação inválido.");
    let reason = animal.status === AnimalStatus.DECEASED ? "Animal em óbito não pode receber nova solicitação." : "";
    reason ||= registrationGap(animal, identity.municipalityId);
    try { identificationForAnimal(animal, settings, identity.municipalityId); } catch (error) { reason ||= error.message; }
    const tutor = await trustedTutorSnapshot(client, req.user, identity.municipalityId);
    const documents = selected && !reason ? await catalogReusableDocuments(client, { ...identity, animalId: animal.id, requestTypeId, settings }) : [];
    return { animal: animalView(animal, identity.municipalityId), tutor, requestTypes: settings.requestTypes,
      identificationTypes: settings.identificationTypes, documentTypes: settings.documentTypes || [],
      documents, eligibility: { canSubmit: !reason, reason } };
  });
  res.set("Cache-Control", "no-store").json(result);
}

export async function documentContent(req, res) {
  const identity = requireTutor(req);
  const content = await withAuthTransaction(async (client) => {
    const animal = await findOwnedAnimal(client, { id: req.params.id, ...identity });
    requireLiveAnimal(animal);
    const settings = await loadRequestSettings(identity.municipalityId, client);
    return readReusableDocument(client, { ...identity, animalId: req.params.id, sourceRequestId: req.params.sourceRequestId,
      attachmentId: req.params.attachmentId, hash: req.query.hash, settings });
  });
  const fileName = String(content.fileName || "documento").replace(/[\r\n"\\]/g, "_").slice(0, 150);
  res.set("Cache-Control", "no-store").set("X-Content-Type-Options", "nosniff")
    .set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    .type(content.contentType).send(content.bytes);
}

export async function confirmMicrochip(req, res) {
  if (!isInternalUser(req.user)) throw authError(403, "Conferência restrita à equipe de atendimento.");
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) throw authError(400, "Selecione um município.");
  const animal = await withAuthTransaction(async (client) => {
    await lockMunicipalSchedule(client, municipalityId);
    const row = await findOwnedAnimal(client, { id: req.params.id, municipalityId, internal: true, lock: true });
    return confirmAnimalMicrochip(client, { animal: row, microchip: req.body?.microchip, municipalityId, user: req.user });
  });
  res.set("Cache-Control", "no-store").json({ animal: animalView(animal, municipalityId) });
}

export function animalEndpoint(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    const status = error.code === "23505" ? 409 : error.status || 500;
    res.set("Cache-Control", "no-store").status(status).json({ error: error.status ? error.message
      : status === 409 ? "Identificação indisponível; procure o atendimento." : "Não foi possível concluir a operação do animal." });
  });
}
