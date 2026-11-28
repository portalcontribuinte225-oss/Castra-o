import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

const statusIcons = { success: CircleCheck, warning: TriangleAlert };

export interface ToastNotice {
  title: string;
  detail?: string;
  tone: keyof typeof statusIcons;
}

export type Toast = ToastNotice & { id: number };

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { id, title, detail, tone } = toast;
  const Icon = statusIcons[tone];
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(() => onDismiss(id), tone === "success" ? 5000 : 9000);
    return () => window.clearTimeout(timer);
  }, [id, tone, hovered, focused, onDismiss]);

  return (
    <div className="toast" data-tone={tone} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Icon className="toast-icon" size={20} aria-hidden="true" />
      <div className="toast-msg">
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
      </div>
      <button className="toast-close" type="button" aria-label={`Fechar aviso: ${title}`}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onClick={() => onDismiss(id)}>
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="toast-container" role="region" aria-label="Avisos do sistema" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />)}
    </div>,
    document.body,
  );
}
