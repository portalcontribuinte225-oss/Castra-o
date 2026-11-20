import { Eye } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { CloseButton } from "../../components/close-button";
import { Input } from "../../components/input";
import { authErrorStyle, authFieldStyle, authFormStyle, authHeadingStyle, authLabelStyle, authTitleStyle } from "./auth-form-styles";
import { PasswordRecoveryForm } from "./password-recovery-form";
import { useAuthLogin } from "./use-auth-login";
import type { AuthAudienceValue, SessionUser } from "./auth-types";

interface AuthEntryProps {
  municipalityId: string;
  audience: AuthAudienceValue;
  onLogin: (user: SessionUser) => void;
  onClose: () => void;
}

const backdropStyle = "tw:fixed tw:inset-0 tw:z-300 tw:grid tw:place-items-center tw:bg-ui-ink/46 tw:p-3 tw:min-[721px]:p-6";
const dialogStyle = [
  "tw:grid tw:w-[min(520px,calc(100vw-40px))] tw:gap-3 tw:overflow-auto tw:px-5 tw:py-[18px]",
  "tw:max-h-[calc(100dvh-24px)] tw:min-[721px]:max-h-[calc(100dvh-48px)] tw:shadow-[0_28px_80px_rgba(15,23,42,0.22)]",
].join(" ");
const passwordToggleStyle = [
  "tw:absolute tw:end-1.5 tw:top-1/2 tw:grid tw:size-[34px] tw:-translate-y-1/2 tw:place-items-center tw:rounded-[var(--radius)]",
  "tw:border-0 tw:bg-transparent tw:p-0 tw:text-ui-muted tw:enabled:hover:bg-ui-accent-soft tw:enabled:hover:text-ui-accent-strong",
  "tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-ui-accent",
].join(" ");
const focusableControls = "button:not(:disabled), input:not(:disabled)";

export function AuthEntry({ municipalityId, audience, onLogin, onClose }: AuthEntryProps) {
  const login = useAuthLogin(audience, municipalityId, onLogin);
  const passwordId = useId();
  const modal = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState("");
  const tutor = audience === AuthAudience.TUTOR;
  const missingMunicipality = tutor && !municipalityId;

  useEffect(() => {
    const trigger = document.activeElement;
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    if (recovery) return;
    const input = modal.current?.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    (input || modal.current?.querySelector<HTMLButtonElement>("button"))?.focus();
  }, [recovery, missingMunicipality]);

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

  function handleDialogKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAccess();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(focusableControls)];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && controls.includes(active) && active !== (event.shiftKey ? first : last)) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }

  return (
    <div className={backdropStyle} ref={modal} onKeyDown={handleDialogKey}>
      <Card
        className={dialogStyle}
        role="dialog"
        aria-modal="true"
        aria-label={recovery ? "Recuperar acesso" : tutor ? "Acesso de tutor" : "Acesso da equipe"}
      >
        {!recovery && (
          <div className={authHeadingStyle}>
            <h2 className={authTitleStyle}>{tutor ? "Entrar como tutor" : "Entrar como equipe"}</h2>
            <CloseButton aria-label="Fechar acesso" onClick={closeAccess} />
          </div>
        )}
        {missingMunicipality ? (
          <p className={authErrorStyle} role="alert">Selecione o município na página.</p>
        ) : recovery ? (
          <PasswordRecoveryForm
            key={`${audience}:${municipalityId}`}
            audience={audience}
            municipalityId={municipalityId}
            initialIdentifier={login.identifier}
            onBack={backToLogin}
            onRecovered={finishRecovery}
            onClose={closeAccess}
          />
        ) : (
          <form className={authFormStyle} onSubmit={(event) => {
            event.preventDefault();
            void login.submit();
          }}>
            <label className={authFieldStyle}>
              <span className={authLabelStyle}>{tutor ? "CPF ou e-mail" : "E-mail da equipe"}</span>
              <Input
                type={tutor ? "text" : "email"}
                autoComplete="username"
                required
                maxLength={254}
                value={login.identifier}
                onChange={(event) => login.setIdentifier(event.target.value)}
                disabled={login.loading}
              />
            </label>
            {tutor && <small className="tw:text-ui-muted">Se compartilha o e-mail, use seu CPF.</small>}
            <div className={authFieldStyle}>
              <span className={authLabelStyle}><label htmlFor={passwordId}>Senha</label></span>
              <div className="tw:relative">
                <Input
                  id={passwordId}
                  className="tw:pe-11"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={login.password}
                  onChange={(event) => login.setPassword(event.target.value)}
                  disabled={login.loading}
                />
                <button
                  type="button"
                  className={passwordToggleStyle}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  disabled={login.loading}
                >
                  <Eye size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            {notice && <p role="status" className="tw:m-0 tw:text-sm tw:text-ui-text">{notice}</p>}
            {login.error && <p role="alert" className={authErrorStyle}>{login.error}</p>}
            <Button type="submit" disabled={login.loading || !login.identifier.trim() || !login.password}>
              {login.loading ? "Entrando..." : "Entrar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={login.loading}
              onClick={openRecovery}
            >
              Esqueceu a senha?
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
