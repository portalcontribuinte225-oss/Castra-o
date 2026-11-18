import test from "node:test";
import assert from "node:assert/strict";
import { loadEmailIdentityParams, loadEmailIdentitySummary } from "../src/services/email-identity.js";
import { EMAIL_ACCOUNT_CONFIG_KEY, EmailImageStatus } from "../../shared/email-contract.js";
import { EMAIL_IDENTITY_VARIABLES } from "../../shared/email-uses-contract.js";
import { fakeEmailDatabase } from "./fixtures/email-config-db.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const UPDATED = new Date("2026-11-15T10:00:00.000Z");
const PUBLIC_URL = "https://system.example.test";
const town = {
  name: "  Test Town  ", department_name: "Animal Department", contact: "(48) 3000-0000", email: "town@example.test", address: "Main Street, 1",
  brasao: "data:image/png;base64,AAAA", department_logo: "data:image/png;base64,BBBB", updated_at: UPDATED,
};
const empty = Object.fromEntries(EMAIL_IDENTITY_VARIABLES.map((name) => [name, ""]));
const link = (path) => `${PUBLIC_URL}/api/public/municipalities/${MUNICIPALITY}/${path}?v=${UPDATED.getTime()}`;

function fixture(account = { serviceId: "service_test", publicKey: "public-key-test", publicUrl: PUBLIC_URL }, municipality = town) {
  return fakeEmailDatabase({ configs: { [`${EMAIL_ACCOUNT_CONFIG_KEY}:null`]: account }, municipalities: { [MUNICIPALITY]: municipality } });
}

test("the municipality identity becomes trimmed template variables with versioned public links to the brasão and the department logo", async () => {
  assert.deepEqual(await loadEmailIdentityParams(MUNICIPALITY, { database: fixture() }), {
    municipality_name: "Test Town",
    municipality_brasao_url: link("brasao"),
    department_name: "Animal Department",
    department_logo_url: link("department-logo"),
    municipality_contact: "(48) 3000-0000",
    municipality_email: "town@example.test",
    municipality_address: "Main Street, 1",
  });
});

test("an image the municipality does not keep has an empty link, without the public address both are empty, and the rest still goes", async () => {
  const noBrasao = await loadEmailIdentityParams(MUNICIPALITY, { database: fixture(undefined, { ...town, brasao: "" }) });
  assert.equal(noBrasao.municipality_brasao_url, "");
  assert.equal(noBrasao.department_logo_url, link("department-logo"));
  assert.equal(noBrasao.municipality_name, "Test Town");
  const noLogo = await loadEmailIdentityParams(MUNICIPALITY, { database: fixture(undefined, { ...town, department_logo: null }) });
  assert.equal(noLogo.department_logo_url, "");
  assert.equal(noLogo.municipality_brasao_url, link("brasao"));
  const noAddress = await loadEmailIdentityParams(MUNICIPALITY, { database: fixture({ serviceId: "service_test", publicKey: "public-key-test" }) });
  assert.equal(noAddress.municipality_brasao_url, "");
  assert.equal(noAddress.department_logo_url, "");
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

test("the municipal screen learns whether the brasão and the department logo will reach the e-mail", async () => {
  const { READY, MISSING, NO_PUBLIC_URL } = EmailImageStatus;
  const summary = (municipality, publicUrl = PUBLIC_URL) => loadEmailIdentitySummary(MUNICIPALITY, publicUrl, { database: fixture(undefined, municipality) });
  assert.deepEqual(await summary(town), { name: "Test Town", departmentName: "Animal Department", brasao: READY, departmentLogo: READY });
  assert.deepEqual(await summary(town, ""), { name: "Test Town", departmentName: "Animal Department", brasao: NO_PUBLIC_URL, departmentLogo: NO_PUBLIC_URL });
  const onlyBrasao = await summary({ ...town, department_logo: "" });
  assert.deepEqual([onlyBrasao.brasao, onlyBrasao.departmentLogo], [READY, MISSING]);
  const onlyLogo = await summary({ ...town, brasao: "" }, "");
  assert.deepEqual([onlyLogo.brasao, onlyLogo.departmentLogo], [MISSING, NO_PUBLIC_URL]);
  assert.equal(await loadEmailIdentitySummary(OTHER, PUBLIC_URL, { database: fixture() }), null);
});
