import React from "react";
import { SmsEnvironment } from "../../../shared/sms-contract.js";
import { SavedSecretField } from "../../components/saved-secret-field";
import { ConfigActiveToggle, Field } from "../../components/ui";
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

// The platform's SMSMais account, which only the master sees: its token is shown by its start, and the channel is switched on here for every municipality.
export function SmsCredentials({ state }: { state: SmsState }) {
  const { config, token, connection, confirmingRemoval } = state;
  const busy = state.loading || state.saving || state.testing || state.sendingTest;
  const secureStorageUnavailable = config.secureStorageAvailable === false;
  // A saved token stays inside its field (start visible, rest masked); saving and removing never show together.
  const tokenSaved = config.hasToken && !token;
  return (
    <section className="whatsapp-section">
      <div className="whatsapp-section-header">
        <span className="whatsapp-section-label">Credenciais</span>
        <ConfigActiveToggle checked={config.active} onChange={state.toggleActive} />
      </div>
      <SavedSecretField
        label="Token de API SMSMais"
        placeholder="Cole o token da SMSMais"
        saved={tokenSaved}
        preview={config.tokenPreview}
        value={token}
        onChange={state.setToken}
        showSave={!tokenSaved}
        saveLabel="Salvar credenciais"
        onSave={state.saveToken}
        saveDisabled={busy || !token || secureStorageUnavailable}
        removeLabel="Remover token"
        removeNote="Remover o token? O SMS será desativado para todos os municípios."
        confirming={confirmingRemoval}
        onConfirmingChange={state.setConfirmingRemoval}
        onRemove={state.removeToken}
        removeDisabled={busy}
      />
      <p className="whatsapp-note">Informe o token sem o prefixo Bearer. Ativar o SMS exige um token de produção, validado pelo servidor.</p>
      {config.hasToken && <p className="whatsapp-note">Ambiente salvo: {environmentLabel(config.environment)}. Última validação: {displayDate(config.lastValidatedAt)}.</p>}
      {config.environment === SmsEnvironment.SANDBOX && <p role="status">Token de homologação: não envia SMS nem ativa o canal.</p>}
      {secureStorageUnavailable && <p role="alert">A configuração segura do servidor está indisponível. Procure o responsável técnico para salvar um token ou ativar o SMS.</p>}
      <div className="form-actions">
        <button type="button" className="ghost-button" disabled={busy || (!token && !config.hasToken)} onClick={state.testConnection}>
          {state.testing ? "Consultando..." : "Testar conexão / Consultar saldo"}
        </button>
      </div>
      {connection && (
        <div role="status">
          <p>Conexão validada. Ambiente: {environmentLabel(connection.environment)}.</p>
          {connection.environment === SmsEnvironment.SANDBOX && <p>Homologação: esta credencial não habilita o SMS.</p>}
          <p>Créditos: {connection.balance?.credits.toLocaleString("pt-BR")}. Equivalente em SMS: {connection.balance?.sms.toLocaleString("pt-BR")}.</p>
          <small>Consulta em {displayDate(connection.checkedAt)}. O teste não salva a credencial nem ativa o SMS.</small>
        </div>
      )}

      <div className="whatsapp-section-heading"><span>Teste de envio</span></div>
      <div className="whatsapp-input-action-row">
        <Field label="Número" type="tel" autoComplete="tel" value={state.testPhone} placeholder="(00) 00000-0000" onChange={(value: string) => state.setTestPhone(formatPhone(value))} />
        <button className="primary-action" type="button" onClick={state.sendTest} disabled={busy || !config.hasToken}>
          {state.sendingTest ? "Enviando..." : "Enviar teste"}
        </button>
      </div>
      {state.testOutcome && <p className={state.testOutcome.sent ? "sms-status confirmed" : "sms-status"}>{testText(state.testOutcome)}</p>}
    </section>
  );
}
