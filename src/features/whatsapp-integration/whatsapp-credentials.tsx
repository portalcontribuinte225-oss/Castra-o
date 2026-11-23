import { WHATSAPP_TOKEN_VARIABLE_PREFIX } from "../../../shared/server-credential-contract.js";
import { Button } from "../../components/button";
import { IntegrationCard, integrationActionFieldStyle, integrationFieldsStyle } from "../../components/integration-card";
import { ConfigField, ConfigSelectField } from "../../components/ui";
import type { useWhatsappCredentials } from "./use-whatsapp-credentials";

type Credentials = ReturnType<typeof useWhatsappCredentials>;

// The keys to choose from, by name only. "Nenhuma" takes the channel out of use, and a chosen key the server no longer holds stays
// listed, so the choice is still visible (the badge then says it is not integrated).
function keyOptions(variables: string[], chosen: string) {
  const names = chosen && !variables.includes(chosen) ? [...variables, chosen] : variables;
  return [{ value: "", label: "Nenhuma" }, ...names.map((name) => ({ value: name, label: name }))];
}

export function WhatsappCredentials({ municipalityId, credentials }: { municipalityId: string; credentials: Credentials }) {
  const {
    settings, setSettings, ready, loadFailed, retry, saving, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, changed, save, sendTest,
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
  const chosen = String(settings.tokenVariable || "");
  return (
    <IntegrationCard title="Credenciais">
      <div className={integrationActionFieldStyle}>
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
          <ConfigSelectField label="Key do token" value={chosen} options={keyOptions(variables, chosen)} disabled={locked} onChange={(value) => patch({ tokenVariable: value })} />
        </div>
        <Button onClick={save} disabled={locked || !changed}>Salvar</Button>
      </div>
      {saveStatus && <span className={saveStatus.includes("sucesso") ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}
      {!variables.length && (
        <p className="whatsapp-note">Nenhuma variável <code>{WHATSAPP_TOKEN_VARIABLE_PREFIX}…</code> no servidor. Crie uma no Render para escolher aqui.</p>
      )}

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
