import { ChoiceQuestion } from "../../components/choice-question";
import type { FollowUpValue, TutorContacts } from "../request-follow-up/follow-up";

const FollowUpAnswer = Object.freeze({ YES: "yes", NO: "no" });
const NO_CHANNEL_TEXT = "Este município ainda não envia avisos por celular e nenhum e-mail foi informado. Informe um e-mail para receber os avisos.";
const NO_CONTACT_TEXT = "Não há contato disponível para receber avisos. Informe um e-mail ou um celular válido.";

interface FollowUpQuestionProps {
  value: FollowUpValue;
  onChange: (value: FollowUpValue) => void;
  // The contacts the notices can reach when they are known before the answer (the tutor's, or the registration's), or null when they
  // are asked after a yes (an animal without a tutor).
  reachable: TutorContacts | null;
  phoneEnabled: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  invalid?: boolean;
}

// Whether the person wants the notices of the request, asked with no answer marked. With the contacts already known, the notices can
// only be accepted when one of them can be reached, and the yes names the channels they will use.
export function FollowUpQuestion({ value, onChange, reachable, phoneEnabled, loading, error, onRetry, invalid = false }: FollowUpQuestionProps) {
  const channels = reachable ? [reachable.email && "e-mail", reachable.phone && "celular"].filter(Boolean).join(" e ") : "";
  const unreachable = reachable !== null && !channels;
  const options = [
    { value: FollowUpAnswer.YES, label: "Sim, quero", description: `Se aceitar, você fica por dentro de tudo${channels ? ` por ${channels}` : ""}: confirmação ou mudança do agendamento, análise dos documentos e o resultado da sua solicitação.`,
      disabled: loading || Boolean(error) || unreachable },
    { value: FollowUpAnswer.NO, label: "Não precisa", description: "Se preferir não receber avisos, é só guardar o protocolo e consultar sua solicitação quando quiser." },
  ];
  const answer = value.enabled === null ? "" : value.enabled ? FollowUpAnswer.YES : FollowUpAnswer.NO;
  return (
    <ChoiceQuestion question="Quer acompanhar esta solicitação?" options={options} value={answer} invalid={invalid}
      onChange={(next) => onChange({ enabled: next === FollowUpAnswer.YES })}>
      {loading && <p role="status">Carregando os canais de aviso...</p>}
      {error && <div role="alert"><p className="form-error">{error}</p><button type="button" className="ghost-button" onClick={onRetry}>Tentar novamente</button></div>}
      {!loading && !error && unreachable && <p className="follow-up-notice" role="status">{phoneEnabled ? NO_CONTACT_TEXT : NO_CHANNEL_TEXT}</p>}
    </ChoiceQuestion>
  );
}
