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
  onToggle: () => void;
  children: React.ReactNode;
}

// One animal of the request: a header with only its number, name and species, which folds the animal's data away.
export function AnimalAccordionCard({ index, title, detail, open, collapsible, onToggle, children }: AnimalAccordionCardProps) {
  return (
    <div className={`animal-form${open ? " is-open" : " is-collapsed"}`}>
      {collapsible && (
        <Card as="button" className="tw:mb-3 tw:flex tw:min-h-14 tw:w-full tw:items-center tw:gap-3 tw:px-4 tw:py-2 tw:text-left tw:hover:border-ui-accent tw:aria-expanded:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" aria-expanded={open} onClick={onToggle}>
          <span className="animal-title-badge" aria-hidden="true">{index + 1}</span>
          <span className="animal-accordion-title">
            <strong>{title}</strong>
            {detail && <span className="animal-accordion-summary">{detail}</span>}
          </span>
          <ChevronRight size={17} className={`animal-accordion-chevron${open ? " is-open" : ""}`} aria-hidden="true" />
        </Card>
      )}
      {open && children}
    </div>
  );
}
