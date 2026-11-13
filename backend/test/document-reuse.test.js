import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { DocumentReuseScope, MAX_REQUEST_JSON_BYTES, MAX_DOCUMENT_REUSE_VALIDITY_DAYS,
  normalizeDocumentReusePolicy, validateDocumentReusePolicy } from "../../shared/document-reuse-contract.js";
import { assertMaterializedRequestSize, decodeDocumentContent } from "../src/services/documents/document-content.js";
import { canonicalDocumentDefinition, documentCriteriaFingerprint, PHOTO_DEFINITION } from "../src/services/documents/document-policy.js";
import { hasValidDocumentReceipt, signDocumentReceipt } from "../src/services/documents/document-provenance.js";
import { describeStoredDocument } from "../src/services/documents/stored-document.js";
import { createReceivedDocument, prepareRequestDocuments } from "../src/services/documents/request-documents.js";
import { applyDocumentReviews, decorateRequestDocuments } from "../src/services/documents/document-reviews.js";
import { catalogReusableDocuments, readReusableDocument } from "../src/services/documents/document-catalog.js";

const oldSecret = process.env.JWT_SECRET;
before(() => { process.env.JWT_SECRET = "isolated-document-reuse-tests"; });
after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
const NOW = new Date("2026-11-13T12:00:00.000Z");
const OWNER = "tutor-1", MUNICIPALITY = "municipality-1", ANIMAL = "animal-1";
const TUTOR = { id: OWNER, role: "tutor", municipality_id: MUNICIPALITY };
const STAFF = { id: "reviewer-1", role: "analista", municipality_id: MUNICIPALITY };
const PDF = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\ntest document\n").toString("base64")}`;
const definition = (overrides = {}) => canonicalDocumentDefinition({ id: "identity", name: "Identidade", reuseScope: "tutor", required: true, ...overrides });
const settingsFor = (documents = [definition()]) => ({ documentTypes: documents,
  requestTypes: [{ id: "procedure", name: "CASTRACAO", documents: documents.map(({ id }) => ({ id })) }], identificationTypes: [] });
function received(documentDefinition = definition(), extra = {}) {
  return createReceivedDocument({ documentId: documentDefinition.id, dataUrl: PDF, fileName: "original.pdf", ...extra }, documentDefinition,
    { requestId: "original", ownerUserId: OWNER, municipalityId: MUNICIPALITY, animalIds: [ANIMAL], now: NOW });
}
function row(document, extra = {}) {
  return { id: document.requestId || "original", tutor_id: OWNER, municipality_id: MUNICIPALITY,
    created_at: new Date("2026-10-01T00:00:00.000Z"), request_type: "procedure", animals: [{ id: ANIMAL }], document_index: 0, document, ...extra };
}
function reference(source) {
  const description = describeStoredDocument(source, definition({ maxSizeMb: 12 }));
  return { sourceRequestId: source.id, attachmentId: description.attachmentId, hash: description.hash };
}
function clientFor(sources) {
  const calls = [];
  return { calls, async query(sql, values) {
    calls.push({ sql, values });
    assert.match(sql, /r\.tutor_id = \$\d/);
    assert.match(sql, /r\.municipality_id = \$\d/);
    if (sql.includes("LIMIT 80")) {
      assert.match(sql, /- 'dataUrl'/);
      const matches = sources.filter((source) => source.tutor_id === values[0] && source.municipality_id === values[1] && values[2].includes(source.document.documentId));
      return { rows: matches.map((source) => {
        const { dataUrl, data_url, content, previewUrl, url, ...document } = source.document;
        return { ...source, document };
      }) };
    }
    const index = values[4];
    return { rows: sources.filter((source) => source.id === values[0] && source.tutor_id === values[1] && source.municipality_id === values[2]
      && (source.document.attachmentId === values[3] || index !== null && source.document_index === index)).map((source) => structuredClone(source)) };
  } };
}
function submission(extra = {}) {
  return { body: { request_type: "procedure", declarationAccepted: true }, user: TUTOR, tutorId: OWNER,
    municipalityId: MUNICIPALITY, settings: settingsFor(), requestId: "new-request", animalIds: [ANIMAL], now: NOW, ...extra };
}

test("document policy defaults conservatively and rejects invalid or unrepresentable periods", () => {
  assert.deepEqual(normalizeDocumentReusePolicy({}), { reuseScope: DocumentReuseScope.REQUEST, reuseValidityDays: null });
  assert.equal(validateDocumentReusePolicy({ reuseScope: "tutor", reuseValidityDays: null }), "");
  assert.equal(validateDocumentReusePolicy({ reuseValidityDays: MAX_DOCUMENT_REUSE_VALIDITY_DAYS }), "");
  for (const value of [0, -1, 1.5, "30", Number.MAX_SAFE_INTEGER, MAX_DOCUMENT_REUSE_VALIDITY_DAYS + 1]) assert.ok(validateDocumentReusePolicy({ reuseValidityDays: value }));
  assert.ok(validateDocumentReusePolicy({ reuseScope: "global" }));
});

test("file validation checks decoded bytes instead of declared size or MIME", () => {
  const valid = decodeDocumentContent({ dataUrl: PDF, fileType: "text/html", fileSize: 0 }, definition());
  assert.equal(valid.contentType, "application/pdf");
  assert.ok(valid.size > 0);
  for (const dataUrl of ["https://example.test/file.pdf", PDF.replace("application/pdf", "image/png"),
    `data:application/pdf;base64,${Buffer.from("<html>unsafe</html>").toString("base64")}`, PDF.slice(0, -1)]) {
    assert.throws(() => decodeDocumentContent({ dataUrl }, definition()));
  }
  assert.throws(() => decodeDocumentContent({ dataUrl: PDF }, definition({ maxSizeMb: 0.000001 })));
});

test("receipts survive JSONB key ordering and bind authority fields", () => {
  const document = received();
  const reordered = JSON.parse(JSON.stringify({ ...document, origin: Object.fromEntries(Object.entries(document.origin).reverse()) }));
  assert.equal(hasValidDocumentReceipt(reordered, row(reordered)), true);
  for (const change of [{ status: "approved" }, { receivedAt: "2026-11-14T00:00:00Z" }, { animalId: "other" },
    { origin: { ...document.origin, requestId: "fake" } }, { review: { decision: "approved", reviewedBy: "fake" } }]) {
    const forged = { ...document, ...change };
    assert.equal(hasValidDocumentReceipt(forged, row(forged)), false);
  }
  assert.equal(hasValidDocumentReceipt(document, row(document, { tutor_id: "other" })), false);
  assert.equal(hasValidDocumentReceipt(document, row(document, { municipality_id: "other" })), false);
});

test("legacy approval and browser dates are not trusted; finite expiry uses original DB date", () => {
  const document = { documentId: "identity", dataUrl: PDF, fileName: "old.pdf", status: "approved", receivedAt: "2099-01-01", review: { reviewedBy: "admin" } };
  const source = row(document);
  const described = describeStoredDocument(source, definition({ reuseValidityDays: 30 }), { now: NOW });
  assert.equal(described.status, "attached");
  assert.equal(described.receivedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(described.state, "expired");
  assert.equal(describeStoredDocument(source, definition(), { now: NOW }).state, "pending");
  const invalidReceipt = { ...document, receipt: { version: 1, digest: "0".repeat(64) } };
  const unknown = describeStoredDocument(row(invalidReceipt), definition({ reuseValidityDays: 30 }), { now: NOW });
  assert.equal(unknown.receivedAt, null);
  assert.equal(unknown.state, "unavailable");
  const unverifiedCopy = { ...document, origin: { requestId: "older-file", receivedAt: "2020-01-01" } };
  const unverified = describeStoredDocument(row(unverifiedCopy), definition({ reuseValidityDays: 30 }), { now: NOW });
  assert.equal(unverified.receivedAt, null, "An unverified copy cannot acquire the recent destination request date");
  assert.equal(unverified.state, "unavailable");
  assert.equal(describeStoredDocument(row(unverifiedCopy), definition(), { now: NOW }).state, "pending");
  const decorated = decorateRequestDocuments({ ...source, documents: [document] }, settingsFor());
  assert.equal(decorated.documents[0].status, "attached");
  assert.equal(decorated.documents[0].attachmentId, described.attachmentId);
});

test("expiry happens at the exact server UTC boundary and policy changes preserve receipt dates", () => {
  const document = received();
  const policy = definition({ reuseValidityDays: 1 });
  assert.equal(describeStoredDocument(row(document), policy, { now: new Date("2026-11-14T11:59:59.999Z") }).state, "pending");
  assert.equal(describeStoredDocument(row(document), policy, { now: new Date("2026-11-14T12:00:00.000Z") }).state, "expired");
  assert.equal(describeStoredDocument(row(document), definition(), { now: new Date("2030-01-01") }).receivedAt, NOW.toISOString());
});

test("fresh uploads ignore forged review, dates and ownership; declaration is required only for applicable public procedure", async () => {
  const upload = { documentId: "identity", dataUrl: PDF, fileName: "new.pdf", status: "approved", receivedAt: "2099-01-01", ownerUserId: "other", review: { reviewedBy: "fake" } };
  const args = submission({ body: { request_type: "procedure", declarationAccepted: true, documents: [upload] } });
  const [document] = await prepareRequestDocuments(clientFor([]), args);
  assert.equal(document.status, "attached");
  assert.equal(document.review, undefined);
  assert.equal(document.receivedAt, NOW.toISOString());
  assert.equal(document.ownerUserId, OWNER);
  assert.equal(hasValidDocumentReceipt(document, row(document)), true);
  for (const declarationAccepted of [false, undefined, "true", 1]) await assert.rejects(() => prepareRequestDocuments(clientFor([]), { ...args,
    body: { ...args.body, declarationAccepted } }), { status: 400 });
  await assert.doesNotReject(() => prepareRequestDocuments(clientFor([]), { ...args, user: STAFF, body: { request_type: "procedure" } }));
  const disabled = settingsFor(); disabled.requestTypes[0].stepDocuments = false;
  await assert.doesNotReject(() => prepareRequestDocuments(clientFor([]), submission({ settings: disabled })));
});

test("all supported request type aliases enforce required documents and honor configured document steps", async () => {
  for (const type of [{ requestTypeId: "procedure" }, { request_type: "procedure" }, { request_type: "CASTRACAO" },
    { requestType: "procedure" }, { requestType: "CASTRACAO" }, { type: "CASTRACAO" }]) {
    const args = submission({ body: { ...type, declarationAccepted: true } });
    await assert.rejects(() => prepareRequestDocuments(clientFor([]), args), { status: 400 }, JSON.stringify(type));
    await assert.doesNotReject(() => prepareRequestDocuments(clientFor([]), { ...args,
      body: { ...args.body, documents: [{ documentId: "identity", dataUrl: PDF }] } }));
    const disabled = settingsFor(); disabled.requestTypes[0].stepDocuments = false;
    await assert.doesNotReject(() => prepareRequestDocuments(clientFor([]), { ...args, settings: disabled,
      body: { ...type, declarationAccepted: false } }));
    const identityDisabled = settingsFor(); identityDisabled.identificationTypes = [{ id: "without-documents", stepDocuments: false }];
    await assert.doesNotReject(() => prepareRequestDocuments(clientFor([]), { ...args, settings: identityDisabled,
      body: { ...type, workflowData: { identificationTypeId: "without-documents" } } }));
  }
  await assert.doesNotReject(() => prepareRequestDocuments(clientFor([]), submission({ body: { requestType: "DENUNCIA" } })));
});

test("reuse resolves persisted bytes and immutable origin under shared row lock", async () => {
  const source = row(received());
  const client = clientFor([source]);
  const [copy] = await prepareRequestDocuments(client, submission({ body: { request_type: "procedure", declarationAccepted: true,
    reusedDocuments: [{ ...reference(source), status: "approved", receivedAt: "2099-01-01", dataUrl: "fake" }] } }));
  assert.equal(copy.dataUrl, source.document.dataUrl);
  assert.equal(copy.receivedAt, source.document.receivedAt);
  assert.deepEqual(copy.origin, source.document.origin);
  assert.equal(copy.status, "attached");
  assert.notEqual(copy.attachmentId, source.document.attachmentId);
  assert.match(client.calls[0].sql, /FOR SHARE OF r/);
  const intermediate = row(copy, { id: copy.requestId });
  const [copyAgain] = await prepareRequestDocuments(clientFor([source, intermediate]), submission({ requestId: "third-request",
    body: { request_type: "procedure", declarationAccepted: true, reusedDocuments: [reference(intermediate)] } }));
  assert.equal(copyAgain.origin.requestId, "original");
  assert.equal(copyAgain.receivedAt, NOW.toISOString());
  source.document.status = "rejected";
  source.document.receipt = signDocumentReceipt(source.document);
  await assert.rejects(() => prepareRequestDocuments(clientFor([source, intermediate]), submission({ body: {
    request_type: "procedure", declarationAccepted: true, reusedDocuments: [reference(intermediate)] } })), { status: 400 });
});

test("foreign owner/municipality, changed hashes, expired/rejected files and request scope cannot reuse", async () => {
  const source = row(received());
  const ref = reference(source);
  const args = (overrides = {}) => submission({ body: { request_type: "procedure", declarationAccepted: true, reusedDocuments: [ref] }, ...overrides });
  await assert.rejects(() => prepareRequestDocuments(clientFor([row(source.document, { tutor_id: "other" })]), args()), { status: 404 });
  await assert.rejects(() => prepareRequestDocuments(clientFor([row(source.document, { municipality_id: "other" })]), args()), { status: 404 });
  await assert.rejects(() => prepareRequestDocuments(clientFor([source]), args({ body: { request_type: "procedure", declarationAccepted: true,
    reusedDocuments: [{ ...ref, hash: "f".repeat(64) }] } })), { status: 400 });
  await assert.rejects(() => prepareRequestDocuments(clientFor([source]), args({ settings: settingsFor([definition({ reuseScope: "request" })]) })), { status: 400 });
  await assert.rejects(() => prepareRequestDocuments(clientFor([source]), args({ settings: settingsFor([definition({ reuseValidityDays: 1 })]), now: new Date("2026-11-15") })), { status: 400 });
  await assert.rejects(() => prepareRequestDocuments(clientFor([source]), args({ user: STAFF })), { status: 403 });
});

test("manual decisions bind actor, bytes and current criteria; body status alone cannot approve", async () => {
  const document = received();
  const previous = { ...row(document), documents: [document] };
  const unchanged = await applyDocumentReviews(null, { previous, patch: { documents: [{ ...document, status: "approved", review: { reviewedBy: "fake" } }] },
    user: STAFF, municipalityId: MUNICIPALITY, settings: settingsFor(), now: NOW });
  assert.equal(unchanged[0].status, "attached");
  const reviewed = await applyDocumentReviews(null, { previous, patch: { documentReviews: [{ attachmentId: document.attachmentId, decision: "approved" }] },
    user: STAFF, municipalityId: MUNICIPALITY, settings: settingsFor(), now: NOW });
  assert.equal(reviewed[0].review.reviewedBy, STAFF.id);
  assert.equal(reviewed[0].review.hash, document.hash);
  assert.equal(reviewed[0].review.criteriaFingerprint, documentCriteriaFingerprint(definition()));
  assert.equal(describeStoredDocument(row(reviewed[0]), definition()).status, "approved");
  assert.equal(describeStoredDocument(row(reviewed[0]), definition({ analysisRules: { requiredText: "new" } })).status, "attached");
  const replacement = await applyDocumentReviews(null, { previous: { ...previous, documents: reviewed },
    patch: { documents: [{ ...document, status: "approved", dataUrl: `data:application/pdf;base64,${Buffer.from("%PDF-1.4\nchanged").toString("base64")}` }] },
    user: STAFF, municipalityId: MUNICIPALITY, settings: settingsFor(), now: NOW });
  assert.notEqual(replacement[0].attachmentId, document.attachmentId);
  assert.equal(replacement[0].status, "attached");
  assert.equal(replacement[0].review, undefined);
  await assert.rejects(() => applyDocumentReviews(null, { previous, patch: { documentReviews: [] }, user: TUTOR, municipalityId: MUNICIPALITY }), { status: 403 });
});

test("legacy review uses decorated file identity without renewing receipt date", async () => {
  const document = { documentId: "identity", dataUrl: PDF, fileName: "old.pdf", status: "approved", receivedAt: "2099-01-01" };
  const previous = { ...row(document), documents: [document] };
  const id = decorateRequestDocuments(previous, settingsFor()).documents[0].attachmentId;
  const [reviewed] = await applyDocumentReviews(null, { previous, patch: { documentReviews: [{ attachmentId: id, decision: "approved" }] },
    user: STAFF, municipalityId: MUNICIPALITY, settings: settingsFor(), now: NOW });
  assert.equal(reviewed.status, "approved");
  assert.equal(reviewed.receivedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(hasValidDocumentReceipt(reviewed, row(reviewed)), true);
});

test("catalog is metadata only, source scoped, and shared multi-animal photos are ineligible", async () => {
  const good = row(received());
  const photo = { documentId: "animal_photo", dataUrl: `data:image/png;base64,${Buffer.from([137,80,78,71,13,10,26,10,0]).toString("base64")}`, fileName: "photo.png" };
  const ambiguous = row(photo, { id: "multi", animals: [{ id: ANIMAL }, { id: "animal-2" }] });
  const catalog = await catalogReusableDocuments(clientFor([good, ambiguous]), { userId: OWNER, municipalityId: MUNICIPALITY, animalId: ANIMAL,
    requestTypeId: "procedure", settings: settingsFor(), now: NOW });
  assert.equal(catalog.find((item) => item.documentId === "identity").eligible, true);
  assert.equal(catalog.find((item) => item.documentId === PHOTO_DEFINITION.id).eligible, false);
  assert.equal(JSON.stringify(catalog).includes("base64"), false);
  assert.equal(JSON.stringify(catalog).includes("reviewedBy"), false);
  const preview = await readReusableDocument(clientFor([good]), { userId: OWNER, municipalityId: MUNICIPALITY, animalId: ANIMAL,
    ...reference(good), settings: settingsFor() });
  assert.ok(Buffer.isBuffer(preview.bytes));
  await assert.rejects(() => readReusableDocument(clientFor([good]), { userId: "other", municipalityId: MUNICIPALITY, animalId: ANIMAL,
    ...reference(good), settings: settingsFor() }), { status: 404 });
});

test("animal-scoped preview resolves embedded source policy and cannot use another owned animal context", async () => {
  const policy = definition({ reuseScope: "animal" });
  const source = row(received(policy));
  const settings = { documentTypes: [], requestTypes: [{ id: "procedure", documents: [policy] }] };
  await assert.rejects(() => readReusableDocument(clientFor([source]), { userId: OWNER, municipalityId: MUNICIPALITY, animalId: "other-animal",
    ...reference(source), settings }), { status: 404 });
});

test("serialized UTF8 budget includes multibyte characters and server-expanded reused base64", async () => {
  assert.throws(() => assertMaterializedRequestSize({ note: "é".repeat(MAX_REQUEST_JSON_BYTES / 2) }), { status: 413 });
  const bytes = Buffer.alloc(6.5 * 1024 * 1024, 65); bytes.write("%PDF-");
  const dataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
  const first = definition({ maxSizeMb: 12 }), second = definition({ id: "residence", maxSizeMb: 12 });
  const sources = [row(received(first, { dataUrl })), row(received(second, { dataUrl }), { document_index: 1 })];
  await assert.rejects(() => prepareRequestDocuments(clientFor(sources), submission({ settings: settingsFor([first, second]),
    body: { request_type: "procedure", declarationAccepted: true, reusedDocuments: sources.map(reference) } })), { status: 413 });
});
