import type { ComponentPropsWithoutRef } from "react";

const buttonStyle = [
  "tw:inline-flex tw:min-h-10 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-full tw:border tw:border-solid tw:px-3.5",
  "tw:touch-manipulation tw:text-[0.85rem] tw:leading-none tw:whitespace-nowrap tw:motion-safe:transition",
  "tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent",
].join(" ");

const variantStyles = {
  primary: [
    "tw:border-[color:var(--ui-action)] tw:bg-[var(--ui-action)] tw:font-semibold tw:text-white",
    "tw:enabled:hover:border-[color:var(--ui-action-hover)] tw:enabled:hover:bg-[var(--ui-action-hover)]",
  ].join(" "),
  outline: [
    "tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-[color:var(--ink-700)]",
    "tw:enabled:hover:border-[color:var(--ink-200)] tw:enabled:hover:bg-card-page tw:enabled:hover:text-[color:var(--ink-900)]",
  ].join(" "),
  menu: [
    "tw:border-card-border tw:bg-card-surface tw:font-medium",
    "tw:not-aria-[current=true]:enabled:hover:border-[#c8d8ee] tw:not-aria-[current=true]:enabled:hover:bg-[#f6f9fd] tw:not-aria-[current=true]:enabled:hover:text-[color:var(--selected-ink)]",
    "tw:aria-[current=true]:border-[color:var(--ink-700)] tw:aria-[current=true]:bg-[var(--ui-action-soft)] tw:aria-[current=true]:text-[color:var(--selected-ink)]",
    "tw:aria-[current=true]:font-semibold tw:aria-[current=true]:shadow-[0_1px_2px_rgba(15,23,42,0.08)]",
  ].join(" "),
  danger: "tw:border-ui-danger tw:bg-ui-danger-soft tw:font-medium tw:text-ui-danger tw:enabled:hover:bg-ui-danger tw:enabled:hover:text-white",
  custom: "",
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: keyof typeof variantStyles;
};

export function Button({ variant = "primary", type = "button", className = "", ...props }: ButtonProps) {
  return <button {...props} type={type} data-ui-button="" className={`${buttonStyle} ${variantStyles[variant]} ${className}`.trim()} />;
}
