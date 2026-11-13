import React from "react";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { PasswordChangeForm } from "./password-change-form";
import type { SessionUser } from "./auth-types";

interface SessionBoundaryProps {
  session: { user: SessionUser | null; ready: boolean; error: string; accept: (user: SessionUser | null) => void; logout: () => void; retry: () => void };
  renderWorkspace: (user: SessionUser | null) => React.ReactNode;
  renderTutor: (user: SessionUser) => React.ReactNode;
}

export function SessionBoundary({ session, renderWorkspace, renderTutor }: SessionBoundaryProps) {
  if (!session.ready) return <main className="tutor-access-shell"><h1>Acesso ao sistema</h1>{session.error ? <><p role="alert" className="form-error">{session.error}</p><button type="button" className="primary-action" onClick={session.retry}>Tentar novamente</button><button type="button" className="ghost-button" onClick={session.logout}>Sair</button></> : <p role="status">Validando sua sessão...</p>}</main>;
  if (session.user?.mustChangePassword) return <main className="tutor-access-shell"><PasswordChangeForm mandatory onChanged={session.accept} onCancel={session.logout} /></main>;
  if (session.user?.role === AuthAudience.TUTOR) return <>{renderTutor(session.user)}</>;
  return <>{renderWorkspace(session.user)}</>;
}
