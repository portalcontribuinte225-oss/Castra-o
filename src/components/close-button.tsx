import { X } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

type CloseButtonProps = Pick<ComponentPropsWithoutRef<"button">, "aria-label" | "disabled" | "onClick">;

const closeButtonStyle = [
  "tw:inline-flex tw:h-[34px] tw:w-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[10px] tw:border tw:border-solid tw:p-0",
  "tw:border-[#fecdd3] tw:bg-ui-danger-soft tw:text-[#be123c]",
  "tw:hover:border-[#fda4af] tw:hover:bg-[#ffe4e6] tw:hover:text-[#9f1239]",
  "tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-[#be123c]",
].join(" ");

export function CloseButton({ "aria-label": label = "Fechar", disabled, onClick }: CloseButtonProps) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={closeButtonStyle}>
      <X size={17} aria-hidden="true" />
    </button>
  );
}
