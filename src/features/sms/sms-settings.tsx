import React from "react";
import { SMS_MAX_TOKEN_LENGTH, SmsEnvironment } from "../../../shared/sms-contract.js";
import { useSmsSettings } from "./use-sms-settings";

const environmentLabel = (environment: string | null) => environment === SmsEnvironment.PRODUCTION ? "Produção"
  : environment === SmsEnvironment.SANDBOX ? "Homologação" : "Não verificado";
function displayDate(value: string | null) {
  return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString("pt-BR") : "Ainda não realizada";
}

export function SmsSettings({ municipalityId, canManage }: { municipalityId: string; canManage: boolean }) {
  const state = useSmsSettings(municipalityId, canManage);
  if (!canManage) return <p role="status">Configuração de SMS restrita à administração.</p>;
  if (!municipalityId) return <p>Selecione um município para configurar o SMS.</p>;
  const busy = state.loading || state.saving || state.testing;
  const secureStorageUnavailable = state.config.secureStorageAvailable === false;
  return <section className="notification-settings">
    <h3>SMSMais</h3>
    <p>Configure o SMS para os códigos de recuperação de senha deste município.</p>
    {state.loading && <p role="status">Carregando configuração de SMS...</p>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {!state.ready && !state.loading && <button type="button" className="ghost-button" onClick={state.retry}>Carregar novamente</button>}
    {state.ready && <>
      <p>Configuração salva: <strong>{state.config.active ? "Ativada" : "Desativada"}</strong>. Token: {state.config.hasToken ? "configurado" : "não configurado"}.</p>
      <p>Ambiente salvo: {environmentLabel(state.config.environment)}. Última validação: {displayDate(state.config.lastValidatedAt)}.</p>
      {state.config.environment === SmsEnvironment.SANDBOX && <p role="status">Token de homologação: o SMS não fica disponível na recuperação de senha.</p>}
      {secureStorageUnavailable && <p role="alert">A configuração segura do servidor está indisponível. Procure o responsável técnico para salvar um token ou ativar o SMS.</p>}
    </>}
    <form onSubmit={(event) => { event.preventDefault(); void state.save(); }}>
      <fieldset disabled={!state.ready || busy}>
        <legend>Integração SMS</legend>
        <label className="field"><span>Token de API SMSMais</span><input type="password" autoComplete="new-password" spellCheck={false}
          maxLength={SMS_MAX_TOKEN_LENGTH} value={state.token}
          placeholder={state.config.hasToken ? "Preencha somente para substituir o token" : "Informe o token SMSMais"}
          onChange={(event) => state.setToken(event.target.value)} aria-describedby="sms-token-help" /></label>
        <small id="sms-token-help">Informe sem o prefixo Bearer. Deixe vazio para manter o token salvo.</small>
        <label className="config-active-toggle"><input type="checkbox" role="switch" checked={state.active}
          disabled={secureStorageUnavailable && !state.active} onChange={(event) => state.setActive(event.target.checked)} />
          <span className="toggle-track"><span className="toggle-thumb" /></span><span>Ativar SMS na recuperação de senha</span></label>
        <p className="whatsapp-note">Desativar preserva o token. A ativação exige token de produção validado pelo servidor.</p>
        <div className="form-actions">
          <button type="submit" className="primary-action" disabled={secureStorageUnavailable && Boolean(state.token || state.active)}>{state.saving ? "Salvando..." : "Salvar SMS"}</button>
          <button type="button" className="ghost-button" disabled={!state.token && !state.config.hasToken} onClick={state.testConnection}>{state.testing ? "Consultando..." : "Testar conexão / Consultar saldo"}</button>
          <button type="button" className="ghost-button danger-action" disabled={!state.config.hasToken} onClick={state.removeToken}>Remover token e desativar</button>
        </div>
      </fieldset>
    </form>
    {state.notice && <p role="status">{state.notice}</p>}
    {state.connection && <div role="status">
      <p>Conexão validada. Ambiente: {environmentLabel(state.connection.environment)}.</p>
      {state.connection.environment === SmsEnvironment.SANDBOX && <p>Homologação: esta credencial não habilita o SMS na recuperação.</p>}
      <p>Créditos: {state.connection.balance.credits.toLocaleString("pt-BR")}. Equivalente em SMS: {state.connection.balance.sms.toLocaleString("pt-BR")}.</p>
      <small>Consulta em {displayDate(state.connection.checkedAt)}. O teste não salva a credencial nem ativa o SMS.</small>
    </div>}
  </section>;
}
