import type { ComponentPropsWithoutRef } from "react";

const inputStyle = [
  "tw:block tw:h-11 tw:w-full tw:min-w-0 tw:rounded-[10px] tw:border tw:border-solid tw:border-card-border tw:bg-card-surface tw:px-[13px] tw:text-sm tw:text-ui-ink",
  "tw:focus:border-ui-accent tw:focus:outline-2 tw:focus:outline-offset-1 tw:focus:outline-ui-accent/45",
  "tw:aria-[invalid=true]:border-ui-danger tw:aria-[invalid=true]:focus:border-ui-danger tw:aria-[invalid=true]:focus:outline-ui-danger/45",
].join(" ");

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={`${inputStyle} ${className}`.trim()} />;
}
