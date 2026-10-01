import test from "node:test";
import assert from "node:assert/strict";
import { findNewLaunches } from "./discovery.js";
import { PUMP_FUN_PROGRAM_ID } from "./pumpfun.js";
import { base58Encode } from "./base58.js";
import type { ParsedTransaction, SignatureInfo } from "./rpc.js";

const CREATE_DISCRIMINATOR = [24, 30, 200, 40, 5, 28, 7, 119];

function createInstructionData(): string {
  return base58Encode(Buffer.concat([Buffer.from(CREATE_DISCRIMINATOR), Buffer.alloc(4)]));
}

// account[0] = mint, account[2] = bonding curve, account[7] = deployer/user,
// per CREATE_ACCOUNT_INDEX in pumpfun.ts. The rest are irrelevant fillers.
const CREATE_ACCOUNTS = [
  "Mint1111111111111111111111111111111111111",
  "Filler1Program11111111111111111111111111",
  "BondingCurve11111111111111111111111111111",
  "Filler3Program11111111111111111111111111",
  "Filler4Program11111111111111111111111111",
  "Filler5Program11111111111111111111111111",
  "Filler6Program11111111111111111111111111",
  "Deployer111111111111111111111111111111111",
];

function fakeRpc(bySignature: Record<string, ParsedTransaction | null>, signatures: SignatureInfo[]) {
  return {
    async getSignaturesForAddress(address: string, limit: number) {
      assert.equal(address, PUMP_FUN_PROGRAM_ID);
      return signatures.slice(0, limit);
    },
    async getTransaction(signature: string) {
      return bySignature[signature] ?? null;
    },
  };
}

function createTx(): ParsedTransaction {
  return {
    slot: 1,
    blockTime: 1700000100,
    transaction: {
      signatures: ["sigCreate"],
      message: {
        accountKeys: CREATE_ACCOUNTS.map((pubkey) => ({ pubkey, signer: false, writable: true })),
        instructions: [
          { programId: PUMP_FUN_PROGRAM_ID, accounts: CREATE_ACCOUNTS, data: createInstructionData() },
        ],
      },
    },
    meta: { err: null, fee: 5000, preBalances: [], postBalances: [] },
  };
}

test("first poll (sinceBlockTime null) seeds the watermark without reporting launches", async () => {
  const signatures: SignatureInfo[] = [
    { signature: "sigNewest", slot: 3, err: null, memo: null, blockTime: 1700000200 },
  ];
  const rpc = fakeRpc({}, signatures);

  const result = await findNewLaunches(rpc, null);
  assert.deepEqual(result.launches, []);
  assert.equal(result.newestBlockTime, 1700000200);
});

test("finds a create instruction among newer signatures and returns oldest-first", async () => {
  const signatures: SignatureInfo[] = [
    { signature: "sigNewer", slot: 2, err: null, memo: null, blockTime: 1700000200 },
    { signature: "sigCreate", slot: 1, err: null, memo: null, blockTime: 1700000100 },
  ];
  const rpc = fakeRpc({ sigCreate: createTx(), sigNewer: null }, signatures);

  const result = await findNewLaunches(rpc, 1700000000);
  assert.equal(result.launches.length, 1);
  assert.equal(result.launches[0].mint, "Mint1111111111111111111111111111111111111");
  assert.equal(result.launches[0].deployer, "Deployer111111111111111111111111111111111");
  assert.equal(result.launches[0].bondingCurve, "BondingCurve11111111111111111111111111111");
  assert.equal(result.launches[0].createdAt, 1700000100);
  assert.equal(result.newestBlockTime, 1700000200);
});

test("ignores signatures at or before the watermark", async () => {
  const signatures: SignatureInfo[] = [
    { signature: "sigCreate", slot: 1, err: null, memo: null, blockTime: 1700000100 },
  ];
  const rpc = fakeRpc({ sigCreate: createTx() }, signatures);

  const result = await findNewLaunches(rpc, 1700000100);
  assert.deepEqual(result.launches, []);
  assert.equal(result.newestBlockTime, 1700000100);
});

test("skips failed transactions and non-create instructions", async () => {
  const signatures: SignatureInfo[] = [
    { signature: "sigFailed", slot: 2, err: { InstructionError: [0, {}] }, memo: null, blockTime: 1700000200 },
    { signature: "sigUnrelated", slot: 1, err: null, memo: null, blockTime: 1700000100 },
  ];
  const unrelatedTx: ParsedTransaction = {
    slot: 1,
    blockTime: 1700000100,
    transaction: {
      signatures: ["sigUnrelated"],
      message: { accountKeys: [], instructions: [] },
    },
    meta: { err: null, fee: 5000, preBalances: [], postBalances: [] },
  };
  const rpc = fakeRpc({ sigUnrelated: unrelatedTx }, signatures);

  const result = await findNewLaunches(rpc, 1700000000);
  assert.deepEqual(result.launches, []);
  assert.equal(result.newestBlockTime, 1700000200);
});

test("skips a signature whose getTransaction call throws, instead of failing the whole poll", async () => {
  const signatures: SignatureInfo[] = [
    { signature: "sigCreate", slot: 2, err: null, memo: null, blockTime: 1700000200 },
    { signature: "sigFlaky", slot: 1, err: null, memo: null, blockTime: 1700000100 },
  ];
  const rpc = fakeRpc({ sigCreate: createTx() }, signatures);
  rpc.getTransaction = async (signature: string) => {
    if (signature === "sigFlaky") throw new Error("Transaction sigFlaky not found");
    return signature === "sigCreate" ? createTx() : null;
  };

  const result = await findNewLaunches(rpc, 1700000000);
  assert.equal(result.launches.length, 1);
  assert.equal(result.launches[0].mint, "Mint1111111111111111111111111111111111111");
  assert.equal(result.newestBlockTime, 1700000200);
});

test("returns the prior watermark unchanged when there are no signatures at all", async () => {
  const rpc = fakeRpc({}, []);
  const result = await findNewLaunches(rpc, 1700000000);
  assert.deepEqual(result.launches, []);
  assert.equal(result.newestBlockTime, 1700000000);
});
