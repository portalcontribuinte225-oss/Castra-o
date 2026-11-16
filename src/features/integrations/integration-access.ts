import { IntegrationConfigItem } from "../../../shared/config-permission-contract.js";
import type { AnyRecord } from "../../types";

// The permission item that opens each integration tab; the same item lets the user switch that channel's messages.
export const integrationTabItems: Record<string, string> = {
  whatsapp: IntegrationConfigItem.WHATSAPP,
  email: IntegrationConfigItem.EMAIL,
  sms: IntegrationConfigItem.SMS,
};

// Whether the user may work on an integration tab. When the municipality gave them a permission group, the group decides; with no group,
// only who manages the municipality (and the global administration) does, which `roleAllowed` tells.
export function canUseIntegration(canUsePermissions: boolean, group: AnyRecord | undefined, item: string, roleAllowed: boolean): boolean {
  return canUsePermissions ? Boolean(group?.allowedConfigItems?.includes(item)) : roleAllowed;
}
