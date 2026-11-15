import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { emptyCatalog } from "./whatsapp-integration-types";
import type { EventBinding, EventBindings, TemplateCatalog } from "./whatsapp-integration-types";

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useWhatsappTemplates(municipalityId: string) {
  const [attempt, setAttempt] = useState(0);
  const [catalog, setCatalog] = useState<TemplateCatalog>(emptyCatalog);
  const [bindings, setBindings] = useState<EventBindings>({});
  const [loadedId, setLoadedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeId = useRef(municipalityId);
  activeId.current = municipalityId;
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setCatalog(emptyCatalog);
    setBindings({});
    setLoadedId("");
    setError("");
    setNotice("");
    if (!municipalityId) return;
    setLoading(true);
    Promise.all([api.getWhatsappCatalog(municipalityId), api.getWhatsappBindings(municipalityId)]).then(([loadedCatalog, loadedBindings]) => {
      if (cancelled) return;
      setCatalog(loadedCatalog);
      setBindings(loadedBindings.bindings || {});
      setLoadedId(municipalityId);
    }).catch((failure) => {
      if (!cancelled) setError(messageOf(failure, "Não foi possível carregar os templates do WhatsApp."));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);

  const ready = Boolean(municipalityId) && loadedId === municipalityId;

  async function sync() {
    if (syncing || !ready) return;
    const syncedId = municipalityId;
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const synced = await api.syncWhatsappCatalog(syncedId);
      if (activeId.current !== syncedId) return;
      setCatalog(synced);
      setNotice(`${synced.templates.length} template(s) sincronizado(s).`);
    } catch (failure) {
      if (activeId.current === syncedId) setError(messageOf(failure, "Não foi possível sincronizar os templates."));
    } finally { setSyncing(false); }
  }

  // Resolves to an error message, or an empty string when the change was saved.
  async function change(run: () => Promise<{ bindings: EventBindings }>, fallback: string) {
    if (saving || !ready) return fallback;
    const changedId = municipalityId;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await run();
      if (activeId.current === changedId) {
        setBindings(saved.bindings || {});
        setNotice("Vínculo salvo.");
      }
      return "";
    } catch (failure) {
      return messageOf(failure, fallback);
    } finally { setSaving(false); }
  }

  const saveBinding = (event: string, binding: EventBinding) => change(() => api.saveWhatsappBinding(municipalityId, event, binding), "Não foi possível salvar o vínculo.");
  const removeBinding = (event: string) => change(() => api.removeWhatsappBinding(municipalityId, event), "Não foi possível remover o vínculo.");

  return { catalog, bindings, loading, ready, syncing, saving, error, notice, retry, sync, saveBinding, removeBinding };
}
