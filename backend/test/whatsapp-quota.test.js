import test from "node:test";
import assert from "node:assert/strict";
import { checkAndConsumeQuota, evaluateWhatsappQuota } from "../src/services/whatsappQuota.js";

const date = new Date("2026-11-13T12:00:00Z");

test("quota validates contract, limit and period using the Brazilian calendar", () => {
  assert.equal(evaluateWhatsappQuota(null, date).allowed, false);
  assert.equal(evaluateWhatsappQuota({ plan: 1, contractStart: "2026-11-14" }, date).allowed, false);
  assert.equal(evaluateWhatsappQuota({ plan: 1, contractEnd: "2026-11-12" }, date).allowed, false);
  assert.equal(evaluateWhatsappQuota({ plan: 1, currentPeriodStart: "2026-11", currentPeriodUsed: 1 }, date).allowed, false);
  const reset = evaluateWhatsappQuota({ plan: 1, currentPeriodStart: "2026-10", currentPeriodUsed: 1 }, date);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 0);
  assert.equal(reset.next.currentPeriodUsed, 1);
  const lateEvening = evaluateWhatsappQuota({ plan: 1, contractEnd: "2026-11-12" }, new Date("2026-11-13T01:00:00Z"));
  assert.equal(lateEvening.allowed, true);
});

test("concurrent consumption serializes existing rows and cannot exceed the last slot", async () => {
  let stored = { plan: 1, currentPeriodStart: "2026-11", currentPeriodUsed: 0 };
  let lastLock = Promise.resolve();
  let releases = 0;
  const db = { connect: async () => {
    let unlock;
    return {
      query: async (sql, params) => {
        if (sql.includes("SELECT value")) {
          assert.ok(sql.endsWith("FOR UPDATE"));
          assert.deepEqual(params, ["whatsapp_quota", "municipality-a"]);
          const previousLock = lastLock;
          lastLock = new Promise((resolve) => { unlock = resolve; });
          await previousLock;
          return { rows: [{ value: structuredClone(stored) }] };
        }
        if (sql.includes("INSERT INTO config")) stored = JSON.parse(params[2]);
        if (sql === "COMMIT" || sql === "ROLLBACK") unlock?.();
        return { rows: [] };
      },
      release: () => { releases += 1; },
    };
  } };
  const results = await Promise.all([
    checkAndConsumeQuota("municipality-a", { db, now: date }),
    checkAndConsumeQuota("municipality-a", { db, now: date }),
  ]);
  assert.equal(results.filter(({ allowed }) => allowed).length, 1);
  assert.equal(stored.currentPeriodUsed, 1);
  assert.equal(releases, 2);
  assert.equal(results.some((result) => Object.hasOwn(result, "next")), false);
});

test("quota errors rollback and release the borrowed connection", async () => {
  const statements = [];
  const db = { connect: async () => ({ query: async (sql) => {
    statements.push(sql);
    if (sql.includes("SELECT value")) throw new Error("database unavailable");
    return { rows: [] };
  }, release: () => statements.push("release") }) };
  await assert.rejects(checkAndConsumeQuota("municipality-a", { db, now: date }));
  assert.deepEqual(statements.slice(-2), ["ROLLBACK", "release"]);
});
