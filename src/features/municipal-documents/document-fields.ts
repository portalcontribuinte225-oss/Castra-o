import type { AnyRecord } from "../../types";
import { formatCep, formatCpf, formatPhone, normalizeText, onlyDigits } from "../../utils";

// How the documents of the municipality write the data of a request: the tutor and the animals.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const UNKNOWN_TUTOR = "Tutor não informado";

// A number is written with its mask only when it has all its digits; anything else stays as it was typed.
function masked(value: unknown, format: (input: string) => string, lengths: number[]): string {
  const text = String(value ?? "");
  return lengths.includes(onlyDigits(text).length) ? format(text) : text;
}

export const documentCpf = (value: unknown) => masked(value, formatCpf, [11]);
export const documentPhone = (value: unknown) => masked(value, formatPhone, [10, 11]);
export const documentCep = (value: unknown) => masked(value, formatCep, [8]);

// The tutor of a normalized request, or nothing when the request has no name for them.
export function requestTutorName(request: AnyRecord): string {
  const name = String(request.tutor || "").trim();
  return name === UNKNOWN_TUTOR ? "" : name;
}

// The answers of the form are "Sim" and "Não"; anything else is written as it came.
export function yesNoAnswer(value: unknown): string {
  const normalized = normalizeText(String(value ?? ""));
  if (value === true || normalized === "sim") return "Sim";
  if (value === false || normalized === "nao") return "Não";
  return String(value ?? "").trim();
}

// "12.4" → "12,4 kg"; a weight already written with its unit stays as it is.
export function animalWeightLabel(weight: unknown): string {
  const text = String(weight ?? "").trim();
  return /^\d+(?:[.,]\d+)?$/.test(text) ? `${text.replace(".", ",")} kg` : text;
}

export function animalBreedLabel(animal: AnyRecord): string {
  if (animal.breedDescription || animal.breed) return String(animal.breedDescription || animal.breed);
  return normalizeText(String(animal.breedType || "")) === "indefinida" ? "SRD" : String(animal.breedType || "");
}

// The code of the microchip when it is known, or whether the animal has one.
export function animalMicrochipLabel(animal: AnyRecord): string {
  return String(animal.confirmedMicrochip || animal.microchip || animal.declaredMicrochip || "") || yesNoAnswer(animal.hasChip);
}

function birthDate(value: unknown): { year: number; month: number; day: number } | null {
  const text = String(value ?? "").trim();
  const iso = ISO_DATE.exec(text);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const br = BR_DATE.exec(text);
  return br ? { year: Number(br[3]), month: Number(br[2]), day: Number(br[1]) } : null;
}

// The age on the given day, from the birth date of the animal ("3 anos", "8 meses"); without it, the age the tutor wrote.
export function animalAgeLabel(animal: AnyRecord, on: Date = new Date()): string {
  const born = birthDate(animal.birthDate);
  const written = String(animal.age || "").trim();
  if (!born) return written;
  const months = (on.getFullYear() - born.year) * 12 + (on.getMonth() + 1 - born.month) - (on.getDate() < born.day ? 1 : 0);
  if (months < 0) return written;
  if (months < 12) return months === 0 ? "Menos de 1 mês" : months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano" : `${years} anos`;
}
