import { SMS_CONFIG_KEY } from "../../../shared/sms-contract.js";

export const SMS_TEST_MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
export const SMS_TEST_OTHER = "22222222-2222-4222-8222-222222222222";
export const SMS_TEST_NAMES = { [SMS_TEST_MUNICIPALITY]: "Test Town", [SMS_TEST_OTHER]: "Other Town" };

// Fake pg access for the SMS configuration. `records` holds the SMS record of each municipality (the account, by municipality);
// every other config row (the switches of the messages, for instance) sits in `configs` as `<key>:<municipality>`.
export function smsSettingsDatabase() {
  const records = new Map(); const configs = new Map(); const calls = []; const audits = []; const state = { borrowed: 0, failAudit: false };
  const isRecord = (key) => key === SMS_CONFIG_KEY;
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM municipalities WHERE id=$1")) return { rows: SMS_TEST_NAMES[values[0]] ? [{ id: values[0], name: SMS_TEST_NAMES[values[0]] }] : [] };
    if (sql.includes("SELECT value FROM config")) {
      const [key, municipalityId] = values;
      const stored = isRecord(key) ? records.get(municipalityId) : configs.get(`${key}:${municipalityId}`);
      return { rows: stored === undefined ? [] : [{ value: structuredClone(stored) }] };
    }
    if (sql.includes("INSERT INTO config")) {
      const [key, municipalityId, value] = values;
      if (isRecord(key)) records.set(municipalityId, JSON.parse(value)); else configs.set(`${key}:${municipalityId}`, JSON.parse(value));
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO auth_rate_limits")) return { rows: [{ attempts: 1 }] };
    if (sql.includes("DELETE FROM auth_rate_limits")) return { rows: [] };
    if (sql.includes("INSERT INTO audit_logs")) {
      if (state.failAudit) throw new Error("private database failure");
      // The shared writer sends the entry as eight values (user, e-mail, municipality, action, entity type, entity id, changes, ip).
      if (values.length === 8) audits.push({ userId: values[0], municipalityId: values[2], action: values[3], entityId: values[5], changes: values[6] ? JSON.parse(values[6]) : null });
      return { rows: [] };
    }
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    throw new Error(`Unexpected SMS test query: ${sql}`);
  };
  return { records, configs, calls, audits, state, query, async connect() {
    state.borrowed += 1; let snapshot;
    return { async query(sql, values) {
      if (sql === "BEGIN") snapshot = { records: structuredClone(records), configs: structuredClone(configs) };
      if (sql === "ROLLBACK") {
        records.clear(); for (const [key, value] of snapshot.records) records.set(key, value);
        configs.clear(); for (const [key, value] of snapshot.configs) configs.set(key, value);
      }
      return query(sql, values);
    }, release() { state.borrowed -= 1; } };
  } };
}
