import { pool } from "../db/index.js";
import { SMS_CONFIG_KEY } from "../../../shared/sms-contract.js";
import { MESSAGE_QUOTA_KEYS, isContractInForce } from "../../../shared/message-quota-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { IDENTIFICATION_TYPES_CONFIG_KEY, buildDefaultIdentificationTypes } from "../services/identification-type-defaults.js";
import { REQUEST_TYPES_CONFIG_KEY } from "../services/request-type-defaults.js";
import { NEIGHBORHOODS_CONFIG_KEY } from "../services/neighborhood-defaults.js";

// This adapter extends the existing pg/config storage: no Drizzle runtime exists in this application.
// All lookups are parameterized and scoped to an active municipality. The one platform value read here is the SMS account, which
// no municipality owns: whether SMS reaches the municipality depends on it and on the municipality's own SMS contract.
const SMS_QUOTA_KEY = MESSAGE_QUOTA_KEYS[NotificationChannel.SMS];
export async function loadRequestSettings(municipalityId, database = pool) {
  const keys = [REQUEST_TYPES_CONFIG_KEY, IDENTIFICATION_TYPES_CONFIG_KEY, "whatsapp", SMS_QUOTA_KEY, "castragestao:document-types", NEIGHBORHOODS_CONFIG_KEY];
  const { rows } = await database.query(
    `SELECT m.id AS municipality_id, c.key, c.value
     FROM municipalities m LEFT JOIN config c ON (c.municipality_id = m.id AND c.key = ANY($2::text[])) OR (c.municipality_id IS NULL AND c.key = $3)
     WHERE m.id = $1 AND m.active = TRUE`,
    [municipalityId, keys, SMS_CONFIG_KEY],
  );
  if (!rows.length) throw Object.assign(new Error("Município indisponível para esta operação."), { status: 400 });
  const values = Object.fromEntries(rows.filter((row) => row.key).map((row) => [row.key, row.value]));
  return {
    requestTypes: Array.isArray(values[REQUEST_TYPES_CONFIG_KEY]) ? values[REQUEST_TYPES_CONFIG_KEY] : [],
    identificationTypes: Array.isArray(values[IDENTIFICATION_TYPES_CONFIG_KEY])
      ? values[IDENTIFICATION_TYPES_CONFIG_KEY] : buildDefaultIdentificationTypes(),
    // The follow-up form asks for a phone as soon as the municipality can reach one, by WhatsApp or by SMS (the channel on and a contract in force).
    phoneEnabled: values.whatsapp?.active === true || (values[SMS_CONFIG_KEY]?.active === true && isContractInForce(values[SMS_QUOTA_KEY])),
    documentTypes: Array.isArray(values["castragestao:document-types"]) ? values["castragestao:document-types"] : [],
    neighborhoods: Array.isArray(values[NEIGHBORHOODS_CONFIG_KEY]) ? values[NEIGHBORHOODS_CONFIG_KEY] : [],
  };
}

// Batch the review catalog for private historical lists, including inactive municipalities.
export async function loadDocumentReviewSettings(municipalityIds, database = pool) {
  const ids = [...new Set(municipalityIds.filter(Boolean))];
  const result = new Map(ids.map((id) => [id, { requestTypes: [], documentTypes: [] }]));
  if (!ids.length) return result;
  const { rows } = await database.query(
    "SELECT municipality_id, key, value FROM config WHERE municipality_id = ANY($1::uuid[]) AND key = ANY($2::text[])",
    [ids, [REQUEST_TYPES_CONFIG_KEY, "castragestao:document-types"]],
  );
  for (const row of rows) {
    const settings = result.get(row.municipality_id);
    if (settings) settings[row.key === REQUEST_TYPES_CONFIG_KEY ? "requestTypes" : "documentTypes"] = Array.isArray(row.value) ? row.value : [];
  }
  return result;
}
