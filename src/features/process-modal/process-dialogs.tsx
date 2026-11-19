import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { REJECTION_REASONS } from "../../../shared/notification-contract.js";
import type { AnyRecord } from "../../types";
import { userBelongsToSector } from "../../App";
import { ProcessDialog } from "./process-dialog";

export function AssignDialog({ sectors, users, initial, busy, onConfirm, onClose }: { sectors: AnyRecord[]; users: AnyRecord[]; initial: { sectorId: string; userId: string }; busy: boolean; onConfirm: (assignment: { sectorId: string; userId: string }) => void; onClose: () => void }) {
  const [assignment, setAssignment] = useState(initial);
  const sectorUsers = users.filter((user) => !assignment.sectorId || userBelongsToSector(user, assignment.sectorId));
  return (
    <ProcessDialog
      title={<><ClipboardList size={15} /> Atribuir responsável</>}
      onClose={onClose}
      actions={<>
        <button className="ghost-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="primary-action" type="button" disabled={busy || !assignment.sectorId || !assignment.userId} onClick={() => onConfirm(assignment)}>{busy ? "Atribuindo..." : "Confirmar"}</button>
      </>}
    >
      <label className="field">
        <span>Setor</span>
        <select value={assignment.sectorId} disabled={busy} onChange={(event) => setAssignment({ sectorId: event.target.value, userId: "" })}>
          <option value="">Selecione o setor...</option>
          {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Usuário</span>
        <select value={assignment.userId} disabled={busy} onChange={(event) => setAssignment((current) => ({ ...current, userId: event.target.value }))}>
          <option value="">Selecione o usuário...</option>
          {sectorUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
      </label>
    </ProcessDialog>
  );
}

// Rejecting a procedure (or a whole special request) always says why: a reason from the list and a justification.
export function RejectDialog({ title, subject, busy, onConfirm, onClose }: { title: string; subject: string; busy: boolean; onConfirm: (rejection: { reason: string; note: string }) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <ProcessDialog
      title={title}
      onClose={onClose}
      actions={<>
        <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
        <button className="secondary-action danger-action" type="button" disabled={busy || !reason || !note.trim()} onClick={() => onConfirm({ reason, note: note.trim() })}>
          {busy ? "Indeferindo..." : "Confirmar indeferimento"}
        </button>
      </>}
    >
      {subject && <p className="prm-muted-note">{subject}</p>}
      <label className="field">
        <span>Motivo</span>
        <select value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">Selecione o motivo...</option>
          {REJECTION_REASONS.map((item: string) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Justificativa</span>
        <textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Explique o motivo do indeferimento" />
      </label>
    </ProcessDialog>
  );
}

// A short text the action needs: what has to be corrected in a document, or what the investigation of a complaint concluded.
export function NoteDialog({ title, label, placeholder, confirmLabel, busy, maxLength, onConfirm, onClose }: { title: string; label: string; placeholder: string; confirmLabel: string; busy: boolean; maxLength: number; onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  return (
    <ProcessDialog
      title={title}
      onClose={onClose}
      actions={<>
        <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
        <button className="primary-action" type="button" disabled={busy || !note.trim()} onClick={() => onConfirm(note.trim())}>{busy ? "Salvando..." : confirmLabel}</button>
      </>}
    >
      <label className="field">
        <span>{label}</span>
        <textarea value={note} maxLength={maxLength} onChange={(event) => setNote(event.target.value)} placeholder={placeholder} autoFocus />
      </label>
    </ProcessDialog>
  );
}

export function UnsavedChangesDialog({ busy, onDiscard, onClose, onSave }: { busy: boolean; onDiscard: () => void; onClose: () => void; onSave: () => void }) {
  return (
    <ProcessDialog
      title="Alterações não salvas"
      onClose={onClose}
      actions={<>
        <button className="ghost-button" type="button" disabled={busy} onClick={onDiscard}>Descartar</button>
        <button className="ghost-button" type="button" disabled={busy} onClick={onClose}>Continuar editando</button>
        <button className="primary-action" type="button" disabled={busy} onClick={onSave}>{busy ? "Salvando..." : "Salvar e fechar"}</button>
      </>}
    >
      <p className="prm-muted-note">Há alterações nos dados de saúde ou de microchip.</p>
    </ProcessDialog>
  );
}
