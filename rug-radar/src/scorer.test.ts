import assert from "node:assert/strict";
import { test } from "node:test";
import { combineSignals } from "./scorer.js";
import type { SignalResult } from "./types.js";

test("returns a zero score with no signals when none are supplied", () => {
  const result = combineSignals("mint1", []);
  assert.equal(result.mint, "mint1");
  assert.equal(result.score, 0);
  assert.deepEqual(result.signals, []);
});

test("weights liquidity and holder-concentration more than other signals", () => {
  const signals: SignalResult[] = [
    { name: "liquidity", score: 80, reasons: ["thin liquidity"] },
    { name: "holder-concentration", score: 80, reasons: ["concentrated"] },
    { name: "bundled-buys", score: 0, reasons: ["no bundling detected"] },
  ];
  const result = combineSignals("mint2", signals);
  // (80*2 + 80*2 + 0*1) / 5 = 64
  assert.equal(result.score, 64);
  assert.equal(result.signals.length, 3);
});

test("unknown signal names fall back to weight 1", () => {
  const signals: SignalResult[] = [
    { name: "some-future-signal", score: 40, reasons: ["placeholder"] },
    { name: "another-future-signal", score: 60, reasons: ["placeholder"] },
  ];
  const result = combineSignals("mint3", signals);
  assert.equal(result.score, 50);
});

test("a single signal passes its own score straight through", () => {
  const result = combineSignals("mint4", [
    { name: "liquidity", score: 33, reasons: ["moderate"] },
  ]);
  assert.equal(result.score, 33);
});

test("preserves signal order and reasons for display", () => {
  const signals: SignalResult[] = [
    { name: "liquidity", score: 10, reasons: ["deep liquidity"] },
    { name: "holder-concentration", score: 20, reasons: ["well distributed"] },
  ];
  const result = combineSignals("mint5", signals);
  assert.deepEqual(
    result.signals.map((s) => s.name),
    ["liquidity", "holder-concentration"],
  );
  assert.deepEqual(result.signals[0].reasons, ["deep liquidity"]);
});
