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

export interface ParsedTransaction {
  slot: number;
  blockTime: number | null;
  transaction: {
    signatures: string[];
    message: unknown;
  };
  meta: ParsedTransactionMeta | null;
}

interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

export class SolanaRpcClient {
  private nextId = 1;

  constructor(
    private readonly url: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request<T>(method: string, params: unknown[]): Promise<T> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
    });

    if (!res.ok) {
      throw new Error(`RPC HTTP error ${res.status} for ${method}`);
    }

    const body = (await res.json()) as RpcResponse<T>;
    if (body.error) {
      throw new RpcError(body.error.message, body.error.code);
    }
    return body.result as T;
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

  async getSignaturesForAddress(address: string, limit = 25): Promise<SignatureInfo[]> {
    return this.request<SignatureInfo[]>("getSignaturesForAddress", [address, { limit }]);
  }

  async getTransaction(signature: string): Promise<ParsedTransaction | null> {
    return this.request<ParsedTransaction | null>("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
  }
}
