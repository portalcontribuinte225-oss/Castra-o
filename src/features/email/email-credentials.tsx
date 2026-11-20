import React from "react";
import { IntegrationCard, integrationFieldsStyle } from "../../components/integration-card";
import { SavedSecretField } from "../../components/saved-secret-field";
import { ConfigField } from "../../components/ui";
import type { EmailAccountView } from "./email-integration-types";
import type { useEmailAccount } from "./use-email-account";

type AccountState = ReturnType<typeof useEmailAccount>;

// The platform account of the master: it is one for every municipality, so it never depends on a selected one.
export function EmailCredentials({ account, state }: { account: EmailAccountView | null; state: AccountState }) {
  const { form, edit, status, statusOk, saving, changed, fieldsChanged, confirmingRemoval, setConfirmingRemoval, save, removeKey } = state;
  // A saved key stays inside its field (start visible, rest masked); saving and removing never show together.
  const keySaved = Boolean(account?.hasPrivateKey) && !form.privateKey;
  return (
    <IntegrationCard title="Credenciais">
      <div className={integrationFieldsStyle}>
        <ConfigField label="ID do serviço (Service ID)" value={form.serviceId} placeholder="service_xxxxxxx" autoComplete="off" onChange={(value) => edit({ serviceId: value })} />
        <ConfigField label="Chave pública (Public Key)" value={form.publicKey} placeholder="Chave pública da conta" autoComplete="off" onChange={(value) => edit({ publicKey: value })} />
      </div>
      <ConfigField label="Endereço público do sistema" value={form.publicUrl} placeholder="https://seu-sistema.exemplo.com.br" autoComplete="off" onChange={(value) => edit({ publicUrl: value })} />
      <p className="whatsapp-note">Usado para o brasão e o logo do órgão aparecerem nos e-mails.</p>
      <SavedSecretField
        label="Chave privada (Private Key)"
        placeholder="Cole a chave privada do EmailJS"
        saved={keySaved}
        preview={account?.privateKeyPreview || ""}
        value={form.privateKey}
        onChange={(value) => edit({ privateKey: value })}
        showSave={!keySaved || fieldsChanged}
        saveLabel="Salvar credenciais"
        onSave={save}
        saveDisabled={saving || !changed}
        removeLabel="Remover chave"
        removeNote="Remover a chave privada? O EmailJS pode recusar os envios sem ela."
        confirming={confirmingRemoval}
        onConfirmingChange={setConfirmingRemoval}
        onRemove={removeKey}
        removeDisabled={saving}
      />
      <p className="whatsapp-note">Requer “Allow EmailJS API for non-browser applications” ligado no EmailJS (Account &gt; Security).</p>
      {status && <span className={statusOk ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{status}</span>}
    </IntegrationCard>
  );
}
