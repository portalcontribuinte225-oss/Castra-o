import { EmailBrasaoStatus } from "../../../shared/email-contract.js";
import { EMAIL_IDENTITY_VARIABLES, EmailVariable } from "../../../shared/email-uses-contract.js";
import { loadMunicipalityIdentity } from "../repositories/municipality-identity.js";
import { loadEmailAccount } from "./email-account.js";

const MAX_NAME_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 300;
const emptyIdentity = Object.freeze(Object.fromEntries(EMAIL_IDENTITY_VARIABLES.map((name) => [name, ""])));

const text = (value, max) => String(value ?? "").trim().slice(0, max);

export function brasaoStatus(identity, publicUrl) {
  if (!identity?.has_brasao) return EmailBrasaoStatus.MISSING;
  return publicUrl ? EmailBrasaoStatus.READY : EmailBrasaoStatus.NO_PUBLIC_URL;
}

// The link carries the last update, so a changed brasão is not served from a stale cache.
export function brasaoUrl(identity, publicUrl) {
  if (!identity?.has_brasao || !publicUrl) return "";
  const version = new Date(identity.updated_at).getTime();
  return `${publicUrl}/api/public/municipalities/${identity.id}/brasao${Number.isFinite(version) ? `?v=${version}` : ""}`;
}

// The identity is cosmetic: when it cannot be read the message still goes, just without it.
export async function loadEmailIdentityParams(municipalityId, { database } = {}) {
  if (!municipalityId) return { ...emptyIdentity };
  try {
    const [identity, account] = await Promise.all([loadMunicipalityIdentity(municipalityId, database), loadEmailAccount(database)]);
    if (!identity) return { ...emptyIdentity };
    return {
      [EmailVariable.MUNICIPALITY_NAME]: text(identity.name, MAX_NAME_LENGTH),
      [EmailVariable.MUNICIPALITY_BRASAO_URL]: brasaoUrl(identity, account.publicUrl),
      [EmailVariable.DEPARTMENT_NAME]: text(identity.department_name, MAX_NAME_LENGTH),
      [EmailVariable.MUNICIPALITY_CONTACT]: text(identity.contact, MAX_NAME_LENGTH),
      [EmailVariable.MUNICIPALITY_EMAIL]: text(identity.email, MAX_NAME_LENGTH),
      [EmailVariable.MUNICIPALITY_ADDRESS]: text(identity.address, MAX_ADDRESS_LENGTH),
    };
  } catch {
    return { ...emptyIdentity };
  }
}

// What the municipal screen shows under "Identificação nos e-mails".
export async function loadEmailIdentitySummary(municipalityId, publicUrl, { database } = {}) {
  const identity = await loadMunicipalityIdentity(municipalityId, database);
  if (!identity) return null;
  return { name: text(identity.name, MAX_NAME_LENGTH), departmentName: text(identity.department_name, MAX_NAME_LENGTH), brasao: brasaoStatus(identity, publicUrl) };
}
