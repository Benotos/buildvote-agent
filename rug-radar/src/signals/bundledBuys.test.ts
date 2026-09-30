import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreBundledBuys } from "./bundledBuys.js";
import type { EarlyBuy } from "./bundledBuys.js";

function buy(buyer: string, fundedBy: string | null, secondsAfterLaunch: number): EarlyBuy {
  return { buyer, fundedBy, secondsAfterLaunch };
}

test("returns a zero score with a reason when there are no early buys", () => {
  const result = scoreBundledBuys({ earlyBuys: [] });
  assert.equal(result.score, 0);
  assert.match(result.reasons[0], /no early buy data/);
});

test("scores high risk when most early buyers share one funding source", () => {
  const result = scoreBundledBuys({
    earlyBuys: [
      buy("buyerA", "funder1", 10),
      buy("buyerB", "funder1", 20),
      buy("buyerC", "funder1", 30),
      buy("buyerD", "funder2", 40),
    ],
  });
  assert.equal(result.score, 90);
  assert.match(result.reasons[0], /3 of 4 early buyers/);
});

test("scores moderate risk in the 30-50% band", () => {
  const result = scoreBundledBuys({
    earlyBuys: [
      buy("buyerA", "funder1", 10),
      buy("buyerB", "funder1", 20),
      buy("buyerC", "funder2", 30),
      buy("buyerD", "funder3", 40),
      buy("buyerE", "funder4", 50),
    ],
  });
  assert.equal(result.score, 55);
});

test("ignores buys outside the early window", () => {
  const result = scoreBundledBuys({
    earlyBuys: [
      buy("buyerA", "funder1", 10),
      buy("buyerB", "funder1", 20),
      buy("buyerC", "funder1", 9999), // outside default window
    ],
    windowSeconds: 300,
  });
  // Only 2 buys are early, both from funder1 -> high risk.
  assert.equal(result.score, 90);
  assert.match(result.reasons[0], /2 of 2 early buyers/);
});

test("a single buyer funded by a unique source is not a bundle", () => {
  const result = scoreBundledBuys({
    earlyBuys: [buy("buyerA", "funder1", 10), buy("buyerB", "funder2", 20)],
  });
  assert.equal(result.score, 0);
  assert.match(result.reasons[0], /no common funding source/);
});

test("buyers with no traceable funding source do not count toward a bundle", () => {
  const result = scoreBundledBuys({
    earlyBuys: [buy("buyerA", null, 10), buy("buyerB", null, 20), buy("buyerC", null, 30)],
  });
  assert.equal(result.score, 0);
  assert.match(result.reasons[0], /no common funding source/);
});

test("the same buyer address funded twice by the same source only counts once", () => {
  const result = scoreBundledBuys({
    earlyBuys: [
      buy("buyerA", "funder1", 10),
      buy("buyerA", "funder1", 15),
      buy("buyerB", "funder2", 20),
    ],
  });
  // distinct buyers: buyerA, buyerB -> largest bundle is 1 (funder1 has only buyerA)
  assert.equal(result.score, 0);
});
