import { MOBILE_PHONE_MESSAGE, isMobilePhone } from "../../../shared/phone-contract.js";
import { formatCep, formatCpf, formatPhone, isValidCpf, onlyDigits } from "../../utils";

// The request's tutor or its own contact details when no tutor is identified.
export interface TutorData {
  // Null while the tutor has no account (a request registered by the staff): the data is the one of the request and there is no password.
  id: string | null;
  hasAccess: boolean;
  contactOnly?: boolean;
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
  cpf: string;
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
    name: tutor.name || "", cpf: formatCpf(tutor.cpf || ""), email: tutor.email || "", phone: formatPhone(tutor.phone || ""), address: tutor.address || "",
    neighborhood: tutor.neighborhood || "", city: tutor.city || "", state: tutor.state || "", cep: formatCep(tutor.cep || ""), password: "",
  };
}

// The same rules the server applies, so the staff sees the problem before saving.
export function tutorFormIssues(form: TutorForm, contactOnly = false): Partial<Record<keyof TutorForm, string>> {
  const issues: Partial<Record<keyof TutorForm, string>> = {};
  const name = form.name.trim();
  if ((!contactOnly || name) && name.length < 2) issues.name = "Informe o nome do tutor.";
  if (contactOnly && form.cpf.trim() && !isValidCpf(form.cpf)) issues.cpf = "Informe um CPF válido.";
  if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) issues.email = "Informe um e-mail válido.";
  if ((!contactOnly || form.phone.trim()) && !isMobilePhone(form.phone)) issues.phone = MOBILE_PHONE_MESSAGE;
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
export function tutorPayload(form: TutorForm, contactOnly = false): Record<string, string> {
  return {
    name: form.name.trim(), email: form.email.trim(), phone: onlyDigits(form.phone), address: form.address.trim(),
    neighborhood: form.neighborhood.trim(), city: form.city.trim(), state: form.state.trim().toUpperCase(), cep: onlyDigits(form.cep),
    ...(contactOnly ? { cpf: onlyDigits(form.cpf) } : {}),
    ...(form.password ? { password: form.password } : {}),
  };
}
