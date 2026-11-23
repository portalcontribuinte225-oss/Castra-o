import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Check, Share2 } from "lucide-react";
import type { AnyRecord } from "../../types";
import { Button } from "../../components/button";
import { ShareOutcome, adoptionAnimalName, adoptionShareDetails, shareAdoptionLink } from "./share-adoption";

const FEEDBACK_MS = 2500;
const FEEDBACK: Partial<Record<ShareOutcome, string>> = {
  [ShareOutcome.COPIED]: "Link copiado",
  [ShareOutcome.FAILED]: "Não deu para copiar o link",
};

interface ShareAdoptionButtonProps {
  animal: AnyRecord;
  // On a card only the icon shows; the animal's name gives the button its accessible name.
  iconOnly?: boolean;
}

// Shares the link of an animal for adoption; after a copy, says so for a moment.
export function ShareAdoptionButton({ animal, iconOnly = false }: ShareAdoptionButtonProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  useEffect(() => {
    if (!outcome) return undefined;
    const timer = window.setTimeout(() => setOutcome(null), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [outcome]);

  async function share(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const result = await shareAdoptionLink(adoptionShareDetails(animal as { id: string }, window.location.origin), navigator);
    setOutcome(FEEDBACK[result] ? result : null);
  }

  const feedback = outcome ? FEEDBACK[outcome] : undefined;
  const icon = outcome === ShareOutcome.COPIED ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />;
  if (iconOnly) {
    const label = feedback || `Compartilhar ${adoptionAnimalName(animal) || "o animal"}`;
    return (
      <Button
        variant="custom"
        className="tw:w-10 tw:shrink-0 tw:px-0 tw:border-transparent tw:bg-transparent tw:text-ui-muted tw:enabled:hover:bg-card-page tw:enabled:hover:text-ui-ink"
        onClick={share}
        aria-label={label}
        title={label}
      >
        {icon}
        <span className="tw:sr-only" aria-live="polite">{feedback}</span>
      </Button>
    );
  }

  const label = feedback || "Compartilhar";
  return (
    <Button variant="outline" className="tw:w-full" onClick={share} aria-live="polite">
      {icon}
      {label}
    </Button>
  );
}
