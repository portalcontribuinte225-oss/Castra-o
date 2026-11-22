import { CredentialIssue } from "../../../shared/server-credential-contract.js";

const reported = new Set();

// One warning per variable and problem for the life of the process. It names the variable and never shows its value.
function report(variable, issue) {
  const key = `${variable}:${issue}`;
  if (reported.has(key)) return;
  reported.add(key);
  console.warn(`[credenciais] ${variable} ${issue === CredentialIssue.MISSING ? "não está definida" : "está em formato inválido"} nas variáveis do servidor.`);
}

// Reads one integration secret from the environment at every use, so a change in Render applies on the next restart.
// A missing or malformed value comes back empty, with the reason.
export function readServerCredential(variable, isValid, env = process.env) {
  const value = String(env?.[variable] ?? "").trim();
  const issue = !value ? CredentialIssue.MISSING : isValid(value) ? null : CredentialIssue.INVALID;
  if (issue) report(variable, issue);
  return issue ? { value: "", issue } : { value, issue: null };
}
