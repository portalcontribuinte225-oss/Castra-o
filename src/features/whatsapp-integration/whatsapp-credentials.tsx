import React from "react";
import { WHATSAPP_TOKEN_VARIABLE_PREFIX } from "../../../shared/server-credential-contract.js";
import { Button } from "../../components/button";
import { IntegrationCard, integrationActionFieldStyle, integrationFieldsStyle } from "../../components/integration-card";
import { ServerSecretField } from "../../components/server-secret-field";
import { CompactChoiceField, ConfigActiveToggle, ConfigField } from "../../components/ui";
import type { useWhatsappCredentials } from "./use-whatsapp-credentials";

type Credentials = ReturnType<typeof useWhatsappCredentials>;

// A variable can never be named like this (they all start with the prefix), so the chip is safe to tell apart.
const NO_TOKEN_VARIABLE = "Nenhuma";

export function WhatsappCredentials({ municipalityId, credentials }: { municipalityId: string; credentials: Credentials }) {
  const {
    settings, setSettings, ready, loadFailed, retry, saving, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, changed,
    savedTokenVariable, save, toggleActive, sendTest,
  } = credentials;
  if (municipalityId && !ready) {
    return (
      <IntegrationCard title="Credenciais">
        {loadFailed ? (
          <div role="alert">
            <p className="form-error">Não foi possível carregar as credenciais do WhatsApp.</p>
            <Button variant="outline" onClick={retry}>Carregar novamente</Button>
          </div>
        ) : <p role="status">Carregando configuração do WhatsApp...</p>}
      </IntegrationCard>
    );
  }
  const locked = !ready || saving;
  const patch = (changes: Record<string, unknown>) => {
    if (!locked) setSettings((current) => ({ ...current, ...changes }));
  };
  const variables: string[] = Array.isArray(settings.tokenVariables) ? settings.tokenVariables : [];
  return (
    <IntegrationCard title="Credenciais" actions={<ConfigActiveToggle checked={Boolean(settings.active)} onChange={toggleActive} disabled={locked} />}>
      <div className={integrationFieldsStyle}>
        <ConfigField
          label="ID da conta do WhatsApp Business (WABA)"
          value={settings.wabaId || ""}
          placeholder="WhatsApp Business Account ID da Meta"
          autoComplete="off"
          disabled={locked}
          onChange={(value) => patch({ wabaId: value })}
        />
        <ConfigField
          label="ID do número remetente"
          value={settings.phoneNumberId || ""}
          placeholder="Phone Number ID da Meta"
          autoComplete="off"
          disabled={locked}
          onChange={(value) => patch({ phoneNumberId: value })}
        />
      </div>
      <CompactChoiceField
        label="Variável do token"
        value={settings.tokenVariable || NO_TOKEN_VARIABLE}
        options={[NO_TOKEN_VARIABLE, ...variables]}
        onChange={(choice: string) => patch({ tokenVariable: choice === NO_TOKEN_VARIABLE ? "" : choice })}
      />
      {!variables.length && (
        <p className="whatsapp-note">Nenhuma variável <code>{WHATSAPP_TOKEN_VARIABLE_PREFIX}…</code> no servidor. Crie uma no Render para escolher aqui.</p>
      )}
      {savedTokenVariable && (
        <ServerSecretField label="Token de acesso" variable={savedTokenVariable} preview={settings.tokenPreview || ""} issue={settings.tokenIssue || null} />
      )}
      <Button className="tw:justify-self-start" onClick={save} disabled={locked || !changed}>Salvar credenciais</Button>
      {saveStatus && <span className={saveStatus.includes("sucesso") ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}

      <div className="whatsapp-section-heading"><span>Teste de envio</span></div>
      <div className={integrationActionFieldStyle}>
        <ConfigField label="Número" value={testPhone} placeholder="(00) 00000-0000" onChange={setTestPhone} disabled={!ready} />
        <Button onClick={sendTest} disabled={testing || locked || !hasCredentials}>
          {testing ? "Enviando..." : "Enviar teste"}
        </Button>
      </div>
      {testStatus && <p className={testStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{testStatus}</p>}
    </IntegrationCard>
  );
}
