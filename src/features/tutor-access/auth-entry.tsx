import React, { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { PasswordRecoveryForm } from "./password-recovery-form";
import type { SessionUser } from "./auth-types";
import { Eye } from "lucide-react";

interface AuthEntryProps {
  municipalityId: string;
  municipalities: Array<{ id: string; name: string; state?: string }>;
  onMunicipalitySelect: (id: string) => void;
  initialAudience?: string;
  onLogin: (user: SessionUser) => void;
  onClose: () => void;
}

export function AuthEntry({ municipalityId, municipalities, onMunicipalitySelect, initialAudience = AuthAudience.TUTOR, onLogin, onClose }: AuthEntryProps) {
  const [audience, setAudience] = useState(initialAudience);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentContext = useRef("");
  currentContext.current = `${audience}:${municipalityId}`;
  useEffect(() => { setIdentifier(""); setPassword(""); setShowPassword(false); setRecovery(false); setError(""); }, [municipalityId, audience]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    const context = currentContext.current;
    try {
      const user = await api.login(identifier.trim(), password, audience, municipalityId);
      if (context !== currentContext.current) { api.logout(); setError("O município de acesso mudou. Entre novamente."); return; }
      setPassword("");
      onLogin(user);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Não foi possível entrar. Tente novamente.");
      setPassword("");
    } finally { setLoading(false); }
  }
  return <div className="modal-backdrop"><div className="auth-modal compact-auth-modal" role="dialog" aria-modal="true" aria-label="Acesso ao sistema">
    <div className="tutor-auth-heading"><h2>Entrar no sistema</h2><button type="button" className="ghost-button" onClick={onClose} disabled={loading} aria-label="Fechar acesso">Fechar</button></div>
    <fieldset disabled={loading || recovery} className="follow-up-choice"><legend>Tipo de acesso</legend><label><input type="radio" name="auth-audience" checked={audience === AuthAudience.TUTOR} onChange={() => setAudience(AuthAudience.TUTOR)} /> Tutor</label><label><input type="radio" name="auth-audience" checked={audience === AuthAudience.STAFF} onChange={() => setAudience(AuthAudience.STAFF)} /> Equipe</label></fieldset>
    {audience === AuthAudience.TUTOR && <label className="field"><span>Município</span><select required value={municipalityId} onChange={(event) => onMunicipalitySelect(event.target.value)} disabled={loading || recovery}><option value="">Selecione o município</option>{municipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name}{municipality.state ? ` / ${municipality.state}` : ""}</option>)}</select></label>}
    {recovery ? <PasswordRecoveryForm key={`${audience}:${municipalityId}`} audience={audience} municipalityId={municipalityId} onBack={() => setRecovery(false)} /> : <form className="tutor-auth-form" onSubmit={submit}>
      <label className="field"><span>{audience === AuthAudience.TUTOR ? "CPF ou e-mail" : "E-mail da equipe"}</span><input type={audience === AuthAudience.TUTOR ? "text" : "email"} autoComplete="username" required maxLength={254} value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading} /></label>
      {audience === AuthAudience.TUTOR && <small>Se compartilha o e-mail com outra pessoa, use seu CPF.</small>}
      <label className="field password-field"><span>Senha</span><div><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} disabled={loading}><Eye size={18} /></button></div></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-action" disabled={loading || !identifier.trim() || !password || (audience === AuthAudience.TUTOR && !municipalityId)}>{loading ? "Entrando..." : "Entrar"}</button>
      <button type="button" className="ghost-button" disabled={loading || (audience === AuthAudience.TUTOR && !municipalityId)} onClick={() => setRecovery(true)}>Esqueceu a senha?</button>
    </form>}
  </div></div>;
}
