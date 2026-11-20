import React, { useState } from "react";
import { ContactKind, validateNewPassword } from "../../../shared/auth-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { CompactChoiceField } from "../../components/ui";
import { formatCpf, onlyDigits } from "../../utils";
import { useRequirementDownload } from "../request-requester/use-requirement-download";
import type { SessionUser } from "../tutor-access/auth-types";
import { AccessStep } from "./access-state";
import type { AccessChannel, AccessedRequest } from "./access-types";
import { useRequestAccess } from "./use-request-access";

const channelOptions = [{ value: ContactKind.EMAIL, label: "E-mail" }, { value: ContactKind.PHONE, label: "Celular" }];
const channelNames: Record<AccessChannel, string> = { [ContactKind.EMAIL]: "e-mail", [ContactKind.PHONE]: "celular" };
const fieldLabel = "tw:grid tw:gap-1.5 tw:text-sm tw:font-medium tw:text-ui-ink";

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
    return <Card as="section" className="tw:grid tw:gap-4 tw:p-4 tw:sm:p-6" aria-label="Sua solicitação">
      <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Solicitação {request.protocol}</h3>
      <RequirementDownload protocol={request.protocol} createRequirement={() => createRequirement(request)} />
      {account.exists ? <>
        <p>Este CPF já tem acesso neste município. Entre com seu CPF e sua senha.</p>
        {access.error && <p className="form-error" role="alert">{access.error}</p>}
        <Button className="tw:justify-self-start" onClick={onLogin}>Entrar</Button>
      </> : <PasswordCreation loading={access.loading} error={access.error} onSubmit={async (password) => {
        const user = await access.createPassword(password);
        if (user) onSession(user);
      }} />}
    </Card>;
  }
  const coding = access.step === AccessStep.CODE;
  const waiting = access.clock.retryIn > 0;
  return <form className="tw:grid tw:gap-4" aria-label="Acessar minha solicitação" aria-busy={access.loading} onSubmit={(event) => { event.preventDefault(); void (coding ? access.open() : access.send()); }}>
    {coding && <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Digite o código</h3>}
    {!coding && <>
      <p>Informe o protocolo e o CPF do tutor. Enviamos o código para o contato informado na solicitação.</p>
      <label className={fieldLabel}><span>Protocolo</span><Input autoComplete="off" maxLength={20} placeholder="000123/2026" required value={access.protocol} onChange={(event) => access.edit({ protocol: event.target.value })} disabled={access.loading} /></label>
      <label className={fieldLabel}><span>CPF do tutor</span><Input inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" required value={formatCpf(access.cpf)} onChange={(event) => access.edit({ cpf: onlyDigits(event.target.value).slice(0, 11) })} disabled={access.loading} /></label>
      <CompactChoiceField label="Receber o código por" value={access.channel} options={channelOptions} onChange={(channel: AccessChannel) => access.edit({ channel })} />
      <Button type="submit" className="tw:justify-self-start" disabled={access.loading || waiting || !access.protocol.trim() || access.cpf.length !== 11}>{access.loading ? "Enviando..." : waiting ? `Aguarde ${access.clock.retryIn}s` : "Enviar código"}</Button>
    </>}
    {coding && <>
      <p role="status">Se os dados conferirem, enviamos um código de 6 dígitos para o {channelNames[access.channel]} informado na solicitação. Ele vale por 10 minutos.</p>
      <label className={fieldLabel}><span>Código recebido</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={access.code} onChange={(event) => access.edit({ code: event.target.value.replace(/\D/g, "") })} disabled={access.loading} /></label>
      {access.clock.expiresIn === 0 && <p role="status">Código expirado. Peça um novo.</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="submit" disabled={access.loading || access.clock.expiresIn === 0 || access.code.length !== 6}>{access.loading ? "Conferindo..." : "Abrir solicitação"}</Button>
        <Button variant="outline" disabled={access.loading || waiting} onClick={() => void access.send()}>{waiting ? `Reenviar em ${access.clock.retryIn}s` : "Reenviar código"}</Button>
        <Button variant="outline" disabled={access.loading} onClick={access.correct}>Corrigir dados</Button>
      </div>
    </>}
    {access.error && <p className="form-error" role="alert">{access.error}</p>}
  </form>;
}

function RequirementDownload({ protocol, createRequirement }: { protocol: string; createRequirement: () => Promise<string> }) {
  const requirement = useRequirementDownload(createRequirement, protocol);
  return <>
    <p>Baixe o requerimento da sua solicitação, com os dados que você informou.</p>
    <Button variant="outline" className="tw:justify-self-start" onClick={requirement.download} disabled={requirement.downloading}>{requirement.downloading ? "Gerando..." : "Baixar requerimento"}</Button>
    {requirement.error && <p className="form-error" role="alert">{requirement.error}</p>}
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
  return <form className="tw:grid tw:gap-4" aria-label="Criar minha senha" aria-busy={loading} onSubmit={submit}>
    <h4 className="tw:m-0 tw:text-base tw:font-semibold">Criar minha senha</h4>
    <p>Com a senha, você entra com seu CPF e acompanha seus animais e solicitações.</p>
    <label className={fieldLabel}><span>Nova senha</span><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /></label>
    <small>Use pelo menos 6 caracteres.</small>
    <label className={fieldLabel}><span>Confirmar nova senha</span><Input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={loading} /></label>
    {(issue || error) && <p className="form-error" role="alert">{issue || error}</p>}
    <Button type="submit" className="tw:justify-self-start" disabled={loading || !password || !confirm}>{loading ? "Salvando..." : "Criar minha senha"}</Button>
  </form>;
}
