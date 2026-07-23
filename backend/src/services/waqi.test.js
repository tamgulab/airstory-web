import test from "node:test";
import assert from "node:assert/strict";
import { aqiPm25ToUgm3 } from "./waqi.js";

test("converts US EPA PM2.5 AQI breakpoints to µg/m³", () => {
  assert.equal(aqiPm25ToUgm3(0), 0);
  assert.equal(aqiPm25ToUgm3(50), 12);
  assert.ok(Math.abs(aqiPm25ToUgm3(100) - 35.4) < 0.05);
  assert.ok(aqiPm25ToUgm3(8) > 0);
  assert.ok(aqiPm25ToUgm3(8) < 12);
});

test("rejects invalid AQI", () => {
  assert.equal(aqiPm25ToUgm3(null), null);
  assert.equal(aqiPm25ToUgm3(-1), null);
});
