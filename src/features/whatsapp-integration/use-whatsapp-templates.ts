import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";
import { emptyTemplateList } from "./whatsapp-integration-types";
import type { WhatsappTemplateList, WhatsappTemplateRow } from "./whatsapp-integration-types";
import { needsAutoSync } from "./whatsapp-template-display";

// Only messages the server wrote are shown; anything else (network, malformed response) gets the fallback.
function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export function useWhatsappTemplates(municipalityId: string, canSync: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [list, setList] = useState<WhatsappTemplateList>(emptyTemplateList);
  const [loadedId, setLoadedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeId = useRef(municipalityId);
  const autoSyncedFor = useRef("");
  activeId.current = municipalityId;
  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const ready = Boolean(municipalityId) && loadedId === municipalityId;

  useEffect(() => {
    let cancelled = false;
    setList(emptyTemplateList);
    setLoadedId("");
    setError("");
    setNotice("");
    if (!municipalityId) return;
    setLoading(true);
    api.getWhatsappTemplates(municipalityId).then((loaded) => {
      if (cancelled) return;
      setList(loaded);
      setLoadedId(municipalityId);
    }).catch((failure) => {
      if (!cancelled) setError(messageOf(failure, "Não foi possível carregar os templates do WhatsApp."));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);

  async function runSync(silent: boolean) {
    if (syncing || !ready) return;
    const syncedId = municipalityId;
    setSyncing(true);
    if (!silent) { setError(""); setNotice(""); }
    try {
      const synced = await api.syncWhatsappTemplates(syncedId);
      if (activeId.current !== syncedId) return;
      setList(synced);
      if (!silent) setNotice(`${synced.templates.length} template(s) sincronizado(s).`);
    } catch (failure) {
      if (!silent && activeId.current === syncedId) setError(messageOf(failure, "Não foi possível sincronizar os templates."));
    } finally { setSyncing(false); }
  }

  // Opening the screen refreshes a stale catalog once, so new templates appear without a click.
  useEffect(() => {
    if (!ready || !canSync || autoSyncedFor.current === municipalityId) return;
    autoSyncedFor.current = municipalityId;
    if (needsAutoSync(list.syncedAt)) void runSync(true);
  }, [ready, canSync, municipalityId]);

  async function toggle(row: WhatsappTemplateRow) {
    if (saving || !ready) return;
    const changedId = municipalityId;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.setWhatsappTemplateActive(changedId, { name: row.name, language: row.language, active: !row.active });
      if (activeId.current === changedId) setList(updated);
    } catch (failure) {
      if (activeId.current === changedId) setError(messageOf(failure, "Não foi possível alterar o template."));
    } finally { setSaving(false); }
  }

  return { list, loading, ready, syncing, saving, error, notice, retry, sync: () => runSync(false), toggle };
}
