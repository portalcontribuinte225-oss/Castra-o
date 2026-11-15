import { isValidCpf, onlyDigits } from "../../utils";
import type { AnimalDeathPayload, AnimalSummary, AnimalTransferPayload } from "./animal-service-types";

export const emptyDeathForm = (): AnimalDeathPayload => ({ death_date: "", death_cause: "", notes: "" });

export const emptyTransferForm = (): AnimalTransferPayload => ({
  target_tutor_name: "", target_tutor_cpf: "", target_tutor_phone: "", target_tutor_email: "", target_tutor_cep: "",
  target_tutor_address: "", target_tutor_neighborhood: "", target_tutor_city: "", target_tutor_state: "", notes: "",
});

export function validateDeathForm(form: AnimalDeathPayload): string {
  return form.death_date && form.death_cause.trim() ? "" : "Informe data e causa do óbito.";
}

export function validateTransferForm(form: AnimalTransferPayload): string {
  return form.target_tutor_name.trim() && isValidCpf(form.target_tutor_cpf) ? "" : "Informe nome e CPF válido do novo tutor.";
}

export function buildDeathPayload(form: AnimalDeathPayload): AnimalDeathPayload {
  return { ...form, death_cause: form.death_cause.trim() };
}

export function buildTransferPayload(form: AnimalTransferPayload): AnimalTransferPayload {
  return { ...form, target_tutor_name: form.target_tutor_name.trim(), target_tutor_cpf: onlyDigits(form.target_tutor_cpf) };
}

export function describeAnimal(animal: AnimalSummary): string {
  const microchip = animal.confirmedMicrochip || animal.declaredMicrochip || animal.microchip;
  return [animal.name || "Animal sem nome", microchip].filter(Boolean).join(" · ");
}
