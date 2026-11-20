import React from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "../../components/card";

interface AnimalAccordionCardProps {
  index: number;
  title: string;
  detail: string;
  open: boolean;
  // With a single animal there is nothing to fold, so no header is shown.
  collapsible: boolean;
  internal?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// One animal of the request: a header with only its number, name and species, which folds the animal's data away.
export function AnimalAccordionCard({ index, title, detail, open, collapsible, internal = false, onToggle, children }: AnimalAccordionCardProps) {
  const heading = (
    <>
      <div className="animal-title-badge" aria-hidden="true">{index + 1}</div>
      <div className="animal-accordion-title">
        <strong>{title}</strong>
        {detail && <span className="animal-accordion-summary">{detail}</span>}
      </div>
      <ChevronRight size={17} className={`animal-accordion-chevron${open ? " is-open" : ""}`} aria-hidden="true" />
    </>
  );
  return (
    <div className={`animal-form${open ? " is-open" : " is-collapsed"}`}>
      {collapsible && (internal ? (
        <button type="button" className="animal-form-header animal-accordion-toggle animal-form-header--card" aria-expanded={open} onClick={onToggle}>
          {heading}
        </button>
      ) : (
        <Card as="button" className="tw:mb-3 tw:flex tw:min-h-14 tw:w-full tw:items-center tw:gap-3 tw:px-4 tw:py-2 tw:text-left tw:hover:border-ui-accent tw:aria-expanded:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" aria-expanded={open} onClick={onToggle}>
          {heading}
        </Card>
      ))}
      {open && children}
    </div>
  );
}
