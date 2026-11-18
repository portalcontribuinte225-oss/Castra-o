import { HeartHandshake } from "lucide-react";
import { SharedAdoptionState, type SharedAdoption } from "./use-shared-adoption";

// What the page says when a shared link points to an animal that is no longer waiting: adopted, or gone.
export function SharedAdoptionNotice({ shared }: { shared: SharedAdoption }) {
  if (shared.state !== SharedAdoptionState.ADOPTED && shared.state !== SharedAdoptionState.MISSING) return null;
  const name = String(shared.animal?.animal_name || "").trim();
  const message = shared.state === SharedAdoptionState.ADOPTED
    ? `${name || "Este animal"} já encontrou uma família. Conheça outros animais que estão esperando por um lar.`
    : "Este animal não está mais disponível para adoção. Conheça os outros que estão esperando por um lar.";
  return (
    <p className="adoption-share-notice" role="status">
      <HeartHandshake size={18} aria-hidden="true" />
      {message}
    </p>
  );
}
