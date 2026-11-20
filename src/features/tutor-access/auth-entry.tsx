import { Eye } from "lucide-react";
import { useId, useState } from "react";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { CloseButton } from "../../components/close-button";
import { Input } from "../../components/input";
import { PasswordRecoveryForm } from "./password-recovery-form";
import { useAuthLogin } from "./use-auth-login";
import type { AuthAudienceValue, SessionUser } from "./auth-types";

interface AuthEntryProps {
  municipalityId: string;
  audience: AuthAudienceValue;
  onLogin: (user: SessionUser) => void;
  onClose: () => void;
}

const staffBackdropStyle = "tw:fixed tw:inset-0 tw:z-300 tw:grid tw:place-items-center tw:bg-ui-ink/46 tw:p-3 tw:min-[721px]:p-6";
const staffDialogStyle = [
  "tw:grid tw:w-[min(520px,calc(100vw-40px))] tw:gap-3 tw:overflow-auto tw:px-5 tw:py-[18px]",
  "tw:max-h-[calc(100dvh-24px)] tw:min-[721px]:max-h-[calc(100dvh-48px)] tw:shadow-[0_28px_80px_rgba(15,23,42,0.22)]",
].join(" ");
const staffFieldStyle = "tw:grid tw:min-w-0 tw:gap-1.5";
const staffLabelStyle = "tw:text-[0.66rem] tw:font-medium tw:text-ui-muted";
const staffPasswordToggleStyle = [
  "tw:absolute tw:end-1.5 tw:top-1/2 tw:grid tw:size-[34px] tw:-translate-y-1/2 tw:place-items-center tw:rounded-[var(--radius)]",
  "tw:border-0 tw:bg-transparent tw:p-0 tw:text-ui-muted tw:enabled:hover:bg-ui-accent-soft tw:enabled:hover:text-ui-accent-strong",
  "tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-ui-accent",
].join(" ");

export function AuthEntry({ municipalityId, audience, onLogin, onClose }: AuthEntryProps) {
  const login = useAuthLogin(audience, municipalityId, onLogin);
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState("");
  const tutor = audience === AuthAudience.TUTOR;
  const staffLogin = !tutor && !recovery;
  const missingMunicipality = tutor && !municipalityId;
  const Dialog = staffLogin ? Card : "div";
  const LoginInput = staffLogin ? Input : "input";
  const LoginButton = staffLogin ? Button : "button";
  const labelStyle = staffLogin ? staffLabelStyle : undefined;

  function closeAccess() {
    login.reset();
    onClose();
  }

  function openRecovery() {
    login.setPassword("");
    setShowPassword(false);
    setNotice("");
    setRecovery(true);
  }

  function backToLogin() {
    setRecovery(false);
    setShowPassword(false);
  }

  function finishRecovery() {
    login.reset();
    backToLogin();
    setNotice("Senha salva.");
  }

  return (
    <div className={staffLogin ? staffBackdropStyle : "modal-backdrop"}>
      <Dialog
        className={staffLogin ? staffDialogStyle : "auth-modal compact-auth-modal"}
        role="dialog"
        aria-modal="true"
        aria-label={recovery ? "Recuperar acesso" : tutor ? "Acesso de tutor" : "Acesso da equipe"}
      >
        <div className={staffLogin ? "tw:flex tw:items-center tw:justify-between tw:gap-3" : "tutor-auth-heading"}>
          {!recovery && <h2 className={staffLogin ? "tw:m-0 tw:text-2xl tw:leading-[1.08] tw:text-ui-ink" : undefined}>{tutor ? "Entrar como tutor" : "Entrar como equipe"}</h2>}
          {staffLogin ? (
            <CloseButton aria-label="Fechar acesso" onClick={closeAccess} />
          ) : (
            <button type="button" className="ghost-button" onClick={closeAccess} aria-label="Fechar acesso" style={recovery ? { marginLeft: "auto" } : undefined}>Fechar</button>
          )}
        </div>
        {missingMunicipality ? (
          <p className="form-error" role="alert">Selecione o município na página.</p>
        ) : recovery ? (
          <PasswordRecoveryForm
            key={`${audience}:${municipalityId}`}
            audience={audience}
            municipalityId={municipalityId}
            initialIdentifier={login.identifier}
            onBack={backToLogin}
            onRecovered={finishRecovery}
          />
        ) : (
          <form className={staffLogin ? "tw:grid tw:w-full tw:gap-4" : "tutor-auth-form"} onSubmit={(event) => {
            event.preventDefault();
            void login.submit();
          }}>
            <label className={staffLogin ? staffFieldStyle : "field"}>
              <span className={labelStyle}>{tutor ? "CPF ou e-mail" : "E-mail da equipe"}</span>
              <LoginInput
                type={tutor ? "text" : "email"}
                autoComplete="username"
                required
                maxLength={254}
                value={login.identifier}
                onChange={(event) => login.setIdentifier(event.target.value)}
                disabled={login.loading}
              />
            </label>
            {tutor && <small>Se compartilha o e-mail, use seu CPF.</small>}
            <div className={staffLogin ? staffFieldStyle : "field password-field"}>
              <span className={labelStyle}><label htmlFor={passwordId}>Senha</label></span>
              <div className={staffLogin ? "tw:relative" : undefined}>
                <LoginInput
                  id={passwordId}
                  className={staffLogin ? "tw:pe-11" : undefined}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={login.password}
                  onChange={(event) => login.setPassword(event.target.value)}
                  disabled={login.loading}
                />
                <button
                  type="button"
                  className={staffLogin ? staffPasswordToggleStyle : undefined}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  disabled={login.loading}
                >
                  <Eye size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            {notice && <p role="status" className={staffLogin ? "tw:m-0 tw:text-sm tw:text-ui-text" : undefined}>{notice}</p>}
            {login.error && <p role="alert" className={staffLogin ? "tw:m-0 tw:text-sm tw:font-semibold tw:text-ui-danger" : "form-error"}>{login.error}</p>}
            <LoginButton type="submit" className={staffLogin ? undefined : "primary-action"} disabled={login.loading || !login.identifier.trim() || !login.password}>
              {login.loading ? "Entrando..." : "Entrar"}
            </LoginButton>
            <LoginButton
              type="button"
              variant={staffLogin ? "outline" : undefined}
              className={staffLogin ? undefined : "ghost-button"}
              disabled={login.loading}
              onClick={openRecovery}
            >
              Esqueceu a senha?
            </LoginButton>
          </form>
        )}
      </Dialog>
    </div>
  );
}
