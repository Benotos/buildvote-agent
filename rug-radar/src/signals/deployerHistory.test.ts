import test from "node:test";
import assert from "node:assert/strict";
import { scoreDeployerHistory, type PriorLaunch } from "./deployerHistory.js";

function launches(pattern: boolean[]): PriorLaunch[] {
  return pattern.map((migrated, i) => ({ mint: `Mint${i}`, migrated }));
}

test("returns a zero score with a reason when there is no prior history", () => {
  const result = scoreDeployerHistory({ deployer: "Deployer1", priorLaunches: [] });
  assert.equal(result.score, 0);
  assert.match(result.reasons[0], /no prior tokens/);
});

test("caps the score when there are too few prior launches to call it a pattern", () => {
  const result = scoreDeployerHistory({ deployer: "Deployer1", priorLaunches: launches([false, false]) });
  assert.ok(result.score <= 40);
  assert.match(result.reasons[0], /too few prior tokens/);
});

test("a single migrated prior launch scores near zero even though thin", () => {
  const result = scoreDeployerHistory({ deployer: "Deployer1", priorLaunches: launches([true]) });
  assert.equal(result.score, 0);
});

test("scores high risk when almost all prior launches never migrated", () => {
  const result = scoreDeployerHistory({
    deployer: "Deployer1",
    priorLaunches: launches([false, false, false, false, true]),
  });
  assert.equal(result.score, 90);
  assert.match(result.reasons[0], />= 80%/);
});

test("scores moderate risk in the 50-80% dead band", () => {
  const result = scoreDeployerHistory({
    deployer: "Deployer1",
    priorLaunches: launches([false, false, false, true, true]),
  });
  assert.equal(result.score, 55);
  assert.match(result.reasons[0], /50-80%/);
});

test("scores proportionally low risk when most prior launches migrated", () => {
  const result = scoreDeployerHistory({
    deployer: "Deployer1",
    priorLaunches: launches([false, true, true, true, true]),
  });
  assert.equal(result.score, 20);
});

test("boundary: exactly 50% dead counts as moderate risk", () => {
  const result = scoreDeployerHistory({
    deployer: "Deployer1",
    priorLaunches: launches([false, false, true, true]),
  });
  assert.equal(result.score, 55);
  assert.match(result.reasons[0], /50-80%/);
});
