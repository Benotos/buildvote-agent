import type { SolanaRpcClient } from "../rpc.js";
import { decodeBondingCurve } from "../pumpfun.js";
import type { LiquidityInput } from "../signals/liquidity.js";

type AccountInfoFetcher = Pick<SolanaRpcClient, "getAccountInfo">;

export async function fetchLiquidityInput(
  rpc: AccountInfoFetcher,
  bondingCurveAddress: string,
): Promise<LiquidityInput> {
  const account = await rpc.getAccountInfo(bondingCurveAddress, "base64");
  if (!account) {
    throw new Error(`bonding curve account not found: ${bondingCurveAddress}`);
  }

  const [base64Data] = account.data as [string, string];
  const curve = decodeBondingCurve(base64Data);
  return {
    complete: curve.complete,
    realSolReserves: curve.realSolReserves,
  };
}
