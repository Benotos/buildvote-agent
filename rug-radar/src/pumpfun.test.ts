import test from "node:test";
import assert from "node:assert/strict";
import { decodeBondingCurve } from "./pumpfun.js";
import { base58Decode } from "./base58.js";

// Builds a fixture buffer matching the real BondingCurve account layout
// (see pumpfun.ts) so the decoder can be tested offline, without any RPC call.
function buildBondingCurveFixture(fields: {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: string;
}): string {
  const buf = Buffer.alloc(8 + 5 * 8 + 1 + 32);
  let offset = 8; // discriminator, contents don't matter for decoding
  buf.writeBigUInt64LE(fields.virtualTokenReserves, offset);
  offset += 8;
  buf.writeBigUInt64LE(fields.virtualSolReserves, offset);
  offset += 8;
  buf.writeBigUInt64LE(fields.realTokenReserves, offset);
  offset += 8;
  buf.writeBigUInt64LE(fields.realSolReserves, offset);
  offset += 8;
  buf.writeBigUInt64LE(fields.tokenTotalSupply, offset);
  offset += 8;
  buf.writeUInt8(fields.complete ? 1 : 0, offset);
  offset += 1;
  Buffer.from(base58Decode(fields.creator)).copy(buf, offset);
  return buf.toString("base64");
}

test("decodes a still-bonding curve account", () => {
  const creator = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const base64 = buildBondingCurveFixture({
    virtualTokenReserves: 1_000_000_000n,
    virtualSolReserves: 30_000_000_000n,
    realTokenReserves: 500_000_000n,
    realSolReserves: 5_000_000_000n,
    tokenTotalSupply: 1_000_000_000_000n,
    complete: false,
    creator,
  });

  const decoded = decodeBondingCurve(base64);
  assert.equal(decoded.virtualTokenReserves, 1_000_000_000n);
  assert.equal(decoded.realSolReserves, 5_000_000_000n);
  assert.equal(decoded.complete, false);
  assert.equal(decoded.creator, creator);
});

test("decodes a completed (migrated) curve account", () => {
  const creator = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
  const base64 = buildBondingCurveFixture({
    virtualTokenReserves: 0n,
    virtualSolReserves: 0n,
    realTokenReserves: 0n,
    realSolReserves: 85_000_000_000n,
    tokenTotalSupply: 1_000_000_000_000n,
    complete: true,
    creator,
  });

  const decoded = decodeBondingCurve(base64);
  assert.equal(decoded.complete, true);
  assert.equal(decoded.creator, creator);
});

test("throws when the account data is too short to be a bonding curve", () => {
  const tooShort = Buffer.alloc(10).toString("base64");
  assert.throws(() => decodeBondingCurve(tooShort));
});
