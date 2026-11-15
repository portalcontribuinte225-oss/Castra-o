import React from "react";
import { useNotificationSettings } from "./use-notification-settings";

export function NotificationSettings({ municipalityId, readOnly = false }: { municipalityId: string; readOnly?: boolean }) {
  const settings = useNotificationSettings(municipalityId);
  return (
    <section className="notification-settings">
      <h3>Notificações por e-mail</h3>
      <p>O e-mail permanece habilitado e recebe o aviso quando o WhatsApp não puder enviar.</p>
      {!municipalityId && <p>Selecione um município para configurar as notificações.</p>}
      {settings.loading && <p role="status">Carregando notificações...</p>}
      {settings.error && <div role="alert"><p className="form-error">{settings.error}</p><button type="button" className="ghost-button" onClick={settings.retry}>Carregar novamente</button></div>}
      {readOnly && <p>Apenas administradores podem alterar os canais de notificação.</p>}
      <fieldset disabled={readOnly || !settings.ready || settings.loading || settings.saving}>
        <legend>Templates de envio</legend>
        <label className="field">
          <span>Template de notificações por e-mail</span>
          <input maxLength={200} value={settings.value.emailTemplateId} onChange={(event) => settings.setValue((current) => ({ ...current, emailTemplateId: event.target.value }))} />
        </label>
        <p className="whatsapp-note">Use um template próprio, separado da recuperação de senha. No EmailJS, configure o destinatário com <code>to_email</code>, o assunto com <code>subject</code> e o corpo com <code>message</code>. Também estão disponíveis <code>to_name</code>, <code>protocol</code> e <code>event</code>.</p>
        <button type="button" className="primary-action" onClick={settings.save} disabled={readOnly || !settings.ready || settings.saving}>{settings.saving ? "Salvando..." : "Salvar notificações por e-mail"}</button>
      </fieldset>
      {settings.success && <p role="status">Configuração de notificações salva.</p>}
    </section>
  );
}
