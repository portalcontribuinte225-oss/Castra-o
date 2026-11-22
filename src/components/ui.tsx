import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnyRecord } from "../types";
import { statusLabels } from "../domain";
import { Card } from "./card";
import { Button } from "./button";
import { CloseButton } from "./close-button";
import { Input } from "./input";

export function EmptyState({ title, text, action, onAction }: AnyRecord) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
      {action && <button className="secondary-action" type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function InfoTile({ label, value }: AnyRecord) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

export function ConfigSectionHeader({ title, createLabel, onCreate, children }: AnyRecord) {
  return (
    <div className="tw:mb-3 tw:flex tw:min-h-[50px] tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
      <h2 className="tw:m-0 tw:text-base tw:font-semibold tw:text-ui-ink">{title}</h2>
      {(children || createLabel) && <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        {children}
        {createLabel && (
          <Button onClick={onCreate}>
            <Plus size={15} aria-hidden="true" />
            {createLabel}
          </Button>
        )}
      </div>}
    </div>
  );
}

export function ConfigStatusFilter({ value, onChange, activeCount = 0, inactiveCount = 0 }: AnyRecord) {
  const items = [
    { id: "active", label: `Ativos (${activeCount})` },
    { id: "inactive", label: `Inativos (${inactiveCount})` },
    { id: "all", label: "Todos" },
  ];
  return (
    <div className="tw:flex tw:flex-wrap tw:gap-1.5" role="group" aria-label="Filtrar por situação">
      {items.map((item) => (
        <Button
          key={item.id}
          variant="custom"
          aria-pressed={value === item.id}
          className="tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:aria-pressed:border-ui-accent tw:aria-pressed:bg-ui-accent-soft tw:aria-pressed:text-ui-accent-strong"
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

export function ConfigRow({ className = "", children, ...props }: ComponentPropsWithoutRef<"button">) {
  return (
    <Card as="button" {...props} className={`config-list-row tw:flex tw:min-h-[72px] tw:w-full tw:items-center tw:overflow-hidden tw:p-0 tw:text-left tw:touch-manipulation tw:max-[760px]:min-h-[84px] tw:hover:border-ui-accent tw:hover:bg-card-page tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-ui-accent ${className}`.trim()}>
      {children}
    </Card>
  );
}

export function ConfigActiveToggle({ checked, onChange, onText = "Ativo", offText = "Inativo", disabled = false }: AnyRecord) {
  return (
    <label className="tw:inline-flex tw:min-h-10 tw:w-fit tw:max-w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-solid tw:border-card-border tw:bg-card-surface tw:px-3 tw:text-sm tw:font-medium tw:text-ui-text">
      <input className="tw:peer tw:sr-only" type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span aria-hidden="true" className="tw:relative tw:h-5 tw:w-9 tw:shrink-0 tw:rounded-full tw:bg-[var(--ink-200)] tw:peer-checked:bg-ui-accent tw:peer-checked:[&>span]:translate-x-4 tw:peer-focus-visible:outline-2 tw:peer-focus-visible:outline-offset-2 tw:peer-focus-visible:outline-ui-accent">
        <span className="tw:absolute tw:start-0.5 tw:top-0.5 tw:size-4 tw:rounded-full tw:bg-white tw:motion-safe:transition-transform" />
      </span>
      <span>{checked ? onText : offText}</span>
    </label>
  );
}

interface MetricProps {
  title: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: ReactNode;
  compact?: boolean;
}

export function Metric({ title, value, icon: Icon, trend, compact = false }: MetricProps) {
  return (
    <Card data-dashboard-metric={compact ? undefined : ""} className={compact ? "tw:flex tw:items-center tw:gap-3 tw:px-5 tw:py-4 tw:shadow-[0_4px_16px_rgba(15,23,42,0.05)]" : "tw:flex tw:min-h-[104px] tw:min-w-0 tw:items-center tw:gap-3 tw:p-4 tw:max-[560px]:flex-col tw:max-[560px]:items-start"}>
      <div className={compact ? "tw:shrink-0 tw:text-ui-accent" : "tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-[var(--ui-radius-md)] tw:bg-[var(--ui-action)] tw:text-white"}>
        {Icon && <Icon size={compact ? 20 : 22} aria-hidden="true" />}
      </div>
      <div className={compact ? "tw:flex tw:flex-col" : "tw:grid tw:min-w-0 tw:gap-1"}>
        <span className={compact ? "tw:text-[0.7rem] tw:text-ui-muted" : "tw:text-sm tw:font-medium tw:text-ui-muted"}>{title}</span>
        <strong className={compact ? "tw:order-first tw:text-[1.05rem] tw:font-bold tw:text-ui-ink" : "tw:truncate tw:text-xl tw:font-semibold tw:text-ui-ink tw:tabular-nums"}>{value}</strong>
        {trend && <small className={compact ? undefined : "tw:text-xs tw:text-ui-muted"}>{trend}</small>}
      </div>
    </Card>
  );
}

export function PanelHeader({ title, action, onAction, aside, actionClassName = "ghost-button" }: AnyRecord) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {aside}
      {action && <button className={actionClassName} type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, actions, icon: Icon, appearance }: AnyRecord) {
  return (
    <div className="modal-header">
      {Icon && (
        <div className="modal-header-icon">
          <Icon size={18} />
        </div>
      )}
      <div className="modal-header-text">
        {title && <h2>{title}</h2>}
        {subtitle && <p className="modal-header-sub">{subtitle}</p>}
      </div>
      {actions}
      {appearance === "config" ? (
        <CloseButton onClick={onClose} />
      ) : (
        <button className="modal-header-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status, className = "" }: AnyRecord) {
  return <span className={`status-badge status-${status} ${className}`}>{statusLabels[status] || status}</span>;
}

export const configFieldStyle = "tw:grid tw:min-w-0 tw:content-start tw:gap-1.5 tw:text-sm tw:font-medium tw:text-ui-text";
export const configTextareaStyle = "tw:block tw:w-full tw:min-w-0 tw:rounded-[var(--ui-radius-md)] tw:border tw:border-solid tw:border-card-border tw:bg-card-surface tw:px-[13px] tw:py-2.5 tw:text-sm tw:text-ui-ink tw:focus:border-ui-accent tw:focus:outline-hidden tw:aria-invalid:border-ui-danger tw:aria-invalid:focus:border-ui-danger";

type ConfigFieldProps = Omit<ComponentPropsWithoutRef<"input">, "onChange"> & {
  label: ReactNode;
  invalid?: boolean;
  onChange?: (value: string) => void;
};

export function ConfigField({ label, className = "", value, type = "text", invalid, onChange, ...props }: ConfigFieldProps) {
  return (
    <label className={`${configFieldStyle} ${className}`.trim()}>
      <span>{label}</span>
      <Input {...props} type={type} value={value ?? ""} aria-invalid={invalid || props["aria-invalid"]} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  );
}

export function CompactChoiceField({ label, value, options, onChange, invalid = false, required = false }: AnyRecord) {
  return (
    <div className={`compact-choice-field ${invalid ? "invalid" : ""}`}>
      <span>{label}{required && <span className="required-asterisk">*</span>}</span>
      <div>
        {(options || []).map((option) => {
          const item = typeof option === "string" ? { label: option, value: option } : option;
          const selected = value === item.value || value === item.label;
          return (
            <button key={item.value || item.label} type="button" className={selected ? "selected" : ""} onClick={() => onChange(item.value || item.label)} title={item.title || item.label}>
              <span>{item.label}</span>
              {item.subtitle && <small>{item.subtitle}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
