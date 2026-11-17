import React, { useState } from "react";
import { normalizeText } from "../utils";

export interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
}

export interface ChecklistGroup {
  id: string;
  label?: string;
  items: ChecklistItem[];
}

// Above this many items the list gets a search field.
export const CHECKLIST_SEARCH_THRESHOLD = 8;

// The ids with `id` added at the end, or removed when it was already there: the order is the order they were chosen.
export function toggleSelection(selectedIds: string[], id: string): string[] {
  return selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id];
}

// The groups with only the items whose label contains the search (ignoring case and accents); groups left empty are dropped.
export function filterChecklistGroups(groups: ChecklistGroup[], query: string): ChecklistGroup[] {
  const needle = normalizeText(query);
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !needle || normalizeText(item.label).includes(needle)) }))
    .filter((group) => group.items.length > 0);
}

interface ScrollChecklistProps {
  legend: string;
  // A short line under the title, such as "Pode marcar mais de um."
  hint?: string;
  required?: boolean;
  groups: ChecklistGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
  errorText?: string;
  emptyText: string;
}

// A fixed-height box with its own scroll: one checkbox row per item, optionally grouped, with a search field when the list is long.
// The ids come back in the order they were chosen.
export function ScrollChecklist({ legend, hint = "", required = false, groups, selectedIds, onChange, invalid = false, errorText = "", emptyText }: ScrollChecklistProps) {
  const [query, setQuery] = useState("");
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (total === 0) return <p className="scroll-checklist-empty" role="status">{emptyText}</p>;
  const visible = filterChecklistGroups(groups, query);

  return (
    <fieldset className={`scroll-checklist${invalid ? " is-invalid" : ""}`}>
      <legend>{legend}{required && <span className="required-asterisk">*</span>}</legend>
      {hint && <small className="form-hint">{hint}</small>}
      {total > CHECKLIST_SEARCH_THRESHOLD && (
        <input
          className="scroll-checklist-search"
          type="search"
          value={query}
          placeholder="Buscar"
          aria-label={`Buscar em ${legend.toLowerCase()}`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <div className="scroll-checklist-box">
        {visible.length === 0 && <p className="scroll-checklist-empty" role="status">Nada encontrado para a busca.</p>}
        {visible.map((group) => (
          <div className="scroll-checklist-group" key={group.id}>
            {group.label && <strong className="scroll-checklist-group-title">{group.label}</strong>}
            {group.items.map((item) => (
              <label className="scroll-checklist-row" key={item.id}>
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onChange(toggleSelection(selectedIds, item.id))} />
                <span className="scroll-checklist-label">{item.label}</span>
                {item.detail && <span className="scroll-checklist-detail">{item.detail}</span>}
              </label>
            ))}
          </div>
        ))}
      </div>
      {invalid && errorText && <small className="field-error-message">{errorText}</small>}
    </fieldset>
  );
}
