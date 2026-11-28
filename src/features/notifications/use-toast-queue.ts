import { useCallback, useMemo, useRef, useState } from "react";
import type { Toast, ToastNotice } from "../../components/toast-container";

const MAX_TOASTS = 3;

export function useToastQueue(scopeKey: string) {
  const scope = useMemo(() => ({ key: scopeKey }), [scopeKey]);
  const nextId = useRef(0);
  const [queue, setQueue] = useState({ scope, toasts: [] as Toast[] });
  if (queue.scope !== scope) setQueue({ scope, toasts: [] });

  const showToast = useCallback((notice: ToastNotice) => {
    const toast = { ...notice, id: ++nextId.current };
    // A late response from another municipality belongs to its previous queue.
    setQueue((current) => current.scope === scope
      ? { scope, toasts: [toast, ...current.toasts].slice(0, MAX_TOASTS) }
      : current);
  }, [scope]);

  const dismissToast = useCallback((id: number) => {
    setQueue((current) => current.scope === scope
      ? { scope, toasts: current.toasts.filter((toast) => toast.id !== id) }
      : current);
  }, [scope]);

  return { toasts: queue.scope === scope ? queue.toasts : [], showToast, dismissToast };
}
