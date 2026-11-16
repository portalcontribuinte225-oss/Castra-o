import { configsAllowStep, normalizeFollowUp } from "../../../shared/notification-contract.js";
import { MOBILE_PHONE_MESSAGE, isMobilePhone } from "../../../shared/phone-contract.js";
import { isInternalUser } from "../tenant.js";
import { normalizeCpf, isValidCpf, isValidPhone } from "../utils.js";
import { prepareAnimalNeighborhoods } from "./request-neighborhoods.js";
import { DERIVED_WORKFLOW_KEYS, activeInMunicipality, prepareRequestProcedures, withDerivedProcedures } from "./request-procedures.js";

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

// Only trusted configuration may dispense identity; origin/skipTutor sent by the client cannot.
export function prepareRequestSubmission({ body, user, municipalityId, workflow, settings }) {
  const requestType = body.request_type ?? body.requestType ?? body.requestTypeId ?? body.type;
  const isComplaint = requestType === "DENUNCIA";
  const internal = Boolean(user && isInternalUser(user));
  const publicProcedure = !internal && !isComplaint;
  const suppliedCpf = body.cpf ?? body.tutor_cpf;
  const cleanCpf = normalizeCpf(suppliedCpf);
  const hasCpfInput = suppliedCpf !== undefined && suppliedCpf !== null && String(suppliedCpf).trim() !== "";
  // The procedures of each animal, when the request carries them; their derived fields replace whatever the client sent.
  const procedures = isComplaint ? null : prepareRequestProcedures({ animals: body.animals, municipalityId, settings });
  // With procedures per animal (the form of the public and the internal request) each new animal names the neighborhood where it
  // lives; the normalized animals replace the ones the client sent. A request made the old way has no animal form to ask it in.
  const located = procedures ? prepareAnimalNeighborhoods({ animals: procedures.animals, municipalityId, settings }) : null;
  const nextWorkflow = withDerivedProcedures(workflow, procedures?.fields);
  delete nextWorkflow.notificationDispatches;
  delete nextWorkflow.notificationResults;

  // The identification type the request was made with: it must be an active one of the municipality, and it is the trusted
  // configuration that may dispense the tutor (the client cannot).
  function selectIdentification() {
    const identificationId = workflow.identificationTypeId;
    const selected = identificationId
      ? settings.identificationTypes.find((item) => activeInMunicipality(item, municipalityId) && item.id === identificationId)
      : null;
    if (identificationId && !selected) invalid("Tipo de identificação inválido para o município.");
    if (Array.isArray(body.animals) && body.animals.some((animal) => animal?.identificationTypeId && animal.identificationTypeId !== identificationId)) {
      invalid("Tipo de identificação do animal não corresponde à solicitação.");
    }
    return selected;
  }

  // A request made the old way has one type for the whole request, found by id or by name.
  function selectSingleRequestType() {
    const requestTypeId = body.requestTypeId;
    const candidates = settings.requestTypes.filter((item) => activeInMunicipality(item, municipalityId));
    const matches = candidates.filter((item) => requestTypeId ? item.id === requestTypeId
      : item.id === requestType || item.name === requestType);
    const selected = matches.length === 1 ? matches[0] : null;
    if ((requestTypeId || settings.requestTypes.length) && !selected) invalid("Tipo de solicitação inválido para o município.");
    return selected;
  }

  let tutorRequired = true;
  if (publicProcedure) {
    // An old-style request names its single type, which still has to be a valid one.
    if (!procedures) selectSingleRequestType();
    if (Array.isArray(body.animals) && body.animals.some((animal) => !animal || typeof animal !== "object" || Array.isArray(animal))) {
      invalid("Dados do animal inválidos.");
    }
    const selectedIdentification = selectIdentification();
    tutorRequired = configsAllowStep([selectedIdentification], "stepTutor");
    nextWorkflow.followUp = normalizeFollowUp(workflow.followUp, { phoneEnabled: settings.phoneEnabled });
  } else if (workflow.followUp !== undefined) {
    nextWorkflow.followUp = normalizeFollowUp(workflow.followUp, { phoneEnabled: settings.phoneEnabled });
  }
  // Staff register a tutor too, unless the identification type they chose has no Tutor step (an animal without a tutor); the request
  // types never dispense it.
  if (internal && !isComplaint) tutorRequired = configsAllowStep([selectIdentification()], "stepTutor");

  if ((hasCpfInput || tutorRequired || isComplaint || user?.role === "tutor") && !isValidCpf(cleanCpf)) {
    invalid(isComplaint ? "CPF válido é obrigatório para registrar a denúncia." : "Informe um CPF válido para o tutor.");
  }
  // The mobile is how the municipality reaches the tutor, whoever fills the form. A logged tutor's comes from their profile, and a
  // complaint has its own phone rule below.
  if (tutorRequired && !isComplaint && user?.role !== "tutor" && !isMobilePhone(body.phone)) invalid(MOBILE_PHONE_MESSAGE);
  if (isComplaint) {
    const name = body.tutor_name ?? body.tutorName ?? body.tutor;
    if (typeof name !== "string" || !name.trim()) invalid("Nome do denunciante é obrigatório.");
    if (!isValidPhone(body.phone)) invalid("Informe um telefone válido em Contato.");
  }
  return {
    cpf: cleanCpf || null, workflow: nextWorkflow, requestType: procedures ? procedures.fields.requestType : requestType,
    animals: located || undefined, internal, tutorRequired,
  };
}

// Consent, delivery metadata and the derived procedures are not editable through the generic operational PATCH.
const PROTECTED_WORKFLOW_KEYS = Object.freeze(["followUp", "notificationDispatches", "notificationResults", ...DERIVED_WORKFLOW_KEYS]);

export function mergeProtectedWorkflow(current, patch) {
  const next = { ...current, ...patch };
  for (const key of PROTECTED_WORKFLOW_KEYS) {
    if (Object.hasOwn(current, key)) next[key] = current[key];
    else delete next[key];
  }
  return next;
}
