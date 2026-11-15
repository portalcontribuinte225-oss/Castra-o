import assert from "node:assert/strict";

// Guards hand-numbered INSERT statements: columns, VALUES entries and bound parameters must line up.
export function assertInsertShape(sql, values) {
  const columns = sql.match(/INSERT INTO \w+ \(([^)]*)\)/)[1].split(",").map((name) => name.trim()).filter(Boolean);
  const entries = sql.match(/VALUES \(([\s\S]*?)\)\s*RETURNING/)[1].split(",").map((entry) => entry.trim()).filter(Boolean);
  const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
  assert.equal(entries.length, columns.length, "VALUES entries must match the column list");
  assert.equal(Math.max(...placeholders), values.length, "highest placeholder must equal the bound values");
  assert.equal(new Set(placeholders).size, values.length, "every bound value must be used exactly once");
}
