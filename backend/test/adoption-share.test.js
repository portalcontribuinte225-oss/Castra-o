import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createAdoptionShareRouter } from "../src/routes/adoption-share.js";
import { pool } from "../src/db/index.js";
import { adoptionSharePath, readAdoptionShareId } from "../../shared/adoption-contract.js";

const ID = "33333333-3333-4333-8333-333333333333";
const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const clientFetch = globalThis.fetch;
const PHOTO = Buffer.from("fake raster photo bytes");
const SECOND = Buffer.from("second fake photo");
const dataUrl = (type, bytes = PHOTO) => `data:image/${type};base64,${bytes.toString("base64")}`;
const INDEX_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="Sistema para gestao de castracao."
    />
    <title>CastraGestao Animal</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

function animal(fields = {}) {
  return {
    id: ID, animal_name: "Luna", species: "Canino", sex: "Fêmea", age: "2 anos", description: "Brincalhona e dócil.", health: ["Vacinada"],
    photo_url: "", photos: [dataUrl("jpeg")], main_photo_index: 0, status: "disponivel", municipality_id: MUNICIPALITY,
    adopted_at: null, created_at: "2026-11-01T10:00:00.000Z", municipalityActive: true,
    interests: [{ name: "PRIVATE_PERSON", phone: "PRIVATE_PHONE" }, { name: "ANOTHER_PRIVATE_PERSON" }],
    created_by_name: "PRIVATE_CREATOR", adoption_notes: "PRIVATE_NOTE",
    ...fields,
  };
}

async function fixture(t, adoptions = {}) {
  const folder = await mkdtemp(path.join(tmpdir(), "adoption-share-"));
  const indexHtmlPath = path.join(folder, "index.html");
  await writeFile(indexHtmlPath, INDEX_HTML);
  const calls = [];
  const previous = pool.query;
  pool.query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM adoptions a")) {
      const row = adoptions[values[0]];
      return { rows: row && row.municipalityActive !== false ? [structuredClone(row)] : [] };
    }
    throw new Error("Unexpected test database operation");
  };
  const app = express();
  app.use(createAdoptionShareRouter({ indexHtmlPath }));
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous;
    await rm(folder, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = (route, headers = {}) => clientFetch(`${origin}${route}`, { headers });
  return { get, calls, origin };
}

test("the share path is built and read back, and only an animal id counts as one", () => {
  assert.equal(adoptionSharePath(ID), `/adocao/${ID}`);
  assert.equal(readAdoptionShareId(`/adocao/${ID}`), ID);
  assert.equal(readAdoptionShareId(`/adocao/${ID}/`), ID);
  for (const pathname of ["/", "/adocao/", "/adocao/123", `/adocao/${ID}/extra`, "/outra/página", "/adocao/%E0%A4%A"]) {
    assert.equal(readAdoptionShareId(pathname), "", pathname);
  }
});

test("a shared link answers the app's page with the animal's preview, every typed text escaped", async (t) => {
  const { get, origin } = await fixture(t, { [ID]: animal({ animal_name: 'Luna <script>alert(1)</script>', description: 'Diz "oi" & late' }) });
  const response = await get(`/adocao/${ID}`, { "X-Forwarded-Proto": "https" });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.match(html, /<title>Luna &lt;script&gt;alert\(1\)&lt;\/script&gt; · Canino para adoção<\/title>/);
  assert.match(html, /<meta property="og:description" content="2 anos, Fêmea\. Diz &quot;oi&quot; &amp; late" \/>/);
  const httpsOrigin = origin.replace("http://", "https://");
  assert.match(html, new RegExp(`<meta property="og:image" content="${httpsOrigin}/api/adoptions/${ID}/photo" />`));
  assert.match(html, new RegExp(`<meta property="og:url" content="${httpsOrigin}/adocao/${ID}" />`));
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.match(html, /<div id="root"><\/div>/);
});

test("an adopted animal says it found a family, and one without a raster photo shows the app icon", async (t) => {
  const { get, origin } = await fixture(t, { [ID]: animal({ status: "adotado", photos: [], photo_url: "https://example.test/foto.png" }) });
  const html = await (await get(`/adocao/${ID}`)).text();
  assert.match(html, /<title>Luna já encontrou uma família<\/title>/);
  assert.match(html, new RegExp(`<meta property="og:image" content="${origin}/pwa-icon-512.png" />`));
});

test("an unknown, invalid or inactive animal gets the general adoption preview, an invalid id without a database read", async (t) => {
  const { get, calls } = await fixture(t, { [ID]: animal({ municipalityActive: false }) });
  for (const route of [`/adocao/${ID}`, "/adocao/44444444-4444-4444-8444-444444444444", "/adocao/nao-e-um-id"]) {
    const response = await get(route);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /<title>Animais para adoção<\/title>/, route);
  }
  assert.equal(calls.length, 2);
});

test("the public data of a shared animal carries only what the public list shows", async (t) => {
  const { get } = await fixture(t, { [ID]: animal() });
  const response = await get(`/api/adoptions/${ID}/public`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.animal_name, "Luna");
  assert.equal(body.municipality_id, MUNICIPALITY);
  assert.equal(body.interestCount, 2);
  assert.equal(JSON.stringify(body).includes("PRIVATE"), false);
  assert.equal("interests" in body, false);
  for (const route of ["/api/adoptions/44444444-4444-4444-8444-444444444444/public", "/api/adoptions/nao-e-um-id/public"]) {
    const missing = await get(route);
    assert.equal(missing.status, 404, route);
    assert.deepEqual(await missing.json(), { error: "Animal indisponível." }, route);
  }
});

test("the main photo is served without a session as a cached raster image", async (t) => {
  const { get } = await fixture(t, { [ID]: animal({ photos: [dataUrl("jpeg"), dataUrl("png", SECOND)], main_photo_index: 1 }) });
  const response = await get(`/api/adoptions/${ID}/photo`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "public, max-age=86400");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), SECOND);
  const cached = await get(`/api/adoptions/${ID}/photo`, { "If-None-Match": response.headers.get("etag") });
  assert.equal(cached.status, 304);
});

test("anything but a stored raster photo answers the same 404", async (t) => {
  const svg = `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)></svg>").toString("base64")}`;
  const cases = { svg: animal({ photos: [svg] }), remote: animal({ photos: [], photo_url: "https://example.test/foto.png" }), none: animal({ photos: [], photo_url: "" }) };
  for (const [name, row] of Object.entries(cases)) {
    const { get } = await fixture(t, { [ID]: row });
    const response = await get(`/api/adoptions/${ID}/photo`);
    assert.equal(response.status, 404, name);
    assert.deepEqual(await response.json(), { error: "Foto indisponível." }, name);
  }
});

test("a failing database still serves the page and answers the data and the photo with the plain 404", async (t) => {
  const { get } = await fixture(t, {});
  pool.query = async () => { throw new Error("database secret detail"); };
  assert.match(await (await get(`/adocao/${ID}`)).text(), /Animais para adoção/);
  const data = await get(`/api/adoptions/${ID}/public`);
  assert.equal(data.status, 404);
  assert.equal(JSON.stringify(await data.json()).includes("secret"), false);
  assert.equal((await get(`/api/adoptions/${ID}/photo`)).status, 404);
});
