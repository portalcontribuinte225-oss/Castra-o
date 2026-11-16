import type { TutorContacts } from "../request-follow-up/follow-up";

const NO_CHANNEL_TEXT = "Este município ainda não envia avisos por celular e nenhum e-mail foi informado. Informe um e-mail para receber os avisos.";
const NO_CONTACT_TEXT = "Não há contato disponível para receber avisos. Informe um e-mail ou um celular válido.";

interface NoticeConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // The contacts the notices can reach: a valid e-mail, and the mobile only when the municipality has a phone channel.
  reachable: TutorContacts;
  phoneEnabled: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

// The acceptance of the notices, asked right under the contacts and never marked beforehand. It names the channels the notices will use,
// and it cannot be marked while there is nowhere to send them.
export function NoticeConsent({ checked, onChange, reachable, phoneEnabled, loading, error, onRetry }: NoticeConsentProps) {
  const channels = [reachable.email && "e-mail", reachable.phone && "celular"].filter(Boolean).join(" e ");
  const canAccept = !loading && !error && Boolean(channels);
  return (
    <div className="requester-notice">
      <label className="checkbox-row notice-consent">
        <input type="checkbox" checked={checked && canAccept} disabled={!canAccept} onChange={(event) => onChange(event.target.checked)} />
        {channels ? `Quero receber avisos desta solicitação por ${channels}: confirmação da data, mudança de agenda e conclusão.` : "Quero receber avisos desta solicitação."}
      </label>
      {loading && <p role="status">Carregando os canais de aviso...</p>}
      {error && <div role="alert"><p className="form-error">{error}</p><button type="button" className="ghost-button" onClick={onRetry}>Tentar novamente</button></div>}
      {!loading && !error && !channels && <p className="follow-up-notice" role="status">{phoneEnabled ? NO_CONTACT_TEXT : NO_CHANNEL_TEXT}</p>}
      <p className="muted">Sem os avisos você não saberá se a data mudar. Guarde seu protocolo.</p>
    </div>
  );
}
