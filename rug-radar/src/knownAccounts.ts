// Well-known, stable Solana program addresses. These are program accounts,
// never real holders, so signals exclude them when looking at who holds a token.

export const KNOWN_PROGRAM_ACCOUNTS = {
  systemProgram: "11111111111111111111111111111111111111111",
  tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  token2022Program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  associatedTokenProgram: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
} as const;

export const KNOWN_PROGRAM_ACCOUNT_ADDRESSES: string[] = Object.values(KNOWN_PROGRAM_ACCOUNTS);
