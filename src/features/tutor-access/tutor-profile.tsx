import React, { useState } from "react";
import { formatPhone } from "../../utils";
import { maskFollowUpEmail, maskFollowUpPhone } from "../request-follow-up/follow-up";
import { useAuthChallengeClock } from "./use-auth-challenge-clock";
import { useTutorProfile } from "./use-tutor-profile";
import { ContactKind } from "../../../shared/auth-contract.js";

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
  if (!state.profile) return <div><p className="form-error" role="alert">{state.error}</p><button type="button" className="ghost-button" onClick={state.retry}>Tentar novamente</button></div>;
  const profile = state.profile;
  return <section className="tutor-profile panel">
    <h2>Meu perfil</h2>
    <p>{profile.name} · CPF {profile.cpf}</p>
    <p>E-mail: {profile.email ? maskFollowUpEmail(profile.email) : "Não informado"} · {profile.emailVerified ? "Confirmado" : "Não confirmado"}</p>
    <p>Telefone: {profile.phone ? maskFollowUpPhone(profile.phone) : "Não informado"} · {profile.phoneVerified ? "Confirmado" : "Não confirmado"}</p>
    <p>Confirme seus contatos para recuperar o acesso sem precisar de atendimento presencial. Confirmar um contato não altera sua escolha de receber avisos.</p>
    <form className="tutor-auth-form" onSubmit={submit}>
      <h3>Confirmar ou alterar contato</h3>
      {!state.challenge ? <>
        <label className="field"><span>Contato</span><select value={kind} onChange={(event) => { setKind(event.target.value); setValue(""); setSuccess(false); }} disabled={state.saving}><option value={ContactKind.EMAIL}>E-mail</option><option value={ContactKind.PHONE}>Telefone</option></select></label>
        <label className="field"><span>{kind === ContactKind.EMAIL ? "E-mail a confirmar" : "Telefone a confirmar"}</span><input type={kind === ContactKind.EMAIL ? "email" : "tel"} autoComplete={kind === ContactKind.EMAIL ? "email" : "tel"} required maxLength={kind === ContactKind.EMAIL ? 254 : 16} value={value} onChange={(event) => setValue(kind === ContactKind.PHONE ? formatPhone(event.target.value) : event.target.value)} disabled={state.saving} /></label>
        <label className="field"><span>Senha atual</span><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={state.saving} /></label>
        <p>O código será enviado somente ao contato informado acima. O contato atual permanece até a confirmação.</p>
      </> : <>
        <p>Digite o código recebido no contato novo. {clock.expiresIn > 0 ? `Ele expira em ${clock.expiresIn}s.` : "O código expirou."}</p>
        <label className="field"><span>Código recebido</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} disabled={state.saving || clock.expiresIn === 0} /></label>
        <button type="button" className="ghost-button" onClick={() => { state.cancel(); setCode(""); setCurrentPassword(""); }} disabled={state.saving || clock.retryIn > 0}>{clock.retryIn > 0 ? `Novo envio disponível em ${clock.retryIn}s` : "Solicitar outro código"}</button>
      </>}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {success && <p role="status">Contato confirmado e atualizado. Os avisos autorizados das solicitações em andamento usarão esse contato.</p>}
      <button type="submit" className="primary-action" disabled={state.saving || (Boolean(state.challenge) && (clock.expiresIn === 0 || code.length !== 6))}>{state.saving ? "Aguarde..." : state.challenge ? "Confirmar contato" : "Enviar código ao contato"}</button>
    </form>
  </section>;
}
