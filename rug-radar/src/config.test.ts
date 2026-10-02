import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./config.js";

test("loadConfig falls back to public RPC and default port", () => {
  const config = loadConfig({});
  assert.equal(config.rpcUrl, "https://api.mainnet-beta.solana.com");
  assert.equal(config.wsUrl, undefined);
  assert.equal(config.port, 8787);
});

test("loadConfig reads overrides from env", () => {
  const config = loadConfig({
    SOLANA_RPC_URL: "https://example.org/rpc",
    SOLANA_WS_URL: "wss://example.org/ws",
    PORT: "3000",
  });
  assert.equal(config.rpcUrl, "https://example.org/rpc");
  assert.equal(config.wsUrl, "wss://example.org/ws");
  assert.equal(config.port, 3000);
});
