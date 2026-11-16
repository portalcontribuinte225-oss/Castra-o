import { CompactChoiceField } from "../../components/ui";
import type { FollowUpValue } from "../request-follow-up/follow-up";
import { RegistrationContactFields } from "../tutor-access/registration-contact-fields";

const answers = [
  { value: "yes", label: "Sim, quero", subtitle: "Avisamos quando a data for confirmada ou mudar." },
  { value: "no", label: "Não precisa", subtitle: "Guarde o protocolo para consultar depois." },
];

interface UntutoredNoticesProps {
  followUp: FollowUpValue;
  onFollowUpChange: (value: FollowUpValue) => void;
  email: string;
  phone: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  showErrors: boolean;
  // What is missing for the notices, when the answer is yes.
  issue: string;
}

// An animal without a tutor identifies nobody: the only thing asked is whether the person wants the notices and, if so, how to reach them.
export function UntutoredNotices({ followUp, onFollowUpChange, email, phone, onEmailChange, onPhoneChange, showErrors, issue }: UntutoredNoticesProps) {
  return (
    <>
      <div className="form-sub-card">
        <CompactChoiceField label="Quer acompanhar esta solicitação?" value={followUp.enabled ? "yes" : "no"} options={answers} onChange={(value: string) => onFollowUpChange({ enabled: value === "yes" })} />
      </div>
      {followUp.enabled && (
        <div className="requester-reveal">
          <RegistrationContactFields notices email={email} phone={phone} onEmailChange={onEmailChange} onPhoneChange={onPhoneChange} showErrors={showErrors} />
          {showErrors && issue && <p className="form-error" role="alert">{issue}</p>}
        </div>
      )}
    </>
  );
}
