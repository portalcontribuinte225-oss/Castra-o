import { createContext, useContext, useId, useRef } from "react";
import type { ReactNode } from "react";
import { CloseButton } from "../../components/close-button";
import { useModalFocus } from "../../components/modal-focus";

export const ProcessDialogErrorContext = createContext("");

interface ProcessDialogProps {
  title: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  busy: boolean;
  className?: string;
}

export function ProcessDialog({ title, children, actions, onClose, busy, className = "" }: ProcessDialogProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const error = useContext(ProcessDialogErrorContext);
  useModalFocus(overlay);
  return (
    <div className="prm-dialog-overlay" ref={overlay} data-managed-dialog="" onClick={(event) => {
      if (!busy && event.target === event.currentTarget) onClose();
    }}>
      <div className={`prm-dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}>
        <div className="prm-dialog-head">
          <h3 id={titleId}>{title}</h3>
          <CloseButton disabled={busy} onClick={onClose} />
        </div>
        {children}
        {error && <p className="form-error-msg" role="alert">{error}</p>}
        {actions && <div className="prm-dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}
