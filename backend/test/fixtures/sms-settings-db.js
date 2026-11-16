import { SMS_CONFIG_KEY } from "../../../shared/sms-contract.js";
import { MESSAGE_QUOTA_KEYS } from "../../../shared/message-quota-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";

export const SMS_TEST_MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
export const SMS_TEST_OTHER = "22222222-2222-4222-8222-222222222222";
export const SMS_TEST_NAMES = { [SMS_TEST_MUNICIPALITY]: "Test Town", [SMS_TEST_OTHER]: "Other Town" };
export const SMS_QUOTA_KEY = MESSAGE_QUOTA_KEYS[NotificationChannel.SMS];

// Fake pg access for the SMS configuration. `state.account` holds the platform's SMS account (one row, with no municipality); every
// other config row (the switches of the messages and the contracts, for instance) sits in `configs` as `<key>:<municipality>`.
export function smsSettingsDatabase() {
  const configs = new Map(); const calls = []; const audits = []; const state = { borrowed: 0, failAudit: false, account: undefined };
  // The contract of a municipality for the SMS channel, as the municipal rows keep it.
  const setContract = (municipalityId, quota = { plan: 100 }) => configs.set(`${SMS_QUOTA_KEY}:${municipalityId}`, structuredClone(quota));
  const contractOf = (municipalityId) => configs.get(`${SMS_QUOTA_KEY}:${municipalityId}`);
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM municipalities WHERE id=$1")) return { rows: SMS_TEST_NAMES[values[0]] ? [{ id: values[0], name: SMS_TEST_NAMES[values[0]] }] : [] };
    if (sql.includes("SELECT value FROM config")) {
      const [key, municipalityId] = values;
      const stored = key === SMS_CONFIG_KEY ? state.account : configs.get(`${key}:${municipalityId}`);
      return { rows: stored === undefined ? [] : [{ value: structuredClone(stored) }] };
    }
    if (sql.includes("INSERT INTO config")) {
      // The account is saved as (key, value); every other row as (key, municipality, value).
      if (values[0] === SMS_CONFIG_KEY) state.account = JSON.parse(values.at(-1)); else configs.set(`${values[0]}:${values[1]}`, JSON.parse(values[2]));
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
  return { configs, calls, audits, state, query, setContract, contractOf, async connect() {
    state.borrowed += 1; let snapshot;
    return { async query(sql, values) {
      if (sql === "BEGIN") snapshot = { account: structuredClone(state.account), configs: structuredClone(configs) };
      if (sql === "ROLLBACK") {
        state.account = snapshot.account;
        configs.clear(); for (const [key, value] of snapshot.configs) configs.set(key, value);
      }
      return query(sql, values);
    }, release() { state.borrowed -= 1; } };
  } };
}
