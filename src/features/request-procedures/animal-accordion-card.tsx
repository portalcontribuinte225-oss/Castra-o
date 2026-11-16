import React from "react";
import { ChevronRight } from "lucide-react";

interface AnimalAccordionCardProps {
  index: number;
  title: string;
  detail: string;
  open: boolean;
  // With a single animal there is nothing to fold, so no header is shown.
  collapsible: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// One animal of the request: a header with only its number, name and species, which folds the animal's data away.
export function AnimalAccordionCard({ index, title, detail, open, collapsible, onToggle, children }: AnimalAccordionCardProps) {
  return (
    <div className={`animal-form${open ? " is-open" : " is-collapsed"}`}>
      {collapsible && (
        <button type="button" className="animal-form-header animal-accordion-toggle animal-form-header--card" aria-expanded={open} onClick={onToggle}>
          <div className="animal-title-badge">{index + 1}</div>
          <div className="animal-accordion-title">
            <strong>{title}</strong>
            {detail && <span className="animal-accordion-summary">{detail}</span>}
          </div>
          <ChevronRight size={17} className={`animal-accordion-chevron${open ? " is-open" : ""}`} />
        </button>
      )}
      {open && children}
    </div>
  );
}
