import { useState } from "react";
import { ApiError } from "../../api";
import type { CreatedAnimalRequest } from "./animal-service-types";

type SubmitAnimalRequest<Payload> = (animalId: string, payload: Payload) => Promise<CreatedAnimalRequest>;
export type AnimalServiceResult = { created: CreatedAnimalRequest } | { error: string };

export const ANIMAL_SERVICE_FAILURE = "Não foi possível enviar a solicitação. Tente novamente.";

// Only the server's own message is shown; any other failure gets a generic text without internals.
export async function submitAnimalServiceRequest<Payload>(submit: SubmitAnimalRequest<Payload>, animalId: string, payload: Payload): Promise<AnimalServiceResult> {
  try {
    return { created: await submit(animalId, payload) };
  } catch (failure) {
    return { error: failure instanceof ApiError ? failure.message : ANIMAL_SERVICE_FAILURE };
  }
}

export function useAnimalServiceRequest<Payload>(animalId: string, submit: SubmitAnimalRequest<Payload>) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedAnimalRequest | null>(null);

  async function send(payload: Payload) {
    if (saving) return;
    setSaving(true);
    setError("");
    const result = await submitAnimalServiceRequest(submit, animalId, payload);
    if ("created" in result) setCreated(result.created);
    else setError(result.error);
    setSaving(false);
  }

  return { saving, error, fail: setError, created, send };
}
