import { createHash } from "node:crypto";
import { AnimalStatus, MicrochipStatus } from "../../../../shared/animal-contract.js";
import { authError } from "../auth/auth-security.js";

export const ANIMAL_FIELDS = ["name", "species", "sex", "size", "breedType", "breedDescription", "coat", "birthDate", "age", "weight",
  "dewormed", "vaccinated", "illnessHistory", "food"];
export const validUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const normalizeChip = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export function normalizeAnimalData(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw authError(400, "Dados do animal inválidos.");
  const data = Object.fromEntries(ANIMAL_FIELDS.map((key) => [key, typeof input[key] === "string" ? input[key].trim().slice(0, key === "illnessHistory" ? 2000 : 300) : ""]));
  data.breedDescription ||= typeof input.breed === "string" ? input.breed.trim().slice(0, 300) : "";
  data.coat ||= typeof input.color === "string" ? input.color.trim().slice(0, 300) : "";
  data.birthDate ||= typeof input.birth_date === "string" ? input.birth_date.trim().slice(0, 30) : "";
  const declaredMicrochip = normalizeChip(input.declaredMicrochip || input.microchip);
  if (declaredMicrochip && (declaredMicrochip.length < 4 || declaredMicrochip.length > 32)) throw authError(400, "Microchip deve ter entre 4 e 32 caracteres.");
  return { ...data, declaredMicrochip };
}

// Materializing the same source changes its id, never its source identity fingerprint.
export function animalFingerprint(input) {
  const data = normalizeAnimalData(input);
  return createHash("sha256").update(JSON.stringify({ ...data, identificationTypeId: input.identificationTypeId || "animal_com_tutor" })).digest("hex");
}

export function animalView(row, municipalityId) {
  const metadata = row.metadata || {};
  const registration = metadata.registration || {};
  const confirmed = row.microchip || "";
  const declared = metadata.declaredMicrochip || "";
  return {
    ...Object.fromEntries(ANIMAL_FIELDS.map((key) => [key, registration[key] || ""])),
    id: row.id, name: row.name || "", species: row.species || "", sex: row.sex || "", size: row.size || "",
    breed: row.breed || "", breedDescription: row.breed || registration.breedDescription || "",
    breedType: registration.breedType || "",
    coat: row.color || "", birthDate: row.birth_date || "", age: registration.age || "",
    confirmedMicrochip: confirmed, declaredMicrochip: declared, microchip: confirmed || declared,
    hasChip: confirmed || declared ? "Sim" : "Nao",
    microchipStatus: confirmed ? MicrochipStatus.CONFIRMED : declared ? MicrochipStatus.DECLARED : MicrochipStatus.ABSENT,
    identificationTypeId: metadata.identificationTypes?.[municipalityId] || "animal_com_tutor",
    status: row.status || AnimalStatus.ACTIVE,
  };
}

export function requireLiveAnimal(row) {
  if (!row || row.status === AnimalStatus.DECEASED) throw authError(409, "Este animal não está disponível para uma nova solicitação.");
}

export function registrationGap(row, municipalityId) {
  const animal = animalView(row, municipalityId);
  return ["species", "sex", "size", "breedType"].some((key) => !animal[key])
    ? "O cadastro do animal está incompleto. Procure o atendimento para conferência." : "";
}
