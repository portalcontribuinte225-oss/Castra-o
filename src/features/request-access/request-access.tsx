import React, { useState } from "react";
import { ContactKind, validateNewPassword } from "../../../shared/auth-contract.js";
import { CompactChoiceField } from "../../components/ui";
import { formatCpf, onlyDigits } from "../../utils";
import { useRequirementDownload } from "../request-requester/use-requirement-download";
import type { SessionUser } from "../tutor-access/auth-types";
import { AccessStep } from "./access-state";
import type { AccessChannel, AccessedRequest } from "./access-types";
import { useRequestAccess } from "./use-request-access";

const channelOptions = [{ value: ContactKind.EMAIL, label: "E-mail" }, { value: ContactKind.PHONE, label: "Celular" }];
const channelNames: Record<AccessChannel, string> = { [ContactKind.EMAIL]: "e-mail", [ContactKind.PHONE]: "celular" };

interface RequestAccessProps {
  municipalityId: string;
  // From the link or from the last screen of the request; the code is always asked.
  initialProtocol?: string;
  initialCpf?: string;
  // Makes the request document (a PDF, as a data URL) of the request that was opened.
  createRequirement: (request: AccessedRequest) => Promise<string>;
  onSession: (user: SessionUser) => void;
  onLogin: () => void;
}

// "Acessar minha solicitação": protocol, the tutor's CPF and a code sent to the request's contact open the request document and,
// on the first access, the creation of the tutor's password.
export function RequestAccess({ municipalityId, initialProtocol = "", initialCpf = "", createRequirement, onSession, onLogin }: RequestAccessProps) {
  const access = useRequestAccess(municipalityId, { protocol: initialProtocol, cpf: initialCpf });
  if (!municipalityId) return <p role="status">Selecione o município na página para acessar sua solicitação.</p>;
  if (access.step === AccessStep.VERIFIED && access.view) {
    const { request, account } = access.view;
    return <section className="tutor-auth-form" aria-label="Sua solicitação">
      <h2>Solicitação {request.protocol}</h2>
      <RequirementDownload protocol={request.protocol} createRequirement={() => createRequirement(request)} />
      {account.exists ? <>
        <p>Este CPF já tem acesso neste município. Entre com seu CPF e sua senha.</p>
        {access.error && <p className="form-error" role="alert">{access.error}</p>}
        <div className="tutor-auth-actions"><button type="button" className="primary-action" onClick={onLogin}>Entrar</button></div>
      </> : <PasswordCreation loading={access.loading} error={access.error} onSubmit={async (password) => {
        const user = await access.createPassword(password);
        if (user) onSession(user);
      }} />}
    </section>;
  }
  const coding = access.step === AccessStep.CODE;
  const waiting = access.clock.retryIn > 0;
  return <form className="tutor-auth-form" onSubmit={(event) => { event.preventDefault(); void (coding ? access.open() : access.send()); }}>
    <h2>{coding ? "Digite o código" : "Acessar minha solicitação"}</h2>
    {!coding && <>
      <p>Informe o protocolo e o CPF do tutor. Enviamos o código para o contato informado na solicitação.</p>
      <label className="field"><span>Protocolo</span><input autoComplete="off" maxLength={20} placeholder="000123/2026" required value={access.protocol} onChange={(event) => access.edit({ protocol: event.target.value })} disabled={access.loading} /></label>
      <label className="field"><span>CPF do tutor</span><input inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" required value={formatCpf(access.cpf)} onChange={(event) => access.edit({ cpf: onlyDigits(event.target.value).slice(0, 11) })} disabled={access.loading} /></label>
      <CompactChoiceField label="Receber o código por" value={access.channel} options={channelOptions} onChange={(channel: AccessChannel) => access.edit({ channel })} />
      <button type="submit" className="primary-action" disabled={access.loading || waiting || !access.protocol.trim() || access.cpf.length !== 11}>{access.loading ? "Enviando..." : waiting ? `Aguarde ${access.clock.retryIn}s` : "Enviar código"}</button>
    </>}
    {coding && <>
      <p role="status">Se os dados conferirem, enviamos um código de 6 dígitos para o {channelNames[access.channel]} informado na solicitação. Ele vale por 10 minutos.</p>
      <label className="field"><span>Código recebido</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={access.code} onChange={(event) => access.edit({ code: event.target.value.replace(/\D/g, "") })} disabled={access.loading} /></label>
      {access.clock.expiresIn === 0 && <p role="status">Código expirado. Peça um novo.</p>}
      <button type="submit" className="primary-action" disabled={access.loading || access.clock.expiresIn === 0 || access.code.length !== 6}>{access.loading ? "Conferindo..." : "Abrir solicitação"}</button>
      <button type="button" className="ghost-button" disabled={access.loading || waiting} onClick={() => void access.send()}>{waiting ? `Reenviar em ${access.clock.retryIn}s` : "Reenviar código"}</button>
      <button type="button" className="ghost-button" disabled={access.loading} onClick={access.correct}>Corrigir dados</button>
    </>}
    {access.error && <p className="form-error" role="alert">{access.error}</p>}
  </form>;
}

function RequirementDownload({ protocol, createRequirement }: { protocol: string; createRequirement: () => Promise<string> }) {
  const requirement = useRequirementDownload(createRequirement, protocol);
  return <>
    <p>Baixe o requerimento da sua solicitação, com os dados que você informou.</p>
    <div className="tutor-auth-actions">
      <button className="ghost-button" type="button" onClick={requirement.download} disabled={requirement.downloading}>{requirement.downloading ? "Gerando..." : "Baixar requerimento"}</button>
    </div>
    {requirement.error && <p className="form-error">{requirement.error}</p>}
  </>;
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
  return <form className="tutor-auth-form" onSubmit={submit}>
    <h3>Criar minha senha</h3>
    <p>Com a senha, você entra com seu CPF e acompanha seus animais e solicitações.</p>
    <label className="field"><span>Nova senha</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /></label>
    <small>Use pelo menos 6 caracteres.</small>
    <label className="field"><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={loading} /></label>
    {(issue || error) && <p className="form-error" role="alert">{issue || error}</p>}
    <div className="tutor-auth-actions"><button className="primary-action" type="submit" disabled={loading || !password || !confirm}>{loading ? "Salvando..." : "Criar minha senha"}</button></div>
  </form>;
}
