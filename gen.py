import os
OUT = os.path.dirname(os.path.abspath(__file__))  # writes next to this file

STAMP = '<svg class="stamp {cls}" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect x="4" y="4" width="32" height="32" rx="5"/><path class="x x1" pathLength="1" d="M10.5 11c5 5.2 10.6 10.8 19 19.5"/><path class="x x2" pathLength="1" d="M30 10.5c-6.2 6-12 12.2-19.2 19.8"/></svg>'
CHECK = '<svg class="stamp stamp--check" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect x="4" y="4" width="32" height="32" rx="5"/><path class="x x1" pathLength="1" d="M11.5 20.5l6 6.5 11.5-13.5"/></svg>'
BOX_X = '<svg viewBox="0 0 32 32" focusable="false"><path class="x x1" pathLength="1" d="M7 8c4.2 4.4 9 9.2 18 17.4"/><path class="x x2" pathLength="1" d="M25 7c-5 5.8-10.2 11-17.2 18.2"/></svg>'

FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='9' fill='%23070c1a'/%3E%3Crect x='7' y='7' width='26' height='26' rx='4' fill='none' stroke='%23eaf0ff' stroke-width='2.6'/%3E%3Cpath d='M12.5 12.5l15 15M27.5 12.5l-15 15' stroke='%23ff5a4d' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E"

# ---- Edit these, then run: python3 gen.py ----
NAME = "Build.vote"        # project name, swapped in everywhere
HANDLE = "BuildDotVote"    # X handle without @
CA = ""                    # contract address; leave empty until launch
BUY_URL = ""               # e.g. the pump.fun page; leave empty until launch
AGENT_REPO = ""            # the AGENT's public repo, e.g. https://github.com/Benotos/buildvote-agent (not the website repo)
LIVE_JSON = ""             # leave empty: read from the agent repo's status branch. Set a path only to override.
_m = __import__("re").match(r"https://github\.com/([^/]+)/([^/#?]+)", AGENT_REPO)
if not LIVE_JSON:
    LIVE_JSON = f"https://raw.githubusercontent.com/{_m.group(1)}/{_m.group(2)}/status/live.json" if _m else "live.json"
GITHUB_URL = AGENT_REPO
# ----------------------------------------------

AC = ' aria-current="page"'
PAGES = [("index.html", "Home"), ("live.html", "Live build"), ("roadmap.html", "Roadmap"), ("tokenomics.html", "Tokenomics"), ("whitepaper.html", "Whitepaper")]

RISK = "Build.vote is an experimental project. Tokens are volatile and you can lose everything you put in. Nothing here is financial, investment or tax advice, and no return is promised."

def head(title, desc):
    return f'''<!doctype html>
<html lang="en" data-brand="Build.vote">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#070c1a">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Build.vote">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta name="twitter:card" content="summary">
<meta name="twitter:site" content="@BuildDotVote">
<link rel="icon" type="image/svg+xml" href="{FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&amp;family=Instrument+Sans:wght@400..700&amp;display=swap">
<link rel="stylesheet" href="style.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js" defer></script>
<script src="app.js" defer></script>
</head>'''

def nav(current):
    links = "\n".join(
        f'      <a href="{f}"{AC if f == current else ""}>{n}</a>' for f, n in PAGES)
    return f'''<body>
<a class="skip" href="#main">Skip to content</a>
<div class="preloader" aria-hidden="true"><div class="preloader__mark"><svg class="stamp" viewBox="0 0 40 40"><rect x="4" y="4" width="32" height="32" rx="5"/><path class="x x1" pathLength="1" d="M10.5 11c5 5.2 10.6 10.8 19 19.5"/><path class="x x2" pathLength="1" d="M30 10.5c-6.2 6-12 12.2-19.2 19.8"/></svg><span>Build.vote</span></div></div>
<script>try{{if(sessionStorage.getItem("bv-seen")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("no-preload");sessionStorage.setItem("bv-seen","1")}}catch(e){{document.documentElement.classList.add("no-preload")}}</script>
<canvas id="scene" aria-hidden="true"></canvas>
<div class="grain" aria-hidden="true"></div>
<div class="veil" aria-hidden="true"></div>
<div class="site">
<header class="nav">
  <div class="wrap nav__inner">
    <a class="brand" href="index.html">{STAMP.format(cls="stamp--static")}<span>Build.vote</span></a>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-links"><span class="sr-only">Menu</span><span class="bars" aria-hidden="true"></span></button>
    <nav id="nav-links" class="nav__links" aria-label="Main">
{links}
      <a class="nav__x" href="https://x.com/BuildDotVote" target="_blank" rel="noopener noreferrer">@BuildDotVote<span class="sr-only"> on X (opens in a new tab)</span></a>
    </nav>
  </div>
</header>
'''

def footer(current):
    GH_FOOT = f'\n        <a href="{GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>' if GITHUB_URL else ''
    links = "\n".join(
        f'        <a href="{f}"{AC if f == current else ""}>{n}</a>' for f, n in PAGES)
    return f'''
<footer class="footer">
  <div class="wrap">
    <p class="footer__risk">{RISK}</p>
    <div class="footer__row">
      <a class="brand" href="index.html">{STAMP.format(cls="stamp--static")}<span>Build.vote</span></a>
      <nav class="footer__links" aria-label="Footer">
{links}
        <a href="https://x.com/BuildDotVote" target="_blank" rel="noopener noreferrer">X</a>{GH_FOOT}
      </nav>
    </div>
  </div>
</footer>
</div>
</body>
</html>
'''

def opt(value, desc):
    return f'''        <label class="opt">
          <input type="radio" name="choice" value="{value}">
          <span class="box" aria-hidden="true">{BOX_X}</span>
          <span class="opt__text"><span class="opt__name">{value}</span><span class="opt__desc">{desc}</span></span>
        </label>'''

def rule(title, text):
    return f'''      <li>{CHECK}<div><h3>{title}</h3><p>{text}</p></div></li>'''

BUY = (f'<a class="btn btn--primary" href="{BUY_URL}" target="_blank" rel="noopener noreferrer">Buy on pump.fun</a>' if BUY_URL
       else '<button type="button" class="btn btn--primary" disabled>Buy opens at launch</button>')

BUILD_LIST = [
  ("Wallet roast", "Paste a wallet, get a funny breakdown of its trading history."),
  ("Bundle detector", "Flag wallets funded from one source that bought together at launch."),
  ("Token graveyard", "Dead tokens with their peak market cap and cause of death."),
  ("Solana payment toolkit", "Payment links and simple invoices paid in SOL or USDC, with a receipt page."),
  ("Dev wallet tracker", "Follow a token's deployer wallet and see when it moves or sells."),
  ("Fee claim tracker", "See when creator fees on a token were claimed and where they went."),
]
BUILD_ITEMS = "\n".join(f'      <li><span class="builds__n">{i+1:02d}</span><div><h3>{t}</h3><p>{d}</p></div></li>' for i,(t,d) in enumerate(BUILD_LIST))
GH_LINE = (f'Submit work on <a href="{GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>.' if GITHUB_URL
           else 'The public repo link gets posted here and on X when it opens.')
FAQ_ITEMS = [
  ("Is the token live?", "Not yet. The contract address appears on this site and on X at launch. Anything posted anywhere else is not us."),
  ("What does the agent build?", "Crypto tools on Solana, one per round. The idea pool above is where options come from, and holders pick."),
  ("How does voting work?", "When a round opens, balances are snapshotted. You sign a message naming your choice. Weight follows balance up to a cap, and the full list of signatures is published so anyone can recount."),
  ("Can whales take over a vote?", "Each wallet's weight is capped at a set share of the round's total vote. The draft cap is 5%. A cap does not stop someone splitting tokens across wallets, so we publish every signature for anyone to check."),
  ("Where do creator fees go?", "API costs, buybacks, contributor rewards and a reserve. The draft split is on the tokenomics page. Every claim and spend links to its record."),
  ("Will you ever ask me to sign a transaction to vote?", "No. Voting is a signed message only. If something asks for a transaction, an approval or your seed phrase, it is a scam."),
]
FAQ = """
  <section class="section wrap" aria-labelledby="faq-title">
    <div class="section__head"><h2 id="faq-title" data-split>Questions</h2></div>
    <div class="faq">
""" + "\n".join(f'      <details class="faq__item"><summary>{q}</summary><p>{a}</p></details>' for q,a in FAQ_ITEMS) + """
    </div>
  </section>
"""


MARQUEE = "".join(f'<span class="marquee__item"><svg viewBox="0 0 40 40"><rect x="4" y="4" width="32" height="32" rx="5"/><path d="{"M11.5 20.5l6 6.5 11.5-13.5" if i%2 else "M11 11l18 18M29 11L11 29"}"/></svg>{t}</span>' for i,t in enumerate(["Holders vote","Agent builds live","Signatures only","Every spend on the record","Public fee rules","Whale cap on every round","Contributors get paid","Real data only"]))

SVG_STEPS = [
 # snapshot
 '''<svg viewBox="0 0 240 180" class="ill"><path class="ill__frame" d="M20 50V20h30M190 20h30v30M220 130v30h-30M50 160H20v-30"/><rect class="ill__bar b1" x="60" y="95" width="18" height="45" rx="3"/><rect class="ill__bar b2" x="90" y="70" width="18" height="70" rx="3"/><rect class="ill__bar b3" x="120" y="110" width="18" height="30" rx="3"/><rect class="ill__bar b4" x="150" y="55" width="18" height="85" rx="3"/><circle class="ill__flash" cx="200" cy="38" r="6"/></svg>''',
 # vote
 '''<svg viewBox="0 0 240 180" class="ill"><rect class="ill__frame" x="40" y="22" width="160" height="136" rx="10"/><path class="ill__line" d="M62 52h96M62 72h116M62 92h70"/><rect class="ill__box" x="62" y="112" width="26" height="26" rx="4"/><path class="ill__x" pathLength="1" d="M67 117l16 16M83 117l-16 16"/><path class="ill__sig" pathLength="1" d="M104 132c8-14 14-16 16-6s6 10 12-2 10-10 12 0 8 6 18-4"/></svg>''',
 # build
 '''<svg viewBox="0 0 240 180" class="ill"><rect class="ill__frame" x="20" y="22" width="200" height="136" rx="10"/><path class="ill__line" d="M20 44h200"/><circle class="ill__dot" cx="34" cy="33" r="3"/><circle class="ill__dot" cx="46" cy="33" r="3"/><path class="ill__code c1" d="M38 66h60M38 84h96M54 102h72M54 120h40M38 138h84"/><rect class="ill__caret" x="126" y="132" width="3" height="12"/><path class="ill__graph" d="M168 66v76"/><circle class="ill__commit" cx="168" cy="72" r="5"/><circle class="ill__commit" cx="168" cy="104" r="5"/><circle class="ill__commit k3" cx="168" cy="136" r="5"/></svg>''',
 # ship
 '''<svg viewBox="0 0 240 180" class="ill"><path class="ill__frame" d="M70 80l50-24 50 24v56l-50 24-50-24z"/><path class="ill__line" d="M70 80l50 24 50-24M120 104v56"/><path class="ill__check" pathLength="1" d="M100 128l14 14 26-30"/><path class="ill__up" d="M120 44V14M108 26l12-12 12 12"/></svg>''',
]
STEP_TEXT = [
 ("Snapshot","When a round opens, holder balances are recorded at one fixed point. Buying after the snapshot does not change that round."),
 ("Vote","Holders sign a message for one option. Weight follows balance, capped so no single wallet can decide a round. No transaction, no gas."),
 ("Build","The agent builds the winner in a public repo. Commits and API spend post to the live build page as they happen."),
 ("Ship","The result goes live with a plain write up of what worked, what broke and what it cost. Then the next round opens."),
]
PANELS = "\n".join(f'''        <li class="hs__panel card" data-spot><span class="hs__n">0{i+1}</span><div class="hs__art">{SVG_STEPS[i]}</div><h3>{t}</h3><p>{d}</p></li>''' for i,(t,d) in enumerate(STEP_TEXT))

FLOW_ROWS = [("API costs",40,"#7fa2ff","Model calls and tools the agent uses"),("Buybacks",30,"#ff5a4d","Market buys, each linked to its transaction"),("Contributor rewards",20,"#b9caff","Accepted issues, bug reports, merged PRs"),("Reserve",10,"#9aa6c4","Covers months when fees fall short")]
def flow_svg():
    top=40; H=320; y=top; parts=[]; cur=14
    for i,(n,p,c,_) in enumerate(FLOW_ROWS):
        h=H*p/100; ys=y+h/2; y+=h; w=h*0.9; nh=max(w,48); yd=cur+nh/2; cur+=nh+22
        d=f"M200 {ys:.1f} C 470 {ys:.1f}, 500 {yd:.1f}, 744 {yd:.1f}"
        parts.append(f'<path class="flow__band" d="{d}" stroke="{c}" stroke-width="{w:.1f}"/><path class="flow__pulse" style="--d:{i*0.35}s" d="{d}" stroke="{c}"/>')
        parts.append(f'<g class="flow__node" style="--d:{0.2+i*0.1}s"><rect x="744" y="{yd-nh/2:.1f}" width="250" height="{nh:.1f}" rx="10" stroke="{c}"/><text x="764" y="{yd-3:.1f}" class="flow__name">{n}</text><text x="764" y="{yd+17:.1f}" class="flow__pct">{p}% draft</text></g>')
    src=f'<g class="flow__src"><rect x="20" y="{top}" width="180" height="{H}" rx="14"/><text x="42" y="{top+H/2-6}" class="flow__name">Creator fees</text><text x="42" y="{top+H/2+16}" class="flow__pct">from token trades</text></g>'
    return f'<svg class="flow__svg" viewBox="0 0 1000 400" role="img" aria-label="Draft split of creator fees: API costs 40 percent, buybacks 30 percent, contributor rewards 20 percent, reserve 10 percent.">'+"".join(parts)+src+'</svg>'
FLOW = f"""  <section class="section wrap flow" aria-labelledby="flow-title">
    <div class="section__head">
      <h2 id="flow-title" data-split>Where the fees go</h2>
      <p>Creator fees fund the work. This is the draft split, finalized and published before launch. Every claim and spend shows up on the <a href="live.html">live build</a> page with its transaction.</p>
    </div>
    <div class="card flow__card" data-spot>
      {flow_svg()}
      <ul class="flow__list">
""" + "\n".join(f'        <li style="--c:{c}"><span class="flow__sw"></span><b>{n}</b><span class="flow__p">{p}%</span><small>{d}</small><i style="--w:{p}%"></i></li>' for n,p,c,d in FLOW_ROWS) + """
      </ul>
    </div>
  </section>
"""

INDEX = f'''<main id="main">
  <section class="hero wrap" aria-labelledby="hero-title">
    <h1 id="hero-title" data-split><span class="line">{STAMP.format(cls="stamp--draw")}You vote.</span><span class="line">An AI agent builds it, live.</span></h1>
    <p class="lead">Build.vote is an experiment in software directed by its holders. You pick what gets built next. The agent works in public, and its commits, API spend and creator fee claims show up on a dashboard anyone can verify.</p>
    <ul class="tags" aria-label="Project status">
      <li><b>Token:</b> {"live" if CA else "not launched"}</li>
      <li><b>Voting:</b> not live</li>
      <li><b>Fee split:</b> published before launch</li>
    </ul>
    <div class="ca" role="group" aria-label="Contract address">
      <span class="ca__label">CA</span>
      <code class="ca__value" id="ca-value">{CA or "Posted here at launch"}</code>
      <button type="button" class="ca__copy" data-copy="{CA}"{"" if CA else " disabled"}>Copy</button>
    </div>
    <div class="btn-row hero__cta">
      {BUY}
      <a class="btn btn--ghost" href="#ballot-title">Try the draft ballot</a>
      <a class="btn btn--ghost" href="live.html">Watch the live build</a>
    </div>
    <a class="scroll-cue" href="#ballot-title" aria-label="Scroll to the ballot"><span></span></a>
  </section>

  <div class="marquee" aria-hidden="true">
    <div class="marquee__track">{MARQUEE}{MARQUEE}</div>
  </div>

  <section class="section wrap ballot-section" aria-labelledby="ballot-title">
    <div class="ballot-intro">
      <h2 id="ballot-title" data-split>Mark the ballot</h2>
      <p>This is the kind of choice a round asks. Mark one option, connect a wallet if you want, and sign a preview message.</p>
      <p>Signing proves you control the wallet. It moves nothing, costs nothing and approves nothing.</p>
      <p class="muted small">These three options are a draft. The real round 1 ballot gets posted on X before voting opens.</p>
    </div>

    <form class="card ballot" id="ballot" data-tilt="3" aria-labelledby="ballot-name" aria-describedby="ballot-disclaimer" novalidate>
      <div class="ballot__head">
        <p class="ballot__title" id="ballot-name">Round 1 · draft ballot</p>
        <p class="ballot__hint">Mark one</p>
      </div>
      <fieldset class="ballot__options">
        <legend class="sr-only">What should the agent build first?</legend>
{opt("Wallet roast", "Paste a wallet, get a funny breakdown of its trading history.")}
{opt("Bundle detector", "Flag wallets funded from one source that bought together at launch.")}
{opt("Token graveyard", "Dead tokens with their peak market cap and cause of death.")}
      </fieldset>
      <div class="ballot__actions">
        <p id="wallet-status" class="wallet-status" aria-live="polite">No wallet connected.</p>
        <div class="btn-row">
          <button type="button" id="connect" class="btn btn--ghost">Connect wallet</button>
          <button type="button" id="sign" class="btn btn--primary" disabled>Sign vote preview</button>
        </div>
        <details class="msg">
          <summary>See the exact message you would sign</summary>
          <pre id="msg-preview"></pre>
        </details>
        <p id="sig-out" class="sig-out" role="status" aria-live="polite"></p>
      </div>
      <p id="ballot-disclaimer" class="ballot__foot">{STAMP.format(cls="stamp--static")}<span>Preview only. You sign a plain text message, never a transaction. Nothing is sent to a server and no vote is counted.</span></p>
    </form>
  </section>

  <section class="section wrap" aria-labelledby="builds-title">
    <div class="section__head">
      <h2 id="builds-title" data-split>What the agent can build</h2>
      <p>Crypto tools, small enough to ship in one round. This is the idea pool. Holders vote on which ones get built, and anyone can propose more.</p>
    </div>
    <ol class="builds">
{BUILD_ITEMS}
    </ol>
  </section>

  <section class="hs" aria-labelledby="round-title">
    <div class="hs__sticky">
      <div class="wrap hs__head">
        <h2 id="round-title" data-split>How a round works</h2>
        <p>Four steps, the same every time. Each one leaves a public record.</p>
        <div class="hs__bar" aria-hidden="true"><span></span></div>
      </div>
      <ol class="hs__track">
{PANELS}
      </ol>
    </div>
  </section>

{FLOW}
  <section class="section wrap" aria-labelledby="rules-title">
    <div class="section__head">
      <h2 id="rules-title" data-split>Rules we commit to</h2>
      <p>If we break one of these, call it out in public.</p>
    </div>
    <ul class="card rules">
{rule("Real data only", "The dashboard shows onchain records and real logs. If a number does not exist yet, we say so instead of guessing.")}
{rule("Public fee rules", "The creator fee split is published before launch. Every claim and every spend links to its record so you can check it.")}
{rule("Honest posting", "Posts describe what shipped and what did not. No price talk, no promises of returns.")}
{rule("Signatures only", "Voting asks you to sign a message. We will never ask for a transaction or a token approval to vote.")}
    </ul>
  </section>


  <section class="section wrap contrib" aria-labelledby="contrib-title">
    <div class="section__head">
      <h2 id="contrib-title" data-split>Get paid to contribute</h2>
      <p>A share of creator fees goes to people who make the agent's work better. Rewards are for accepted work only, and every payout links to its transaction.</p>
    </div>
    <div class="contrib__grid">
      <div class="card contrib__item" data-tilt="4"><h3>Issues</h3><p>Spot something missing or broken in a shipped tool. Accepted issues earn a reward.</p></div>
      <div class="card contrib__item" data-tilt="4"><h3>Bug reports</h3><p>Show how to reproduce a bug. Confirmed reports earn more than plain issues.</p></div>
      <div class="card contrib__item" data-tilt="4"><h3>Pull requests</h3><p>Fix it yourself. Merged pull requests earn the biggest share.</p></div>
    </div>
    <p class="muted small contrib__note">{GH_LINE} Reward sizes are set in the final fee rules, published before launch.</p>
  </section>
{FAQ}
  <section class="bigcta" aria-labelledby="follow-title">
    <div class="wrap">
      <p class="bigcta__type" aria-hidden="true"><span>You vote.</span><span>It gets built.</span></p>
      <div class="cta">
        <div>
          <h2 id="follow-title">Follow the build</h2>
          <p>Launch details, the fee split and the first ballot get posted on X first.</p>
        </div>
        <a class="btn btn--primary" href="https://x.com/BuildDotVote" target="_blank" rel="noopener noreferrer">Follow @BuildDotVote<span class="sr-only"> (opens in a new tab)</span></a>
      </div>
    </div>
  </section>
</main>'''

def tl(n, title, status, text, done, live=False):
    pill = '<span class="pill pill--live">In progress</span>' if live else '<span class="pill">Planned</span>'
    return f'''    <li class="tl{" tl--live" if live else ""}">
      <span class="tl__box" aria-hidden="true"></span>
      <article class="card" data-tilt="4">
        <div class="tl__top"><span class="tl__step">Step {n}</span>{pill}</div>
        <h2>{title}</h2>
        <p>{text}</p>
        <p class="tl__done"><b>Done when:</b> {done}</p>
      </article>
    </li>'''

ROADMAP = f'''<main id="main">
  <section class="page-head wrap">
    <h1 data-split>Roadmap</h1>
    <p class="lead">What happens, in order. There are no dates here, because none are fixed yet. Dates get added when they are real.</p>
  </section>
  <section class="wrap" aria-label="Roadmap steps">
    <ol class="timeline">
{tl(1, "Foundations", "", "This site, the draft whitepaper, draft fee rules and the agent's working setup: a public repo, a hard API budget and full logging.", "the site is live, the whitepaper is public and the agent can run end to end on a test task.", live=True)}
{tl(2, "Launch", "", "The token goes live. Final supply, distribution and the fee split are published before launch, not after.", "the token exists and the final parameters are posted and linked from this site.")}
{tl(3, "Voting backend", "", "Balance snapshots, signed message checks and a public tally that anyone can recompute from the raw signatures.", "a test round runs with real signatures and the tally can be reproduced by someone outside the team.")}
{tl(4, "Live dashboard", "", "One page for commits, API spend and creator fee claims, each linked to its source record.", "every number on the dashboard links to a commit, an invoice log or a transaction.")}
{tl(5, "Round 1", "", "The first real ballot. Holders vote, the agent builds the winner in public and ships it.", "the winning tool is live and its build log and costs are public.")}
{tl(6, "Ongoing rounds", "", "Regular rounds, with the rules adjusted in public as we learn what works.", "this never finishes by design. Each round gets its own write up.")}
    </ol>
    <p class="legend-note">{STAMP.format(cls="stamp--static")}<span>An empty box means planned. A step gets its X only when the work ships and you can check it.</span></p>
  </section>
</main>'''

TOKENOMICS = f'''<main id="main">
  <section class="page-head wrap">
    <h1 data-split>Tokenomics</h1>
    <p class="lead">How creator fees are meant to flow and how voting weight is meant to work. All of it is a draft.</p>
    <div class="draft-note" role="note">{STAMP.format(cls="stamp--static")}<p><strong>Draft.</strong> Every number and rule on this page can change. The final version is published before launch and linked here. The token has not launched, so there is no supply, price, market cap or holder count to show.</p></div>
  </section>

  <section class="wrap" aria-labelledby="fees-title">
    <div class="card fee-card" data-tilt="3">
      <div class="fee-card__top">
        <h2 id="fees-title">Draft creator fee split</h2>
        <span class="pill pill--draft">Draft</span>
      </div>
      <div class="feebar" role="img" aria-label="Draft split: API costs 40 percent, buybacks 30 percent, contributor rewards 20 percent, reserve 10 percent.">
        <span class="feebar__seg seg-api" style="flex:40">40%</span>
        <span class="feebar__seg seg-buy" style="flex:30">30%</span>
        <span class="feebar__seg seg-bounty" style="flex:20">20%</span>
        <span class="feebar__seg seg-reserve" style="flex:10">10%</span>
      </div>
      <dl class="fee-legend">
        <div><span class="swatch seg-api" aria-hidden="true"></span><dt>API costs <span>40%</span></dt><dd>Pays for the model calls and tools the agent uses. Spend is logged per round.</dd></div>
        <div><span class="swatch seg-buy" aria-hidden="true"></span><dt>Buybacks <span>30%</span></dt><dd>Market buys of the token, each linked to its transaction. Not a promise of any price effect.</dd></div>
        <div><span class="swatch seg-bounty" aria-hidden="true"></span><dt>Contributor rewards <span>20%</span></dt><dd>Paid for accepted issues, bug reports and merged pull requests.</dd></div>
        <div><span class="swatch seg-reserve" aria-hidden="true"></span><dt>Reserve <span>10%</span></dt><dd>Covers months when fees fall short of API costs. Balance shown on the dashboard.</dd></div>
      </dl>
    </div>
  </section>

  <section class="section wrap" aria-label="Token parameters">
    <div class="card table-card">
      <table class="params">
        <caption>Parameters</caption>
        <thead><tr><th scope="col">Parameter</th><th scope="col">Draft position</th></tr></thead>
        <tbody>
          <tr><th scope="row">Supply</th><td>Not set yet. Published before launch.<span class="pill pill--draft">Open</span></td></tr>
          <tr><th scope="row">Distribution</th><td>Not set yet. Any team or reserve allocation will be stated with its wallet address before launch.<span class="pill pill--draft">Open</span></td></tr>
          <tr><th scope="row">Voting weight</th><td>Draft: weight follows your balance at the round's snapshot. One wallet, one signed choice per round.<span class="pill pill--draft">Draft</span></td></tr>
          <tr><th scope="row">Whale cap</th><td>Draft: no wallet counts for more than 5% of a round's total vote weight, however much it holds.<span class="pill pill--draft">Draft</span></td></tr>
          <tr><th scope="row">Minimum to vote</th><td>To be decided. A small minimum may be set to limit spam wallets.<span class="pill pill--draft">Open</span></td></tr>
          <tr><th scope="row">Utility</th><td>Voting on what the agent builds next. Nothing else is promised.<span class="pill pill--draft">Draft</span></td></tr>
          <tr><th scope="row">Buybacks</th><td>Draft: 30% of creator fees, each buyback linked to its transaction on the dashboard. What happens to bought tokens is decided before launch.<span class="pill pill--draft">Draft</span></td></tr>
        </tbody>
      </table>
    </div>
  </section>
</main>'''

WP_SECTIONS = [
("abstract", "Abstract", '''<p>Build.vote lets token holders decide what an AI agent builds next. Each round, holders sign a message to pick one option from a short ballot. The agent builds the winner in a public repository. Its commits, its API spend and every creator fee claim that funds the work appear on a public dashboard.</p>
<p>The point is to test one question: can a community direct useful software in the open, with costs anyone can check?</p>'''),
("problem", "The problem", '''<p>Most token projects ask holders to trust a team's roadmap and a team's spending. Holders rarely choose what gets built and rarely see what it cost.</p>
<p>AI agents now make small software cheap to produce. But an agent working in private is just another black box. Build.vote tries to fix both sides: holders choose, and the work and the money stay visible.</p>'''),
("mechanism", "Mechanism", '''<p>A round runs in four steps.</p>
<ol>
<li><strong>Snapshot.</strong> When a round opens, holder balances are recorded at a fixed point. Balances after that point do not affect the round.</li>
<li><strong>Vote.</strong> Each holder signs a plain text message naming the round, their choice, their wallet, a random nonce and a timestamp. No transaction is involved.</li>
<li><strong>Tally.</strong> Signatures are checked against the snapshot. Draft rule: weight follows snapshot balance, capped so no wallet counts for more than 5% of the round's total weight. If a wallet signs more than once, its latest valid signature counts. The full list of signatures is published so anyone can recompute the result.</li>
<li><strong>Build and ship.</strong> The agent builds the winning option in public, then the result ships with a write up of what worked, what broke and what it cost.</li>
</ol>
<p>Ballot options are proposed in public before each round. The first ballot is not final; the options on the home page are a draft.</p>'''),
("fees", "Fees", '''<p>The work is funded by creator fees earned when the token trades. Draft split, to be finalized before launch:</p>
<table class="params">
<thead><tr><th scope="col">Use</th><th scope="col">Share</th></tr></thead>
<tbody>
<tr><th scope="row">API costs</th><td>40%</td></tr>
<tr><th scope="row">Buybacks</th><td>30%</td></tr>
<tr><th scope="row">Contributor rewards</th><td>20%</td></tr>
<tr><th scope="row">Reserve</th><td>10%</td></tr>
</tbody>
</table>
<p>The final split is published before launch. Any later change is announced in advance with the reason. Every fee claim and every spend links to its record on the dashboard. If fees do not cover API costs, the agent does less work; it does not borrow against the future.</p>'''),
("contributors", "Contributor rewards", '''<p>The agent is not the only one building. A share of creator fees (draft: 20%) pays people who improve its work.</p>
<ul>
<li><strong>Issues.</strong> Accepted issues that point out something missing or broken.</li>
<li><strong>Bug reports.</strong> Confirmed bugs with steps to reproduce.</li>
<li><strong>Pull requests.</strong> Merged fixes and features.</li>
</ul>
<p>Only accepted work is paid. Reward sizes are set in the final fee rules before launch, and each payout links to its transaction on the dashboard.</p>'''),
("agent", "The agent", '''<p>The agent is an AI coding agent with a hard API budget per round. It builds crypto tools on Solana, such as wallet analytics, launch checks and payment tools. It works in a public repository, so every commit is visible as it happens.</p>
<ul>
<li>It does not hold the keys to fee funds and cannot move them.</li>
<li>It builds only what won the vote. Scope changes are posted in public.</li>
<li>Its public posts describe progress and problems. They never discuss price.</li>
<li>A human reviews anything that touches user wallets or secrets before it ships.</li>
</ul>'''),
("safety", "Safety", '''<ul>
<li><strong>Signatures only.</strong> Voting never asks for a transaction, a token approval or a seed phrase. If anything claiming to be Build.vote asks for one, it is not us.</li>
<li><strong>Read what you sign.</strong> The vote message is plain text. Your wallet shows it before you sign. It should name the round and your choice and nothing else.</li>
<li><strong>Official links.</strong> Links are posted from <a href="https://x.com/BuildDotVote" target="_blank" rel="noopener noreferrer">@BuildDotVote</a>. Treat other accounts and direct messages as impersonators.</li>
<li><strong>Public data only.</strong> Tools that analyze wallets use public onchain data. Nothing here needs your private keys.</li>
</ul>'''),
("risks", "Risks", '''<ul>
<li>The token can lose most or all of its value, and it can happen fast.</li>
<li>Creator fees may be too small to pay for meaningful work.</li>
<li>The agent can build badly, slowly or not at all. Software it ships can have bugs.</li>
<li>The whale cap limits each wallet, not each person. Someone can split tokens across many wallets to get around it.</li>
<li>Third party platforms, wallets and APIs can fail, change terms or shut down.</li>
<li>Rules about tokens differ by country and can change. You are responsible for what applies to you.</li>
<li>The project is an experiment and may stop.</li>
</ul>'''),
("disclaimer", "Disclaimer", f'''<p>This is a draft for discussion, not an offer or solicitation. {RISK} Nothing in this document is a promise of future features, prices or returns. Read the final version published before launch, and do your own research.</p>'''),
]

toc = "\n".join(f'        <li><a href="#{i}">{t}</a></li>' for i, t, _ in WP_SECTIONS)
body = "\n".join(f'      <section id="{i}" aria-labelledby="{i}-h"><h2 id="{i}-h">{t}</h2>\n{c}\n      </section>' for i, t, c in WP_SECTIONS)

WHITEPAPER = f'''<main id="main">
  <section class="page-head wrap">
    <h1 data-split>Whitepaper</h1>
    <p class="lead">How Build.vote is meant to work, what it costs and what can go wrong.</p>
    <div class="meta"><span class="pill pill--draft">Version 0.1 · draft</span><span class="pill">Subject to change before launch</span></div>
  </section>
  <div class="wrap wp">
    <nav class="toc" aria-label="Whitepaper sections">
      <p>Contents</p>
      <ol>
{toc}
      </ol>
    </nav>
    <article class="card prose">
{body}
    </article>
  </div>
</main>'''


def readout(key, label, note):
    return f'<div class="readout" data-key="{key}"><dt>{label}</dt><dd class="readout__v">—</dd><dd class="readout__n">{note}</dd></div>'

LIVE = f"""<main id="main" data-live-json="{LIVE_JSON}" data-github="{GITHUB_URL}">
  <section class="page-head wrap">
    <h1 data-split>Live build</h1>
    <p class="lead">Watch the agent work in real time: every file it reads, every edit, every command, what each session cost and where the fees went. Nothing here is typed by hand.</p>

  </section>

  <section class="wrap console-wrap" aria-labelledby="console-title">
    <div class="card console" data-state="standby">
      <div class="console__bar">
        <span class="console__dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h2 id="console-title" class="console__title">agent@build.vote</h2>
        <span class="console__meta"><span data-c="session">no session</span><span data-c="clock"></span><span data-c="turns"></span></span>
        <button type="button" class="console__demo" data-demo-btn>Watch a demo</button>
      </div>
      <div class="console__task" role="status" aria-live="polite">
        <span class="dot" aria-hidden="true"></span>
        <b data-c="state">Standby</b>
        <span data-c="task">Starts at launch. Creator fees fund the first session.</span>
        <span class="console__next" data-c="next"></span>
      </div>
      <p class="console__badge" data-c="badge" hidden>Demo: simulated session, not real agent activity</p>
      <ol class="console__feed" id="feed"></ol>
      <p class="console__empty" data-c="empty">The agent wakes up when creator fees arrive after launch. From then on, every file it reads, every edit and every command appears here as it happens. Press "Watch a demo" to see what that looks like.<span class="console__cursor" aria-hidden="true"></span></p>
    </div>
    <aside class="card spend" aria-labelledby="spend-title">
      <div class="panel__head"><h2 id="spend-title">Spend per session</h2><span class="pill" data-c="spendtotal">—</span></div>
      <div class="spend__bars" id="spendbars" role="img" aria-label="No sessions yet"></div>
      <p class="empty" data-c="spendempty">Each bar will be one real session, linked to its log.</p>
      <dl class="spend__stats">
        <div><dt>Sessions</dt><dd data-c="nsess">0</dd></div>
        <div><dt>Avg per session</dt><dd data-c="avg">—</dd></div>
        <div><dt>Daily cap</dt><dd data-c="cap">—</dd></div>
      </dl>
    </aside>
  </section>

  <section class="wrap" aria-labelledby="readouts-title">
    <h2 id="readouts-title" class="sr-only">Readouts</h2>
    <dl class="readouts">
      {readout("spend", "API spend", "Not live yet")}
      {readout("fees", "Creator fees claimed", "Not live yet")}
      {readout("commits", "Agent commits", "Agent repo not public yet")}
      {readout("holders", "Holders", "Token not launched")}
      {readout("round", "Current round", "Round 1 opens after launch")}
      {readout("payouts", "Contributor payouts", "Not live yet")}
    </dl>
  </section>

  <section class="section wrap live-grid" aria-label="Build panels">
    <article class="card panel">
      <header class="panel__head"><h2>Build queue</h2><span class="pill" data-count="queue">Empty</span></header>
      <ol class="feed" id="queue"></ol>
      <p class="empty" data-empty="queue">Nothing queued. The winner of round 1 lands here first. See the <a href="index.html#builds-title">idea pool</a>.</p>
      <p class="panel__foot" data-foot="queue" hidden>Proposed ideas are candidates for round 1. Holders pick which one gets built.</p>
    </article>
    <article class="card panel">
      <header class="panel__head"><h2>Agent commits</h2><span class="pill" data-count="commits">Waiting for work</span></header>
      <ol class="feed" id="commits"></ol>
      <p class="empty" data-empty="commits">No commits yet. Each commit will show its message, time and a link to the diff.</p>
    </article>
    <article class="card panel panel--wide">
      <header class="panel__head"><h2>Session ledger</h2><span class="pill" data-count="sessions">No sessions</span></header>
      <div class="ledger-wrap">
        <table class="ledger">
          <thead><tr><th scope="col">Date</th><th scope="col">Task</th><th scope="col">Model calls</th><th scope="col">Cost</th><th scope="col">Proof</th></tr></thead>
          <tbody id="sessions"><tr><td colspan="5" class="empty">No sessions logged yet. Each agent session gets a row with its cost and a link to the log.</td></tr></tbody>
        </table>
      </div>
    </article>
    <article class="card panel panel--wide">
      <header class="panel__head"><h2>Fee claims and spends</h2><span class="pill" data-count="ledger">No records</span></header>
      <div class="ledger-wrap">
        <table class="ledger">
          <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Amount</th><th scope="col">Went to</th><th scope="col">Transaction</th></tr></thead>
          <tbody id="ledger"><tr><td colspan="5" class="empty">No claims yet. Every claim, buyback and payout will link to its transaction on Solana.</td></tr></tbody>
        </table>
      </div>
    </article>
  </section>
</main>"""

DESC_HOME = "Token holders vote on what an AI agent builds next. The agent works in public, with commits, API spend and fee claims on a public dashboard."
files = {
 "index.html": (head("Build.vote · You vote. An AI agent builds it, live.", DESC_HOME), INDEX),
 "live.html": (head("Live build · Build.vote", "Watch the agent work: build queue, commits, API spend and fee claims, each linked to its source."), LIVE),
 "roadmap.html": (head("Roadmap · Build.vote", "What Build.vote does next, in order, with no invented dates."), ROADMAP),
 "tokenomics.html": (head("Tokenomics · Build.vote", "Draft creator fee split and token parameters for Build.vote, finalized before launch."), TOKENOMICS),
 "whitepaper.html": (head("Whitepaper v0.1 · Build.vote", "Build.vote whitepaper, version 0.1 draft: mechanism, fees, the agent, safety and risks."), WHITEPAPER),
}
for name, (h, m) in files.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as f:
        html = h + "\n" + nav(name) + "\n" + m + "\n" + footer(name)
        html = html.replace("@BuildDotVote", "@" + HANDLE).replace("BuildDotVote", HANDLE).replace("Build.vote", NAME)
        f.write(html)
print("ok")
