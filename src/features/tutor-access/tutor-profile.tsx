import React, { useState } from "react";
import { formatPhone } from "../../utils";
import { maskFollowUpEmail, maskFollowUpPhone } from "../request-follow-up/follow-up";
import { useAuthChallengeClock } from "./use-auth-challenge-clock";
import { useTutorProfile } from "./use-tutor-profile";
import { ContactKind } from "../../../shared/auth-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { authErrorStyle, authFieldStyle, authFormStyle, authLabelStyle, authTitleStyle } from "./auth-form-styles";

export function TutorProfileView() {
  const state = useTutorProfile();
  const [kind, setKind] = useState<string>(ContactKind.EMAIL);
  const [value, setValue] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [success, setSuccess] = useState(false);
  const clock = useAuthChallengeClock(state.challenge);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSuccess(false);
    if (state.challenge) {
      if (clock.expiresIn > 0 && await state.confirm(code)) { setCode(""); setValue(""); setCurrentPassword(""); setSuccess(true); }
    } else if (await state.requestCode(kind, value.trim(), currentPassword)) setCurrentPassword("");
  }
  if (state.loading) return <p role="status">Carregando seu perfil...</p>;
  if (!state.profile) return <Card className="tw:grid tw:justify-items-start tw:gap-3 tw:p-5">
    <p className={authErrorStyle} role="alert">{state.error}</p>
    <Button variant="outline" onClick={state.retry}>Tentar novamente</Button>
  </Card>;
  const profile = state.profile;
  return <Card as="section" className="tw:grid tw:gap-3 tw:p-5">
    <h2 className={authTitleStyle}>Meu perfil</h2>
    <p className="tw:m-0">{profile.name} · CPF {profile.cpf}</p>
    <p className="tw:m-0">E-mail: {profile.email ? maskFollowUpEmail(profile.email) : "Não informado"} · {profile.emailVerified ? "Confirmado" : "Não confirmado"}</p>
    <p className="tw:m-0">Telefone: {profile.phone ? maskFollowUpPhone(profile.phone) : "Não informado"} · {profile.phoneVerified ? "Confirmado" : "Não confirmado"}</p>
    <p className="tw:m-0 tw:text-ui-muted">Confirme seus contatos para recuperar o acesso sem precisar de atendimento presencial. Confirmar um contato não altera sua escolha de receber avisos.</p>
    <form className={authFormStyle} onSubmit={submit}>
      <h3 className="tw:m-0 tw:text-lg">Confirmar ou alterar contato</h3>
      {!state.challenge ? <>
        <label className="field"><span>Contato</span><select value={kind} onChange={(event) => { setKind(event.target.value); setValue(""); setSuccess(false); }} disabled={state.saving}><option value={ContactKind.EMAIL}>E-mail</option><option value={ContactKind.PHONE}>Telefone</option></select></label>
        <label className={authFieldStyle}><span className={authLabelStyle}>{kind === ContactKind.EMAIL ? "E-mail a confirmar" : "Telefone a confirmar"}</span><Input type={kind === ContactKind.EMAIL ? "email" : "tel"} autoComplete={kind === ContactKind.EMAIL ? "email" : "tel"} required maxLength={kind === ContactKind.EMAIL ? 254 : 16} value={value} onChange={(event) => setValue(kind === ContactKind.PHONE ? formatPhone(event.target.value) : event.target.value)} disabled={state.saving} /></label>
        <label className={authFieldStyle}><span className={authLabelStyle}>Senha atual</span><Input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={state.saving} /></label>
        <p>O código será enviado somente ao contato informado acima. O contato atual permanece até a confirmação.</p>
      </> : <>
        <p>Digite o código recebido no contato novo. {clock.expiresIn > 0 ? `Ele expira em ${clock.expiresIn}s.` : "O código expirou."}</p>
        <label className={authFieldStyle}><span className={authLabelStyle}>Código recebido</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} disabled={state.saving || clock.expiresIn === 0} /></label>
        <Button variant="outline" onClick={() => { state.cancel(); setCode(""); setCurrentPassword(""); }} disabled={state.saving || clock.retryIn > 0}>{clock.retryIn > 0 ? `Novo envio disponível em ${clock.retryIn}s` : "Solicitar outro código"}</Button>
      </>}
      {state.error && <p className={authErrorStyle} role="alert">{state.error}</p>}
      {success && <p className="form-success-msg" role="status">Contato confirmado e atualizado. Os avisos autorizados das solicitações em andamento usarão esse contato.</p>}
      <Button type="submit" disabled={state.saving || (Boolean(state.challenge) && (clock.expiresIn === 0 || code.length !== 6))}>{state.saving ? "Aguarde..." : state.challenge ? "Confirmar contato" : "Enviar código ao contato"}</Button>
    </form>
  </Card>;
}
