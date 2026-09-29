#!/usr/bin/env python3
"""Runs one agent session and publishes what it does.

What it does, in order:
  1. Checks today's spend against DAILY_BUDGET_USD. Stops if the cap is hit.
  2. Marks the agent as building on the `status` branch (live.json).
  3. Runs Claude Code headless on TASK.md, streaming every step into the feed.
  4. Writes a full session log to logs/, commits the agent's work to main.
  5. Adds the session (real cost, steps, log link) to live.json and marks idle.

The website reads live.json from the status branch. Nothing is typed by hand.
"""
import base64, json, os, re, subprocess, sys, time, urllib.error, urllib.request
from datetime import datetime, timedelta, timezone

REPO = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GITHUB_TOKEN"]
BRANCH = os.environ.get("STATUS_BRANCH", "status")
MAX_TURNS = int(os.environ.get("MAX_TURNS", "40"))
DAILY = float(os.environ.get("DAILY_BUDGET_USD", "5"))
EVERY_H = float(os.environ.get("RUN_EVERY_HOURS", "6"))
MODEL = os.environ.get("AGENT_MODEL", "")
BILLING = os.environ.get("BILLING", "api")  # "subscription" when running on a Claude Pro/Max token
MAX_PER_DAY = int(os.environ.get("MAX_SESSIONS_PER_DAY", "2"))
FLUSH_EVERY = 25  # seconds between live pushes while running
API = os.environ.get("GITHUB_API_URL", "https://api.github.com")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECRET = re.compile(r"(sk-ant-[\w-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[\w]{20,}|AKIA[0-9A-Z]{16}|[1-9A-HJ-NP-Za-km-z]{80,})")

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def clean(s, n=180):
    s = SECRET.sub("[redacted]", str(s or "")).replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"

def rel(p):
    p = str(p or "")
    return os.path.relpath(p, ROOT) if p.startswith(ROOT) else p

# ---------- GitHub API ----------
def gh(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "buildvote-agent")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise

def ensure_branch():
    if gh("GET", f"/repos/{REPO}/branches/{BRANCH}"):
        return
    default = gh("GET", f"/repos/{REPO}")["default_branch"]
    sha = gh("GET", f"/repos/{REPO}/git/ref/heads/{default}")["object"]["sha"]
    gh("POST", f"/repos/{REPO}/git/refs", {"ref": f"refs/heads/{BRANCH}", "sha": sha})

STATE = {"sha": None}

def load():
    r = gh("GET", f"/repos/{REPO}/contents/live.json?ref={BRANCH}")
    if not r:
        return {"updated_at": None, "agent": {"status": "standby", "task": ""}, "round": {"number": None, "status": "", "title": ""},
                "holders": {"count": None, "as_of": None, "source": ""}, "queue": [], "sessions": [], "ledger": [], "feed": []}
    STATE["sha"] = r["sha"]
    return json.loads(base64.b64decode(r["content"]).decode())

def save(d, msg):
    d["updated_at"] = now()
    d["billing"] = BILLING
    if BILLING == "api":
        d["daily_budget_usd"] = DAILY
    else:
        d.pop("daily_budget_usd", None)
        d["max_sessions_per_day"] = MAX_PER_DAY
    body = {"message": msg, "branch": BRANCH, "content": base64.b64encode(json.dumps(d, indent=2).encode()).decode()}
    for attempt in range(3):
        if STATE["sha"]:
            body["sha"] = STATE["sha"]
        try:
            r = gh("PUT", f"/repos/{REPO}/contents/live.json", body)
            STATE["sha"] = r["content"]["sha"]
            return
        except urllib.error.HTTPError as e:
            if e.code in (409, 422) and attempt < 2:
                cur = gh("GET", f"/repos/{REPO}/contents/live.json?ref={BRANCH}")
                STATE["sha"] = cur["sha"] if cur else None
                continue
            print("status push failed:", e, file=sys.stderr)
            return

# ---------- feed ----------
def feed_add(d, kind, text):
    d.setdefault("feed", []).append({"t": now(), "kind": kind, "text": clean(text)})
    d["feed"] = d["feed"][-80:]

def events(ev):
    if ev.get("type") != "assistant":
        return
    for b in (ev.get("message") or {}).get("content") or []:
        if b.get("type") == "text" and (b.get("text") or "").strip():
            yield "think", b["text"].strip().split("\n")[0]
        elif b.get("type") == "tool_use":
            n, i = b.get("name", ""), b.get("input") or {}
            if n == "Read":
                yield "read", rel(i.get("file_path"))
            elif n in ("Edit", "MultiEdit", "Write", "NotebookEdit"):
                yield "edit", rel(i.get("file_path") or i.get("notebook_path"))
            elif n == "Bash":
                yield "run", i.get("command", "")
            elif n in ("Grep", "Glob"):
                yield "search", i.get("pattern", "")
            elif n == "TodoWrite":
                todos = i.get("todos") or []
                doing = [t.get("content") for t in todos if t.get("status") == "in_progress"]
                yield "plan", ("Now: " + doing[0]) if doing else f"Plan updated ({len(todos)} items)"
            elif n in ("WebFetch", "WebSearch"):
                yield "search", i.get("url") or i.get("query") or n
            else:
                yield "tool", n

def task_title():
    p = os.path.join(ROOT, "TASK.md")
    if not os.path.exists(p):
        return None
    txt = open(p, encoding="utf-8").read()
    if re.search(r"(?im)^status:\s*(none|paused)\s*$", txt):
        return None
    for line in txt.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return "Current task"

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)

# ---------- main ----------
def main():
    ensure_branch()
    d = load()
    sessions = d.setdefault("sessions", [])
    n = len(sessions) + 1
    today = datetime.now(timezone.utc).date().isoformat()
    spent = sum(s.get("cost_usd") or 0 for s in sessions if str(s.get("date", "")).startswith(today))
    d["schedule"] = {"every_hours": EVERY_H, "next_run": (datetime.now(timezone.utc) + timedelta(hours=EVERY_H)).replace(microsecond=0).isoformat().replace("+00:00", "Z")}

    title = task_title()
    if not title:
        d["agent"] = {"status": "paused", "task": "No active task in TASK.md."}
        save(d, "agent: paused, no task"); return
    ran_today = sum(1 for s in sessions if str(s.get("date", "")).startswith(today))
    if BILLING != "api" and ran_today >= MAX_PER_DAY:
        d["agent"] = {"status": "idle", "task": f"Done for today ({MAX_PER_DAY} sessions). Resumes tomorrow."}
        save(d, "agent: daily session limit"); return
    if BILLING == "api" and spent >= DAILY:
        d["agent"] = {"status": "idle", "task": f"Daily budget of ${DAILY:.2f} reached. Resumes tomorrow."}
        feed_add(d, "info", f"Skipped session: ${spent:.2f} already spent today (cap ${DAILY:.2f}).")
        save(d, "agent: daily cap reached"); return

    started = now()
    d["agent"] = {"status": "building", "task": title, "session": n, "started_at": started, "turns": 0}
    feed_add(d, "start", f"Session {n} started: {title}")
    save(d, f"agent: session {n} started")

    prompt = ("You are the Build.vote agent. Work on the task in TASK.md for this session. "
              "Make real, working progress in small steps. Read PROGRESS.md first, and before you finish, "
              "update PROGRESS.md with what you did, what works, and what is next. "
              "Do not run git commit or git push; the runner does that. Never print, read or write secrets or .env files.")
    cmd = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose", "--max-turns", str(MAX_TURNS), "--dangerously-skip-permissions"]
    if MODEL:
        cmd += ["--model", MODEL]

    log, result, steps, last_flush = [], {}, 0, time.time()
    proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except ValueError:
            log.append(("info", clean(line, 400))); continue
        if ev.get("type") == "result":
            result = ev; continue
        for kind, text in events(ev):
            steps += 1 if kind != "think" else 0
            feed_add(d, kind, text)
            log.append((kind, clean(text, 400)))
        if time.time() - last_flush > FLUSH_EVERY:
            d["agent"]["turns"] = steps
            save(d, f"agent: session {n} progress")
            last_flush = time.time()
    proc.wait()

    cost = float(result.get("total_cost_usd") or 0)
    ok = proc.returncode == 0 and not result.get("is_error")
    summary = clean(result.get("result") or "", 600)

    # session log, committed with the work
    os.makedirs(os.path.join(ROOT, "logs"), exist_ok=True)
    fname = f"logs/session-{n:04d}.md"
    with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as f:
        f.write(f"# Session {n}: {title}\n\n")
        f.write(f"- Started: {started}\n- Ended: {now()}\n- Steps: {steps}\n- Model turns: {result.get('num_turns', '?')}\n")
        f.write((f"- API cost: ${cost:.4f}\n" if BILLING == "api" else f"- Billing: Claude subscription (API value ${cost:.4f}, not billed)\n") + f"- Outcome: {'ok' if ok else 'error'}\n\n")
        if summary:
            f.write(f"## Summary\n\n{summary}\n\n")
        f.write("## Steps\n\n")
        for kind, text in log:
            f.write(f"- `{kind}` {text}\n")
    git("add", "-A")
    git("reset", "-q", "--", ".env", ".env.local")
    c = git("commit", "-m", f"Session {n}: {title}")
    pushed = git("push", "origin", "HEAD").returncode == 0 if c.returncode == 0 else False

    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    row = {"date": started, "task": title, "calls": result.get("num_turns"), "log_url": f"{server}/{REPO}/blob/main/{fname}", "billing": BILLING}
    if BILLING == "api":
        row["cost_usd"] = round(cost, 4)
    else:
        row["cost_usd"] = 0          # nothing billed: runs on the Claude subscription
        row["api_value_usd"] = round(cost, 4)  # what the same usage would cost on the API
    sessions.append(row)
    feed_add(d, "done" if ok else "error",
             f"Session {n} {'finished' if ok else 'ended with an error'} · {steps} steps · "
             + (f"${cost:.2f}" if BILLING == "api" else f"covered by Claude subscription (${cost:.2f} API value)")
             + ("" if pushed else " · push failed"))
    d["agent"] = {"status": "idle", "task": f"Last session: {title}", "session": n, "turns": steps}
    save(d, f"agent: session {n} done")
    if not ok:
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        try:
            d = load(); feed_add(d, "error", f"Runner error: {e}"); d["agent"] = {"status": "paused", "task": "Runner error, see Actions log."}; save(d, "agent: runner error")
        finally:
            raise
