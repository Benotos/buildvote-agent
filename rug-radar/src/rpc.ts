// Thin client for the public Solana JSON-RPC API. No keys, no private endpoints —
// just the standard methods documented at https://solana.com/docs/rpc/http.

export type FetchLike = typeof fetch;

export class RpcError extends Error {
  constructor(message: string, public readonly code: number) {
    super(message);
    this.name = "RpcError";
  }
}

export interface RpcTokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
}

export interface TokenLargestAccount extends RpcTokenAmount {
  address: string;
}

export interface AccountInfoValue {
  data: [string, string] | { program: string; parsed: unknown; space: number };
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  err: unknown | null;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus?: string;
}

export interface TokenBalanceEntry {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: RpcTokenAmount;
}

export interface ParsedTransactionMeta {
  err: unknown | null;
  fee: number;
  preBalances: number[];
  postBalances: number[];
  preTokenBalances?: TokenBalanceEntry[];
  postTokenBalances?: TokenBalanceEntry[];
  logMessages?: string[];
}

export interface ParsedAccountKey {
  pubkey: string;
  signer: boolean;
  writable: boolean;
  source?: string;
}

// An instruction from an unrecognized program (e.g. pump.fun): the RPC can't
// decode its contents, so it's returned as a raw programId + account list +
// base58 instruction data.
export interface PartiallyDecodedInstruction {
  programId: string;
  accounts: string[];
  data: string;
}

// An instruction from a program the RPC knows how to decode (System, Token, ...).
export interface KnownProgramInstruction {
  programId: string;
  program: string;
  parsed: unknown;
}

export type MessageInstruction = PartiallyDecodedInstruction | KnownProgramInstruction;

export interface ParsedTransaction {
  slot: number;
  blockTime: number | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: ParsedAccountKey[];
      instructions?: MessageInstruction[];
    };
  };
  meta: ParsedTransactionMeta | null;
}

interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

// The public RPC's rate limit is tight enough that back-to-back calls (e.g.
// discovery's getTransaction per signature) routinely hit HTTP 429 — observed
// against real mainnet-beta, not a hypothetical. Retrying with backoff turns
// that into a short delay instead of a dropped transaction.
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 300;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SolanaRpcClient {
  private nextId = 1;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly url: string,
    private readonly fetchImpl: FetchLike = fetch,
    retry: RetryOptions = {},
  ) {
    this.maxRetries = retry.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseDelayMs = retry.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.sleep = retry.sleep ?? defaultSleep;
  }

  private async request<T>(method: string, params: unknown[]): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
      });

      if (res.status === 429 && attempt < this.maxRetries) {
        await this.sleep(this.baseDelayMs * 2 ** attempt);
        continue;
      }

      if (!res.ok) {
        throw new Error(`RPC HTTP error ${res.status} for ${method}`);
      }

      const body = (await res.json()) as RpcResponse<T>;
      if (body.error) {
        throw new RpcError(body.error.message, body.error.code);
      }
      return body.result as T;
    }
  }

  async getTokenSupply(mint: string): Promise<RpcTokenAmount> {
    const { value } = await this.request<{ value: RpcTokenAmount }>("getTokenSupply", [mint]);
    return value;
  }

  async getTokenLargestAccounts(mint: string): Promise<TokenLargestAccount[]> {
    const { value } = await this.request<{ value: TokenLargestAccount[] }>(
      "getTokenLargestAccounts",
      [mint],
    );
    return value;
  }

  async getAccountInfo(
    address: string,
    encoding: "base64" | "jsonParsed" = "base64",
  ): Promise<AccountInfoValue | null> {
    const { value } = await this.request<{ value: AccountInfoValue | null }>("getAccountInfo", [
      address,
      { encoding },
    ]);
    return value;
  }

  async getSignaturesForAddress(
    address: string,
    limit = 25,
    until?: string,
  ): Promise<SignatureInfo[]> {
    const config: { limit: number; until?: string } = { limit };
    if (until) config.until = until;
    return this.request<SignatureInfo[]>("getSignaturesForAddress", [address, config]);
  }

  async getTransaction(signature: string): Promise<ParsedTransaction | null> {
    // 1, not 0: live mainnet-beta now rejects every current transaction with
    // "Transaction version (1) is not supported by the requesting client"
    // when this was 0 (observed live — most/all recent transactions use
    // version 1, not legacy or v0). Bump again if a future version appears.
    return this.request<ParsedTransaction | null>("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 1 },
    ]);
  }
}

// The public RPC cluster is multiple nodes behind a load balancer: a
// signature returned by one node's getSignaturesForAddress can briefly 404 on
// getTransaction against another, and some historical transactions use a
// version this client doesn't request support for. Callers that scan many
// signatures (discovery, deployer history, bundled buys) should skip a
// failure like this rather than aborting the whole scan over one transaction.
export async function safeGetTransaction(
  rpc: Pick<SolanaRpcClient, "getTransaction">,
  signature: string,
): Promise<ParsedTransaction | null> {
  try {
    return await rpc.getTransaction(signature);
  } catch (err) {
    console.error(`getTransaction failed for ${signature}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
