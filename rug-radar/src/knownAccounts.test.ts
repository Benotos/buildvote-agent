import test from "node:test";
import assert from "node:assert/strict";
import { KNOWN_PROGRAM_ACCOUNTS, KNOWN_PROGRAM_ACCOUNT_ADDRESSES } from "./knownAccounts.js";

test("known program accounts have distinct, non-empty addresses", () => {
  const addresses = Object.values(KNOWN_PROGRAM_ACCOUNTS);
  assert.equal(addresses.length, new Set(addresses).size, "addresses should be unique");
  for (const address of addresses) {
    assert.ok(address.length > 0);
  }
});

test("KNOWN_PROGRAM_ACCOUNT_ADDRESSES matches the accounts map", () => {
  assert.deepEqual(
    new Set(KNOWN_PROGRAM_ACCOUNT_ADDRESSES),
    new Set(Object.values(KNOWN_PROGRAM_ACCOUNTS)),
  );
});
