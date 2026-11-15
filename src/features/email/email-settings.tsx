import React from "react";
import { PanelHeader } from "../../components/ui";
import { NotificationSettings } from "../notifications/notification-settings";
import { AuthDeliverySettings } from "../tutor-access/auth-delivery-settings";
import { useEmailStatus } from "./use-email-status";
import type { EmailStatus } from "./use-email-status";

const statusRows: { field: keyof EmailStatus; label: string; variable: string }[] = [
  { field: "serviceConfigured", label: "ID do serviço EmailJS", variable: "EMAILJS_SERVICE_ID" },
  { field: "publicKeyConfigured", label: "Chave pública", variable: "EMAILJS_PUBLIC_KEY" },
  { field: "privateKeyConfigured", label: "Chave privada", variable: "EMAILJS_PRIVATE_KEY" },
  { field: "recoveryTemplateConfigured", label: "Template padrão de recuperação de senha", variable: "EMAILJS_TEMPLATE_ID" },
];

export function EmailSettings({ municipalityId, canManage }: { municipalityId: string; canManage: boolean }) {
  const email = useEmailStatus(municipalityId, canManage);
  if (!canManage) return <p role="status">Configuração de e-mail restrita à administração.</p>;
  if (!municipalityId) return <p>Selecione um município para configurar o e-mail.</p>;
  const { status } = email;
  return <div className="config-panel wide">
    <PanelHeader title="E-mail por município" />
    <section className="notification-settings">
      <h3>Integração EmailJS</h3>
      <p>O envio usa as credenciais do servidor, compartilhadas por todos os municípios. Elas não podem ser vistas nem alteradas por esta tela.</p>
      {email.loading && <p role="status">Consultando a integração de e-mail...</p>}
      {email.error && <p role="alert" className="form-error">{email.error} <button type="button" className="ghost-button" onClick={email.retry}>Tentar novamente</button></p>}
      {status && statusRows.map(({ field, label, variable }) => <p key={field}>{label}: <strong>{status[field] ? "configurado" : "não configurado"}</strong> <small>({variable})</small></p>)}
      {status && !(status.serviceConfigured && status.publicKeyConfigured) && <p role="alert">Sem o ID do serviço e a chave pública, nenhum e-mail é enviado. Procure o responsável técnico.</p>}
    </section>
    <NotificationSettings key={`notifications:${municipalityId}`} municipalityId={municipalityId} channel="email" />
    <AuthDeliverySettings key={`auth:${municipalityId}`} municipalityId={municipalityId} channel="emailTemplates" />
  </div>;
}
