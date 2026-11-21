import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const fieldControlStyle = [
  "tw:block tw:h-11 tw:w-full tw:min-w-0 tw:rounded-[var(--ui-radius-md)] tw:border tw:border-solid tw:border-card-border tw:bg-card-surface tw:px-[13px] tw:text-sm tw:text-ui-ink",
  "tw:focus:border-ui-accent tw:focus:outline-hidden",
  "tw:aria-invalid:border-ui-danger tw:aria-invalid:focus:border-ui-danger",
].join(" ");

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(function Input(
  { className = "", ...props },
  ref,
) {
  return <input {...props} ref={ref} data-ui-input="" className={`${fieldControlStyle} ${className}`.trim()} />;
});
