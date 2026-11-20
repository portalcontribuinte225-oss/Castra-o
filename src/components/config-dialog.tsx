import { useRef } from "react";
import type { ReactNode } from "react";
import { useModalFocus } from "./modal-focus";

export function ConfigDialogBackdrop({ children }: { children: ReactNode }) {
  const backdrop = useRef<HTMLDivElement>(null);
  useModalFocus(backdrop);
  return <div className="modal-backdrop" data-managed-dialog="" ref={backdrop}>{children}</div>;
}
