import React, { useState } from "react";
import { validateNewPassword } from "../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { CompactChoiceField } from "../../components/ui";
import { formatCpf, onlyDigits } from "../../utils";
import type { SessionUser } from "../tutor-access/auth-types";
import { AccessStep } from "./access-state";
import type { AccessChannel, AccessedRequest } from "./access-types";
import { AccessedRequestCard } from "./accessed-request-card";
import { useRequestAccess } from "./use-request-access";

const channelLabels: Record<AccessChannel, string> = {
  [NotificationChannel.EMAIL]: "E-mail", [NotificationChannel.WHATSAPP]: "WhatsApp", [NotificationChannel.SMS]: "SMS",
};
const channelNames: Record<AccessChannel, string> = {
  [NotificationChannel.EMAIL]: "e-mail", [NotificationChannel.WHATSAPP]: "WhatsApp", [NotificationChannel.SMS]: "SMS",
};
const fieldLabel = "tw:grid tw:gap-1.5 tw:text-sm tw:font-medium tw:text-ui-ink";

interface RequestAccessProps {
  municipalityId: string;
  // From the last screen of the request; the code is always asked.
  initialCpf?: string;
  // Makes the request document (a PDF, as a data URL) of one of the requests.
  createRequirement: (request: AccessedRequest) => Promise<string>;
  onSession: (user: SessionUser) => void;
  onLogin: () => void;
}

// "Acompanhar solicitação": the tutor's CPF and a code sent, by the channel the person chooses, to the contact of a request open the
// requests of that CPF with the same contact, their request documents and, on the first access, the creation of the tutor's password.
export function RequestAccess({ municipalityId, initialCpf = "", createRequirement, onSession, onLogin }: RequestAccessProps) {
  const access = useRequestAccess(municipalityId, { cpf: initialCpf });
  if (!municipalityId) return <p role="status">Selecione o município na página para acompanhar sua solicitação.</p>;
  if (access.step === AccessStep.VERIFIED && access.view) {
    const { requests, account } = access.view;
    return <div className="tw:grid tw:gap-4">
      {requests.length === 0 && <p role="status">Nenhuma solicitação encontrada.</p>}
      {requests.map((request) => <AccessedRequestCard key={request.protocol} request={request} createRequirement={() => createRequirement(request)} />)}
      <Card as="section" className="tw:grid tw:gap-4 tw:p-4 tw:sm:p-6" aria-label="Seu acesso">
        {account.exists ? <>
          <p>Este CPF já tem acesso neste município. Entre com seu CPF e sua senha.</p>
          {access.error && <p className="form-error" role="alert">{access.error}</p>}
          <Button className="tw:justify-self-end tw:max-sm:w-full" onClick={onLogin}>Entrar</Button>
        </> : <PasswordCreation loading={access.loading} error={access.error} onSubmit={async (password) => {
          const user = await access.createPassword(password);
          if (user) onSession(user);
        }} />}
      </Card>
    </div>;
  }
  const coding = access.step === AccessStep.CODE;
  const waiting = access.clock.retryIn > 0;
  const { channels, loading: channelsLoading, error: channelsError, retry } = access.availableChannels;
  return <form className="tw:grid tw:gap-4" aria-label="Acompanhar solicitação" aria-busy={access.loading} onSubmit={(event) => { event.preventDefault(); void (coding ? access.open() : access.send()); }}>
    {coding && <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Digite o código</h3>}
    {!coding && <>
      <p>Informe o CPF do tutor. Enviamos um código para o contato informado na solicitação.</p>
      <label className={fieldLabel}><span>CPF do tutor<span className="required-asterisk">*</span></span><Input inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" required value={formatCpf(access.cpf)} onChange={(event) => access.edit({ cpf: onlyDigits(event.target.value).slice(0, 11) })} disabled={access.loading} /></label>
      {channelsLoading ? <p role="status">Carregando as formas de envio do código...</p>
        : channelsError ? <div className="tw:grid tw:justify-items-start tw:gap-2">
          <p className="form-error" role="alert">{channelsError}</p>
          <Button variant="outline" onClick={retry}>Tentar novamente</Button>
        </div>
        : channels.length === 0 ? <p role="status">No momento não é possível enviar o código. Procure o atendimento do município.</p>
        : <CompactChoiceField label="Receber o código por" value={access.channel} options={channels.map((value) => ({ value, label: channelLabels[value] }))} onChange={(channel: AccessChannel) => access.edit({ channel })} />}
      <Button type="submit" className="tw:justify-self-end tw:max-sm:w-full" disabled={access.loading || waiting || !access.channel || access.cpf.length !== 11}>{access.loading ? "Enviando..." : waiting ? `Aguarde ${access.clock.retryIn}s` : "Enviar código"}</Button>
      <p className="whatsapp-note">Tem acesso de tutor? Use o botão Entrar.</p>
    </>}
    {coding && <>
      <p role="status">Se o CPF tiver solicitação, enviamos um código de 6 dígitos{access.channel ? ` por ${channelNames[access.channel]}` : ""} para o contato informado nela. Ele vale por 10 minutos.</p>
      <label className={fieldLabel}><span>Código recebido</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={access.code} onChange={(event) => access.edit({ code: event.target.value.replace(/\D/g, "") })} disabled={access.loading} /></label>
      {access.clock.expiresIn === 0 && <p role="status">Código expirado. Peça um novo.</p>}
      <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        <Button type="submit" disabled={access.loading || access.clock.expiresIn === 0 || access.code.length !== 6}>{access.loading ? "Conferindo..." : "Ver solicitações"}</Button>
        <Button variant="outline" disabled={access.loading || waiting} onClick={() => void access.send()}>{waiting ? `Reenviar em ${access.clock.retryIn}s` : "Reenviar código"}</Button>
        <Button variant="outline" disabled={access.loading} onClick={access.correct}>Corrigir dados</Button>
      </div>
    </>}
    {access.error && <p className="form-error" role="alert">{access.error}</p>}
  </form>;
}

function PasswordCreation({ loading, error, onSubmit }: { loading: boolean; error: string; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [issue, setIssue] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const problem = validateNewPassword(password) || (password !== confirm ? "As senhas não conferem." : "");
    setIssue(problem);
    if (!problem) void onSubmit(password);
  }
  return <form className="tw:grid tw:gap-4" aria-label="Criar minha senha" aria-busy={loading} onSubmit={submit}>
    <h4 className="tw:m-0 tw:text-base tw:font-semibold">Criar minha senha</h4>
    <p>Com a senha, você entra com seu CPF e acompanha seus animais e solicitações.</p>
    <label className={fieldLabel}><span>Nova senha</span><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /></label>
    <small>Use pelo menos 6 caracteres.</small>
    <label className={fieldLabel}><span>Confirmar nova senha</span><Input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={loading} /></label>
    {(issue || error) && <p className="form-error" role="alert">{issue || error}</p>}
    <Button type="submit" className="tw:justify-self-end tw:max-sm:w-full" disabled={loading || !password || !confirm}>{loading ? "Salvando..." : "Criar minha senha"}</Button>
  </form>;
}
