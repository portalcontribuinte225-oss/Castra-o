import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import { formFromTutor, tutorPayload } from "./tutor-data";
import type { TutorData, TutorForm } from "./tutor-data";

// Loads the tutor of a request when the tab is opened, and saves what the staff edited.
export function useTutorData(requestId: string, municipalityId: string, onSaved?: (tutor: TutorData) => void) {
  const [tutor, setTutor] = useState<TutorData | null>(null);
  const [form, setForm] = useState<TutorForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    api.getRequestTutor(requestId, municipalityId)
      .then((result) => { if (!cancelled) { setTutor(result.tutor || null); setForm(result.tutor ? formFromTutor(result.tutor) : null); } })
      .catch((failure) => { if (!cancelled) setError(failure instanceof ApiError ? failure.message : "Não foi possível carregar os dados do tutor."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestId, municipalityId, attempt]);

  function change(patch: Partial<TutorForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setNotice(""); setSaveError("");
  }

  async function save() {
    if (!tutor || !form || saving) return;
    setSaving(true); setSaveError(""); setNotice("");
    try {
      const result = await api.updateRequestTutor(requestId, tutorPayload(form, tutor.contactOnly), municipalityId);
      setTutor(result.tutor); setForm(formFromTutor(result.tutor));
      setNotice(result.passwordChanged ? "Dados e senha atualizados." : "Dados atualizados.");
      onSaved?.(result.tutor);
    } catch (failure) {
      setSaveError(failure instanceof ApiError ? failure.message : "Não foi possível salvar os dados do tutor.");
    } finally { setSaving(false); }
  }

  return { tutor, form, loading, error, saving, saveError, notice, change, save, retry: () => setAttempt((current) => current + 1) };
}
