import React, { useState } from "react";
import { api, ApiError } from "../../api";
import { validateNewPassword } from "../../../shared/auth-contract.js";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { authErrorStyle, authFieldStyle, authFormStyle, authLabelStyle, authTitleStyle } from "./auth-form-styles";
import type { SessionUser } from "./auth-types";
import { useAuthOperation } from "./use-auth-operation";

export function PasswordChangeForm({ mandatory = false, external = false, onChanged, onCancel }: { mandatory?: boolean; external?: boolean; onChanged: (user: SessionUser) => void; onCancel?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const operation = useAuthOperation("password-change");
  const PasswordInput = external ? Input : "input";
  const FormButton = external ? Button : "button";
  const fieldStyle = external ? authFieldStyle : "field";
  const labelStyle = external ? authLabelStyle : undefined;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const issue = validateNewPassword(password);
    if (issue || password !== confirm) { setError(issue || "As senhas não conferem."); return; }
    setLoading(true);
    setError("");
    const request = operation.begin();
    try {
      const user = await api.changePassword({ currentPassword, password }, request);
      if (!request.isCurrent()) return;
      setCurrentPassword(""); setPassword(""); setConfirm("");
      onChanged(user);
    } catch (failure) {
      if (request.isCurrent()) setError(failure instanceof ApiError ? failure.message : "Não foi possível alterar a senha. Tente novamente.");
    } finally { if (request.isCurrent()) setLoading(false); }
  }
  return <form className={external ? authFormStyle : "tutor-auth-form"} onSubmit={submit}>
    <h2 className={external ? authTitleStyle : undefined}>{mandatory ? "Crie sua senha de acesso" : "Alterar senha"}</h2>
    {mandatory && <p>Antes de continuar, substitua a senha inicial por uma senha que só você conhece.</p>}
    <label className={fieldStyle}><span className={labelStyle}>{mandatory ? "Senha inicial" : "Senha atual"}</span><PasswordInput type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={loading} /></label>
    <label className={fieldStyle}><span className={labelStyle}>Nova senha</span><PasswordInput type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /></label>
    <small>Use pelo menos 6 caracteres.</small>
    <label className={fieldStyle}><span className={labelStyle}>Confirmar nova senha</span><PasswordInput type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={loading} /></label>
    {error && <p className={external ? authErrorStyle : "form-error"} role="alert">{error}</p>}
    <div className="tutor-auth-actions">
      <FormButton className={external ? undefined : "primary-action"} type="submit" disabled={loading || !currentPassword || !password || !confirm}>{loading ? "Salvando..." : "Salvar nova senha"}</FormButton>
      {onCancel && <FormButton type="button" variant={external ? "outline" : undefined} className={external ? undefined : "ghost-button"} onClick={onCancel} disabled={loading}>{mandatory ? "Sair" : "Cancelar"}</FormButton>}
    </div>
  </form>;
}
