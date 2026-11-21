import test from "node:test";
import assert from "node:assert/strict";
import { requestsMenuAllowed, userHasConfigItem } from "../src/services/config-permission.js";
import { IntegrationConfigItem, CHANNEL_CONFIG_ITEMS } from "../../shared/config-permission-contract.js";
import { NotificationChannel } from "../../shared/notification-contract.js";
import { REQUESTS_MENU_ITEM } from "../../shared/staff-notifications-contract.js";
import { permissionConfigs, permissionGroup } from "./fixtures/permission-groups.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SMS = IntegrationConfigItem.SMS;

const manager = { id: "aaaaaaaa-0000-4000-8000-000000000001", role: "admin_municipal", municipalityId: A, email: "manager@example.test" };
const analyst = { id: "aaaaaaaa-0000-4000-8000-000000000002", role: "analista", municipalityId: A, email: "Analyst@Example.test" };

// A fake config table: rows are `<key>:<municipality>`; every read is recorded.
function database(rows = {}) {
  const store = new Map(Object.entries(rows)); const reads = [];
  return { reads, query: async (_sql, values) => { reads.push(values); const value = store.get(`${values[0]}:${values[1]}`); return { rows: value === undefined ? [] : [{ value }] }; } };
}
const allowed = (user, db, item = SMS) => userHasConfigItem(user, item, { database: db });
const withGroup = (municipalityId, items, member = analyst, extra = {}) => permissionConfigs(municipalityId, {
  users: [{ id: member.id, permissionGroupId: "g" }], groups: [permissionGroup("g", items, extra)],
});

test("each channel has the permission item of its tab", () => {
  assert.deepEqual(CHANNEL_CONFIG_ITEMS, { [NotificationChannel.WHATSAPP]: "whatsapp_settings", [NotificationChannel.SMS]: "sms_settings", [NotificationChannel.EMAIL]: "email_settings" });
});

test("the global administration passes with no database read, and anyone outside the staff or without a municipality never does", async () => {
  const db = database();
  for (const role of ["master", "suporte"]) assert.equal(await allowed({ id: "x", role }, db), true, role);
  for (const role of ["tutor", "ong", "protetor", "", undefined]) assert.equal(await allowed({ id: "x", role, municipalityId: A }, db), false, String(role));
  assert.equal(await allowed(null, db), false);
  assert.equal(await allowed({ id: "x", role: "analista" }, db), false, "no municipality");
  assert.deepEqual(db.reads, []);
});

test("a user with no group falls back to the role: only the manager of the municipality passes", async () => {
  const db = database();
  assert.equal(await allowed(manager, db), true);
  assert.equal(await allowed(analyst, db), false);
  assert.equal(await allowed({ ...analyst, role: "servidor_publico" }, db), false);
});

test("the group the municipality gave the user decides, for the analyst and for the manager alike", async () => {
  const db = database(withGroup(A, [SMS]));
  assert.equal(await allowed(analyst, db), true);
  assert.equal(await allowed(analyst, db, IntegrationConfigItem.EMAIL), false);
  assert.equal(await allowed(analyst, db, IntegrationConfigItem.WHATSAPP), false);
  const without = database(withGroup(A, [IntegrationConfigItem.EMAIL], manager));
  assert.equal(await allowed(manager, without), false, "a manager whose group lacks the item is refused");
  assert.equal(await allowed(manager, without, IntegrationConfigItem.EMAIL), true);
});

test("an inactive, missing or unlinked group counts as no group", async () => {
  assert.equal(await allowed(analyst, database(withGroup(A, [SMS], analyst, { active: false }))), false);
  assert.equal(await allowed(manager, database(withGroup(A, [], manager, { active: false }))), true);
  const missing = permissionConfigs(A, { users: [{ id: analyst.id, permissionGroupId: "gone" }], groups: [permissionGroup("g", [SMS])] });
  assert.equal(await allowed(analyst, database(missing)), false);
  const unlinked = permissionConfigs(A, { users: [{ id: analyst.id, permissionGroupId: "" }], groups: [permissionGroup("g", [SMS])] });
  assert.equal(await allowed(analyst, database(unlinked)), false);
  const stranger = permissionConfigs(A, { users: [{ id: "someone-else", permissionGroupId: "g" }], groups: [permissionGroup("g", [SMS])] });
  assert.equal(await allowed(analyst, database(stranger)), false);
});

test("the team user is found by id or by e-mail, ignoring case", async () => {
  const byEmail = permissionConfigs(A, { users: [{ id: "other-id", email: "analyst@example.TEST", permissionGroupId: "g" }], groups: [permissionGroup("g", [SMS])] });
  assert.equal(await allowed(analyst, database(byEmail)), true);
  const noEmail = permissionConfigs(A, { users: [{ id: "other-id", email: "", permissionGroupId: "g" }], groups: [permissionGroup("g", [SMS])] });
  assert.equal(await allowed({ ...analyst, email: "" }, database(noEmail)), false, "two empty e-mails are not a match");
  assert.equal(await allowed({ ...analyst, email: undefined }, database(noEmail)), false);
});

test("a municipality's groups never decide for the users of another one", async () => {
  const db = database({ ...withGroup(B, [SMS, IntegrationConfigItem.EMAIL, IntegrationConfigItem.WHATSAPP]) });
  assert.equal(await allowed(analyst, db), false);
  assert.equal(db.reads.every((values) => values[1] === A), true);
  const other = { ...analyst, municipalityId: B };
  assert.equal(await allowed(other, db), true);
  assert.equal(db.reads.slice(-2).every((values) => values[1] === B), true);
  assert.equal(await allowed({ ...analyst, municipalityId: undefined, municipality_id: B }, db), true, "the snake-case field of the session row counts too");
});

test("malformed configuration is read as no group", async () => {
  for (const rows of [{ [`castragestao:teams:${A}`]: "x", [`permission_groups:${A}`]: {} }, { [`castragestao:teams:${A}`]: { users: "x" }, [`permission_groups:${A}`]: [null, 5] },
    { [`castragestao:teams:${A}`]: { users: [null, 5, { id: analyst.id, permissionGroupId: "g" }] }, [`permission_groups:${A}`]: [null, { id: "g", allowedConfigItems: "sms_settings" }] }]) {
    assert.equal(await allowed(analyst, database(rows)), false);
    assert.equal(await allowed(manager, database(rows)), true, "the manager, not among the team users, keeps the role fallback");
  }
});

test("the Requests permission prefers the authenticated ID and accepts one unambiguous legacy team email", () => {
  const oldAccount = { id: manager.id, email: analyst.email, permissionGroupId: "allowed" };
  const canonical = { id: analyst.id, email: analyst.email, permissionGroupId: "denied" };
  const groups = [{ id: "allowed", allowedMenuItems: [REQUESTS_MENU_ITEM] }, { id: "denied", allowedMenuItems: ["dashboard"] }];
  const allows = (...users) => requestsMenuAllowed(analyst, { teams: { users }, groups });
  assert.equal(allows(oldAccount, canonical), false);
  assert.equal(allows(oldAccount), false);
  const legacy = { ...oldAccount, id: "legacy-analyst" };
  assert.equal(allows(legacy), true);
  assert.equal(allows(legacy, { ...legacy, id: "another-legacy-entry" }), false);
  assert.equal(allows(), true);
});
