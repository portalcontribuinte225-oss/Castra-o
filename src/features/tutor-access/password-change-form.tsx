import React, { useId, useState } from "react";
import { api, ApiError } from "../../api";
import { validateNewPassword } from "../../../shared/auth-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { CloseButton } from "../../components/close-button";
import { ConfigDialogBackdrop } from "../../components/config-dialog";
import { Input } from "../../components/input";
import { authErrorStyle, authFieldStyle, authFormStyle, authHeadingStyle, authLabelStyle, authTitleStyle } from "./auth-form-styles";
import type { SessionUser } from "./auth-types";
import { useAuthOperation } from "./use-auth-operation";

interface PasswordChangeFormProps {
  mandatory?: boolean;
  external?: boolean;
  modal?: boolean;
  returnFocus?: HTMLElement | null;
  onChanged: (user: SessionUser) => void;
  onCancel?: () => void;
}

const staffAction = "tw:border-[color:var(--action-primary-border)] tw:bg-[var(--action-primary)] tw:font-semibold tw:text-[color:var(--action-primary-ink)] tw:enabled:hover:bg-[var(--action-primary-hover)]";

export function PasswordChangeForm({ mandatory = false, external = false, modal = false, returnFocus, onChanged, onCancel }: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const operation = useAuthOperation("password-change");
  const titleId = useId();
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
  const title = <h2 className={authTitleStyle} id={modal ? titleId : undefined}>{mandatory ? "Crie sua senha de acesso" : "Alterar senha"}</h2>;
  const form = <form className={authFormStyle} onSubmit={submit}>
    {modal ? <div className={authHeadingStyle}>{title}{onCancel && <CloseButton onClick={onCancel} disabled={loading} />}</div> : title}
    {mandatory && <p>Antes de continuar, substitua a senha inicial por uma senha que só você conhece.</p>}
    <label className={authFieldStyle}><span className={authLabelStyle}>{mandatory ? "Senha inicial" : "Senha atual"}</span><Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={loading} /></label>
    <label className={authFieldStyle}><span className={authLabelStyle}>Nova senha</span><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /></label>
    <small>Use pelo menos 6 caracteres.</small>
    <label className={authFieldStyle}><span className={authLabelStyle}>Confirmar nova senha</span><Input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={loading} /></label>
    {error && <p className={authErrorStyle} role="alert">{error}</p>}
    <div className="tutor-auth-actions">
      <Button variant={external ? "primary" : "custom"} className={external ? undefined : staffAction} type="submit" disabled={loading || !currentPassword || !password || !confirm}>{loading ? "Salvando..." : "Salvar nova senha"}</Button>
      {onCancel && <Button variant="outline" onClick={onCancel} disabled={loading}>{mandatory ? "Sair" : "Cancelar"}</Button>}
    </div>
  </form>;

  return modal ? (
    <ConfigDialogBackdrop returnFocus={returnFocus}>
      <Card role="dialog" aria-modal="true" aria-labelledby={titleId} className="tw:w-full tw:max-w-[460px] tw:max-h-[calc(100dvh-44px)] tw:overflow-y-auto tw:p-5 tw:shadow-xl">
        {form}
      </Card>
    </ConfigDialogBackdrop>
  ) : form;
}
