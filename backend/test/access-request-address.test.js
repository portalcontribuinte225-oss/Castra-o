import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import accessRequestRoutes from "../src/routes/accessRequests.js";
import { pool } from "../src/db/index.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const clientFetch = globalThis.fetch;
const base = {
  requester_type: "PROTETOR", responsible_name: "Maria Silva", email: "maria@example.test", phone: "(48) 99999-1234", municipality_id: MUNICIPALITY,
};

async function fixture(t) {
  const previous = { query: pool.query, connect: pool.connect };
  const inserts = [];
  pool.query = async (sql, values = []) => {
    if (!sql.includes("INSERT INTO access_requests")) throw new Error("Unexpected access-request test query");
    const columns = sql.slice(sql.indexOf("(") + 1, sql.indexOf(")")).split(",").map((column) => column.trim());
    const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
    inserts.push(row);
    return { rows: [{ id: "33333333-3333-4333-8333-333333333333", status: "PENDENTE", ...row }] };
  };
  const app = express();
  app.use(express.json());
  app.use("/access", accessRequestRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect;
  });
  const send = async (body) => {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}/access`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { send, inserts };
}

test("a credentialing request keeps the whole address, trimmed, with the CEP as 00000-000 and the UF in capitals", async (t) => {
  const { send, inserts } = await fixture(t);
  const sent = await send({ ...base, cep: "88801600", address: " Rua Ararangua ", address_number: " 88 ", neighborhood: " Centro ", city: " Criciuma ", state: "sc" });
  assert.equal(sent.status, 201);
  assert.deepEqual(
    [inserts[0].cep, inserts[0].address, inserts[0].address_number, inserts[0].neighborhood, inserts[0].city, inserts[0].state],
    ["88801-600", "Rua Ararangua", "88", "Centro", "Criciuma", "SC"],
  );
  assert.equal(inserts[0].municipality_id, MUNICIPALITY);
});

test("the address is optional, as the tutor's", async (t) => {
  const { send, inserts } = await fixture(t);
  assert.equal((await send(base)).status, 201);
  assert.deepEqual([inserts[0].cep, inserts[0].address, inserts[0].address_number, inserts[0].neighborhood, inserts[0].city, inserts[0].state], ["", "", "", "", "", ""]);
});

test("a malformed or too long address is refused with the words the screen uses, and nothing is stored", async (t) => {
  const { send, inserts } = await fixture(t);
  const cases = [
    [{ cep: "8880" }, "Informe um CEP com 8 dígitos."],
    [{ state: "S" }, "Informe a UF com 2 letras."],
    [{ state: "S1" }, "Informe a UF com 2 letras."],
    [{ address: "x".repeat(201) }, "Endereço muito longo."],
    [{ address_number: "9".repeat(21) }, "Número muito longo."],
    [{ neighborhood: "x".repeat(121) }, "Bairro muito longo."],
    [{ city: "x".repeat(121) }, "Cidade muito longa."],
  ];
  for (const [address, message] of cases) {
    const refused = await send({ ...base, ...address });
    assert.deepEqual([refused.status, refused.body.error], [400, message], JSON.stringify(address));
  }
  assert.equal(inserts.length, 0);
});
