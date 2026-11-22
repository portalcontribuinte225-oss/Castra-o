import { secretPreview } from "../../../shared/secret-preview-contract.js";
import { CredentialIssue, WHATSAPP_TOKEN_VARIABLE_PATTERN } from "../../../shared/server-credential-contract.js";
import { readServerCredential } from "./server-credentials.js";

const ID_PATTERN = /^\d{5,30}$/;
const TOKEN_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,1000}$/;

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function pick(next, current) {
  return String(next === undefined ? current ?? "" : next).trim();
}

const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

// The token of the variable a municipality chose. Only names with the WhatsApp prefix are ever read, so neither the screen nor a
// value stored in the database can reach any other variable of the server.
export function readWhatsappToken(tokenVariable, env = process.env) {
  const variable = String(tokenVariable || "");
  if (!variable) return { token: "", issue: CredentialIssue.UNSET };
  if (!WHATSAPP_TOKEN_VARIABLE_PATTERN.test(variable)) return { token: "", issue: CredentialIssue.INVALID };
  const { value, issue } = readServerCredential(variable, (token) => TOKEN_PATTERN.test(token), env);
  return { token: value, issue };
}

// The WhatsApp tokens the server holds, by name only, for the master to choose from.
export function listWhatsappTokenVariables(env = process.env) {
  return Object.keys(env)
    .filter((name) => WHATSAPP_TOKEN_VARIABLE_PATTERN.test(name) && TOKEN_PATTERN.test(String(env[name] ?? "").trim()))
    .sort();
}

// Builds the stored value from a master save. Only known fields are kept, so removed settings disappear on the next save. Choosing
// no variable turns the channel off; turning it on needs a variable that holds a token.
export function prepareWhatsappCredentials(current = {}, input = {}, env = process.env) {
  const phoneNumberId = pick(input.phoneNumberId, current.phoneNumberId);
  const wabaId = pick(input.wabaId, current.wabaId);
  const tokenVariable = pick(input.tokenVariable, current.tokenVariable);
  if (phoneNumberId && !ID_PATTERN.test(phoneNumberId)) throw fail("O ID do número de telefone deve conter apenas dígitos.");
  if (wabaId && !ID_PATTERN.test(wabaId)) throw fail("O ID da conta do WhatsApp Business deve conter apenas dígitos.");
  const tokenIssue = readWhatsappToken(tokenVariable, env).issue;
  if (input.tokenVariable !== undefined && tokenVariable && tokenIssue) throw fail("Escolha uma das variáveis do WhatsApp cadastradas no servidor.");
  if (input.active === true && tokenIssue) throw fail("Escolha uma variável do token disponível no servidor antes de ativar o WhatsApp.");
  const active = Boolean(tokenVariable) && (input.active === undefined ? current.active === true : input.active === true);
  return { active, provider: "cloud_api", phoneNumberId, wabaId, tokenVariable };
}

// Visitors only learn whether the channel can send (the public follow-up form needs that); staff also see the identifiers and
// whether a token is there; only the master sees the variable names and how the token starts.
export function publicWhatsappConfig(value, { internal = false, master = false } = {}, env = process.env) {
  const source = asObject(value);
  const tokenVariable = String(source.tokenVariable || "");
  const { token, issue } = readWhatsappToken(tokenVariable, env);
  const active = source.active === true;
  if (!internal) return { active: active && Boolean(token) };
  const view = {
    active,
    provider: "cloud_api",
    phoneNumberId: String(source.phoneNumberId || ""),
    wabaId: String(source.wabaId || ""),
    hasAccessToken: Boolean(token),
  };
  if (!master) return view;
  return { ...view, tokenVariable, tokenVariables: listWhatsappTokenVariables(env), tokenPreview: secretPreview(token), tokenIssue: issue };
}
