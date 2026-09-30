// pump.fun program constants and the bonding curve account layout, per the
// public spec at https://github.com/pump-fun/pump-public-docs
// (docs/PUMP_PROGRAM_README.md). No private endpoints or keys involved —
// this is just how to read data that's already public on-chain.

import { base58Encode } from "./base58.js";

export const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export interface BondingCurveAccount {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: string;
}

// Anchor-style account: 8-byte discriminator, then five little-endian u64
// fields, a bool, then the 32-byte creator pubkey. Later fields
// (is_mayhem_mode, quote_mint, ...) exist but aren't needed here.
const DISCRIMINATOR_BYTES = 8;
const U64_BYTES = 8;
const BOOL_BYTES = 1;
const PUBKEY_BYTES = 32;

export function decodeBondingCurve(base64Data: string): BondingCurveAccount {
  const buf = Buffer.from(base64Data, "base64");
  const minLength =
    DISCRIMINATOR_BYTES + 5 * U64_BYTES + BOOL_BYTES + PUBKEY_BYTES;
  if (buf.length < minLength) {
    throw new Error(
      `bonding curve account data too short: got ${buf.length} bytes, need at least ${minLength}`,
    );
  }

  let offset = DISCRIMINATOR_BYTES;
  const readU64 = (): bigint => {
    const value = buf.readBigUInt64LE(offset);
    offset += U64_BYTES;
    return value;
  };

  const virtualTokenReserves = readU64();
  const virtualSolReserves = readU64();
  const realTokenReserves = readU64();
  const realSolReserves = readU64();
  const tokenTotalSupply = readU64();
  const complete = buf.readUInt8(offset) !== 0;
  offset += BOOL_BYTES;
  const creator = base58Encode(buf.subarray(offset, offset + PUBKEY_BYTES));

  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    complete,
    creator,
  };
}
