import { useEffect } from "react";
import type { RefObject } from "react";

const managedLayer = "[data-managed-dialog]";
const modalLayer = `${managedLayer}, .modal-backdrop`;
const dialogRole = "[role=dialog]";
const closeButton = "button[data-ui-close-button]";
const focusableControls = "button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]";

function dialogFor(layer: HTMLElement) {
  return layer.matches(dialogRole) ? layer : layer.querySelector<HTMLElement>(dialogRole);
}

function dialogControls(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableControls)).filter(
    (control) => control.tabIndex >= 0 && !control.matches(":disabled") && !control.closest("[hidden], [inert], [aria-hidden=true]") && control.getClientRects().length > 0,
  );
}

export function topModalLayer() {
  const layers = document.querySelectorAll(modalLayer);
  return layers[layers.length - 1];
}

export function useModalFocus(ref: RefObject<HTMLElement>, active = true, returnFocus?: HTMLElement | null) {
  useEffect(() => {
    const layer = ref.current;
    if (!active || !layer) return;
    const dialog = dialogFor(layer);
    if (!dialog) return;

    const trigger = returnFocus ?? document.activeElement;
    const controls = dialogControls(dialog);
    const initial = controls.find((control) => control.hasAttribute("data-dialog-initial-focus")) ?? controls[0];
    initial?.focus();

    const layers = Array.from(document.querySelectorAll<HTMLElement>(managedLayer));
    const previous = layers[layers.indexOf(layer) - 1];
    const previousDialog = previous ? dialogFor(previous) : null;
    const covered = previousDialog && !previousDialog.contains(layer) ? previousDialog : null;
    const wasInert = covered?.inert ?? false;
    if (covered) covered.inert = true;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || (event.key !== "Escape" && event.key !== "Tab")) return;
      if (topModalLayer() !== layer) return;

      if (event.key === "Escape") {
        const button = dialog.querySelector<HTMLButtonElement>(closeButton);
        if (!button || button.matches(":disabled")) return;
        event.preventDefault();
        event.stopPropagation();
        button.click();
        return;
      }

      const currentControls = dialogControls(dialog);
      const first = currentControls[0];
      const last = currentControls[currentControls.length - 1];
      if (!first || !last) return;
      const focused = document.activeElement;
      const wrap = event.shiftKey ? focused === first : focused === last;
      if (wrap || !currentControls.some((control) => control === focused)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (covered) covered.inert = wasInert;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [active, ref, returnFocus]);
}
