import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { ordinalPercentile } from "./format.ts";

describe("ordinalPercentile", () => {
  test("standard ordinals", () => {
    assert.equal(ordinalPercentile(1), "1st");
    assert.equal(ordinalPercentile(2), "2nd");
    assert.equal(ordinalPercentile(3), "3rd");
    assert.equal(ordinalPercentile(4), "4th");
    assert.equal(ordinalPercentile(78), "78th");
    assert.equal(ordinalPercentile(91), "91st");
    assert.equal(ordinalPercentile(92), "92nd");
    assert.equal(ordinalPercentile(93), "93rd");
  });

  test("teen exception (11/12/13 → 'th', not 'st/nd/rd')", () => {
    assert.equal(ordinalPercentile(11), "11th");
    assert.equal(ordinalPercentile(12), "12th");
    assert.equal(ordinalPercentile(13), "13th");
  });

  test("rounds non-integer percentiles", () => {
    assert.equal(ordinalPercentile(78.4), "78th");
    assert.equal(ordinalPercentile(78.5), "79th");
    assert.equal(ordinalPercentile(0.5), "1st");
  });

  test("edge values 0 and 100", () => {
    assert.equal(ordinalPercentile(0), "0th");
    assert.equal(ordinalPercentile(100), "100th");
  });

  test("null/undefined/NaN return em-dash", () => {
    assert.equal(ordinalPercentile(null), "—");
    assert.equal(ordinalPercentile(undefined), "—");
    assert.equal(ordinalPercentile(NaN), "—");
    assert.equal(ordinalPercentile(Infinity), "—");
  });
});
