import { pool } from "../db/index.js";
import { NOTIFICATIONS_CONFIG_KEY, normalizeNotificationConfig } from "../../../shared/notification-contract.js";
import { IDENTIFICATION_TYPES_CONFIG_KEY, buildDefaultIdentificationTypes } from "../services/identification-type-defaults.js";

const REQUEST_TYPES_CONFIG_KEY = "castragestao:request-types";

// This adapter extends the existing pg/config storage: no Drizzle runtime exists in this application.
// All lookups are parameterized and scoped to an active municipality, never a platform fallback.
export async function loadRequestSettings(municipalityId, database = pool) {
  const keys = [REQUEST_TYPES_CONFIG_KEY, IDENTIFICATION_TYPES_CONFIG_KEY, NOTIFICATIONS_CONFIG_KEY, "whatsapp"];
  const { rows } = await database.query(
    `SELECT m.id AS municipality_id, c.key, c.value
     FROM municipalities m LEFT JOIN config c ON c.municipality_id = m.id AND c.key = ANY($2::text[])
     WHERE m.id = $1 AND m.active = TRUE`,
    [municipalityId, keys],
  );
  if (!rows.length) throw Object.assign(new Error("Município indisponível para esta operação."), { status: 400 });
  const values = Object.fromEntries(rows.filter((row) => row.key).map((row) => [row.key, row.value]));
  return {
    requestTypes: Array.isArray(values[REQUEST_TYPES_CONFIG_KEY]) ? values[REQUEST_TYPES_CONFIG_KEY] : [],
    identificationTypes: Array.isArray(values[IDENTIFICATION_TYPES_CONFIG_KEY])
      ? values[IDENTIFICATION_TYPES_CONFIG_KEY] : buildDefaultIdentificationTypes(),
    notifications: normalizeNotificationConfig(values[NOTIFICATIONS_CONFIG_KEY]),
    whatsappEnabled: values.whatsapp?.active === true,
  };
}
