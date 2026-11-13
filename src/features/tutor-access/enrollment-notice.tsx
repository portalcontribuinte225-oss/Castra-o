import React from "react";
import { DeliveryStatus } from "../../../shared/notification-contract.js";
import type { EnrollmentCredential } from "./auth-types";

export function EnrollmentNotice({ credential, onDismiss, onLogin }: { credential?: EnrollmentCredential | null; onDismiss: () => void; onLogin: () => void }) {
  if (!credential) return <div className="tutor-enrollment"><p>Se você já possui acesso neste município, entre com seu CPF e sua senha. Se precisar, use a recuperação de senha ou procure o atendimento.</p><button type="button" className="ghost-button" onClick={onLogin}>Entrar como tutor</button></div>;
  const deliveries = Array.isArray(credential.delivery) ? credential.delivery : credential.delivery ? [credential.delivery] : [];
  const accepted = deliveries.some((delivery) => delivery.status === DeliveryStatus.SENT);
  return <section className="tutor-enrollment" aria-label="Seu acesso de tutor">
    <h3>Seu acesso foi criado</h3>
    <p>Anote a senha inicial. Ela será mostrada somente nesta conclusão e deverá ser trocada no primeiro acesso.</p>
    <p>CPF de acesso: <strong>{credential.cpf}</strong></p>
    <p>Senha inicial: <code className="tutor-initial-password">{credential.temporaryPassword}</code></p>
    <p>{accepted ? "O provedor aceitou o envio da senha ao contato informado. Confira o recebimento." : "A senha está disponível aqui. O envio ao contato não foi confirmado; anote-a antes de sair."}</p>
    <p>Sem contato confirmado, a recuperação do acesso depende de atendimento presencial.</p>
    <div className="tutor-auth-actions"><button type="button" className="primary-action" onClick={onLogin}>Entrar como tutor</button><button type="button" className="ghost-button" onClick={onDismiss}>Já anotei, ocultar senha</button></div>
  </section>;
}
