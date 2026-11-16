import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { EmailAccountView, EmailSettings } from "./email-integration-types";

const emptyForm = { serviceId: "", publicKey: "", publicUrl: "", privateKey: "" };

function formOf(account: EmailAccountView | null) {
  return { ...emptyForm, serviceId: account?.serviceId || "", publicKey: account?.publicKey || "", publicUrl: account?.publicUrl || "" };
}

// The platform account, edited only by the master. The private key is typed once, then only its start is shown.
export function useEmailAccount(account: EmailAccountView | null, municipalityId: string, apply: (settings: EmailSettings) => void) {
  const [form, setForm] = useState(() => formOf(account));
  const [status, setStatus] = useState("");
  const [statusOk, setStatusOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  useEffect(() => { setForm(formOf(account)); }, [account]);

  const stored = formOf(account);
  // The ids and the address as stored, to know when the screen holds something not saved yet.
  const fieldsChanged = form.serviceId !== stored.serviceId || form.publicKey !== stored.publicKey || form.publicUrl !== stored.publicUrl;
  const changed = fieldsChanged || Boolean(form.privateKey);

  function edit(changes: Partial<typeof emptyForm>) {
    setStatus("");
    setForm((current) => ({ ...current, ...changes }));
  }

  async function run(request: Promise<EmailSettings>, success: string, failure: string) {
    setSaving(true);
    setStatus("");
    try {
      apply(await request);
      setConfirmingRemoval(false);
      setStatusOk(true);
      setStatus(success);
    } catch (error) {
      setStatusOk(false);
      setStatus(error instanceof ApiError && error.message ? error.message : failure);
    } finally { setSaving(false); }
  }

  const save = () => saving || !changed ? undefined : run(
    api.saveEmailAccount({ serviceId: form.serviceId, publicKey: form.publicKey, publicUrl: form.publicUrl, ...(form.privateKey ? { privateKey: form.privateKey } : {}) }, municipalityId),
    "Credenciais salvas.", "Não foi possível salvar as credenciais.",
  );
  const removeKey = () => saving ? undefined : run(api.saveEmailAccount({ clearPrivateKey: true }, municipalityId), "Chave privada removida.", "Não foi possível remover a chave privada.");

  return { form, edit, status, statusOk, saving, changed, fieldsChanged, confirmingRemoval, setConfirmingRemoval, save, removeKey };
}
