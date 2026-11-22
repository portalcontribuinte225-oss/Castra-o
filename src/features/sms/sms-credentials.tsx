import React from "react";
import { SmsEnvironment } from "../../../shared/sms-contract.js";
import { ServerCredential } from "../../../shared/server-credential-contract.js";
import { Button } from "../../components/button";
import { IntegrationCard, integrationActionFieldStyle } from "../../components/integration-card";
import { ServerSecretField } from "../../components/server-secret-field";
import { ConfigField } from "../../components/ui";
import { formatPhone } from "../../utils";
import type { SmsTestOutcome } from "./sms-types";
import type { useSmsSettings } from "./use-sms-settings";

type SmsState = ReturnType<typeof useSmsSettings>;

const environmentLabel = (environment: string | null) => environment === SmsEnvironment.PRODUCTION ? "Produção"
  : environment === SmsEnvironment.SANDBOX ? "Homologação" : "Não verificado";

function displayDate(value: string | null) {
  return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString("pt-BR") : "Ainda não realizada";
}

// "Sent" is only the provider taking the message, so the text sends the user to the phone to confirm it arrived.
function testText({ sent, reason, detail, providerMessageId }: SmsTestOutcome) {
  if (!sent) return `Não enviado: ${reason}${detail ? ` Detalhe: ${detail}.` : ""}`;
  return `Teste enviado ao provedor${providerMessageId ? ` (código ${providerMessageId})` : ""}. Confira se chegou ao celular: a entrega depende da operadora.`;
}

// The platform's SMSMais account, which only the master sees. The token lives in the server's variables, so here it is only read.
export function SmsCredentials({ state, actions }: { state: SmsState; actions?: React.ReactNode }) {
  const { config, connection } = state;
  const busy = state.loading || state.saving || state.testing || state.sendingTest;
  return (
    <IntegrationCard title="Credenciais" actions={actions}>
      <ServerSecretField label="Token de API SMSMais" variable={ServerCredential.SMS_TOKEN} preview={config.tokenPreview} issue={config.tokenIssue} />
      <p className="whatsapp-note">Ativar o SMS exige um token de produção, validado pelo servidor.{config.hasToken ? ` Ambiente: ${environmentLabel(config.environment)}.` : ""}</p>
      {config.environment === SmsEnvironment.SANDBOX && <p role="status">Token de homologação: não envia SMS nem ativa o canal.</p>}
      <Button variant="outline" className="tw:justify-self-start" disabled={busy || !config.hasToken} onClick={state.testConnection}>
        {state.testing ? "Consultando..." : "Testar conexão / Consultar saldo"}
      </Button>
      {connection && (
        <div role="status">
          <p>Conexão validada. Ambiente: {environmentLabel(connection.environment)}.</p>
          {connection.environment === SmsEnvironment.SANDBOX && <p>Homologação: esta credencial não habilita o SMS.</p>}
          <p>Créditos: {connection.balance?.credits.toLocaleString("pt-BR")}. Equivalente em SMS: {connection.balance?.sms.toLocaleString("pt-BR")}.</p>
          <small>Consulta em {displayDate(connection.checkedAt)}. O teste não ativa o SMS.</small>
        </div>
      )}

      <div className="whatsapp-section-heading"><span>Teste de envio</span></div>
      <div className={integrationActionFieldStyle}>
        <ConfigField label="Número" type="tel" autoComplete="tel" value={state.testPhone} placeholder="(00) 00000-0000" onChange={(value) => state.setTestPhone(formatPhone(value))} />
        <Button onClick={state.sendTest} disabled={busy || !config.hasToken}>
          {state.sendingTest ? "Enviando..." : "Enviar teste"}
        </Button>
      </div>
      {state.testOutcome && <p className={state.testOutcome.sent ? "sms-status confirmed" : "sms-status"}>{testText(state.testOutcome)}</p>}
    </IntegrationCard>
  );
}
