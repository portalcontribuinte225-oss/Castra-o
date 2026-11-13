import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DocumentReviewStatus, DocumentReuseScope, DocumentReuseState } from "../../../shared/document-reuse-contract.js";
import { normalizeDocumentType } from "../../domain";
import { RequestStep, getVisibleSteps } from "../request-steps/request-steps";
import { TutorArea } from "../tutor-access/tutor-area";
import { ProcedureEntry } from "./procedure-entry";
import { bindProcedureIntent } from "./procedure-intent";
import { animalForRequest, pickReusableDocuments, resolveRegisteredIdentificationType } from "./registered-request-data";
import { RegisteredRequestSelection } from "./registered-request-selection";
import { ReusableDocumentChoices } from "./reusable-document-choices";
import { documentPolicyFromForm } from "./document-policy-form";
import { buildDocumentReviewDecisions } from "./document-review-decisions";
import { buildRequestPayload } from "./request-payload";
import { buildDocumentSubmission, removeReusedDocument } from "./document-selection";
import { availabilityPeriod, getAvailableScheduleSlot, selectScheduleOccurrence } from "./use-schedule-availability";
import type { RegisteredRequestContext, ReusableDocumentCandidate } from "./registered-animal-types";

const user = { id: "tutor-a", role: "tutor", name: "Ana", cpf: "52998224725", municipalityId: "town-a", mustChangePassword: false };
const context: RegisteredRequestContext = { animal: { id: "animal-a", name: "Bidu", species: "Canino", sex: "Macho", size: "Pequeno", breedType: "Definida", breedDescription: "Poodle", identificationTypeId: "persisted", declaredMicrochip: "12345" }, tutor: { name: "Ana", cpf: user.cpf, email: "ana@example.com", phone: "48999991234" }, identificationTypes: [{ id: "default", name: "Padrão", active: true }, { id: "persisted", name: "Com tutor", active: false, stepTutor: true }], requestTypes: [{ id: "type-a", name: "Vacinação" }, { id: "type-b", name: "Castração" }], documentTypes: [], documents: [] };
function document(overrides: Partial<ReusableDocumentCandidate> = {}): ReusableDocumentCandidate { return { attachmentId: "attachment-a", documentId: "identity", documentName: "Identidade", fileName: "identity.pdf", fileType: "application/pdf", fileSize: 100, status: DocumentReviewStatus.ATTACHED, state: DocumentReuseState.PENDING, eligible: true, receivedAt: "2026-11-01T00:00:00Z", reuseRef: { sourceRequestId: "source-a", attachmentId: "attachment-a", hash: "hash-a" }, ...overrides }; }

describe("registered procedure entry", () => {
  it("keeps municipality and mutirão through restricted login and binds the intent to one account", () => {
    const intent = { municipalityId: "town-a", schedule: "30/11/2026" };
    const bound = bindProcedureIntent(intent, { ...user, mustChangePassword: true });
    expect(bound).toEqual({ ...intent, ownerId: user.id });
    expect(bindProcedureIntent(bound, user)).toEqual(bound);
    for (const next of [null, { ...user, id: "another" }, { ...user, municipalityId: "town-b" }, { ...user, role: "analista" }]) expect(bindProcedureIntent(bound, next)).toBeNull();
  });

  it("offers both paths and gates them on municipality selection", () => {
    const html = renderToStaticMarkup(<ProcedureEntry disabled onFirst={() => {}} onRegistered={() => {}} />);
    expect(html).toContain("Primeira solicitação"); expect(html).toContain("Animal já cadastrado");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("opens the animal area without rendering requests or an administrative workspace for the intent", () => {
    const requests = vi.fn(() => <p>history</p>);
    const form = vi.fn(() => null);
    const html = renderToStaticMarkup(<TutorArea user={user} intent={{ municipalityId: "town-a" }} onIntentConsumed={() => {}} onSession={() => {}} onLogout={() => {}} renderRequests={requests} renderForm={form} />);
    expect(html).toContain("Meus animais"); expect(html).toContain("Cadastrar outro animal");
    expect(requests).not.toHaveBeenCalled(); expect(form).not.toHaveBeenCalled();
  });
});

describe("registered request context", () => {
  it("preserves persisted breed and identification, including an inactive identification", () => {
    const type = resolveRegisteredIdentificationType(context.identificationTypes, context.animal);
    expect(type?.id).toBe("persisted"); expect(type?.active).toBe(false);
    expect(resolveRegisteredIdentificationType(context.identificationTypes, { ...context.animal, identificationTypeId: "missing" })).toBeNull();
    expect(animalForRequest(context.animal)).toMatchObject({ id: "animal-a", breedDescription: "Poodle", identificationTypeId: "persisted" });
    const html = renderToStaticMarkup(<RegisteredRequestSelection context={context} selectedType="Vacinação" onSelectType={() => {}} />);
    expect(html).toContain("Poodle"); expect(html).toContain("indisponível"); expect(html).toContain("aguarda conferência");
    expect(html).not.toContain("<input"); expect(html).not.toContain("ana@example.com"); expect(html).not.toContain(user.cpf);
  });

  it("skips Tutor while retaining configured steps and final follow-up", () => {
    const steps = getVisibleSteps({ internal: false, skipTutor: true, configs: [{ stepAgenda: false, stepDocuments: true }] }).map((item) => item.step);
    expect(steps).toEqual([RequestStep.ANIMAL, RequestStep.DOCUMENTS, RequestStep.FOLLOW_UP]);
    expect(getVisibleSteps({ internal: true, skipTutor: false, configs: [] }).map((item) => item.step)).toEqual([RequestStep.TUTOR, RequestStep.ANIMAL, RequestStep.SCHEDULE]);
  });
});

describe("document reuse boundaries", () => {
  it("shows the selected reused animal photo with preview and replacement controls", () => {
    const photo = document({ documentId: "animal_photo", documentName: "Foto do animal", fileName: "bidu.jpg", fileType: "image/jpeg" });
    const html = renderToStaticMarkup(<ReusableDocumentChoices candidates={[photo]} selected={photo} onSelect={() => {}} onPreview={() => {}} onRemove={() => {}} />);
    expect(html).toContain("bidu.jpg"); expect(html).toContain("Reaproveitado");
    expect(html).toContain("Ver arquivo"); expect(html).toContain("Usar outro arquivo");
    expect(html).not.toContain("<img");
  });

  it("replaces a reused photo with one upload and leaves no stale photo after a failed read", () => {
    const photo = document({ documentId: "animal_photo" });
    const identity = document({ attachmentId: "identity-file", reuseRef: { sourceRequestId: "source-b", attachmentId: "identity-file", hash: "hash-b" } });
    const selected = { animal_photo: photo, identity };
    const cleared = removeReusedDocument(selected, "animal_photo");
    expect(selected.animal_photo).toBe(photo);
    expect(buildDocumentSubmission([], cleared)).toEqual({ documents: [], reusedDocuments: [identity.reuseRef] });
    const upload = { documentId: "animal_photo", fileName: "new-photo.jpg", dataUrl: "data:image/jpeg;base64,new-photo" };
    const payload = buildRequestPayload(buildDocumentSubmission([upload], selected), user);
    expect(payload.documents).toEqual([upload]); expect(payload.reusedDocuments).toEqual([identity.reuseRef]);
    expect(payload.reusedDocuments).not.toContainEqual(photo.reuseRef);
  });

  it("selects eligible pending metadata without treating it as approved and skips expired/rejected candidates", () => {
    const pending = document();
    const newerExpired = document({ attachmentId: "expired", receivedAt: "2026-11-02T00:00:00Z", eligible: false, state: DocumentReuseState.EXPIRED });
    const rejected = document({ documentId: "residence", eligible: false, status: DocumentReviewStatus.REJECTED, state: DocumentReuseState.UNAVAILABLE });
    expect(pickReusableDocuments([pending, newerExpired, rejected])).toEqual({ identity: pending });
    const html = renderToStaticMarkup(<ReusableDocumentChoices candidates={[pending, newerExpired]} selected={pending} onSelect={() => {}} onPreview={() => {}} onRemove={() => {}} />);
    expect(html).toContain("Pendente de conferência"); expect(html).toContain("Vencido para reaproveitamento"); expect(html).toContain("Usar outro arquivo");
    expect(html).not.toContain("data:");
  });

  it("defaults old document types to request scope and validates blank/null versus positive whole days", () => {
    expect(normalizeDocumentType({ id: "legacy" })).toMatchObject({ reuseScope: DocumentReuseScope.REQUEST, reuseValidityDays: null });
    expect(documentPolicyFromForm(DocumentReuseScope.ANIMAL, " ")).toEqual({ policy: { reuseScope: DocumentReuseScope.ANIMAL, reuseValidityDays: null }, error: "" });
    expect(documentPolicyFromForm(DocumentReuseScope.TUTOR, "30").error).toBe("");
    for (const value of ["0", "-1", "1.5", "text", "36526"]) expect(documentPolicyFromForm(DocumentReuseScope.TUTOR, value).error).not.toBe("");
  });

  it("sends only explicit review decisions tied to an attachment, never client review provenance", () => {
    expect(buildDocumentReviewDecisions([{ id: "row", document: { attachmentId: "stable-id" } }], { row: DocumentReviewStatus.APPROVED })).toEqual([{ attachmentId: "stable-id", decision: DocumentReviewStatus.APPROVED }]);
    expect(() => buildDocumentReviewDecisions([{ id: "row" }], { row: DocumentReviewStatus.APPROVED })).toThrow("Atualize o processo");
    expect(buildDocumentReviewDecisions([{ id: "row" }], { row: DocumentReviewStatus.ATTACHED })).toEqual([]);
  });

  it("forwards new acceptance and separate reuse refs, without credentials or status proof", () => {
    const ref = document().reuseRef;
    const body = buildRequestPayload({ animals: [{ id: "animal-a" }], reusedDocuments: [ref], declarationAccepted: true, temporaryPassword: "secret", workflowData: { scheduleOccurrenceKey: "day:a", scheduleSlotTime: "08:00", followUp: { enabled: false, email: "", phone: "" } } }, user);
    expect(body.animals).toEqual([{ id: "animal-a" }]); expect(body.reusedDocuments).toEqual([ref]); expect(body.declarationAccepted).toBe(true);
    expect(body.workflow_data).toMatchObject({ scheduleOccurrenceKey: "day:a", scheduleSlotTime: "08:00" });
    expect(JSON.stringify(body)).not.toContain("secret"); expect(JSON.stringify(body.reusedDocuments)).not.toContain("approved");
    expect(buildRequestPayload({ signedAt: "old-signature" }, user).declarationAccepted).toBe(false);
  });
});

describe("public aggregate availability", () => {
  const days = [{ date: "30/11/2026", occurrenceKey: "day:full", slots: [{ time: "08:00", vacancies: 10, remaining: 0 }] }, { date: "30/11/2026", occurrenceKey: "rule:other", slots: [{ time: "09:00", vacancies: 4, remaining: 2 }] }];
  it("uses remaining by animal count and preserves the selected occurrence when another local has vacancies", () => {
    expect(getAvailableScheduleSlot(days[0], 1)).toBeNull(); expect(getAvailableScheduleSlot(days[1], 2)?.time).toBe("09:00"); expect(getAvailableScheduleSlot(days[1], 3)).toBeNull();
    expect(selectScheduleOccurrence(days, "30/11/2026")?.occurrenceKey).toBe("rule:other");
    expect(selectScheduleOccurrence(days, "30/11/2026", "day:full")?.occurrenceKey).toBe("day:full");
    expect(selectScheduleOccurrence(days, "30/11/2026", "removed")).toBeUndefined();
  });
  it("queries a bounded period including the mutirão date", () => {
    const period = availabilityPeriod("25/02/2027", new Date(2026, 10, 13));
    expect(period.from).toBe("2027-02-01"); expect(period.to).toBe("2027-05-01");
  });
});
