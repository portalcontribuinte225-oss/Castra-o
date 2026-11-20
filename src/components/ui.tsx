import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnyRecord } from "../types";
import { statusLabels } from "../domain";
import { Card } from "./card";

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
    <div className="config-section-header">
      <div className="config-section-heading">
        <h2>{title}</h2>
      </div>
      <div className="config-section-tools">
        {children}
        {createLabel && (
          <button className="primary-action config-create-action" type="button" onClick={onCreate}>
            <Plus size={15} />
            {createLabel}
          </button>
        )}
      </div>
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
    <div className="config-status-filter">
      {items.map((item) => (
        <button key={item.id} className={value === item.id ? "active" : ""} type="button" onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ConfigActiveToggle({ checked, onChange, onText = "Ativo", offText = "Inativo" }: AnyRecord) {
  return (
    <label className="config-active-toggle">
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
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
  const MetricSurface = compact ? Card : "div";
  return (
    <MetricSurface className={compact ? "tw:flex tw:items-center tw:gap-3 tw:px-5 tw:py-4 tw:shadow-[0_4px_16px_rgba(15,23,42,0.05)]" : "metric-card"}>
      <div className={compact ? "tw:shrink-0 tw:text-ui-accent" : "metric-icon"}>
        {Icon && <Icon size={compact ? 20 : 22} aria-hidden="true" />}
      </div>
      <div className={compact ? "tw:flex tw:flex-col" : undefined}>
        <span className={compact ? "tw:text-[0.7rem] tw:text-ui-muted" : undefined}>{title}</span>
        <strong className={compact ? "tw:order-first tw:text-[1.05rem] tw:font-bold tw:text-ui-ink" : undefined}>{value}</strong>
        {trend && <small>{trend}</small>}
      </div>
    </MetricSurface>
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

export function ModalHeader({ title, subtitle, onClose, actions, icon: Icon }: AnyRecord) {
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
      <button className="modal-header-close" type="button" onClick={onClose} aria-label="Fechar">
        <X size={15} />
      </button>
    </div>
  );
}

export function StatusBadge({ status, className = "" }: AnyRecord) {
  return <span className={`status-badge status-${status} ${className}`}>{statusLabels[status] || status}</span>;
}

export function Field({ label, value, onChange, placeholder, readOnly = false, invalid = false, type = "text", autoComplete, inputMode, maxLength }: AnyRecord) {
  return (
    <label className={`field ${invalid ? "invalid" : ""}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value || ""}
        readOnly={readOnly}
        placeholder={placeholder || ""}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

export function YesNoField({ label, value, onChange }: AnyRecord) {
  return (
    <SegmentedButtons
      label={label}
      value={value}
      options={["Sim", "Não"]}
      onChange={onChange}
    />
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

function SegmentedButtons({ label, value, options, onChange }: AnyRecord) {
  return (
    <div className="compact-choice-field">
      <span>{label}</span>
      <div>
        {(options || []).map((option) => (
          <button key={option} type="button" className={value === option ? "selected" : ""} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
