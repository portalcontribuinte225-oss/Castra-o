export const SMS_TEST_MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
export const SMS_TEST_OTHER = "22222222-2222-4222-8222-222222222222";
export function smsSettingsDatabase() {
  const records = new Map(); const calls = []; const state = { borrowed: 0, failAudit: false };
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM municipalities WHERE id=$1")) return { rows: [SMS_TEST_MUNICIPALITY, SMS_TEST_OTHER].includes(values[0]) ? [{ id: values[0] }] : [] };
    if (sql.includes("SELECT value FROM config")) return { rows: records.has(values[1]) ? [{ value: structuredClone(records.get(values[1])) }] : [] };
    if (sql.includes("INSERT INTO config")) { records.set(values[1], JSON.parse(values[2])); return { rows: [] }; }
    if (sql.includes("INSERT INTO auth_rate_limits")) return { rows: [{ attempts: 1 }] };
    if (sql.includes("DELETE FROM auth_rate_limits")) return { rows: [] };
    if (sql.includes("INSERT INTO audit_logs")) { if (state.failAudit) throw new Error("private database failure"); return { rows: [] }; }
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    throw new Error(`Unexpected SMS test query: ${sql}`);
  };
  return { records, calls, state, query, async connect() {
    state.borrowed += 1; let snapshot;
    return { async query(sql, values) {
      if (sql === "BEGIN") snapshot = structuredClone(records);
      if (sql === "ROLLBACK") { records.clear(); for (const [key, value] of snapshot) records.set(key, value); }
      return query(sql, values);
    }, release() { state.borrowed -= 1; } };
  } };
}
