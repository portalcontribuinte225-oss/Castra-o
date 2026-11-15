import React from "react";
import { AuthPurpose } from "../../../shared/auth-contract.js";
import { useAuthDeliverySettings } from "./use-auth-delivery-settings";
import type { AuthTemplateChannel } from "./use-auth-delivery-settings";

const purposeLabels: Record<string, string> = {
  [AuthPurpose.INITIAL_PASSWORD]: "Senha inicial",
  [AuthPurpose.PASSWORD_RESET]: "Recuperação de senha",
  [AuthPurpose.VERIFY_EMAIL]: "Confirmação de e-mail",
  [AuthPurpose.VERIFY_PHONE]: "Confirmação de telefone",
  [AuthPurpose.CONTACT_CHANGED]: "Contato alterado",
  [AuthPurpose.REQUEST_TRACKING]: "Acompanhamento de solicitação",
};

// A code that confirms an e-mail goes only to the new e-mail; a phone code goes only to the new phone.
const channelPurposes: Record<AuthTemplateChannel, string[]> = {
  emailTemplates: Object.keys(purposeLabels).filter((purpose) => purpose !== AuthPurpose.VERIFY_PHONE),
  whatsappTemplates: Object.keys(purposeLabels).filter((purpose) => purpose !== AuthPurpose.VERIFY_EMAIL),
};

export function AuthDeliverySettings({ municipalityId, channel, readOnly = false }: { municipalityId: string; channel: AuthTemplateChannel; readOnly?: boolean }) {
  const state = useAuthDeliverySettings(municipalityId, channel);
  const isEmail = channel === "emailTemplates";
  return <section className="notification-settings"><h3>{isEmail ? "Mensagens de acesso e segurança por e-mail" : "Mensagens de acesso e segurança por WhatsApp"}</h3><p>Use templates específicos para senha inicial, recuperação e confirmação. Eles não dependem da escolha de receber avisos sobre solicitações.</p>
    {!municipalityId && <p>Selecione um município.</p>}
    {state.loading && <p role="status">Carregando templates de acesso...</p>}
    {state.error && <p role="alert" className="form-error">{state.error} <button type="button" className="ghost-button" onClick={state.retry}>Tentar novamente</button></p>}
    <fieldset disabled={readOnly || !state.ready || state.saving}><legend>Templates por finalidade</legend>
      <div className="notification-template-fields">
        {channelPurposes[channel].map((purpose) => <label className="field" key={purpose}><span>{purposeLabels[purpose]}</span>
          <input maxLength={200} value={state.value[channel]?.[purpose] || ""} onChange={(event) => state.setValue((current) => ({ ...current, [channel]: { ...current[channel], [purpose]: event.target.value } }))} /></label>)}
      </div>
      <p className="whatsapp-note">{isEmail
        ? "Um código para confirmar e-mail vai somente ao e-mail novo."
        : "O WhatsApp usa a mesma ativação e cota do município. Um código de telefone vai somente ao telefone novo."}</p>
      <button type="button" className="primary-action" disabled={!state.ready || state.saving || readOnly} onClick={state.save}>{state.saving ? "Salvando..." : `Salvar templates de acesso por ${isEmail ? "e-mail" : "WhatsApp"}`}</button>
    </fieldset>{state.success && <p role="status">Templates de acesso salvos.</p>}
  </section>;
}
