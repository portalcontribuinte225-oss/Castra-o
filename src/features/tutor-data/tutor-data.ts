import { formatCep, formatPhone, onlyDigits } from "../../utils";

// What the server answers for the tutor of a request (the CPF identifies the account and is never edited).
export interface TutorData {
  // Null while the tutor has no account (a request registered by the staff): the data is the one of the request and there is no password.
  id: string | null;
  hasAccess: boolean;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
}

// What the staff edits. An empty password keeps the current one.
export interface TutorForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  password: string;
}

export const MIN_TUTOR_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function formFromTutor(tutor: TutorData): TutorForm {
  return {
    name: tutor.name || "", email: tutor.email || "", phone: formatPhone(tutor.phone || ""), address: tutor.address || "",
    neighborhood: tutor.neighborhood || "", city: tutor.city || "", state: tutor.state || "", cep: formatCep(tutor.cep || ""), password: "",
  };
}

// The same rules the server applies, so the staff sees the problem before saving.
export function tutorFormIssues(form: TutorForm): Partial<Record<keyof TutorForm, string>> {
  const issues: Partial<Record<keyof TutorForm, string>> = {};
  if (form.name.trim().length < 2) issues.name = "Informe o nome do tutor.";
  if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) issues.email = "Informe um e-mail válido.";
  const phone = onlyDigits(form.phone);
  if (phone && !/^[1-9]\d{9,10}$/.test(phone)) issues.phone = "Informe um telefone válido com DDD.";
  const cep = onlyDigits(form.cep);
  if (cep && cep.length !== 8) issues.cep = "Informe um CEP com 8 dígitos.";
  if (form.state.trim() && !/^[A-Za-z]{2}$/.test(form.state.trim())) issues.state = "Informe a UF com duas letras.";
  if (form.password && Array.from(form.password).length < MIN_TUTOR_PASSWORD_LENGTH) issues.password = `A senha deve ter pelo menos ${MIN_TUTOR_PASSWORD_LENGTH} caracteres.`;
  return issues;
}

// Whether the form differs from what is saved (a typed password always counts as a change).
export function hasTutorChanges(tutor: TutorData, form: TutorForm): boolean {
  const saved = formFromTutor(tutor);
  return form.password !== "" || (Object.keys(saved) as Array<keyof TutorForm>).some((key) => key !== "password" && form[key].trim() !== saved[key].trim());
}

// The body of the request: digits only for the contacts and the CEP, the UF in capitals.
export function tutorPayload(form: TutorForm): Record<string, string> {
  return {
    name: form.name.trim(), email: form.email.trim(), phone: onlyDigits(form.phone), address: form.address.trim(),
    neighborhood: form.neighborhood.trim(), city: form.city.trim(), state: form.state.trim().toUpperCase(), cep: onlyDigits(form.cep),
    ...(form.password ? { password: form.password } : {}),
  };
}
