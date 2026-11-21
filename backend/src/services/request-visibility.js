import { RequestKind, withoutRequestContactCpf } from "../../../shared/request-contract.js";
import { documentsVisibleToUser } from "./documents/document-policy.js";
import { isInternalUser } from "../tenant.js";

export function visibleRequest(row, user) {
  const hideReporter = row.request_type === RequestKind.COMPLAINT && row.is_confidential
    && !isInternalUser(user) && row.tutor_id !== user.id;
  return {
    ...row,
    ...(hideReporter ? { tutor_id: null, tutor_name: null, tutor_email: null, cpf: null, phone: null } : {}),
    workflow_data: withoutRequestContactCpf(row.workflow_data),
    documents: documentsVisibleToUser(row.documents, user),
  };
}
