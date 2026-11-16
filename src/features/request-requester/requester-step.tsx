import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";
import { availableFollowUpContacts, getFollowUpIssues } from "../request-follow-up/follow-up";
import type { FollowUpValue, TutorContacts } from "../request-follow-up/follow-up";
import { TutorStepFields } from "../tutor-access/tutor-step-fields";
import type { TutorStepFieldsProps } from "../tutor-access/tutor-step-fields";
import { NoticeConsent } from "./notice-consent";
import { ProfileContacts } from "./profile-contacts";
import { TutorshipQuestion } from "./tutorship-question";
import { UntutoredNotices } from "./untutored-notices";

export interface RequesterStepProps {
  // The ids of AnimalTutorship, or "" while the question has no answer.
  tutorship: string;
  // The person is a tutor already (the account, or a registered animal): there is nothing to ask about the tutorship.
  tutorshipFixed: boolean;
  // The tutor's data come from the account or the registered animal: only the notices are asked.
  tutorKnown: boolean;
  showErrors: boolean;
  onTutorshipChange: (tutorship: string) => void;
  tutorFields: TutorStepFieldsProps;
  // The contacts typed in this step (or the profile's): the notices go to them, with nothing to type twice.
  contacts: TutorContacts;
  followUp: FollowUpValue;
  onFollowUpChange: (value: FollowUpValue) => void;
  policy: { loading: boolean; error: string; phoneEnabled: boolean; retry: () => void };
}

// The first step of the request, the same for the public form and for the one the staff fills: the answer about the tutor and what it
// opens: the tutor's data and contacts with the acceptance of the notices, or just the question about the notices.
export function RequesterStep({ tutorship, tutorshipFixed, tutorKnown, showErrors, onTutorshipChange, tutorFields, contacts, followUp, onFollowUpChange, policy }: RequesterStepProps) {
  const reachable = availableFollowUpContacts(contacts, policy.phoneEnabled);
  const consent = (
    <NoticeConsent checked={followUp.enabled} onChange={(enabled) => onFollowUpChange({ enabled })} reachable={reachable} phoneEnabled={policy.phoneEnabled}
      loading={policy.loading} error={policy.error} onRetry={policy.retry} />
  );
  return (
    <>
      {!tutorshipFixed && <TutorshipQuestion value={tutorship} onChange={onTutorshipChange} invalid={showErrors && !tutorship} />}
      {tutorKnown && <><ProfileContacts reachable={reachable} />{consent}</>}
      {!tutorKnown && tutorship === AnimalTutorship.WITH_TUTOR && <div className="requester-reveal"><TutorStepFields {...tutorFields} />{consent}</div>}
      {!tutorKnown && tutorship === AnimalTutorship.WITHOUT_TUTOR && (
        <div className="requester-reveal">
          <UntutoredNotices followUp={followUp} onFollowUpChange={onFollowUpChange} email={tutorFields.data.email} phone={tutorFields.data.phone}
            onEmailChange={(value) => tutorFields.onField("email", value)} onPhoneChange={(value) => tutorFields.onMaskedField("phone", value)}
            showErrors={showErrors} issue={followUp.enabled ? getFollowUpIssues(followUp, contacts, policy.phoneEnabled)[0] || "" : ""} />
        </div>
      )}
    </>
  );
}
