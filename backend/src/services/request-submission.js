import { configsAllowStep, normalizeFollowUp } from "../../../shared/notification-contract.js";
import { isInternalUser } from "../tenant.js";
import { normalizeCpf, isValidCpf, isValidPhone } from "../utils.js";

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function activeInMunicipality(item, municipalityId) {
  return item && typeof item === "object" && !Array.isArray(item)
    && item.active !== false && (!item.municipalityId || item.municipalityId === municipalityId);
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
  const nextWorkflow = { ...workflow };
  delete nextWorkflow.notificationDispatches;
  delete nextWorkflow.notificationResults;

  let tutorRequired = true;
  if (publicProcedure) {
    const requestTypeId = body.requestTypeId;
    const candidates = settings.requestTypes.filter((item) => activeInMunicipality(item, municipalityId));
    const matches = candidates.filter((item) => requestTypeId ? item.id === requestTypeId
      : item.id === requestType || item.name === requestType);
    const selectedRequestType = matches.length === 1 ? matches[0] : null;
    if ((requestTypeId || settings.requestTypes.length) && !selectedRequestType) invalid("Tipo de solicitação inválido para o município.");

    const identificationId = workflow.identificationTypeId;
    const selectedIdentification = identificationId
      ? settings.identificationTypes.find((item) => activeInMunicipality(item, municipalityId) && item.id === identificationId)
      : null;
    if (identificationId && !selectedIdentification) invalid("Tipo de identificação inválido para o município.");
    if (Array.isArray(body.animals) && body.animals.some((animal) => !animal || typeof animal !== "object" || Array.isArray(animal))) {
      invalid("Dados do animal inválidos.");
    }
    if (Array.isArray(body.animals) && body.animals.some((animal) => animal.identificationTypeId && animal.identificationTypeId !== identificationId)) {
      invalid("Tipo de identificação do animal não corresponde à solicitação.");
    }
    tutorRequired = configsAllowStep([selectedRequestType, selectedIdentification], "stepTutor");
    nextWorkflow.followUp = normalizeFollowUp(workflow.followUp, { whatsappEnabled: settings.whatsappEnabled });
  } else if (workflow.followUp !== undefined) {
    nextWorkflow.followUp = normalizeFollowUp(workflow.followUp, { whatsappEnabled: settings.whatsappEnabled });
  }

  if ((hasCpfInput || tutorRequired || isComplaint || internal || user?.role === "tutor") && !isValidCpf(cleanCpf)) {
    invalid(isComplaint ? "CPF válido é obrigatório para registrar a denúncia." : "Informe um CPF válido para o tutor.");
  }
  if (isComplaint) {
    const name = body.tutor_name ?? body.tutorName ?? body.tutor;
    if (typeof name !== "string" || !name.trim()) invalid("Nome do denunciante é obrigatório.");
    if (!isValidPhone(body.phone)) invalid("Informe um telefone válido em Contato.");
  }
  return { cpf: cleanCpf || null, workflow: nextWorkflow, requestType, internal, tutorRequired };
}

// Consent and delivery metadata are not editable through the generic operational PATCH.
export function mergeProtectedWorkflow(current, patch) {
  const next = { ...current, ...patch };
  for (const key of ["followUp", "notificationDispatches", "notificationResults"]) {
    if (Object.hasOwn(current, key)) next[key] = current[key];
    else delete next[key];
  }
  return next;
}
