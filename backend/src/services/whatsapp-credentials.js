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

// The municipality chose a key, so WhatsApp is in use there; without one the channel is simply not used.
export const usesWhatsapp = (config) => Boolean(String(config?.tokenVariable || ""));

// A runtime configuration that can send: the Cloud API, a token from the server and the sender's number id.
export const isWhatsappReady = (runtime) => runtime?.provider === "cloud_api" && Boolean(runtime.accessToken) && Boolean(runtime.phoneNumberId);

// Builds the stored value from a master save. Only known fields are kept, so removed settings disappear on the next save. The chosen
// key must be one the server holds; choosing none takes the channel out of use.
export function prepareWhatsappCredentials(current = {}, input = {}, env = process.env) {
  const phoneNumberId = pick(input.phoneNumberId, current.phoneNumberId);
  const wabaId = pick(input.wabaId, current.wabaId);
  const tokenVariable = pick(input.tokenVariable, current.tokenVariable);
  if (phoneNumberId && !ID_PATTERN.test(phoneNumberId)) throw fail("O ID do número de telefone deve conter apenas dígitos.");
  if (wabaId && !ID_PATTERN.test(wabaId)) throw fail("O ID da conta do WhatsApp Business deve conter apenas dígitos.");
  if (input.tokenVariable !== undefined && tokenVariable && readWhatsappToken(tokenVariable, env).issue) {
    throw fail("Escolha uma das variáveis do WhatsApp cadastradas no servidor.");
  }
  return { provider: "cloud_api", phoneNumberId, wabaId, tokenVariable };
}

// No part of a token ever leaves. Everyone learns whether the channel can send (the follow-up form needs that); staff also whether
// the chosen key is in the server; only the master sees the ids and the key names to choose from.
export function publicWhatsappConfig(value, { internal = false, master = false } = {}, env = process.env) {
  const source = asObject(value);
  const tokenVariable = String(source.tokenVariable || "");
  const phoneNumberId = String(source.phoneNumberId || "");
  const integrated = Boolean(readWhatsappToken(tokenVariable, env).token);
  const active = integrated && Boolean(phoneNumberId);
  if (!internal) return { active };
  if (!master) return { active, integrated };
  return { active, integrated, phoneNumberId, wabaId: String(source.wabaId || ""), tokenVariable, tokenVariables: listWhatsappTokenVariables(env) };
}
