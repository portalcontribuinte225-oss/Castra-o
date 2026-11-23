interface AdoptionInterestSummary {
  interest_count?: number;
  interestCount?: number;
  interests?: unknown[];
}

export function getAdoptionInterestCount(animal: AdoptionInterestSummary = {}): number {
  if (typeof animal.interest_count === "number") return animal.interest_count;
  if (typeof animal.interestCount === "number") return animal.interestCount;
  return Array.isArray(animal.interests) ? animal.interests.length : 0;
}
