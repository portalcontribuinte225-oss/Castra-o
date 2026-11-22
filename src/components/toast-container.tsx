import type { AnyRecord } from "../types";

// The short notices of the staff area; a click dismisses one.
export function ToastContainer({ toasts, onDismiss }: AnyRecord) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" role="region" aria-live="polite">
      {toasts.map((toast: AnyRecord) => (
        <div key={toast.id} className={`toast toast--${toast.type}`} onClick={() => onDismiss(toast.id)}>
          <span className="toast-msg">{toast.message}</span>
          <button className="toast-close" type="button" aria-label="Fechar" onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}>×</button>
        </div>
      ))}
    </div>
  );
}
