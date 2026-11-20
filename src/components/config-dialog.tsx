import { useRef } from "react";
import type { ReactNode } from "react";
import { useModalFocus } from "./modal-focus";

export function ConfigDialogBackdrop({ children, returnFocus }: { children: ReactNode; returnFocus?: HTMLElement | null }) {
  const backdrop = useRef<HTMLDivElement>(null);
  useModalFocus(backdrop, true, returnFocus);
  return <div className="modal-backdrop" data-managed-dialog="" ref={backdrop}>{children}</div>;
}
