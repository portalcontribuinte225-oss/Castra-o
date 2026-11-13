import React, { useState } from "react";
import { api, ApiError } from "../../api";
import { AuthAudience, validateNewPassword } from "../../../shared/auth-contract.js";
import { useAuthChallengeClock } from "./use-auth-challenge-clock";
import type { AuthChallenge } from "./auth-types";

export function PasswordRecoveryForm({ audience, municipalityId, onBack }: { audience: string; municipalityId: string; onBack: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const clock = useAuthChallengeClock(challenge);
  async function requestCode() {
    if (loading || clock.retryIn > 0) return;
    setLoading(true); setError("");
    try {
      setChallenge(await api.forgotPassword({ identifier: identifier.trim(), audience, municipalityId }));
      setCode("");
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : "Não foi possível solicitar o código. Tente novamente."); }
    finally { setLoading(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) { await requestCode(); return; }
    if (loading || clock.expiresIn === 0) return;
    const issue = validateNewPassword(password);
    if (issue || password !== confirm) { setError(issue || "As senhas não conferem."); return; }
    setLoading(true); setError("");
    try {
      await api.resetPassword({ challengeId: challenge.challengeId, code, password, audience, municipalityId });
      setPassword(""); setConfirm(""); setCode(""); setChallenge(null); setSuccess(true);
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : "Não foi possível redefinir a senha. Tente novamente."); }
    finally { setLoading(false); }
  }
  if (success) return <div className="tutor-auth-form"><p role="status">Senha redefinida. Entre novamente com a nova senha.</p><button type="button" className="primary-action" onClick={onBack}>Voltar ao login</button></div>;
  return <form className="tutor-auth-form" onSubmit={submit}>
    <h3>Recuperar acesso</h3>
    <label className="field"><span>{audience === AuthAudience.TUTOR ? "CPF ou e-mail" : "E-mail da equipe"}</span><input autoComplete="username" type={audience === AuthAudience.TUTOR ? "text" : "email"} required maxLength={254} value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading || Boolean(challenge)} /></label>
    {challenge && <>
      <p>Se houver uma conta habilitada com contato confirmado, enviaremos um código pelos canais disponíveis. Sem acesso a esse contato, procure o atendimento presencial.</p>
      <p role="status">{clock.expiresIn > 0 ? `O código expira em ${clock.expiresIn} segundos.` : "Código expirado. Solicite outro código."}</p>
      <label className="field"><span>Código recebido</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} disabled={loading || clock.expiresIn === 0} /></label>
      <label className="field"><span>Nova senha</span><input type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} /></label>
      <small>Use pelo menos 15 caracteres; espaços são permitidos.</small>
      <label className="field"><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={loading} /></label>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="primary-action" disabled={loading || (Boolean(challenge) && (clock.expiresIn === 0 || code.length !== 6))}>{loading ? "Aguarde..." : challenge ? "Salvar nova senha" : "Enviar código"}</button>
    {challenge && <button type="button" className="ghost-button" disabled={loading || clock.retryIn > 0} onClick={requestCode}>{clock.retryIn > 0 ? `Reenviar em ${clock.retryIn}s` : "Reenviar código"}</button>}
    <button type="button" className="ghost-button" disabled={loading} onClick={onBack}>Voltar ao login</button>
  </form>;
}
