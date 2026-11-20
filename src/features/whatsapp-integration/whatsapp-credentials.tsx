import React from "react";
import { Button } from "../../components/button";
import { IntegrationCard, integrationActionFieldStyle, integrationFieldsStyle } from "../../components/integration-card";
import { SavedSecretField } from "../../components/saved-secret-field";
import { ConfigActiveToggle, ConfigField } from "../../components/ui";
import type { useWhatsappCredentials } from "./use-whatsapp-credentials";

type Credentials = ReturnType<typeof useWhatsappCredentials>;

export function WhatsappCredentials({ municipalityId, credentials }: { municipalityId: string; credentials: Credentials }) {
  const {
    settings, setSettings, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, idsChanged,
    confirmingRemoval, setConfirmingRemoval, save, toggleActive, removeToken, sendTest,
  } = credentials;
  const patch = (changes: Record<string, unknown>) => setSettings((current) => ({ ...current, ...changes }));
  // A saved token stays inside its field (start visible, rest masked); saving and removing never show together.
  const tokenSaved = Boolean(settings.hasAccessToken) && !settings.accessToken;
  const showSave = !tokenSaved || idsChanged;
  return (
    <IntegrationCard title="Credenciais" actions={<ConfigActiveToggle checked={Boolean(settings.active)} onChange={toggleActive} />}>
      <div className={integrationFieldsStyle}>
        <label className="field">
          <span>Provedor</span>
          <select value={settings.provider || "cloud_api"} onChange={(event) => patch({ provider: event.target.value })}>
            <option value="cloud_api">WhatsApp Cloud API</option>
          </select>
        </label>
        <ConfigField
          label="ID da conta do WhatsApp Business (WABA)"
          value={settings.wabaId || ""}
          placeholder="WhatsApp Business Account ID da Meta"
          autoComplete="off"
          onChange={(value) => patch({ wabaId: value })}
        />
      </div>
      <ConfigField
        label="ID do número remetente"
        value={settings.phoneNumberId || ""}
        placeholder="Phone Number ID da Meta"
        autoComplete="off"
        onChange={(value) => patch({ phoneNumberId: value })}
      />
      <SavedSecretField
        label="Token de acesso"
        placeholder="Cole o token da Cloud API"
        saved={tokenSaved}
        preview={settings.tokenPreview || ""}
        value={settings.accessToken || ""}
        onChange={(value) => patch({ accessToken: value })}
        showSave={showSave}
        saveLabel="Salvar credenciais"
        onSave={save}
        saveDisabled={!municipalityId}
        removeLabel="Remover token"
        removeNote="Remover o token? O WhatsApp será desativado."
        confirming={confirmingRemoval}
        onConfirmingChange={setConfirmingRemoval}
        onRemove={removeToken}
        removeDisabled={!municipalityId}
      />
      {saveStatus && <span className={saveStatus.includes("sucesso") ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}

      <div className="whatsapp-section-heading"><span>Teste de envio</span></div>
      <div className={integrationActionFieldStyle}>
        <ConfigField label="Número" value={testPhone} placeholder="(00) 00000-0000" onChange={setTestPhone} />
        <Button onClick={sendTest} disabled={testing || !municipalityId || !hasCredentials}>
          {testing ? "Enviando..." : "Enviar teste"}
        </Button>
      </div>
      {testStatus && <p className={testStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{testStatus}</p>}
    </IntegrationCard>
  );
}
