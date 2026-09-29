import type { SolanaRpcClient } from "../rpc.js";
import type { HolderConcentrationInput } from "../signals/holderConcentration.js";

type SupplyAndLargestAccounts = Pick<SolanaRpcClient, "getTokenSupply" | "getTokenLargestAccounts">;

export async function fetchHolderConcentrationInput(
  rpc: SupplyAndLargestAccounts,
  mint: string,
  excludedAddresses: string[],
): Promise<HolderConcentrationInput> {
  const [supply, largest] = await Promise.all([
    rpc.getTokenSupply(mint),
    rpc.getTokenLargestAccounts(mint),
  ]);

  return {
    totalSupply: BigInt(supply.amount),
    holders: largest.map((h) => ({ address: h.address, amount: BigInt(h.amount) })),
    excludedAddresses,
  };
}
