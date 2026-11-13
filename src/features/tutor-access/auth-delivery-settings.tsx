import React from "react";
import { AuthPurpose } from "../../../shared/auth-contract.js";
import { useAuthDeliverySettings } from "./use-auth-delivery-settings";

const purposeLabels = {
  [AuthPurpose.INITIAL_PASSWORD]: "Senha inicial",
  [AuthPurpose.PASSWORD_RESET]: "Recuperação de senha",
  [AuthPurpose.VERIFY_EMAIL]: "Confirmação de e-mail",
  [AuthPurpose.VERIFY_PHONE]: "Confirmação de telefone",
  [AuthPurpose.CONTACT_CHANGED]: "Contato alterado",
};

export function AuthDeliverySettings({ municipalityId, readOnly }: { municipalityId: string; readOnly: boolean }) {
  const state = useAuthDeliverySettings(municipalityId);
  return <section className="notification-settings"><h3>Mensagens de acesso e segurança</h3><p>Use templates específicos para senha inicial, recuperação e confirmação. Eles não dependem da escolha de receber avisos sobre solicitações.</p>
    {!municipalityId && <p>Selecione um município.</p>}
    {state.loading && <p role="status">Carregando templates de acesso...</p>}
    {state.error && <p role="alert" className="form-error">{state.error} <button type="button" className="ghost-button" onClick={state.retry}>Tentar novamente</button></p>}
    <fieldset disabled={readOnly || !state.ready || state.saving}><legend>Templates por finalidade</legend>
      {Object.entries(purposeLabels).map(([purpose, label]) => <div key={purpose} className="notification-template-fields"><h4>{label}</h4>{["emailTemplates", "whatsappTemplates"].filter((channel) => purpose === AuthPurpose.VERIFY_EMAIL ? channel === "emailTemplates" : purpose === AuthPurpose.VERIFY_PHONE ? channel === "whatsappTemplates" : true).map((channel) => <label className="field" key={channel}><span>{channel === "emailTemplates" ? "E-mail" : "WhatsApp"}</span><input maxLength={200} value={state.value[channel]?.[purpose] || ""} onChange={(event) => state.setValue((current) => ({ ...current, [channel]: { ...current[channel], [purpose]: event.target.value } }))} /></label>)}</div>)}
      <p className="whatsapp-note">O WhatsApp usa a mesma ativação e cota do município. Um código para confirmar e-mail vai somente ao e-mail novo; um código de telefone vai somente ao telefone novo.</p>
      <button type="button" className="primary-action" disabled={!state.ready || state.saving || readOnly} onClick={state.save}>{state.saving ? "Salvando..." : "Salvar templates de acesso"}</button>
    </fieldset>{state.success && <p role="status">Templates de acesso salvos.</p>}
  </section>;
}
