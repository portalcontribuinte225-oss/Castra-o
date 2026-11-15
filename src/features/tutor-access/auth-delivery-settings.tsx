import React from "react";
import { AuthPurpose } from "../../../shared/auth-contract.js";
import { useAuthDeliverySettings } from "./use-auth-delivery-settings";

const purposeLabels: Record<string, string> = {
  [AuthPurpose.INITIAL_PASSWORD]: "Senha inicial",
  [AuthPurpose.PASSWORD_RESET]: "Recuperação de senha",
  [AuthPurpose.VERIFY_EMAIL]: "Confirmação de e-mail",
  [AuthPurpose.VERIFY_PHONE]: "Confirmação de telefone",
  [AuthPurpose.CONTACT_CHANGED]: "Contato alterado",
  [AuthPurpose.REQUEST_TRACKING]: "Acompanhamento de solicitação",
};

// A code that confirms an e-mail goes only to the new e-mail; a phone code never goes by e-mail.
const emailPurposes = Object.keys(purposeLabels).filter((purpose) => purpose !== AuthPurpose.VERIFY_PHONE);

export function AuthDeliverySettings({ municipalityId, readOnly = false }: { municipalityId: string; readOnly?: boolean }) {
  const state = useAuthDeliverySettings(municipalityId);
  return <section className="notification-settings"><h3>Mensagens de acesso e segurança por e-mail</h3><p>Use templates específicos para senha inicial, recuperação e confirmação. Eles não dependem da escolha de receber avisos sobre solicitações.</p>
    {!municipalityId && <p>Selecione um município.</p>}
    {state.loading && <p role="status">Carregando templates de acesso...</p>}
    {state.error && <p role="alert" className="form-error">{state.error} <button type="button" className="ghost-button" onClick={state.retry}>Tentar novamente</button></p>}
    <fieldset disabled={readOnly || !state.ready || state.saving}><legend>Templates por finalidade</legend>
      <div className="notification-template-fields">
        {emailPurposes.map((purpose) => <label className="field" key={purpose}><span>{purposeLabels[purpose]}</span>
          <input maxLength={200} value={state.value.emailTemplates?.[purpose] || ""} onChange={(event) => state.setValue((current) => ({ ...current, emailTemplates: { ...current.emailTemplates, [purpose]: event.target.value } }))} /></label>)}
      </div>
      <p className="whatsapp-note">Um código para confirmar e-mail vai somente ao e-mail novo.</p>
      <button type="button" className="primary-action" disabled={!state.ready || state.saving || readOnly} onClick={state.save}>{state.saving ? "Salvando..." : "Salvar templates de acesso por e-mail"}</button>
    </fieldset>{state.success && <p role="status">Templates de acesso salvos.</p>}
  </section>;
}
