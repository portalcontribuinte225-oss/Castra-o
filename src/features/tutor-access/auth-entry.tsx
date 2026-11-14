import React, { useState } from "react";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { PasswordRecoveryForm } from "./password-recovery-form";
import { useAuthLogin } from "./use-auth-login";
import type { AuthAudienceValue, SessionUser } from "./auth-types";
import { Eye } from "lucide-react";

interface AuthEntryProps { municipalityId: string; audience: AuthAudienceValue; onLogin: (user: SessionUser) => void; onClose: () => void }

export function AuthEntry({ municipalityId, audience, onLogin, onClose }: AuthEntryProps) {
  const login = useAuthLogin(audience, municipalityId, onLogin);
  const [showPassword, setShowPassword] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState("");
  const tutor = audience === AuthAudience.TUTOR;
  const missingMunicipality = tutor && !municipalityId;
  return <div className="modal-backdrop"><div className="auth-modal compact-auth-modal" role="dialog" aria-modal="true" aria-label={recovery ? "Recuperar acesso" : tutor ? "Acesso de tutor" : "Acesso da equipe"}>
    <div className="tutor-auth-heading">{!recovery && <h2>{tutor ? "Entrar como tutor" : "Entrar como equipe"}</h2>}<button type="button" className="ghost-button" onClick={() => { login.reset(); onClose(); }} aria-label="Fechar acesso" style={recovery ? { marginLeft: "auto" } : undefined}>Fechar</button></div>
    {missingMunicipality ? <p className="form-error" role="alert">Selecione o município na página.</p> : recovery ? <PasswordRecoveryForm key={`${audience}:${municipalityId}`} audience={audience} municipalityId={municipalityId} initialIdentifier={login.identifier} onBack={() => { setRecovery(false); setShowPassword(false); }} onRecovered={() => { login.reset(); setRecovery(false); setShowPassword(false); setNotice("Senha salva."); }} /> : <form className="tutor-auth-form" onSubmit={(event) => { event.preventDefault(); void login.submit(); }}>
      <label className="field"><span>{tutor ? "CPF ou e-mail" : "E-mail da equipe"}</span><input type={tutor ? "text" : "email"} autoComplete="username" required maxLength={254} value={login.identifier} onChange={(event) => login.setIdentifier(event.target.value)} disabled={login.loading} /></label>
      {tutor && <small>Se compartilha o e-mail, use seu CPF.</small>}
      <label className="field password-field"><span>Senha</span><div><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={login.password} onChange={(event) => login.setPassword(event.target.value)} disabled={login.loading} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} disabled={login.loading}><Eye size={18} /></button></div></label>
      {notice && <p role="status">{notice}</p>}{login.error && <p className="form-error" role="alert">{login.error}</p>}
      <button type="submit" className="primary-action" disabled={login.loading || !login.identifier.trim() || !login.password}>{login.loading ? "Entrando..." : "Entrar"}</button>
      <button type="button" className="ghost-button" disabled={login.loading} onClick={() => { login.setPassword(""); setShowPassword(false); setNotice(""); setRecovery(true); }}>Esqueceu a senha?</button>
    </form>}
  </div></div>;
}
