import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import brasaoRoutes from "../src/routes/municipality-brasao.js";
import { pool } from "../src/db/index.js";
import { fakeEmailDatabase } from "./fixtures/email-config-db.js";

const ID = "11111111-1111-4111-8111-111111111111";
const clientFetch = globalThis.fetch;
const BYTES = Buffer.from("fake raster image bytes");
const dataUrl = (type, payload = BYTES.toString("base64")) => `data:image/${type};base64,${payload}`;
const updated_at = new Date("2026-11-15T10:00:00.000Z");

async function fixture(t, municipalities) {
  const database = fakeEmailDatabase({ municipalities });
  const previous = pool.query;
  pool.query = database.query;
  const app = express();
  app.use("/api/public/municipalities", brasaoRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous;
  });
  const get = (id, headers = {}) => clientFetch(`http://127.0.0.1:${server.address().port}/api/public/municipalities/${id}/brasao`, { headers });
  return { get, database };
}

test("a stored raster brasão is served without a session, with its type, cache headers and no sniffing", async (t) => {
  for (const type of ["png", "jpeg", "webp", "gif"]) {
    const { get } = await fixture(t, { [ID]: { brasao: dataUrl(type), updated_at } });
    const response = await get(ID);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), `image/${type}`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("cache-control"), "public, max-age=86400");
    assert.match(response.headers.get("etag"), /^"[0-9a-f]{40}"$/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), BYTES);
  }
});

test("a repeated request with the same validator answers 304 and no body", async (t) => {
  const { get } = await fixture(t, { [ID]: { brasao: dataUrl("png"), updated_at } });
  const etag = (await get(ID)).headers.get("etag");
  const cached = await get(ID, { "If-None-Match": etag });
  assert.equal(cached.status, 304);
  assert.equal((await cached.arrayBuffer()).byteLength, 0);
  assert.equal((await get(ID, { "If-None-Match": '"other"' })).status, 200);
});

test("anything that is not a small raster data URL answers the same 404, so nothing tells why", async (t) => {
  const oversize = dataUrl("png", Buffer.alloc(2 * 1024 * 1024 + 16).toString("base64"));
  const cases = {
    svg: { brasao: dataUrl("svg+xml") },
    scriptSvg: { brasao: `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)></svg>").toString("base64")}` },
    html: { brasao: `data:text/html;base64,${BYTES.toString("base64")}` },
    remoteUrl: { brasao: "https://example.test/brasao.png" },
    badBase64: { brasao: "data:image/png;base64,@@@@" },
    empty: { brasao: "" },
    none: { brasao: null },
    oversize: { brasao: oversize },
    inactive: { brasao: dataUrl("png"), active: false },
  };
  for (const [name, row] of Object.entries(cases)) {
    const { get } = await fixture(t, { [ID]: { updated_at, ...row } });
    const response = await get(ID);
    assert.equal(response.status, 404, name);
    assert.deepEqual(await response.json(), { error: "Brasão indisponível." }, name);
  }
  const { get } = await fixture(t, {});
  assert.equal((await get(ID)).status, 404);
});

test("an id that is not a UUID is refused before any database read", async (t) => {
  const { get, database } = await fixture(t, { [ID]: { brasao: dataUrl("png"), updated_at } });
  for (const id of ["1", "not-a-uuid", "%27%20OR%201=1", `${ID}x`]) assert.equal((await get(id)).status, 404, id);
  assert.equal(database.calls.length, 0);
});

test("a failing database answers the same 404 instead of an error", async (t) => {
  const { get } = await fixture(t, {});
  pool.query = async () => { throw new Error("database secret detail"); };
  const response = await get(ID);
  assert.equal(response.status, 404);
  assert.equal(JSON.stringify(await response.json()).includes("secret"), false);
});
