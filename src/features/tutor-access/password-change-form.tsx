import React, { useState } from "react";
import { api, ApiError } from "../../api";
import { validateNewPassword } from "../../../shared/auth-contract.js";
import type { SessionUser } from "./auth-types";

export function PasswordChangeForm({ mandatory = false, onChanged, onCancel }: { mandatory?: boolean; onChanged: (user: SessionUser) => void; onCancel?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const issue = validateNewPassword(password);
    if (issue || password !== confirm) { setError(issue || "As senhas não conferem."); return; }
    setLoading(true);
    setError("");
    try {
      const user = await api.changePassword({ currentPassword, password });
      setCurrentPassword(""); setPassword(""); setConfirm("");
      onChanged(user);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Não foi possível alterar a senha. Tente novamente.");
    } finally { setLoading(false); }
  }
  return <form className="tutor-auth-form" onSubmit={submit}>
    <h2>{mandatory ? "Crie sua senha de acesso" : "Alterar senha"}</h2>
    {mandatory && <p>Antes de continuar, substitua a senha inicial por uma senha que só você conhece.</p>}
    <label className="field"><span>{mandatory ? "Senha inicial" : "Senha atual"}</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={loading} /></label>
    <label className="field"><span>Nova senha</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /></label>
    <small>Use pelo menos 15 caracteres. Espaços e gerenciadores de senha são permitidos.</small>
    <label className="field"><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={loading} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="tutor-auth-actions"><button className="primary-action" type="submit" disabled={loading || !currentPassword || !password || !confirm}>{loading ? "Salvando..." : "Salvar nova senha"}</button>{onCancel && <button type="button" className="ghost-button" onClick={onCancel} disabled={loading}>{mandatory ? "Sair" : "Cancelar"}</button>}</div>
  </form>;
}
