import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import imageRoutes from "../src/routes/municipality-images.js";
import { pool } from "../src/db/index.js";
import { MunicipalityImage, municipalityImageUrl, readMunicipalityImages } from "../src/services/municipality-images.js";
import { fakeEmailDatabase } from "./fixtures/email-config-db.js";

const ID = "11111111-1111-4111-8111-111111111111";
const PUBLIC_URL = "https://system.example.test";
const clientFetch = globalThis.fetch;
const BYTES = Buffer.from("fake raster image bytes");
const dataUrl = (type, payload = BYTES.toString("base64")) => `data:image/${type};base64,${payload}`;
const oversize = dataUrl("png", Buffer.alloc(2 * 1024 * 1024 + 16).toString("base64"));
const images = Object.values(MunicipalityImage);

// `municipalities` is read on each request, so a test can change a row between requests.
async function fixture(t, municipalities) {
  const database = fakeEmailDatabase({ municipalities });
  const previous = pool.query;
  pool.query = database.query;
  const app = express();
  app.use("/api/public/municipalities", imageRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous;
  });
  const get = (id, image = MunicipalityImage.BRASAO, headers = {}) =>
    clientFetch(`http://127.0.0.1:${server.address().port}/api/public/municipalities/${id}/${image.path}`, { headers });
  return { get, database };
}

test("each stored raster image is served by its own link without a session, with its type, cache headers and no sniffing", async (t) => {
  const rows = {};
  const { get } = await fixture(t, rows);
  for (const image of images) {
    for (const type of ["png", "jpeg", "webp", "gif"]) {
      rows[ID] = { [image.column]: dataUrl(type) };
      const response = await get(ID, image);
      assert.equal(response.status, 200, `${image.path} ${type}`);
      assert.equal(response.headers.get("content-type"), `image/${type}`);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("cache-control"), "public, max-age=86400");
      assert.match(response.headers.get("etag"), /^"[0-9a-f]{40}"$/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), BYTES);
    }
  }
});

test("the brasão link never serves the department logo, nor the other way around", async (t) => {
  const rows = { [ID]: { brasao: dataUrl("png") } };
  const { get } = await fixture(t, rows);
  assert.equal((await get(ID, MunicipalityImage.BRASAO)).status, 200);
  assert.equal((await get(ID, MunicipalityImage.DEPARTMENT_LOGO)).status, 404);
  rows[ID] = { department_logo: dataUrl("png") };
  assert.equal((await get(ID, MunicipalityImage.BRASAO)).status, 404);
  assert.equal((await get(ID, MunicipalityImage.DEPARTMENT_LOGO)).status, 200);
});

test("a repeated request with the same validator answers 304 and no body", async (t) => {
  const { get } = await fixture(t, { [ID]: { brasao: dataUrl("png") } });
  const etag = (await get(ID)).headers.get("etag");
  const cached = await get(ID, MunicipalityImage.BRASAO, { "If-None-Match": etag });
  assert.equal(cached.status, 304);
  assert.equal((await cached.arrayBuffer()).byteLength, 0);
  assert.equal((await get(ID, MunicipalityImage.BRASAO, { "If-None-Match": '"other"' })).status, 200);
});

test("anything that is not a small raster data URL of an active municipality answers the same 404, so nothing tells why", async (t) => {
  const unservable = {
    svg: dataUrl("svg+xml"),
    scriptSvg: `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)></svg>").toString("base64")}`,
    html: `data:text/html;base64,${BYTES.toString("base64")}`,
    remoteUrl: "https://example.test/brasao.png",
    badBase64: "data:image/png;base64,@@@@",
    empty: "",
    none: null,
    oversize,
  };
  const rows = {};
  const { get } = await fixture(t, rows);
  for (const image of images) {
    for (const [name, value] of Object.entries(unservable)) {
      rows[ID] = { [image.column]: value };
      const response = await get(ID, image);
      assert.equal(response.status, 404, `${image.path} ${name}`);
      assert.deepEqual(await response.json(), { error: "Imagem indisponível." }, `${image.path} ${name}`);
    }
    rows[ID] = { [image.column]: dataUrl("png"), active: false };
    assert.equal((await get(ID, image)).status, 404, `${image.path} inactive`);
  }
  delete rows[ID];
  assert.equal((await get(ID)).status, 404);
});

test("an id that is not a UUID is refused before any database read", async (t) => {
  const { get, database } = await fixture(t, { [ID]: { brasao: dataUrl("png"), department_logo: dataUrl("png") } });
  for (const image of images) {
    for (const id of ["1", "not-a-uuid", "%27%20OR%201=1", `${ID}x`]) assert.equal((await get(id, image)).status, 404, id);
  }
  assert.equal(database.calls.length, 0);
});

test("a failing database answers the same 404 instead of an error", async (t) => {
  const { get } = await fixture(t, {});
  pool.query = async () => { throw new Error("database secret detail"); };
  const response = await get(ID, MunicipalityImage.DEPARTMENT_LOGO);
  assert.equal(response.status, 404);
  assert.equal(JSON.stringify(await response.json()).includes("secret"), false);
});

test("the images a body carries are checked: empty removes one, a small raster data URL is kept, and only what was sent comes back", () => {
  assert.deepEqual(readMunicipalityImages({}), {});
  assert.deepEqual(readMunicipalityImages({ brasao: ` ${dataUrl("png")} `, departmentLogo: "" }), { brasao: dataUrl("png"), department_logo: "" });
  assert.deepEqual(readMunicipalityImages({ department_logo: dataUrl("webp"), brasao: null }), { brasao: "", department_logo: dataUrl("webp") });
});

test("an image its public link could not serve is refused with a message that names it", () => {
  for (const value of [dataUrl("svg+xml"), "https://example.test/logo.png", "data:image/png;base64,@@@@", oversize]) {
    assert.throws(() => readMunicipalityImages({ brasao: value }), { status: 400, message: "Não foi possível usar o brasão. Envie uma imagem PNG, JPG ou WEBP de até 2 MB." });
    assert.throws(() => readMunicipalityImages({ departmentLogo: value }), { status: 400, message: "Não foi possível usar o logo do órgão. Envie uma imagem PNG, JPG ou WEBP de até 2 MB." });
  }
});

test("each image has its own versioned public link, empty without the image or without the public address", () => {
  const updated = new Date("2026-11-15T10:00:00.000Z");
  const identity = { id: ID, updated_at: updated, has_brasao: true, has_department_logo: true };
  const link = (path) => `${PUBLIC_URL}/api/public/municipalities/${ID}/${path}`;
  assert.equal(municipalityImageUrl(identity, MunicipalityImage.BRASAO, PUBLIC_URL), `${link("brasao")}?v=${updated.getTime()}`);
  assert.equal(municipalityImageUrl(identity, MunicipalityImage.DEPARTMENT_LOGO, PUBLIC_URL), `${link("department-logo")}?v=${updated.getTime()}`);
  assert.equal(municipalityImageUrl({ ...identity, updated_at: "not a date" }, MunicipalityImage.BRASAO, PUBLIC_URL), link("brasao"));
  assert.equal(municipalityImageUrl({ ...identity, has_department_logo: false }, MunicipalityImage.DEPARTMENT_LOGO, PUBLIC_URL), "");
  assert.equal(municipalityImageUrl(identity, MunicipalityImage.BRASAO, ""), "");
  assert.equal(municipalityImageUrl(null, MunicipalityImage.BRASAO, PUBLIC_URL), "");
});
