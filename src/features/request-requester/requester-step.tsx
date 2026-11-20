import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";
import { availableFollowUpContacts, getFollowUpIssues } from "../request-follow-up/follow-up";
import type { FollowUpValue, TutorContacts } from "../request-follow-up/follow-up";
import { RegistrationContactFields } from "../tutor-access/registration-contact-fields";
import { TutorStepFields } from "../tutor-access/tutor-step-fields";
import type { TutorStepFieldsProps } from "../tutor-access/tutor-step-fields";
import { FollowUpQuestion } from "./follow-up-question";
import { ProfileContacts } from "./profile-contacts";
import { RequestEntryQuestion } from "./request-entry-question";
import { TutorshipQuestion } from "./tutorship-question";

export interface RequesterStepProps {
  // Only the public form asks how the person wants to make the request; the rest of the step opens once they choose a first request.
  entry?: { first: boolean; onFirst: () => void; onRegistered: () => void };
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

// The first step of the request, the same for the public form and for the one the staff fills: one question after another, each shrinking
// to a line once answered. How to request (public only), whether the animal has a tutor, and whether the person wants the notices, with
// the tutor's data and contacts, or only a contact for the notices, between them.
export function RequesterStep({ entry, tutorship, tutorshipFixed, tutorKnown, showErrors, onTutorshipChange, tutorFields, contacts, followUp, onFollowUpChange, policy }: RequesterStepProps) {
  const reachable = availableFollowUpContacts(contacts, policy.phoneEnabled);
  const noticeIssue = followUp.enabled ? getFollowUpIssues(followUp, contacts, policy.phoneEnabled)[0] || "" : "";
  // The contacts are known before the answer with a tutor, and asked after a yes without one (null).
  const question = (known: TutorContacts | null) => (
    <FollowUpQuestion value={followUp} onChange={onFollowUpChange} reachable={known} phoneEnabled={policy.phoneEnabled} internal={tutorFields.internal}
      loading={policy.loading} error={policy.error} onRetry={policy.retry} invalid={showErrors && followUp.enabled === null} />
  );
  const issue = showErrors && noticeIssue ? <p className="form-error" role="alert">{noticeIssue}</p> : null;
  if (entry && !entry.first) return <RequestEntryQuestion first={false} onFirst={entry.onFirst} onRegistered={entry.onRegistered} invalid={showErrors} />;
  return (
    <>
      {entry && <RequestEntryQuestion first onFirst={entry.onFirst} onRegistered={entry.onRegistered} />}
      {!tutorshipFixed && <TutorshipQuestion value={tutorship} onChange={onTutorshipChange} invalid={showErrors && !tutorship} />}
      {tutorKnown && <><ProfileContacts reachable={reachable} />{question(reachable)}{issue}</>}
      {!tutorKnown && tutorship === AnimalTutorship.WITH_TUTOR && (
        <div className="requester-reveal">
          <TutorStepFields {...tutorFields} />
          {question(reachable)}
          {issue}
        </div>
      )}
      {!tutorKnown && tutorship === AnimalTutorship.WITHOUT_TUTOR && (
        <div className="requester-reveal">
          {question(null)}
          {followUp.enabled && (
            <div className="requester-reveal">
              <RegistrationContactFields notices email={tutorFields.data.email} phone={tutorFields.data.phone} showErrors={showErrors}
                onEmailChange={(value) => tutorFields.onField("email", value)} onPhoneChange={(value) => tutorFields.onMaskedField("phone", value)} />
              {issue}
            </div>
          )}
        </div>
      )}
    </>
  );
}
