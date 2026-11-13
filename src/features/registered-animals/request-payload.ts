export function buildRequestPayload(payload: Record<string, unknown>, user?: { name?: string; email?: string; municipalityId?: string }) {
  return {
    animal_name: payload.animalName || payload.animal_name,
    species: payload.species, size: payload.size,
    animal_id: payload.animal_id || payload.animalId || "",
    animal_microchip: payload.animal_microchip || payload.animalMicrochip || "",
    request_type: payload.requestType || payload.request_type,
    municipality: payload.municipality, notes: payload.notes,
    tutor_name: payload.tutor ?? user?.name ?? "", tutor_email: payload.email ?? user?.email ?? "",
    cpf: payload.cpf || "", phone: payload.phone || "", cep: payload.cep || "",
    address: payload.address || "", neighborhood: payload.neighborhood || "", city: payload.city || "", state: payload.state || "",
    preferredSchedule: payload.preferredSchedule || "",
    municipalityId: payload.municipalityId || payload.municipality_id || user?.municipalityId || "",
    schedule_date: payload.preferredSchedule || payload.schedule_date || "",
    scheduleLocationName: payload.scheduleLocationName || "", scheduleAddress: payload.scheduleAddress || "",
    scheduleAddressUrl: payload.scheduleAddressUrl || "", scheduleMunicipality: payload.scheduleMunicipality || "",
    responsibleUnit: payload.responsibleUnit || "", veterinarian: payload.veterinarian || "",
    animals: payload.animals || [], documents: payload.documents || [], reusedDocuments: payload.reusedDocuments || [], declarationAccepted: payload.declarationAccepted === true,
    signatureDataUrl: payload.signatureDataUrl || "", signedAt: payload.signedAt || "",
    type: payload.type || payload.requestType || payload.request_type || "", requestTypeId: payload.requestTypeId || "",
    fee: payload.fee || "", tags: payload.tags || [], workflow_data: payload.workflowData || payload.workflow_data || {},
  };
}
