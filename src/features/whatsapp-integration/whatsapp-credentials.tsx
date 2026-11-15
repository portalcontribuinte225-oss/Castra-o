import React from "react";
import { ConfigActiveToggle, Field } from "../../components/ui";
import type { useWhatsappCredentials } from "./use-whatsapp-credentials";

type Credentials = ReturnType<typeof useWhatsappCredentials>;

const MASK = "•";
const PREVIEW_MASK_LENGTH = 24;
const UNKNOWN_PREVIEW_MASK_LENGTH = 32;

export function WhatsappCredentials({ municipalityId, credentials }: { municipalityId: string; credentials: Credentials }) {
  const {
    settings, setSettings, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, idsChanged,
    confirmingRemoval, setConfirmingRemoval, save, toggleActive, removeToken, sendTest,
  } = credentials;
  const patch = (changes: Record<string, unknown>) => setSettings((current) => ({ ...current, ...changes }));
  // A saved token stays inside its field (start visible, rest masked); saving and removing never show together.
  const tokenSaved = Boolean(settings.hasAccessToken) && !settings.accessToken;
  const showSave = !tokenSaved || idsChanged;
  const maskedToken = settings.tokenPreview
    ? `${settings.tokenPreview}${MASK.repeat(PREVIEW_MASK_LENGTH)}`
    : MASK.repeat(UNKNOWN_PREVIEW_MASK_LENGTH);
  return (
    <section className="whatsapp-section">
      <div className="whatsapp-section-header">
        <span className="whatsapp-section-label">Credenciais</span>
        <ConfigActiveToggle checked={Boolean(settings.active)} onChange={toggleActive} />
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
          autoComplete="off"
          onChange={(value) => patch({ wabaId: value })}
        />
      </div>
      <div className="whatsapp-fields-row">
        <Field
          label="ID do número remetente"
          value={settings.phoneNumberId || ""}
          placeholder="Phone Number ID da Meta"
          autoComplete="off"
          onChange={(value) => patch({ phoneNumberId: value })}
        />
      </div>
      <div className="whatsapp-input-action-row">
        <Field
          label="Token de acesso"
          type={tokenSaved ? "text" : "password"}
          value={tokenSaved ? maskedToken : settings.accessToken || ""}
          readOnly={tokenSaved}
          autoComplete="new-password"
          placeholder="Cole o token da Cloud API"
          onChange={(value) => patch({ accessToken: value })}
        />
        {showSave ? (
          <button className="primary-action" type="button" onClick={save} disabled={!municipalityId}>Salvar credenciais</button>
        ) : confirmingRemoval ? (
          <div className="whatsapp-input-actions">
            <button className="primary-action danger-action" type="button" onClick={removeToken}>Confirmar</button>
            <button className="ghost-button" type="button" onClick={() => setConfirmingRemoval(false)}>Cancelar</button>
          </div>
        ) : (
          <button className="ghost-button danger-action" type="button" onClick={() => setConfirmingRemoval(true)} disabled={!municipalityId}>Remover token</button>
        )}
      </div>
      {settings.accessToken && <p className="whatsapp-note">Começa com <code>{String(settings.accessToken).slice(0, 8)}</code>…</p>}
      {confirmingRemoval && !showSave && <p className="whatsapp-note">Remover o token? O WhatsApp será desativado.</p>}
      {saveStatus && <span className={saveStatus.includes("sucesso") ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}

      <div className="whatsapp-section-heading"><span>Teste de envio</span></div>
      <div className="whatsapp-input-action-row">
        <Field label="Número" value={testPhone} placeholder="(00) 00000-0000" onChange={setTestPhone} />
        <button className="primary-action" type="button" onClick={sendTest} disabled={testing || !municipalityId || !hasCredentials}>
          {testing ? "Enviando..." : "Enviar teste"}
        </button>
      </div>
      {testStatus && <p className={testStatus.includes("sucesso") ? "sms-status confirmed" : "sms-status"}>{testStatus}</p>}
    </section>
  );
}
