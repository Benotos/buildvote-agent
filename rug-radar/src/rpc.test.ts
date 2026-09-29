import test from "node:test";
import assert from "node:assert/strict";
import { SolanaRpcClient, RpcError, type FetchLike } from "./rpc.js";

// All fixtures below mirror real Solana JSON-RPC response shapes
// (https://solana.com/docs/rpc/http). No live network calls happen here.

function fixtureFetch(result: unknown, opts: { error?: { code: number; message: string }; status?: number } = {}): FetchLike {
  return (async () => {
    const payload = opts.error
      ? { jsonrpc: "2.0", id: 1, error: opts.error }
      : { jsonrpc: "2.0", id: 1, result };
    return new Response(JSON.stringify(payload), {
      status: opts.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as FetchLike;
}

interface RecordedCall {
  url: string;
  body: { jsonrpc: string; id: number; method: string; params: unknown[] };
}

function recordingFetch(inner: FetchLike): { fetch: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return inner(url, init);
  }) as FetchLike;
  return { fetch, calls };
}

test("getTokenSupply parses the token amount", async () => {
  const client = new SolanaRpcClient(
    "https://example.test/rpc",
    fixtureFetch({
      context: { slot: 123 },
      value: { amount: "1000000000000", decimals: 6, uiAmount: 1000000, uiAmountString: "1000000" },
    }),
  );

  const supply = await client.getTokenSupply("MintAddress1111111111111111111111111111111");
  assert.equal(supply.amount, "1000000000000");
  assert.equal(supply.decimals, 6);
});

test("getTokenLargestAccounts parses the holder list and sends the mint", async () => {
  const { fetch, calls } = recordingFetch(
    fixtureFetch({
      context: { slot: 123 },
      value: [
        { address: "Holder1", amount: "500000000000", decimals: 6, uiAmount: 500000, uiAmountString: "500000" },
        { address: "Holder2", amount: "200000000000", decimals: 6, uiAmount: 200000, uiAmountString: "200000" },
      ],
    }),
  );
  const client = new SolanaRpcClient("https://example.test/rpc", fetch);

  const holders = await client.getTokenLargestAccounts("Mint1");
  assert.equal(holders.length, 2);
  assert.equal(holders[0].address, "Holder1");
  assert.equal(calls[0].body.method, "getTokenLargestAccounts");
  assert.deepEqual(calls[0].body.params, ["Mint1"]);
});

test("getAccountInfo returns null for a nonexistent account", async () => {
  const client = new SolanaRpcClient("https://example.test/rpc", fixtureFetch({ context: { slot: 1 }, value: null }));
  const info = await client.getAccountInfo("Nowhere1111111111111111111111111111111111");
  assert.equal(info, null);
});

test("getAccountInfo returns account data", async () => {
  const client = new SolanaRpcClient(
    "https://example.test/rpc",
    fixtureFetch({
      context: { slot: 1 },
      value: {
        data: ["base64data==", "base64"],
        executable: false,
        lamports: 2039280,
        owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        rentEpoch: 361,
      },
    }),
  );
  const info = await client.getAccountInfo("Account1111111111111111111111111111111111");
  assert.ok(info);
  assert.equal(info?.owner, "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
});

test("getSignaturesForAddress returns signature history", async () => {
  const client = new SolanaRpcClient(
    "https://example.test/rpc",
    fixtureFetch([
      { signature: "sig1", slot: 100, err: null, memo: null, blockTime: 1700000000, confirmationStatus: "finalized" },
      { signature: "sig2", slot: 90, err: null, memo: null, blockTime: 1699999000, confirmationStatus: "finalized" },
    ]),
  );
  const sigs = await client.getSignaturesForAddress("Deployer111111111111111111111111111111111");
  assert.equal(sigs.length, 2);
  assert.equal(sigs[0].signature, "sig1");
});

test("getTransaction returns token balance changes", async () => {
  const client = new SolanaRpcClient(
    "https://example.test/rpc",
    fixtureFetch({
      slot: 100,
      blockTime: 1700000000,
      transaction: { signatures: ["sig1"], message: {} },
      meta: {
        err: null,
        fee: 5000,
        preBalances: [1000000, 0],
        postBalances: [995000, 5000],
        preTokenBalances: [],
        postTokenBalances: [
          {
            accountIndex: 1,
            mint: "Mint1",
            owner: "Buyer1",
            uiTokenAmount: { amount: "1000000", decimals: 6, uiAmount: 1, uiAmountString: "1" },
          },
        ],
      },
    }),
  );
  const tx = await client.getTransaction("sig1");
  assert.ok(tx?.meta);
  assert.equal(tx?.meta?.postTokenBalances?.[0]?.owner, "Buyer1");
});

test("throws RpcError on an RPC-level error response", async () => {
  const client = new SolanaRpcClient(
    "https://example.test/rpc",
    fixtureFetch(undefined, { error: { code: -32602, message: "Invalid param: not a valid pubkey" } }),
  );
  await assert.rejects(
    () => client.getTokenSupply("not-a-real-mint"),
    (err: unknown) => err instanceof RpcError && err.code === -32602,
  );
});

test("throws on an HTTP-level error", async () => {
  const client = new SolanaRpcClient("https://example.test/rpc", fixtureFetch(undefined, { status: 429 }));
  await assert.rejects(() => client.getTokenSupply("Mint1"), /RPC HTTP error 429/);
});
