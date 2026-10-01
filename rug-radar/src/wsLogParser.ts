// Pure parsing of a transaction's log lines to detect a pump.fun create
// instruction, confirmed against real log output captured live from the
// public websocket RPC (see rug-radar/README.md). Used by wsDiscovery.ts to
// decide which logsSubscribe notifications are worth a getTransaction call,
// instead of fetching every transaction that merely mentions the program.
//
// Anchor logs "Program log: Instruction: <Name>" while execution is inside
// the invoking program's own stack frame, so a plain substring/regex match
// on the whole log array is not enough — a different program's instruction
// can share a name fragment (e.g. "Instruction: CreateTokenAccount" from an
// unrelated program contains "Create"). This tracks the invoke stack via the
// "Program X invoke [N]" / "Program X success"/"failed" lines Solana always
// emits, and only matches while the top of that stack is the given program.

export type CreateVariant = "create" | "create_v2";

const INVOKE_RE = /^Program (\S+) invoke \[\d+\]$/;
const RETURN_RE = /^Program \S+ (success|failed)/;

export function detectCreateInstruction(programId: string, logs: string[]): CreateVariant | null {
  const stack: string[] = [];
  let found: CreateVariant | null = null;

  for (const line of logs) {
    const invoke = INVOKE_RE.exec(line);
    if (invoke) {
      stack.push(invoke[1]);
      continue;
    }
    if (RETURN_RE.test(line)) {
      stack.pop();
      continue;
    }
    if (stack[stack.length - 1] !== programId) continue;

    if (line === "Program log: Instruction: Create") found = "create";
    else if (line === "Program log: Instruction: CreateV2") found = "create_v2";
  }

  return found;
}
