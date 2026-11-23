import { normalizeFollowUp } from "../../../shared/notification-contract.js";
import { AnimalTutorship, isAnimalTutorship, tutorshipRequiresTutor } from "../../../shared/request-tutorship-contract.js";
import { MOBILE_PHONE_MESSAGE, isMobilePhone } from "../../../shared/phone-contract.js";
import { REQUEST_CONTACT_CPF_KEY } from "../../../shared/request-contract.js";
import { isInternalUser } from "../tenant.js";
import { normalizeCpf, isValidCpf, isValidPhone } from "../utils.js";
import { canReachByPhone } from "./follow-up-phone.js";
import { prepareAnimalNeighborhoods } from "./request-neighborhoods.js";
import { DERIVED_WORKFLOW_KEYS, prepareRequestProcedures, withDerivedProcedures } from "./request-procedures.js";

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

// Only the answer to "does the animal have a tutor?" may dispense the tutor's identity; origin, skipTutor and stepTutor sent by the client cannot.
export function prepareRequestSubmission({ body, user, municipalityId, workflow, settings, env = process.env }) {
  const requestType = body.request_type ?? body.requestType ?? body.requestTypeId ?? body.type;
  const isComplaint = requestType === "DENUNCIA";
  const internal = Boolean(user && isInternalUser(user));
  const publicProcedure = !internal && !isComplaint;
  const suppliedCpf = body.cpf ?? body.tutor_cpf;
  const cleanCpf = normalizeCpf(suppliedCpf);
  const hasCpfInput = suppliedCpf !== undefined && suppliedCpf !== null && String(suppliedCpf).trim() !== "";
  // The procedures of each animal, which every request but a complaint carries; their derived fields replace whatever the client sent.
  const procedures = isComplaint ? null : prepareRequestProcedures({ animals: body.animals, municipalityId, settings });
  // Each new animal names the neighborhood where it lives; the normalized animals replace the ones the client sent.
  const located = procedures ? prepareAnimalNeighborhoods({ animals: procedures.animals, municipalityId, settings }) : null;
  const nextWorkflow = withDerivedProcedures(workflow, procedures?.fields);
  delete nextWorkflow.notificationDispatches;
  delete nextWorkflow.notificationResults;
  delete nextWorkflow.procedureScheduleDates;
  delete nextWorkflow[REQUEST_CONTACT_CPF_KEY];

  // The answer to "does the animal have a tutor?": one of the two values of AnimalTutorship, and no answer means with a tutor. It is the
  // only thing that dispenses the tutor, and the animals of the request have to say the same.
  function selectTutorship() {
    const answer = workflow.tutorship || AnimalTutorship.WITH_TUTOR;
    if (!isAnimalTutorship(answer)) invalid("Resposta sobre o tutor inválida.");
    if (Array.isArray(body.animals) && body.animals.some((animal) => animal?.tutorship && animal.tutorship !== workflow.tutorship)) {
      invalid("A resposta sobre o tutor do animal não corresponde à solicitação.");
    }
    return answer;
  }

  let tutorRequired = true;
  if (publicProcedure) {
    if (Array.isArray(body.animals) && body.animals.some((animal) => !animal || typeof animal !== "object" || Array.isArray(animal))) {
      invalid("Dados do animal inválidos.");
    }
    tutorRequired = tutorshipRequiresTutor(selectTutorship());
    nextWorkflow.followUp = normalizeFollowUp(workflow.followUp, { phoneEnabled: canReachByPhone(settings, env) });
  } else if (workflow.followUp !== undefined) {
    nextWorkflow.followUp = normalizeFollowUp(workflow.followUp, { phoneEnabled: canReachByPhone(settings, env) });
  }
  if (!isComplaint && !procedures) invalid("Escolha ao menos um procedimento para cada animal.");
  // Staff register a tutor too, unless they answer that the animal has none; the request types never dispense it.
  if (internal && !isComplaint) tutorRequired = tutorshipRequiresTutor(selectTutorship());

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

// The generic PATCH preserves consent, delivery metadata, contact identification and derived procedures.
const PROTECTED_WORKFLOW_KEYS = Object.freeze(["followUp", "notificationDispatches", "notificationResults", REQUEST_CONTACT_CPF_KEY, ...DERIVED_WORKFLOW_KEYS]);

export function mergeProtectedWorkflow(current, patch) {
  const next = { ...current, ...patch };
  for (const key of PROTECTED_WORKFLOW_KEYS) {
    if (Object.hasOwn(current, key)) next[key] = current[key];
    else delete next[key];
  }
  return next;
}
