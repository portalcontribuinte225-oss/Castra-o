import test from "node:test";
import assert from "node:assert/strict";
import { brasaoStatus, brasaoUrl, loadEmailIdentityParams, loadEmailIdentitySummary } from "../src/services/email-identity.js";
import { EMAIL_ACCOUNT_CONFIG_KEY, EmailBrasaoStatus } from "../../shared/email-contract.js";
import { EMAIL_IDENTITY_VARIABLES } from "../../shared/email-uses-contract.js";
import { fakeEmailDatabase } from "./fixtures/email-config-db.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const UPDATED = new Date("2026-11-15T10:00:00.000Z");
const PUBLIC_URL = "https://system.example.test";
const town = { name: "  Test Town  ", department_name: "Animal Department", contact: "(48) 3000-0000", email: "town@example.test", address: "Main Street, 1", brasao: "data:image/png;base64,AAAA", updated_at: UPDATED };
const empty = Object.fromEntries(EMAIL_IDENTITY_VARIABLES.map((name) => [name, ""]));

function fixture(account = { serviceId: "service_test", publicKey: "public-key-test", publicUrl: PUBLIC_URL }, municipality = town) {
  return fakeEmailDatabase({ configs: { [`${EMAIL_ACCOUNT_CONFIG_KEY}:null`]: account }, municipalities: { [MUNICIPALITY]: municipality } });
}

test("the municipality identity becomes trimmed template variables with a versioned public brasão link", async () => {
  assert.deepEqual(await loadEmailIdentityParams(MUNICIPALITY, { database: fixture() }), {
    municipality_name: "Test Town",
    municipality_brasao_url: `${PUBLIC_URL}/api/public/municipalities/${MUNICIPALITY}/brasao?v=${UPDATED.getTime()}`,
    department_name: "Animal Department",
    municipality_contact: "(48) 3000-0000",
    municipality_email: "town@example.test",
    municipality_address: "Main Street, 1",
  });
});

test("without a brasão or without the public address the link is empty and the rest still goes", async () => {
  const noBrasao = await loadEmailIdentityParams(MUNICIPALITY, { database: fixture(undefined, { ...town, brasao: "" }) });
  assert.equal(noBrasao.municipality_brasao_url, "");
  assert.equal(noBrasao.municipality_name, "Test Town");
  const noAddress = await loadEmailIdentityParams(MUNICIPALITY, { database: fixture({ serviceId: "service_test", publicKey: "public-key-test" }) });
  assert.equal(noAddress.municipality_brasao_url, "");
  assert.equal(noAddress.department_name, "Animal Department");
});

test("no municipality, an unknown one or an unreadable database yield empty identity, never an error or another municipality", async () => {
  assert.deepEqual(await loadEmailIdentityParams(null, { database: fixture() }), empty);
  assert.deepEqual(await loadEmailIdentityParams(OTHER, { database: fixture() }), empty);
  const broken = { query: async () => { throw new Error("database secret detail"); } };
  assert.deepEqual(await loadEmailIdentityParams(MUNICIPALITY, { database: broken }), empty);
});

test("values are bounded so a long registration cannot flood a template", async () => {
  const long = fixture(undefined, { ...town, name: "N".repeat(500), address: "A".repeat(900), contact: "C".repeat(500) });
  const params = await loadEmailIdentityParams(MUNICIPALITY, { database: long });
  assert.equal(params.municipality_name.length, 200);
  assert.equal(params.municipality_contact.length, 200);
  assert.equal(params.municipality_address.length, 300);
});

test("the municipal screen learns whether the brasão will reach the e-mail", async () => {
  assert.deepEqual(await loadEmailIdentitySummary(MUNICIPALITY, PUBLIC_URL, { database: fixture() }), { name: "Test Town", departmentName: "Animal Department", brasao: EmailBrasaoStatus.READY });
  assert.equal((await loadEmailIdentitySummary(MUNICIPALITY, "", { database: fixture() })).brasao, EmailBrasaoStatus.NO_PUBLIC_URL);
  assert.equal((await loadEmailIdentitySummary(MUNICIPALITY, PUBLIC_URL, { database: fixture(undefined, { ...town, brasao: "" }) })).brasao, EmailBrasaoStatus.MISSING);
  assert.equal(await loadEmailIdentitySummary(OTHER, PUBLIC_URL, { database: fixture() }), null);
  assert.equal(brasaoStatus(null, PUBLIC_URL), EmailBrasaoStatus.MISSING);
  assert.equal(brasaoUrl({ has_brasao: true, id: MUNICIPALITY, updated_at: "not a date" }, PUBLIC_URL), `${PUBLIC_URL}/api/public/municipalities/${MUNICIPALITY}/brasao`);
  assert.equal(brasaoUrl({ has_brasao: false, id: MUNICIPALITY, updated_at: UPDATED }, PUBLIC_URL), "");
});
