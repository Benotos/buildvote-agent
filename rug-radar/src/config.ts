// Reads config from environment only. Never hardcode RPC URLs, keys, or secrets here.

export interface Config {
  rpcUrl: string;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rpcUrl = env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const port = Number.parseInt(env.PORT ?? "8787", 10);
  return { rpcUrl, port: Number.isFinite(port) ? port : 8787 };
}
