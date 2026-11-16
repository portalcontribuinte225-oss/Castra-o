import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GROUP_NEW_ITEMS, planIntegrationPermissions } from "../src/services/integration-permission-defaults.js";
import { DEFAULT_PERMISSION_GROUP_ID, buildDefaultPermissionGroup, buildOperationalPermissionGroup } from "../src/municipalityDefaults.js";
import { IntegrationConfigItem } from "../../shared/config-permission-contract.js";

const legacyDefault = () => ({ ...buildDefaultPermissionGroup(), allowedConfigItems: ["environment", "users", "sectors", "permissions", "whatsapp_settings"] });

test("the default group of a new municipality opens the three integration tabs", () => {
  const items = buildDefaultPermissionGroup().allowedConfigItems;
  for (const item of Object.values(IntegrationConfigItem)) assert.ok(items.includes(item), item);
  assert.equal(new Set(items).size, items.length);
  assert.deepEqual(buildOperationalPermissionGroup().allowedConfigItems, []);
});

test("the plan adds the SMS and e-mail items to the default group only, keeping everything else", () => {
  const operational = buildOperationalPermissionGroup();
  const plan = planIntegrationPermissions([operational, legacyDefault()]);
  assert.deepEqual(plan.added, [...DEFAULT_GROUP_NEW_ITEMS]);
  assert.deepEqual(plan.groups[1].allowedConfigItems, ["environment", "users", "sectors", "permissions", "whatsapp_settings", "sms_settings", "email_settings"]);
  assert.deepEqual(plan.groups[0], operational);
  assert.equal(plan.groups[1].id, DEFAULT_PERMISSION_GROUP_ID);
  assert.equal(plan.groups[1].name, legacyDefault().name);
});

test("the plan adds only what is missing, and says why there is nothing to write", () => {
  const partial = { ...legacyDefault(), allowedConfigItems: ["environment", "sms_settings"] };
  assert.deepEqual(planIntegrationPermissions([partial]).added, ["email_settings"]);
  assert.deepEqual(planIntegrationPermissions([partial]).groups[0].allowedConfigItems, ["environment", "sms_settings", "email_settings"]);
  assert.match(planIntegrationPermissions([buildDefaultPermissionGroup()]).skip, /já tem/);
  assert.match(planIntegrationPermissions([buildOperationalPermissionGroup()]).skip, /sem o grupo Acesso total/);
  for (const groups of [undefined, null, {}, "x"]) assert.match(planIntegrationPermissions(groups).skip, /sem grupos/);
  assert.match(planIntegrationPermissions([]).skip, /sem o grupo Acesso total/);
});

test("the plan survives a default group with no item list, does not touch its input and is idempotent", () => {
  const broken = { ...legacyDefault(), allowedConfigItems: undefined };
  assert.deepEqual(planIntegrationPermissions([broken]).groups[0].allowedConfigItems, ["sms_settings", "email_settings"]);
  const original = [legacyDefault()]; const snapshot = structuredClone(original);
  const first = planIntegrationPermissions(original);
  assert.deepEqual(original, snapshot);
  assert.ok(planIntegrationPermissions(first.groups).skip);
});
