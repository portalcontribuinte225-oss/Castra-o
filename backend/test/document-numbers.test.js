import test from "node:test";
import assert from "node:assert/strict";
import { nextDocumentNumber } from "../src/repositories/document-numbers.js";
import { DocumentSequence, documentNumberYear, formatDocumentNumber } from "../../shared/document-number-contract.js";

const CITY_A = "11111111-1111-4111-8111-111111111111";
const CITY_B = "22222222-2222-4222-8222-222222222222";

// A client that keeps the counters the way the upsert does: the first number of a key is 1, each call after it adds one.
function counterClient() {
  const counters = new Map();
  return {
    async query(sql, values) {
      assert.match(sql, /INSERT INTO document_counters/);
      assert.match(sql, /ON CONFLICT \(municipality_id, sequence, year\)/);
      const key = values.slice(0, 3).join("|");
      const next = (counters.get(key) || 1) + 1;
      counters.set(key, next);
      return { rows: [{ seq: next - 1 }] };
    },
  };
}

test("each municipality counts each document on its own, starting again every year", async () => {
  const client = counterClient();
  const now = new Date("2026-06-15T12:00:00Z");
  const next = (municipalityId, sequence, at = now) => nextDocumentNumber(client, { municipalityId, sequence, now: at });
  assert.equal(await next(CITY_A, DocumentSequence.PROTOCOL), "000001/2026");
  assert.equal(await next(CITY_A, DocumentSequence.PROTOCOL), "000002/2026");
  assert.equal(await next(CITY_B, DocumentSequence.PROTOCOL), "000001/2026", "another municipality starts its own count");
  assert.equal(await next(CITY_A, DocumentSequence.PRESCRIPTION), "000001/2026", "prescriptions are counted apart from protocols");
  assert.equal(await next(CITY_A, DocumentSequence.PROTOCOL, new Date("2027-02-01T12:00:00Z")), "000001/2027");
});

test("a document is not numbered without the municipality that issues it", async () => {
  await assert.rejects(nextDocumentNumber(counterClient(), { municipalityId: "", sequence: DocumentSequence.PROTOCOL }), (error) => error.status === 409);
});

test("the year follows the calendar of Brasília and the number has six digits", () => {
  assert.equal(documentNumberYear(new Date("2027-01-01T02:59:00Z")), 2026);
  assert.equal(documentNumberYear(new Date("2027-01-01T03:00:00Z")), 2027);
  assert.equal(formatDocumentNumber(7, 2026), "000007/2026");
  assert.deepEqual(Object.values(DocumentSequence), ["protocol", "prescription"]);
  assert.equal(Object.isFrozen(DocumentSequence), true);
});
