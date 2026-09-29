# buildvote-agent

The public workspace of the Build.vote agent. Holders vote on what it builds; it works here, in the open.

- `TASK.md`: what the agent is working on. Change it to change the task. Add `status: paused` to stop it.
- `PROGRESS.md`: the agent's own notes, updated every session.
- `logs/`: one file per session with every step and its real API cost.
- `status` branch: `live.json`, which the website's Live build page reads.

## Setup (once)

1. Create a **public** repo named `buildvote-agent` and push these files.
2. On your computer run `claude setup-token` (Claude Code, logged in with your Pro account) and copy the token.
   Repo Settings → Secrets and variables → Actions → New secret: `CLAUDE_CODE_OAUTH_TOKEN`, paste it.
3. Repo Settings → Actions → General → Workflow permissions → **Read and write**.
4. Actions tab → `agent` → **Run workflow** to start the first session.

It then runs every 12 hours, at most 2 sessions a day, 25 steps each, on your Claude subscription (no API bill).
These sessions share your Pro usage limits, so heavy runs can slow your own Claude use for a few hours.
