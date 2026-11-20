import type { ComponentPropsWithoutRef } from "react";

const inputStyle = [
  "tw:block tw:h-11 tw:w-full tw:min-w-0 tw:rounded-[var(--ui-radius-md)] tw:border tw:border-solid tw:border-card-border tw:bg-card-surface tw:px-[13px] tw:text-sm tw:text-ui-ink",
  "tw:focus:border-ui-accent tw:focus:outline-hidden",
  "tw:aria-[invalid=true]:border-ui-danger tw:aria-[invalid=true]:focus:border-2 tw:aria-[invalid=true]:focus:border-ui-danger",
].join(" ");

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input {...props} data-ui-input="" className={`${inputStyle} ${className}`.trim()} />;
}
