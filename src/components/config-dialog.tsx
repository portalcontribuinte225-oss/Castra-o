import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const configBackdrop = "[data-config-dialog]";
const focusableControls = "button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";

function dialogControls(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableControls)).filter(
    (control) => control.tabIndex >= 0 && !control.closest("[hidden], [inert], [aria-hidden=true]") && control.getClientRects().length > 0,
  );
}

export function ConfigDialogBackdrop({ children }: { children: ReactNode }) {
  const backdrop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = backdrop.current;
    const dialog = node?.querySelector<HTMLElement>("[role=dialog]");
    if (!node || !dialog) return;

    const trigger = document.activeElement;
    dialogControls(dialog)[0]?.focus();
    const backdrops = Array.from(document.querySelectorAll<HTMLElement>(configBackdrop));
    const previous = backdrops[backdrops.indexOf(node) - 1];
    const covered = previous && !previous.contains(node) ? previous : undefined;
    const wasInert = covered?.inert ?? false;
    if (covered) covered.inert = true;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.key !== "Escape" && event.key !== "Tab")) return;
      const layers = document.querySelectorAll(".modal-backdrop");
      if (layers[layers.length - 1] !== node) return;
      if (event.key === "Escape") {
        const close = dialog.querySelector<HTMLButtonElement>("button[data-ui-close-button]:not(:disabled)");
        if (close) {
          event.preventDefault();
          event.stopPropagation();
          close.click();
        }
        return;
      }
      const controls = dialogControls(dialog);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const focused = document.activeElement;
      const wrap = event.shiftKey ? focused === first : focused === last;
      if (wrap || !controls.some((control) => control === focused)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (covered) covered.inert = wasInert;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return <div className="modal-backdrop" data-config-dialog="" ref={backdrop}>{children}</div>;
}
