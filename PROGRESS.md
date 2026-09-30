# Progress

## Session 1 — 2026-09-29

### Done
- Scaffolded `/rug-radar` as a Node 20 + TypeScript project (step 1 of TASK.md).
- `package.json` with scripts: `dev`, `start`, `build`, `test`, `typecheck`.
  Dev deps only: `typescript`, `tsx`, `@types/node`.
- `tsconfig.json` (strict, ES2022, NodeNext modules).
- `src/config.ts` loads `SOLANA_RPC_URL` and `PORT` from env with a public
  default RPC (`https://api.mainnet-beta.solana.com`), no keys anywhere.
- `src/config.test.ts` — offline unit test for config defaults/overrides.
- `src/types.ts` — shared `TokenLaunch` / `SignalResult` / `LaunchScore` types
  used by upcoming signal modules and the scorer.
- `src/server.ts` — minimal HTTP server serving `public/index.html` and a
  stub `GET /api/feed` returning `{ launches: [] }`.
- `public/index.html` — placeholder live feed page.
- `.env.example` — documents `SOLANA_RPC_URL` and `PORT`, no real values.
- `rug-radar/README.md` — install/run/test instructions and the signal plan.
- Added `dist/` to the root `.gitignore` (build output, not committed).

### Works
- `npm install`, `npm test` (2/2 passing, offline), `npm run typecheck`,
  `npm run build` all succeed in `/rug-radar`.
- `npm run dev` / `npm start` boot an HTTP server; manually verified
  `GET /` returns the HTML page and `GET /api/feed` returns `{"launches":[]}`.

### Next
- Step 2: build the data layer against the public Solana RPC (subscribe to
  new pump.fun mint/launch events, read account data) — URL from env only,
  no keys in code.
- Step 3: implement the four signals in `src/signals/`, each with its own
  module and offline tests using recorded sample data (no live calls in
  tests):
  1. Deployer history
  2. Bundled buys
  3. Holder concentration
  4. Liquidity and migration status
- Step 4: combine signals into a single score with reasons shown next to it.
- Step 5: wire the live feed page to the real data/score pipeline (currently
  a static stub).

## Session 2 — 2026-09-29

### Done
- Ran `npm install` in `/rug-radar` (node_modules wasn't present; needed for
  typecheck/test to run at all).
- Step 2: `src/rpc.ts` — thin client for the public Solana JSON-RPC API
  (`getTokenSupply`, `getTokenLargestAccounts`, `getAccountInfo`,
  `getSignaturesForAddress`, `getTransaction`). Takes the RPC URL from env
  via existing `config.ts`, no keys. `src/rpc.test.ts` mocks `fetch` with
  fixtures shaped like real RPC responses (10 tests: happy paths, null
  account, RPC-level error → `RpcError`, HTTP-level error).
- `src/knownAccounts.ts` — well-known, stable Solana program addresses
  (system/token/token-2022/associated-token programs) that signals should
  treat as non-holders. `src/knownAccounts.test.ts` sanity-checks the list.
- Step 3 (signal 3, Holder concentration), split into pure logic vs. data
  fetch so scoring is testable with zero network mocking:
  - `src/signals/holderConcentration.ts` — `scoreHolderConcentration()`:
    excludes given addresses (bonding curve + known program accounts),
    ranks the rest, sums the top 10, scores by share of total supply
    (>=50% → 90, 30-50% → 55, else a proportional score), reasons list the
    %. `src/signals/holderConcentration.test.ts` — 5 offline tests.
  - `src/data/holderConcentration.ts` — `fetchHolderConcentrationInput()`
    combines `getTokenSupply` + `getTokenLargestAccounts` into the signal's
    input. `src/data/holderConcentration.test.ts` — 1 test with a fake RPC
    object (no `fetch` mocking needed since it depends on `rpc.ts`'s typed
    interface, not the HTTP layer).
- Updated `rug-radar/README.md` to describe the data layer and the built
  signal; noted the other three signals as planned.

### Works
- `npm install`, `npm run typecheck`, `npm run build` all clean in
  `/rug-radar`.
- `npm test`: 18/18 passing, all offline (mocked `fetch` or fake RPC
  objects, no live network calls).

### Next
- Signal 1, Deployer history: needs the pump.fun program ID and how to spot
  a "token create" instruction + its outcome (migrated to Raydium /
  abandoned / still on the curve). Should confirm the exact program ID and
  instruction layout (e.g. via a web search for pump.fun's public program
  docs) before writing decoding logic, rather than guessing byte offsets.
- Signal 2, Bundled buys: build on `rpc.ts`'s `getSignaturesForAddress` +
  `getTransaction` (already implemented and tested) to find early buyers
  funded from a common source wallet.
- Signal 4, Liquidity and migration status: also needs pump.fun-specific
  knowledge (bonding curve reserves, migration completion flag) — same
  research step as signal 1 first.
- Step 4: a combiner that takes `SignalResult[]` → `LaunchScore` (weighted
  average or max-of-risk with reasons flattened) — can be built once at
  least 2 signals exist; holder-concentration alone isn't enough to be
  useful.
- Step 5: wire `GET /api/feed` (currently a stub in `src/server.ts`) to a
  real pipeline once signals + combiner exist.

## Session 3 — 2026-09-30

### Done
- Researched pump.fun on-chain layout (needed before signals 1 and 4 could
  be built): program ID `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`, the
  bonding curve PDA (seeds `["bonding-curve", mint]`), its Anchor account
  layout (8-byte discriminator, five little-endian u64 reserve fields, a
  `complete` bool, then the `creator` pubkey), and how migration works
  (permissionless `migrate` instruction, graduates to PumpSwap since March
  2025, previously Raydium). Source: the project's own public docs repo
  (`pump-fun/pump-public-docs`), linked from `rug-radar/README.md`.
- Fixed a pre-existing bug in `src/knownAccounts.ts`: `systemProgram` had 9
  extra `"1"` characters (41 chars instead of the correct 32-char address
  `11111111111111111111111111111111`). Confirmed the correct value against
  Solana Explorer and added a codec test that pins it (see below) so it
  can't silently regress. Holder-concentration exclusion lists using this
  constant were slightly wrong before; low real-world impact since the
  system program rarely appears as a token holder, but worth fixing since
  other signals may reuse this list.
- `src/base58.ts` — small dependency-free base58 (Bitcoin alphabet) codec
  (`base58Encode`/`base58Decode`), needed to turn the raw pubkey bytes in
  account data back into addresses. `src/base58.test.ts` — 3 tests: the
  all-zero-bytes vector against the (now-fixed) system program address,
  round-trips of 4 known real addresses, and rejection of invalid
  characters.
- `src/pumpfun.ts` — pump.fun program ID constant + `decodeBondingCurve()`,
  a pure offline decoder for the bonding curve account's raw base64 data
  (reserves, `complete` flag, `creator` address). `src/pumpfun.test.ts` — 3
  tests using hand-built fixture buffers (still-bonding, completed/migrated,
  and too-short data), no network involved.
- Step 3 (signal 4, Liquidity and migration status), same pure-logic /
  data-fetch split as signal 3:
  - `src/signals/liquidity.ts` — `scoreLiquidity()`: score 10 if the curve
    is complete (migrated to an AMM); otherwise scores by real SOL reserves
    still backing the curve (<=5 SOL → 80 "thin", <=15 SOL → 45
    "moderate", else 20 "deep, approaching graduation").
    `src/signals/liquidity.test.ts` — 5 offline tests incl. a boundary case.
  - `src/data/liquidity.ts` — `fetchLiquidityInput()` calls
    `rpc.getAccountInfo()` on the bonding curve address and decodes it via
    `pumpfun.ts`. `src/data/liquidity.test.ts` — 2 tests with a fake RPC
    object (found + not-found cases).
- Updated `rug-radar/README.md`: documents `base58.ts`, `pumpfun.ts`, and
  the now-built liquidity signal; notes the bonding curve address comes
  from the mint's "create" transaction rather than being PDA-derived here
  (no `@solana/web3.js` dependency added — PDA derivation needs ed25519
  curve-membership checks that aren't worth a new dependency yet).

### Works
- `npm run typecheck` and `npm run build` are clean in `/rug-radar`.
- `npm test`: 31/31 passing, all offline (mocked `fetch`, fake RPC objects,
  or hand-built fixture buffers — no live network calls anywhere in tests).

### Next
- Signal 1, Deployer history: now unblocked by this session's research.
  Plan: given a deployer wallet address, use `getSignaturesForAddress` +
  `getTransaction` (already in `rpc.ts`) to find past pump.fun `create`
  instructions from that wallet, collect the mints created, then check each
  mint's bonding curve (`decodeBondingCurve`, already built) for
  `complete`/still-active as a rough "how did it end" signal. Note: the
  `create` instruction's exact account order isn't nailed down yet from the
  docs read so far — confirm it (e.g. via a real transaction on a block
  explorer) before decoding instruction data, same caution as this
  session's account-layout work.
- Signal 2, Bundled buys: build on `getSignaturesForAddress` +
  `getTransaction` to find early buyers funded from a common source wallet
  — no new research needed, can start directly.
- Step 4: the combiner (`SignalResult[]` → `LaunchScore`) — now unblocked,
  two signals exist (holder-concentration, liquidity). Could be built next
  session even before signals 1/2 land, then extended as they arrive.
- Step 5: wire `GET /api/feed` to a real pipeline — still blocked on having
  a way to discover *new* launches (a "create" instruction watcher/poller),
  which hasn't been built yet and doesn't depend on which signals exist.

## Session 4 — 2026-09-30

### Done
- Ran `npm install` in `/rug-radar` (node_modules isn't persisted between
  sessions; needed before tests/typecheck could run).
- Step 4, the combiner: `src/scorer.ts` — `combineSignals(mint, signals)` →
  `LaunchScore`. Weighted average of each signal's 0-100 score (liquidity and
  holder-concentration weighted 2x as the most direct rug-pull indicators;
  unlisted/future signal names default to weight 1 so the combiner doesn't
  need touching every time a new signal lands), reasons passed through
  untouched per signal. `src/scorer.test.ts` — 5 offline tests.
- Signal 2, Bundled buys — pure scoring logic:
  `src/signals/bundledBuys.ts` — `scoreBundledBuys()`: takes early buys
  (buyer, funding-source wallet or null, seconds after launch), filters to
  a time window (default 5 min), groups by funding source, scores by what
  share of early buyers share one funding wallet (>=50% → 90, 30-50% → 55,
  else proportional; <2 buyers from one source isn't a "bundle").
  `src/signals/bundledBuys.test.ts` — 7 offline tests.
- Signal 2 — data fetch: before writing `src/data/bundledBuys.ts`, confirmed
  via the public Solana RPC docs (web search) that `getTransaction` with
  `encoding: jsonParsed` returns `transaction.message.accountKeys` as
  `{pubkey, signer, writable, source?}[]` (same order as `preBalances`/
  `postBalances`) — this was previously typed as `unknown` in `rpc.ts`
  since nothing needed it yet. Extended `ParsedTransaction` in `src/rpc.ts`
  with this shape (new `ParsedAccountKey` type) rather than guessing it.
  `src/data/bundledBuys.ts` — `fetchBundledBuysInput()`: pulls the bonding
  curve's recent signatures, keeps ones inside the early window, finds the
  buyer from each transaction's token-balance increase for the mint, then
  for each distinct buyer walks back to their earliest known transaction
  (within a signature-count limit) and reads which other account's SOL
  balance dropped the most — a heuristic "who funded this wallet" proxy,
  documented as such since a wallet's true first-ever tx could be older
  than the scanned window. Caches the funding lookup per buyer address so
  a wallet appearing in multiple early buys isn't re-fetched.
  `src/data/bundledBuys.test.ts` — 5 tests with fake RPC objects (no fetch
  mocking, matching the pattern in the other `data/*.test.ts` files).
- Updated `rug-radar/README.md`: documents the scorer and the now-built
  bundled-buys signal (both logic and data-fetch sides), notes the
  remaining "planned" status of deployer history.

### Works
- `npm run typecheck` and `npm run build` are clean in `/rug-radar`.
- `npm test`: 48/48 passing, all offline (mocked `fetch`, fake RPC objects,
  or hand-built fixture buffers — no live network calls anywhere in tests).
- Three of four signals now built (holder-concentration, liquidity,
  bundled-buys) plus the combiner; only deployer-history and the live feed
  wiring remain from the original TASK.md plan.

### Next
- Signal 1, Deployer history: still the one open signal. Needs the
  pump.fun "create" instruction's account order confirmed against a real
  transaction (e.g. via a block explorer) before decoding — same
  "confirm before decoding" caution used for bundled buys' `accountKeys`
  shape this session. Plan unchanged from session 3: given a deployer
  wallet, use `getSignaturesForAddress` + `getTransaction` (already in
  `rpc.ts`) to find past `create` instructions from that wallet, collect
  the mints, then check each mint's bonding curve (`decodeBondingCurve`,
  already built) for complete/still-active as a rough "how did it end"
  read.
- Bundled buys' funding-source heuristic (`findFundingSource` in
  `src/data/bundledBuys.ts`) only looks back `signatureLimit` (default 50)
  transactions per buyer wallet — fine for freshly-created buyer wallets
  (the common bundling case) but will miss the true funding source for an
  old, active wallet. Worth a real-RPC sanity check once step 5's live
  pipeline exists and there's real data to look at, rather than guessing
  further offline.
- Step 5: wire `GET /api/feed` to a real pipeline. Still needs a way to
  discover *new* launches (a "create" instruction watcher/poller) — this
  remains the last unblocked-but-not-started piece, independent of which
  signals exist. Once it exists, `src/server.ts`'s stub feed can call
  `fetchHolderConcentrationInput` / `fetchLiquidityInput` /
  `fetchBundledBuysInput` for each new launch, run them through
  `scoreHolderConcentration` / `scoreLiquidity` / `scoreBundledBuys`, and
  combine with `combineSignals` — all the pieces now exist except the
  discovery step and the page rendering the real feed (currently a static
  placeholder).

## Session 5 — 2026-09-30

### Done
- Ran `npm install` in `/rug-radar` (node_modules isn't persisted between
  sessions).
- Signal 1, Deployer history — the last open signal — is now built, unblocking
  step 3 entirely (all four signals exist):
  - Research first: fetched the pump.fun program's public Anchor IDL
    (`idl/pump.json` in `pump-fun/pump-public-docs` on GitHub) to confirm the
    `create` instruction's exact account order and discriminator, rather than
    guessing from the docs prose (which only listed argument names, not
    account order). Confirmed `create` discriminator
    `[24,30,200,40,5,28,7,119]` with accounts `mint` (index 0),
    `bonding_curve` (index 2), `user`/deployer (index 7); also found
    `create_v2` (spl-token-2022 coins) with discriminator
    `[214,144,76,236,95,139,49,180]` and `user` at index 4 instead (fewer
    accounts before it — no metadata/mpl_token_metadata accounts in that
    variant). Both variants expose `bonding_curve` directly as an instruction
    account, so no PDA re-derivation is needed to find it.
  - `src/pumpfun.ts` — added `decodeCreateInstruction(dataBase58, accounts)`:
    decodes the instruction's base58 data, matches its first 8 bytes against
    the `create`/`create_v2` discriminators, and pulls `mint`/`bondingCurve`/
    `user` out of the accounts array at the right index for whichever variant
    matched (or returns `null` if neither matches, or accounts are short).
    Added 4 offline tests to `src/pumpfun.test.ts` (create, create_v2,
    unrelated discriminator, too-few-accounts).
  - `src/rpc.ts` — `ParsedTransaction.transaction.message` gained an optional
    `instructions` field (`MessageInstruction[]`), typed as a union of
    `PartiallyDecodedInstruction` (unrecognized programs like pump.fun:
    `programId` + raw `accounts` + base58 `data`) and `KnownProgramInstruction`
    (recognized programs, pre-parsed by the RPC). This was previously
    unmodeled since nothing needed instruction-level data yet — same
    "extend the type when something needs it, confirm against real RPC docs"
    approach used for `ParsedAccountKey` in session 4.
  - `src/signals/deployerHistory.ts` — `scoreDeployerHistory()`: takes the
    deployer's prior launches (mint + whether its curve migrated), scores by
    the share that never migrated (>=80% → 90, 50-80% → 55, else
    proportional). Fewer than 3 prior launches is flagged as too thin a
    sample and capped at 40 regardless of share, so e.g. one bad token isn't
    scored the same as a proven serial-abandoner pattern.
    `src/signals/deployerHistory.test.ts` — 7 offline tests incl. the thin-
    history cap and a boundary case.
  - `src/data/deployerHistory.ts` — `fetchDeployerHistoryInput()`: pages
    through the deployer's signature history, decodes any pump.fun
    create/create_v2 instruction where this wallet is the `user`, skips ones
    that created the current mint (not "prior" history) or a mint already
    seen, and for each prior mint reads its bonding curve account to check
    `complete`. `src/data/deployerHistory.test.ts` — 5 tests with fake RPC
    objects (no fetch mocking, same pattern as the other `data/*.test.ts`
    files): happy path with a mix of migrated/not, excludes current mint,
    ignores non-create transactions, skips failed transactions (no wasted
    `getTransaction` call), and ignores a create instruction from a
    different deployer.
- Updated `rug-radar/README.md`: signal 1 moved from "planned" to "built",
  `pumpfun.ts`'s description now covers `decodeCreateInstruction` and points
  at the IDL (not just the docs prose) as the source, and the top status
  line now says all four signals are built.

### Works
- `npm run typecheck` and `npm run build` are clean in `/rug-radar`.
- `npm test`: 64/64 passing, all offline (mocked `fetch`, fake RPC objects,
  or hand-built fixture buffers/instructions — no live network calls
  anywhere in tests).
- All four signals from TASK.md are now built: deployer history, bundled
  buys, holder concentration, liquidity/migration — plus the combiner.

### Next
- Step 5 is the only remaining piece: wire `GET /api/feed` to a real
  pipeline. Still needs a launch-discovery mechanism (poll
  `getSignaturesForAddress` on the pump.fun program ID itself, or on a
  known high-traffic account, for new `create`/`create_v2` instructions —
  the same decoding already built in `pumpfun.ts` and
  `data/deployerHistory.ts` works for this, just pointed at the program ID
  instead of one deployer). Once discovery exists, `src/server.ts`'s stub
  feed can call all four `fetch*Input` functions per new launch, score with
  `score*`, combine with `combineSignals`, and the page (currently a static
  placeholder in `public/index.html`) needs to poll `/api/feed` and render
  the list.
- `fetchDeployerHistoryInput`'s `signatureLimit` (default 100) bounds how far
  back it looks for a deployer's prior launches — same "fine for typical
  cases, will under-count a very prolific wallet" caveat as bundled buys'
  funding-source lookback (session 4). Worth a real-RPC sanity check once
  step 5 exists and there's live data to look at.
- No live-RPC smoke test has been run yet against any of the four signals'
  data-fetch functions (holder concentration, liquidity, bundled buys,
  deployer history) — all testing so far is offline against fixtures/fake
  RPC objects. Once step 5's discovery loop exists, running the full
  pipeline against one real, recent launch would be a good sanity check
  that the account layouts and instruction decoding hold up against live
  data, not just hand-built fixtures.
