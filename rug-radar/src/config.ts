// Reads config from environment only. Never hardcode RPC URLs, keys, or secrets here.

export interface Config {
  rpcUrl: string;
  // Optional override for providers whose websocket host differs from their
  // HTTP host. When unset, server.ts derives it from rpcUrl (see
  // wsDiscovery.ts's deriveWsUrl).
  wsUrl: string | undefined;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rpcUrl = env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const wsUrl = env.SOLANA_WS_URL || undefined;
  const port = Number.parseInt(env.PORT ?? "8787", 10);
  return { rpcUrl, wsUrl, port: Number.isFinite(port) ? port : 8787 };
}
