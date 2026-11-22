import { CredentialIssue } from "../../shared/server-credential-contract.js";
import { ConfigField } from "./ui";

const MASK = "•";
const PREVIEW_MASK_LENGTH = 24;

// Why the server holds no usable value, in the words the master needs to fix it in Render.
export function credentialIssueText(variable: string, issue: string) {
  return issue === CredentialIssue.MISSING
    ? `Falta ${variable} nas variáveis do servidor.`
    : `${variable} está em formato inválido nas variáveis do servidor.`;
}

interface ServerSecretFieldProps {
  label: string;
  // The environment variable that holds the secret.
  variable: string;
  // Only the start of the secret; empty when the server holds none.
  preview: string;
  issue: string | null;
}

// The one way every integration shows a secret held by the server: start visible and rest masked, or what to fix in Render.
// Secrets are changed in the server's variables only, never on a screen.
export function ServerSecretField({ label, variable, preview, issue }: ServerSecretFieldProps) {
  return (
    <>
      <ConfigField label={label} value={preview ? `${preview}${MASK.repeat(PREVIEW_MASK_LENGTH)}` : ""} placeholder="Não configurado" readOnly />
      {issue
        ? <p className="form-error">{credentialIssueText(variable, issue)}</p>
        : <p className="whatsapp-note">Vem da variável <code>{variable}</code> do servidor. Para trocar, altere no Render.</p>}
    </>
  );
}
