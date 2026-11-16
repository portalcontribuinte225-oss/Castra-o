import React from "react";
import { SmsEnvironment } from "../../../shared/sms-contract.js";
import { SavedSecretField } from "../../components/saved-secret-field";
import { ConfigActiveToggle } from "../../components/ui";
import type { useSmsSettings } from "./use-sms-settings";

type SmsState = ReturnType<typeof useSmsSettings>;

const environmentLabel = (environment: string | null) => environment === SmsEnvironment.PRODUCTION ? "Produção"
  : environment === SmsEnvironment.SANDBOX ? "Homologação" : "Não verificado";

function displayDate(value: string | null) {
  return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString("pt-BR") : "Ainda não realizada";
}

// The municipality's own SMSMais account: its token is shown by its start, and the channel is switched on here.
export function SmsCredentials({ state }: { state: SmsState }) {
  const { config, token, connection, confirmingRemoval } = state;
  const busy = state.loading || state.saving || state.testing;
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
        removeNote="Remover o token? O SMS será desativado."
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
    </section>
  );
}
