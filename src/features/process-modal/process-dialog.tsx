import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ProcessDialogProps {
  title: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}

// A small window over the process, with the look the assignment window already has.
export function ProcessDialog({ title, children, actions, onClose }: ProcessDialogProps) {
  return (
    <div className="assign-modal-overlay" onClick={onClose}>
      <div className="assign-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="assign-modal-header">
          <strong>{title}</strong>
          <button className="assign-modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>
        {children}
        <div className="assign-modal-actions">{actions}</div>
      </div>
    </div>
  );
}
