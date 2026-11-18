import { adoptionSharePath } from "../../../shared/adoption-contract.js";

export enum ShareOutcome {
  SHARED = "shared",
  COPIED = "copied",
  CANCELLED = "cancelled",
  FAILED = "failed",
}

export interface ShareDetails {
  title: string;
  text: string;
  url: string;
}

// The parts of the browser that sharing uses, so a test can stand in for them.
export interface ShareTarget {
  share?: (data: ShareDetails) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

export function adoptionShareUrl(origin: string, id: string): string {
  return `${origin}${adoptionSharePath(id)}`;
}

// What goes along with the link: the animal's name in the title and a line inviting to meet it.
export function adoptionShareDetails(animal: { id: string; name?: string; animal_name?: string }, origin: string): ShareDetails {
  const name = String(animal.name || animal.animal_name || "").trim();
  return {
    title: name ? `${name} para adoção` : "Animal para adoção",
    text: `Conheça ${name || "este animal"}, que está esperando por um lar.`,
    url: adoptionShareUrl(origin, animal.id),
  };
}

// Opens the device's share menu when there is one; otherwise, or when it fails, copies the link. Closing the menu is not
// an error.
export async function shareAdoptionLink(details: ShareDetails, target: ShareTarget): Promise<ShareOutcome> {
  if (target.share) {
    try {
      await target.share(details);
      return ShareOutcome.SHARED;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return ShareOutcome.CANCELLED;
    }
  }
  if (!target.clipboard) return ShareOutcome.FAILED;
  try {
    await target.clipboard.writeText(details.url);
    return ShareOutcome.COPIED;
  } catch {
    return ShareOutcome.FAILED;
  }
}
