import { describe, expect, it } from "vitest";
import { IntegrationConfigItem } from "../../../shared/config-permission-contract.js";
import { canUseIntegration, integrationTabItems } from "./integration-access";

const group = (...items: string[]) => ({ id: "g", active: true, allowedConfigItems: items });

describe("integration access", () => {
  it("opens each integration tab with its own permission item", () => {
    expect(integrationTabItems).toEqual({ whatsapp: "whatsapp_settings", email: "email_settings", sms: "sms_settings" });
    expect(Object.values(integrationTabItems).sort()).toEqual(Object.values(IntegrationConfigItem).sort());
  });

  it("follows the permission group when there is one, whatever the role", () => {
    expect(canUseIntegration(true, group(IntegrationConfigItem.SMS), IntegrationConfigItem.SMS, false)).toBe(true);
    expect(canUseIntegration(true, group(IntegrationConfigItem.SMS), IntegrationConfigItem.EMAIL, true)).toBe(false);
    expect(canUseIntegration(true, group(), IntegrationConfigItem.WHATSAPP, true)).toBe(false);
    expect(canUseIntegration(true, undefined, IntegrationConfigItem.SMS, true)).toBe(false);
    expect(canUseIntegration(true, { id: "g" }, IntegrationConfigItem.SMS, true)).toBe(false);
  });

  it("falls back to the role when there is no group", () => {
    expect(canUseIntegration(false, undefined, IntegrationConfigItem.SMS, true)).toBe(true);
    expect(canUseIntegration(false, undefined, IntegrationConfigItem.SMS, false)).toBe(false);
    expect(canUseIntegration(false, group(IntegrationConfigItem.SMS), IntegrationConfigItem.EMAIL, false)).toBe(false);
  });
});
