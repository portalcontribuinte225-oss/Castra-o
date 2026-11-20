import React from "react";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { PasswordChangeForm } from "./password-change-form";
import type { SessionUser } from "./auth-types";

interface SessionBoundaryProps {
  session: { user: SessionUser | null; ready: boolean; error: string; accept: (user: SessionUser | null) => void; logout: () => void; retry: () => void };
  renderWorkspace: (user: SessionUser | null) => React.ReactNode;
  renderTutor: (user: SessionUser) => React.ReactNode;
}

export function SessionBoundary({ session, renderWorkspace, renderTutor }: SessionBoundaryProps) {
  if (!session.ready) return <main className="tutor-access-shell">
    <Card as="section" className="tw:grid tw:gap-4 tw:p-5">
      <h1 className="tw:m-0 tw:text-2xl">Acesso ao sistema</h1>
      {session.error ? <>
        <p role="alert" className="form-error">{session.error}</p>
        <div className="tutor-auth-actions">
          <Button onClick={session.retry}>Tentar novamente</Button>
          <Button variant="outline" onClick={session.logout}>Sair</Button>
        </div>
      </> : <p role="status">Validando sua sessão...</p>}
    </Card>
  </main>;
  if (session.user?.mustChangePassword) {
    return <main className="tutor-access-shell">
      <PasswordChangeForm mandatory external={session.user.role === AuthAudience.TUTOR} onChanged={session.accept} onCancel={session.logout} />
    </main>;
  }
  if (session.user?.role === AuthAudience.TUTOR) return <>{renderTutor(session.user)}</>;
  return <>{renderWorkspace(session.user)}</>;
}
