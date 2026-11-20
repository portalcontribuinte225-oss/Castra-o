import { useId } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Input } from "../../components/input";

type RequestTextFieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  error?: string;
};

export function RequestTextField({ label, error, className = "", "aria-label": accessibleLabel = label, "aria-invalid": invalid = Boolean(error), ...props }: RequestTextFieldProps) {
  const errorId = useId();
  const description = [props["aria-describedby"], error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <label className={`tw:grid tw:min-w-0 tw:content-start tw:gap-1 ${className}`.trim()}>
      <span className="tw:text-[0.8125rem] tw:font-medium tw:text-ui-text">{label}</span>
      <Input {...props} aria-label={accessibleLabel} aria-invalid={invalid} aria-describedby={description} />
      {error && <small id={errorId} className="tw:text-xs tw:text-ui-danger">{error}</small>}
    </label>
  );
}
