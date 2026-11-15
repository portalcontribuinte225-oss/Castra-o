import { AUTH_DELIVERY_CONFIG_KEY, mergeAuthDeliveryConfig } from "../../../shared/auth-contract.js";
import { NOTIFICATIONS_CONFIG_KEY, mergeNotificationConfig } from "../../../shared/notification-contract.js";

export const isChannelConfigKey = (key) => key === AUTH_DELIVERY_CONFIG_KEY || key === NOTIFICATIONS_CONFIG_KEY;

// Serialize creation as well as updates so editing one channel preserves the others.
export async function lockChannelConfig(database, key, municipalityId) {
  await database.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`channel-config:${key}:${municipalityId}`]);
}

export async function mergeChannelConfig(database, key, municipalityId, patch) {
  const { rows } = await database.query("SELECT value FROM config WHERE key=$1 AND municipality_id=$2 FOR UPDATE", [key, municipalityId]);
  return key === AUTH_DELIVERY_CONFIG_KEY ? mergeAuthDeliveryConfig(rows[0]?.value, patch)
    : mergeNotificationConfig(rows[0]?.value, patch);
}
