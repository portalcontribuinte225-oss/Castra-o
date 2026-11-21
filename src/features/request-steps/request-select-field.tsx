import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { fieldControlStyle } from "../../components/input";

type RequestSelectFieldProps = ComponentPropsWithoutRef<"select"> & { label: string };

export function RequestSelectField({ label, className = "", children, "aria-label": accessibleLabel = label, ...props }: RequestSelectFieldProps) {
  return (
    <label className={`tw:grid tw:min-w-0 tw:content-start tw:gap-1 ${className}`.trim()}>
      <span className="tw:text-[0.8125rem] tw:font-medium tw:text-ui-text">{label}</span>
      <span className="tw:relative tw:block tw:min-w-0">
        <select
          aria-label={accessibleLabel}
          {...props}
          data-ui-select=""
          className={`${fieldControlStyle} tw:appearance-none tw:pr-9 tw:disabled:cursor-not-allowed ${props.value === "" ? "tw:text-ui-muted" : ""}`.trim()}
        >
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:right-[13px] tw:top-1/2 tw:-translate-y-1/2 tw:text-ui-muted" />
      </span>
    </label>
  );
}
