import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import { useAuthOperation } from "./use-auth-operation";
import type { AuthAudienceValue, SessionUser } from "./auth-types";

export function useAuthLogin(audience: AuthAudienceValue, municipalityId: string, onLogin: (user: SessionUser) => void) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const context = `${audience}:${municipalityId}`;
  const operation = useAuthOperation(context);
  useEffect(() => { setIdentifier(""); setPassword(""); setLoading(false); setError(""); }, [context]);
  async function submit() {
    if (loading) return;
    const request = operation.begin();
    setLoading(true); setError("");
    try {
      const user = await api.login(identifier.trim(), password, audience, municipalityId, request);
      if (!request.isCurrent()) return;
      setPassword(""); onLogin(user);
    } catch (failure) {
      if (request.isCurrent()) { setError(failure instanceof ApiError ? failure.message : "Não foi possível entrar."); setPassword(""); }
    } finally { if (request.isCurrent()) setLoading(false); }
  }
  function reset() { operation.cancel(); setIdentifier(""); setPassword(""); setLoading(false); setError(""); }
  return { identifier, setIdentifier, password, setPassword, loading, error, submit, reset };
}
