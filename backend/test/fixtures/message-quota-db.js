export const QUOTA_TEST_MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
export const QUOTA_TEST_OTHER = "22222222-2222-4222-8222-222222222222";

// Fake pg access for the message contracts: config rows by `<key>:<municipality>`, the active municipalities and the audit log. Each
// connection that takes the transaction lock makes the next one wait for its commit, as the advisory lock does.
export function quotaDatabase({ configs = {}, municipalities = [QUOTA_TEST_MUNICIPALITY, QUOTA_TEST_OTHER] } = {}) {
  const store = new Map(Object.entries(configs)); const calls = []; const audits = []; const state = { releases: 0, failRead: false, failWrite: false };
  let lastLock = Promise.resolve();
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("FROM municipalities WHERE id=$1")) return { rows: municipalities.includes(values[0]) ? [{ id: values[0], name: "Test Town" }] : [] };
    if (sql.includes("SELECT value FROM config")) {
      if (state.failRead) throw new Error("database unavailable");
      const value = store.get(`${values[0]}:${values[1]}`);
      return { rows: value === undefined ? [] : [{ value: structuredClone(value) }] };
    }
    if (sql.includes("INSERT INTO config")) {
      if (state.failWrite) throw new Error("private database failure");
      store.set(`${values[0]}:${values[1]}`, JSON.parse(values[2]));
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO audit_logs")) {
      audits.push({ userId: values[0], municipalityId: values[2], action: values[3], entityId: values[5], changes: values[6] ? JSON.parse(values[6]) : null });
      return { rows: [] };
    }
    throw new Error(`Unexpected quota test query: ${sql}`);
  };
  return { store, calls, audits, state, query, async connect() {
    let unlock;
    return { async query(sql, values) {
      if (sql.includes("pg_advisory_xact_lock")) { const previous = lastLock; lastLock = new Promise((resolve) => { unlock = resolve; }); await previous; }
      try { return await query(sql, values); } finally { if (sql === "COMMIT" || sql === "ROLLBACK") unlock?.(); }
    }, release() { state.releases += 1; } };
  } };
}
