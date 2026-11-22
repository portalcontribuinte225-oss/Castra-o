import React from "react";
import { ServerCredential } from "../../../shared/server-credential-contract.js";
import { IntegrationCard, integrationFieldsStyle } from "../../components/integration-card";
import { ServerSecretField, credentialIssueText } from "../../components/server-secret-field";
import { ConfigField } from "../../components/ui";
import type { EmailAccountView } from "./email-integration-types";

// The platform account of the master: it is one for every municipality and lives in the server's variables, so here it is only read.
export function EmailCredentials({ account, actions }: { account: EmailAccountView; actions?: React.ReactNode }) {
  const issueOf = (variable: string) => account.issues.find((item) => item.variable === variable)?.problem ?? null;
  const otherIssues = account.issues.filter((item) => item.variable !== ServerCredential.EMAILJS_PRIVATE_KEY);
  return (
    <IntegrationCard title="Credenciais" actions={actions}>
      <div className={integrationFieldsStyle}>
        <ConfigField label="ID do serviço (Service ID)" value={account.serviceId} placeholder="Não configurado" readOnly />
        <ConfigField label="Chave pública (Public Key)" value={account.publicKey} placeholder="Não configurado" readOnly />
      </div>
      <ConfigField label="Endereço público do sistema" value={account.publicUrl} placeholder="Não configurado" readOnly />
      <p className="whatsapp-note">Usado para o brasão e o logo do órgão aparecerem nos e-mails.</p>
      <ServerSecretField
        label="Chave privada (Private Key)"
        variable={ServerCredential.EMAILJS_PRIVATE_KEY}
        preview={account.privateKeyPreview}
        issue={issueOf(ServerCredential.EMAILJS_PRIVATE_KEY)}
      />
      {otherIssues.map((item) => <p key={item.variable} className="form-error">{credentialIssueText(item.variable, item.problem)}</p>)}
      <p className="whatsapp-note">
        A conta é trocada nas variáveis do servidor (Render): <code>{ServerCredential.EMAILJS_SERVICE_ID}</code>, <code>{ServerCredential.EMAILJS_PUBLIC_KEY}</code>,{" "}
        <code>{ServerCredential.EMAILJS_PRIVATE_KEY}</code> e <code>{ServerCredential.APP_PUBLIC_URL}</code>.
      </p>
      <p className="whatsapp-note">Requer “Allow EmailJS API for non-browser applications” e “Use Private Key” ligados no EmailJS (Account &gt; Security).</p>
    </IntegrationCard>
  );
}
