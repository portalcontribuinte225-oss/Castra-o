import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Input } from "../../components/input";

type RequestTextFieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  error?: string;
};

// A required field says so in its title, with the same red asterisk as the choice cards; the hint inside the field never carries it.
export const RequestTextField = forwardRef<HTMLInputElement, RequestTextFieldProps>(function RequestTextField(
  { label, error, className = "", "aria-label": accessibleLabel = label, "aria-invalid": invalid = Boolean(error), ...props },
  ref,
) {
  const errorId = useId();
  const description = [props["aria-describedby"], error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <label className={`tw:grid tw:min-w-0 tw:content-start tw:gap-1 ${className}`.trim()}>
      <span className="tw:text-[0.8125rem] tw:font-medium tw:text-ui-text">{label}{props.required && <span className="required-asterisk">*</span>}</span>
      <Input {...props} ref={ref} aria-label={accessibleLabel} aria-invalid={invalid} aria-describedby={description} />
      {error && <small id={errorId} className="tw:text-xs tw:text-ui-danger">{error}</small>}
    </label>
  );
});
