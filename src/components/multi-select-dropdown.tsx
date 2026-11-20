import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { topModalLayer } from "./modal-focus";
import { CHECKLIST_SEARCH_THRESHOLD, filterChecklistGroups, toggleSelection } from "./scroll-checklist";
import type { ChecklistItem } from "./scroll-checklist";

interface MultiSelectDropdownProps {
  // What is being chosen, for screen readers, such as "Procedimentos".
  label: string;
  placeholder: string;
  items: ChecklistItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
  errorText?: string;
  emptyText: string;
}

// A field that shows what was chosen, separated by commas, and opens a list floating over what comes below: one checkbox per item
// with its detail on the right, and a search field when the list is long. Escape, a click outside or the field itself closes it.
// The ids come back in the order they were chosen.
export function MultiSelectDropdown({ label, placeholder, items, selectedIds, onChange, invalid = false, errorText = "", emptyText }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const modal = topModalLayer();
      if (modal && !modal.contains(rootRef.current)) return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  if (items.length === 0) return <p className="scroll-checklist-empty" role="status">{emptyText}</p>;
  const chosen = selectedIds.map((id) => items.find((item) => item.id === id)?.label).filter(Boolean).join(", ");

  return (
    <div className={`multi-select${invalid ? " is-invalid" : ""}`} ref={rootRef}>
      <div className="multi-select-field">
        <button
          ref={triggerRef}
          type="button"
          className="multi-select-trigger"
          aria-label={`${label}: ${chosen || placeholder}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <span className={chosen ? "multi-select-value" : "multi-select-value is-placeholder"}>{chosen || placeholder}</span>
          <ChevronDown size={16} aria-hidden="true" className={open ? "is-open" : ""} />
        </button>
        {open && <MultiSelectPanel id={panelId} label={label} items={items} selectedIds={selectedIds} onChange={onChange} />}
      </div>
      {invalid && errorText && <small className="field-error-message">{errorText}</small>}
    </div>
  );
}

interface MultiSelectPanelProps {
  id: string;
  label: string;
  items: ChecklistItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

// The open list: a search field when the list is long, then one checkbox per item with its detail on the right. The search
// starts empty each time the list opens.
export function MultiSelectPanel({ id, label, items, selectedIds, onChange }: MultiSelectPanelProps) {
  const [query, setQuery] = useState("");
  const visible = filterChecklistGroups([{ id: "items", items }], query)[0]?.items || [];
  return (
    <div className="multi-select-panel" id={id}>
      {items.length > CHECKLIST_SEARCH_THRESHOLD && (
        <input
          className="scroll-checklist-search"
          type="search"
          value={query}
          placeholder="Buscar"
          aria-label={`Buscar em ${label.toLowerCase()}`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {visible.length === 0 && <p className="scroll-checklist-empty" role="status">Nada encontrado para a busca.</p>}
      {visible.map((item) => (
        <label className="multi-select-row" key={item.id}>
          <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onChange(toggleSelection(selectedIds, item.id))} />
          <span>{item.label}</span>
          {item.detail && <small>{item.detail}</small>}
        </label>
      ))}
    </div>
  );
}
