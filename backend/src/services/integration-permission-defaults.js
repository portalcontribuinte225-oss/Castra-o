import { IntegrationConfigItem } from "../../../shared/config-permission-contract.js";
import { DEFAULT_PERMISSION_GROUP_ID } from "../municipalityDefaults.js";

// What the default group ("Acesso total") gained when the SMS and e-mail tabs started to follow the permission groups.
export const DEFAULT_GROUP_NEW_ITEMS = Object.freeze([IntegrationConfigItem.SMS, IntegrationConfigItem.EMAIL]);

// The permission groups of a municipality with the new items added to the default group; the other groups are left as they are.
// Answers { groups, added } when there is something to write, or { skip } with the reason when there is not.
export function planIntegrationPermissions(groups) {
  if (!Array.isArray(groups)) return { skip: "sem grupos de permissão" };
  const index = groups.findIndex((group) => group?.id === DEFAULT_PERMISSION_GROUP_ID);
  if (index < 0) return { skip: "sem o grupo Acesso total" };
  const current = Array.isArray(groups[index].allowedConfigItems) ? groups[index].allowedConfigItems : [];
  const added = DEFAULT_GROUP_NEW_ITEMS.filter((item) => !current.includes(item));
  if (!added.length) return { skip: "o grupo Acesso total já tem os itens" };
  return { groups: groups.map((group, position) => (position === index ? { ...group, allowedConfigItems: [...current, ...added] } : group)), added };
}
