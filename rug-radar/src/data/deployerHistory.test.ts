import test from "node:test";
import assert from "node:assert/strict";
import { fetchDeployerHistoryInput } from "./deployerHistory.js";
import { base58Decode, base58Encode } from "../base58.js";
import { PUMP_FUN_PROGRAM_ID } from "../pumpfun.js";

const CREATE_DISCRIMINATOR = [24, 30, 200, 40, 5, 28, 7, 119];
const DEPLOYER = "Deployer11111111111111111111111111111111111";

function createInstructionData(): string {
  return base58Encode(Buffer.concat([Buffer.from(CREATE_DISCRIMINATOR), Buffer.alloc(4)]));
}

// accounts[0] = mint, accounts[2] = bonding curve, accounts[7] = user (deployer),
// matching the real create instruction's account order (see pumpfun.ts).
function createAccounts(mint: string, bondingCurve: string, user: string): string[] {
  const accounts = Array.from({ length: 14 }, (_, i) => `Filler${i}111111111111111111111111111`);
  accounts[0] = mint;
  accounts[2] = bondingCurve;
  accounts[7] = user;
  return accounts;
}

function createTransaction(mint: string, bondingCurve: string, user: string, blockTime = 1700000000) {
  return {
    slot: 1,
    blockTime,
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [],
        instructions: [
          {
            programId: PUMP_FUN_PROGRAM_ID,
            accounts: createAccounts(mint, bondingCurve, user),
            data: createInstructionData(),
          },
        ],
      },
    },
    meta: { err: null, fee: 5000, preBalances: [], postBalances: [] },
  };
}

function bondingCurveAccountInfo(complete: boolean) {
  const buf = Buffer.alloc(8 + 5 * 8 + 1 + 32);
  buf.writeUInt8(complete ? 1 : 0, 8 + 5 * 8);
  Buffer.from(base58Decode("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")).copy(buf, 8 + 5 * 8 + 1);
  return {
    data: [buf.toString("base64"), "base64"] as [string, string],
    executable: false,
    lamports: 1,
    owner: PUMP_FUN_PROGRAM_ID,
    rentEpoch: 0,
  };
}

test("finds prior create instructions from this deployer and reports migration status", async () => {
  const txByMint: Record<string, ReturnType<typeof createTransaction>> = {
    MintA: createTransaction("MintA", "CurveA", DEPLOYER),
    MintB: createTransaction("MintB", "CurveB", DEPLOYER),
  };
  const fakeRpc = {
    getSignaturesForAddress: async () => [
      { signature: "sigA", slot: 1, err: null, memo: null, blockTime: 1700000000 },
      { signature: "sigB", slot: 2, err: null, memo: null, blockTime: 1700001000 },
    ],
    getTransaction: async (sig: string) => (sig === "sigA" ? txByMint.MintA : txByMint.MintB),
    getAccountInfo: async (address: string) => bondingCurveAccountInfo(address === "CurveA"),
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint");
  assert.equal(priorLaunches.length, 2);
  const byMint = new Map(priorLaunches.map((p) => [p.mint, p.migrated]));
  assert.equal(byMint.get("MintA"), true);
  assert.equal(byMint.get("MintB"), false);
});

test("excludes the current mint from prior history", async () => {
  const fakeRpc = {
    getSignaturesForAddress: async () => [
      { signature: "sig1", slot: 1, err: null, memo: null, blockTime: 1700000000 },
    ],
    getTransaction: async () => createTransaction("CurrentMint", "CurveX", DEPLOYER),
    getAccountInfo: async () => bondingCurveAccountInfo(false),
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint");
  assert.equal(priorLaunches.length, 0);
});

test("ignores transactions with no pump.fun create instruction from this deployer", async () => {
  const fakeRpc = {
    getSignaturesForAddress: async () => [
      { signature: "sig1", slot: 1, err: null, memo: null, blockTime: 1700000000 },
    ],
    getTransaction: async () => ({
      slot: 1,
      blockTime: 1700000000,
      transaction: { signatures: ["sig1"], message: { accountKeys: [], instructions: [] } },
      meta: { err: null, fee: 5000, preBalances: [], postBalances: [] },
    }),
    getAccountInfo: async () => null,
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint");
  assert.equal(priorLaunches.length, 0);
});

test("skips failed transactions", async () => {
  let getTransactionCalls = 0;
  const fakeRpc = {
    getSignaturesForAddress: async () => [
      { signature: "sigFailed", slot: 1, err: { InstructionError: [0, "Custom"] }, memo: null, blockTime: 1700000000 },
    ],
    getTransaction: async () => {
      getTransactionCalls++;
      return createTransaction("MintA", "CurveA", DEPLOYER);
    },
    getAccountInfo: async () => bondingCurveAccountInfo(true),
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint");
  assert.equal(priorLaunches.length, 0);
  assert.equal(getTransactionCalls, 0);
});

test("treats a create instruction from a different deployer as not this wallet's history", async () => {
  const fakeRpc = {
    getSignaturesForAddress: async () => [
      { signature: "sig1", slot: 1, err: null, memo: null, blockTime: 1700000000 },
    ],
    getTransaction: async () => createTransaction("MintA", "CurveA", "SomeoneElse1111111111111111111111111111111"),
    getAccountInfo: async () => bondingCurveAccountInfo(true),
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint");
  assert.equal(priorLaunches.length, 0);
});

test("merges in observed prior launches missed by the signature scan", async () => {
  const fakeRpc = {
    getSignaturesForAddress: async () => [],
    getTransaction: async () => createTransaction("CurrentMint", "CurveX", DEPLOYER),
    getAccountInfo: async (address: string) => bondingCurveAccountInfo(address === "CurveObserved"),
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint", {
    observedPriorLaunches: [{ mint: "MintObserved", bondingCurve: "CurveObserved" }],
  });

  assert.deepEqual(priorLaunches, [{ mint: "MintObserved", migrated: true }]);
});

test("does not double-count an observed mint the scan already found", async () => {
  let getTransactionCalls = 0;
  let accountInfoCalls = 0;
  const fakeRpc = {
    getSignaturesForAddress: async () => [
      { signature: "sigA", slot: 1, err: null, memo: null, blockTime: 1700000000 },
    ],
    getTransaction: async () => {
      getTransactionCalls++;
      return createTransaction("MintA", "CurveA", DEPLOYER);
    },
    getAccountInfo: async () => {
      accountInfoCalls++;
      return bondingCurveAccountInfo(false);
    },
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint", {
    observedPriorLaunches: [{ mint: "MintA", bondingCurve: "CurveA" }],
  });

  assert.deepEqual(priorLaunches, [{ mint: "MintA", migrated: false }]);
  assert.equal(getTransactionCalls, 1);
  assert.equal(accountInfoCalls, 1);
});

test("an observed mint never counts as its own prior history", async () => {
  const fakeRpc = {
    getSignaturesForAddress: async () => [],
    getTransaction: async () => null,
    getAccountInfo: async () => bondingCurveAccountInfo(true),
  };

  const priorLaunches = await fetchDeployerHistoryInput(fakeRpc, DEPLOYER, "CurrentMint", {
    observedPriorLaunches: [{ mint: "CurrentMint", bondingCurve: "CurveX" }],
  });

  assert.equal(priorLaunches.length, 0);
});
