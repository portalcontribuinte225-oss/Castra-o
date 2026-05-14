import { CheckCircle2 } from "lucide-react";
import type { AnyRecord } from "../types";
import { statusLabels } from "../domain";

function sumValues(items: AnyRecord[] = []) {
  return items.reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function topItems(items: AnyRecord[] = [], limit = 6) {
  return [...items].sort((left, right) => Number(right.value || 0) - Number(left.value || 0)).slice(0, limit);
}

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
      {createLabel && <button className="secondary-action" type="button" onClick={onCreate}>{createLabel}</button>}
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

export function ConfigActiveToggle({ checked, onChange }: AnyRecord) {
  return (
    <label className="config-active-toggle">
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span>{checked ? "Ativo" : "Inativo"}</span>
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

export function ModalHeader({ title, subtitle, onClose, actions }: AnyRecord) {
  return (
    <div className="modal-header">
      <div>
        {title && <h2>{title}</h2>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
      <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">×</button>
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
              {selected && <CheckCircle2 size={14} />}
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

export function DataBarChart({ title, items = [] }: AnyRecord) {
  const visibleItems = topItems(items.filter((item) => Number(item.value) > 0), 6);
  const max = Math.max(...visibleItems.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="chart-card data-chart">
      <div className="chart-head">
        <strong>{title}</strong>
        <span>{sumValues(visibleItems)}</span>
      </div>
      <div className="data-bars">
        {visibleItems.length === 0 && <span className="empty-chart-note">Sem dados no período</span>}
        {visibleItems.map((item) => (
          <div className="data-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="data-bar-track">
              <i style={{ width: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%` }} />
            </div>
            <strong>{item.value}</strong>
            {item.secondary && <small>{item.secondary}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataDonutChart({ title, items = [] }: AnyRecord) {
  const colors = ["#38a8e8", "#16a34a", "#f97316", "#be185d", "#64748b", "#b7791f"];
  const visibleItems = topItems(items.filter((item) => Number(item.value) > 0), 6);
  const total = sumValues(visibleItems);
  let start = 0;
  const gradient = total
    ? visibleItems.map((item, index) => {
      const size = (Number(item.value || 0) / total) * 100;
      const part = `${colors[index % colors.length]} ${start}% ${start + size}%`;
      start += size;
      return part;
    }).join(", ")
    : "#e2e8f0 0 100%";

  return (
    <div className="chart-card data-chart">
      <div className="chart-head">
        <strong>{title}</strong>
        <span>{total}</span>
      </div>
      <div className="data-donut-wrap">
        <div className="data-donut" style={{ background: `conic-gradient(${gradient})` }}>
          <strong>{total}</strong>
        </div>
        <div className="data-donut-legend">
          {visibleItems.length === 0 && <span className="empty-chart-note">Sem dados no período</span>}
          {visibleItems.map((item, index) => (
            <span key={item.label}>
              <i style={{ background: colors[index % colors.length] }} />
              {item.label}: {item.value}
            </span>
          ))}
        </div>
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
