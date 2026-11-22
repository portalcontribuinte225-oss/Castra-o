import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultPermissionGroup, buildOperationalPermissionGroup } from "../src/municipalityDefaults.js";
import { IntegrationConfigItem } from "../../shared/config-permission-contract.js";

test("the default group of a new municipality opens the three integration tabs", () => {
  const items = buildDefaultPermissionGroup().allowedConfigItems;
  for (const item of Object.values(IntegrationConfigItem)) assert.ok(items.includes(item), item);
  assert.equal(new Set(items).size, items.length);
  assert.deepEqual(buildOperationalPermissionGroup().allowedConfigItems, []);
});
