import { maskFollowUpEmail, maskFollowUpPhone } from "../request-follow-up/follow-up";
import type { TutorContacts } from "../request-follow-up/follow-up";

// Whoever is a tutor already (the account, or a registered animal) is not asked for contacts again: the notices use the ones registered.
export function ProfileContacts({ reachable }: { reachable: TutorContacts }) {
  const shown = [maskFollowUpEmail(reachable.email), maskFollowUpPhone(reachable.phone)].filter(Boolean);
  return (
    <div className="form-sub-card">
      <span className="form-sub-card-title">Seus contatos</span>
      <p>{shown.length ? <>Os avisos vão para o que está no seu cadastro: <strong>{shown.join(" · ")}</strong>.</> : "Seu cadastro não tem um contato que receba avisos."}</p>
    </div>
  );
}
