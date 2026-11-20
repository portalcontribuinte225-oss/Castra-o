import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Check, Share2 } from "lucide-react";
import type { AnyRecord } from "../../types";
import { Button } from "../../components/button";
import { ShareOutcome, adoptionShareDetails, shareAdoptionLink } from "./share-adoption";

export enum ShareButtonLook {
  FULL = "full",
  ICON = "icon",
}

const FEEDBACK_MS = 2500;
const FEEDBACK: Partial<Record<ShareOutcome, string>> = {
  [ShareOutcome.COPIED]: "Link copiado",
  [ShareOutcome.FAILED]: "Não deu para copiar o link",
};

// Shares the link of an animal for adoption; after a copy, says so for a moment.
export function ShareAdoptionButton({ animal, look = ShareButtonLook.FULL }: { animal: AnyRecord; look?: ShareButtonLook }) {
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

  const label = (outcome && FEEDBACK[outcome]) || "Compartilhar";
  const icon = outcome === ShareOutcome.COPIED ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />;
  if (look === ShareButtonLook.ICON) {
    return <button className="ghost-button" type="button" onClick={share} title={label} aria-label={label}>{icon}</button>;
  }
  return (
    <Button variant="outline" className="tw:w-full" onClick={share} aria-live="polite">
      {icon}
      {label}
    </Button>
  );
}
