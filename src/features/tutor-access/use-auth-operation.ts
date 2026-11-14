import { useCallback, useEffect, useRef } from "react";
import type { AuthRequestOptions } from "./auth-types";

export function useAuthOperation(context: string) {
  const currentContext = useRef(context);
  currentContext.current = context;
  const mounted = useRef(true);
  const version = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { version.current += 1; controller.current?.abort(); controller.current = null; }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancel(); }; }, [context, cancel]);
  const begin = useCallback((): AuthRequestOptions & { isCurrent: () => boolean } => {
    cancel();
    const startedVersion = version.current;
    const startedContext = currentContext.current;
    const requestController = new AbortController();
    controller.current = requestController;
    return { signal: requestController.signal, isCurrent: () => mounted.current && !requestController.signal.aborted && startedVersion === version.current && startedContext === currentContext.current };
  }, [cancel]);
  return { begin, cancel };
}
