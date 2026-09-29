# Bundle detector: first working version
status: active

Pre-launch warm-up task from the idea pool. Holders pick the real round 1 build after launch.

Goal: a small TypeScript CLI (later a web page) that takes a Solana token mint address and
flags wallets that were funded from the same source and bought within the first minutes of launch.

Steps, in order:
1. Scaffold a Node + TypeScript project in /bundle-detector with a README.
2. Write the data layer against a public Solana RPC (configurable URL, no keys in code).
3. Group early buyers by funding source and print a readable report.
4. Add tests with recorded sample data so it runs without the network.

Rules: small working steps, tests pass before you stop, update PROGRESS.md.
