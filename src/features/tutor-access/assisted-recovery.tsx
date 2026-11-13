import React, { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import { formatCpf, isValidCpf } from "../../utils";
import type { RecoveryTutor } from "./auth-types";

export function AssistedRecovery({ municipalityId, municipalities, onClose }: { municipalityId: string; municipalities: Array<{ id: string; name: string }>; onClose: () => void }) {
  const [selectedMunicipality, setSelectedMunicipality] = useState(municipalityId);
  const [cpf, setCpf] = useState("");
  const [tutors, setTutors] = useState<RecoveryTutor[]>([]);
  const [tutor, setTutor] = useState<RecoveryTutor | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setCpf(""); setTutors([]); setTutor(null); setReason(""); setConfirmed(false); setTemporaryPassword(""); setSearched(false); }, [selectedMunicipality]);
  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !isValidCpf(cpf) || !selectedMunicipality) return;
    setLoading(true); setError(""); setTemporaryPassword(""); setTutor(null);
    try { setTutors((await api.searchTutors(cpf.replace(/\D/g, ""), selectedMunicipality)).tutors || []); setSearched(true); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : "Não foi possível consultar o tutor."); }
    finally { setLoading(false); }
  }
  async function recover(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !tutor || !confirmed || !reason.trim()) return;
    setLoading(true); setError("");
    try {
      const result = await api.recoverTutorAccess(tutor.id, { municipalityId: selectedMunicipality, identityConfirmed: true, reason: reason.trim() });
      setTemporaryPassword(result.temporaryPassword); setReason(""); setConfirmed(false);
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : "Não foi possível recuperar o acesso."); }
    finally { setLoading(false); }
  }
  return <div className="modal-backdrop"><section className="auth-modal tutor-recovery-modal" role="dialog" aria-modal="true" aria-label="Recuperação presencial de tutor">
    <div className="tutor-auth-heading"><h2>Recuperar acesso do tutor</h2><button type="button" className="ghost-button" onClick={onClose} disabled={loading}>Fechar</button></div>
    <p>Use somente após confirmar presencialmente a identidade. A recuperação será registrada na auditoria.</p>
    {!municipalityId && <label className="field"><span>Município</span><select value={selectedMunicipality} onChange={(event) => setSelectedMunicipality(event.target.value)} disabled={loading}><option value="">Selecione</option>{municipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name}</option>)}</select></label>}
    {!temporaryPassword && <form className="tutor-auth-form" onSubmit={search}><label className="field"><span>CPF do tutor</span><input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} required disabled={loading} /></label><button type="submit" className="primary-action" disabled={loading || !selectedMunicipality || !isValidCpf(cpf)}>{loading ? "Aguarde..." : "Buscar tutor"}</button></form>}
    {searched && !tutors.length && <p>Nenhum tutor encontrado neste município.</p>}
    {!temporaryPassword && tutors.map((item) => <button key={item.id} type="button" className="tutor-recovery-result" disabled={loading} onClick={() => { setTutor(item); setConfirmed(false); setReason(""); }}><strong>{item.name}</strong><span>{item.cpf} · {item.maskedEmail || "Sem e-mail"} · {item.maskedPhone || "Sem telefone"}</span></button>)}
    {tutor && !temporaryPassword && <form className="tutor-auth-form" onSubmit={recover}><h3>{tutor.name}</h3><label className="checkbox-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={loading} />Confirmei presencialmente a identidade do tutor</label><label className="field"><span>Motivo da recuperação</span><textarea required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={loading} /></label><small>Registre o motivo sem copiar dados de documentos pessoais.</small><button type="submit" className="primary-action" disabled={loading || !confirmed || reason.trim().length < 10}>{loading ? "Registrando..." : "Registrar e gerar senha inicial"}</button></form>}
    {temporaryPassword && <div className="tutor-enrollment"><h3>Senha inicial gerada</h3><code className="tutor-initial-password">{temporaryPassword}</code><p>Entregue esta senha ao tutor. Ela aparece somente neste atendimento e deve ser trocada no próximo acesso. Depois, ele poderá confirmar seus contatos no perfil.</p><button type="button" className="primary-action" onClick={onClose}>Concluir e ocultar senha</button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section></div>;
}
