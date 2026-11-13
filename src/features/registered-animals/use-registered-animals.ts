import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { PreviousAnimalCandidate, RegisteredAnimalsPage } from "./registered-animal-types";

export function useRegisteredAnimals() {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState("");
  const [page, setPage] = useState<RegisteredAnimalsPage>({ animals: [], candidates: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setCursor(""); }, [query]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    const timer = setTimeout(() => {
      api.getMyAnimals(query.trim(), cursor).then((result: RegisteredAnimalsPage) => {
        if (cancelled) return;
        setPage((current) => cursor ? { animals: [...current.animals, ...result.animals], candidates: [...current.candidates, ...result.candidates], nextCursor: result.nextCursor } : result);
      }).catch(() => { if (!cancelled) setError("Não foi possível carregar seus animais."); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, cursor, attempt]);

  async function resolve(candidate: PreviousAnimalCandidate): Promise<string | null> {
    if (resolving) return null;
    setResolving(candidate.fingerprint); setError("");
    try { return (await api.resolvePreviousAnimal(candidate)).animal.id; }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : "Não foi possível vincular este cadastro. Atualize a lista ou procure o atendimento."); return null; }
    finally { setResolving(""); }
  }
  return { ...page, query, setQuery, loading, error, resolving, resolve, loadMore: () => { if (page.nextCursor && !loading) setCursor(page.nextCursor); }, retry: () => { setCursor(""); setAttempt((current) => current + 1); } };
}
