import { validateDocumentReusePolicy } from "../../../shared/document-reuse-contract.js";

export function documentPolicyFromForm(reuseScope: string, days: string) {
  const reuseValidityDays = days.trim() === "" ? null : Number(days);
  const policy = { reuseScope, reuseValidityDays };
  return { policy, error: validateDocumentReusePolicy(policy) };
}
