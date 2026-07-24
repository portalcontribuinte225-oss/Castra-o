import { X } from "lucide-react";
import type { AnyRecord } from "../types";
import { statusLabels } from "../domain";

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
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      {createLabel && <button className="primary-action config-create-action" type="button" onClick={onCreate}>+ {createLabel}</button>}
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

export function Metric({ title, value, icon: Icon, trend }: AnyRecord) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{Icon && <Icon size={22} />}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {trend && <small>{trend}</small>}
      </div>
    </div>
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

export function Field({ label, value, onChange, placeholder, readOnly = false, invalid = false, type = "text" }: AnyRecord) {
  return (
    <label className={`field ${invalid ? "invalid" : ""}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value || ""}
        readOnly={readOnly}
        placeholder={placeholder || ""}
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

export function YesNoToggleField({ label, value, onChange }: AnyRecord) {
  const checked = value === "Sim";
  return (
    <div className="yes-no-toggle-field">
      <span>{label}</span>
      <ToggleSwitch checked={checked} onChange={(next: boolean) => onChange(next ? "Sim" : "Não")} label={checked ? "Sim" : "Não"} />
    </div>
  );
}

export function ToggleChoiceField({ label, value, options, onChange }: AnyRecord) {
  const [onOption, offOption] = options;
  const checked = value === onOption;
  return (
    <div className="yes-no-toggle-field">
      <span>{label}</span>
      <ToggleSwitch checked={checked} onChange={(next: boolean) => onChange(next ? onOption : offOption)} label={checked ? "Sim" : "Não"} />
    </div>
  );
}

export function CompactChoiceField({ label, value, options, onChange, invalid = false }: AnyRecord) {
  return (
    <div className={`compact-choice-field ${invalid ? "invalid" : ""}`}>
      <span>{label}</span>
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

export function ToggleSwitch({ label, checked, onChange, onText = "Ativo", offText = "Inativo" }: AnyRecord) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span>{label || (checked ? onText : offText)}</span>
    </label>
  );
}

export function FormSection({ title, action, children }: AnyRecord) {
  return (
    <div className="form-section">
      <div className="form-section-header">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
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
