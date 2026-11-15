import React from "react";
import { ConfigActiveToggle, Field } from "../../components/ui";
import { WhatsappVariablesList } from "./whatsapp-variables-list";
import type { useWhatsappCredentials } from "./use-whatsapp-credentials";

type Credentials = ReturnType<typeof useWhatsappCredentials>;

export function WhatsappCredentials({ municipalityId, credentials }: { municipalityId: string; credentials: Credentials }) {
  const { settings, setSettings, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, save, sendTest } = credentials;
  const patch = (changes: Record<string, unknown>) => setSettings((current) => ({ ...current, ...changes }));
  return (
    <section className="whatsapp-section">
      <div className="whatsapp-section-header">
        <span className="whatsapp-section-label">Credenciais</span>
        <ConfigActiveToggle checked={Boolean(settings.active)} onChange={(checked) => patch({ active: checked })} />
      </div>
      <div className="whatsapp-fields-row">
        <label className="field">
          <span>Provedor</span>
          <select value={settings.provider || "cloud_api"} onChange={(event) => patch({ provider: event.target.value })}>
            <option value="cloud_api">WhatsApp Cloud API</option>
          </select>
        </label>
        <Field
          label="ID da conta do WhatsApp Business (WABA)"
          value={settings.wabaId || ""}
          placeholder="WhatsApp Business Account ID da Meta"
          onChange={(value) => patch({ wabaId: value })}
        />
      </div>
      <div className="whatsapp-fields-row">
        <Field
          label="ID do número remetente"
          value={settings.phoneNumberId || ""}
          placeholder="Phone Number ID da Meta"
          onChange={(value) => patch({ phoneNumberId: value })}
        />
      </div>
      <label className="field">
        <span>Token de acesso</span>
        <input
          value={settings.accessToken || ""}
          type="password"
          placeholder={settings.hasAccessToken ? "Token já salvo" : "Cole o token da Cloud API"}
          onChange={(event) => patch({ accessToken: event.target.value })}
        />
      </label>
      <div className="whatsapp-save-row">
        <button className="primary-action" type="button" onClick={save} disabled={!municipalityId}>Salvar credenciais</button>
        {saveStatus && <span className={saveStatus.includes("sucesso") ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}
      </div>

      <div className="whatsapp-section-heading"><span>Teste de envio</span></div>
      <div className="whatsapp-test-row">
        <Field label="Número" value={testPhone} placeholder="(00) 00000-0000" onChange={setTestPhone} />
        <button className="primary-action" type="button" onClick={sendTest} disabled={testing || !municipalityId || !hasCredentials}>
          {testing ? "Enviando..." : "Enviar teste"}
        </button>
        <WhatsappVariablesList />
      </div>
      {testStatus && <p className={testStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{testStatus}</p>}
    </section>
  );
}
