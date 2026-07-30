# ⚡ Foundry

Foundry is a web platform that works like an autonomous software development company. Connect a GitHub repository and three specialized Claude-powered agents continuously improve it, 24/7:

| Agent | Role | Never does |
|---|---|---|
| **Ideator** | Product manager + architect: analyzes the repo, proposes and ranks improvements | Write code |
| **Coder** | Senior full-stack engineer: implements exactly the selected task in an isolated branch | Invent tasks |
| **Tester** | QA + security + performance engineer: runs every check, files bug reports, gates deployment | Edit code |

The loop: **Ideate → Code → Test → (fix ⇄ retest) → safety check → push → PR/merge → deploy → verify → repeat forever.** Only the Tester can approve shipping. Failed health checks trigger automatic `git revert` rollback plus a GitHub issue.

## Architecture

```
Next.js dashboard  ──►  PostgreSQL  ◄──  Worker process (npm run worker)
                                              │
                              Orchestrator: phase state machine per cycle
                              IDEATING → CODING → TESTING ⇄ FIXING → SAFETY_CHECK
                              → PUSHING → [AWAITING_APPROVAL] → MERGING
                              → DEPLOYING → VERIFYING → COMPLETED / ROLLED_BACK
```

- Every phase transition is persisted (`CycleRun.phase`), so the system is crash-resumable and pausable.
- One active improvement per repository at a time (prevents conflicting changes); multiple repositories advance in parallel.
- Agents converse through structured `AgentMessage` records — visible live in the dashboard.
- Per-repository memory (`MemoryEntry`) stores past bugs, failed ideas, and successes so the Ideator never repeats mistakes.

### Safety (enforced in code)

- Coder/Tester tools are sandboxed to the cloned workspace: path traversal rejected, `git push`/`sudo`/destructive commands blocked, agent subprocesses run with a scrubbed environment (no API keys).
- Every diff is scanned for secrets before pushing; findings block the cycle.
- GitHub tokens are encrypted at rest (AES-256-GCM).
- Deployment requires Tester approval; failed production health checks auto-rollback and open an issue.

## Setup

### 1. Prerequisites

- Node.js 20+, Docker Desktop, an [Anthropic API key](https://platform.claude.com/), and a GitHub account.

### 2. Install & configure

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

- `ANTHROPIC_API_KEY` — your Anthropic key.
- `AUTH_SECRET` — `openssl rand -base64 32`
- `APP_ENCRYPTION_KEY` — `openssl rand -hex 32`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — create a GitHub OAuth app at <https://github.com/settings/developers> with callback URL `http://localhost:3000/api/auth/callback/github`.

### 3. Database

```bash
docker compose up -d
npx prisma migrate dev --name init
```

### 4. Run

```bash
npm run dev      # dashboard on http://localhost:3000
npm run worker   # in a second terminal — the autonomous engine
```

Sign in with GitHub, click **Connect repository**, paste a fine-grained GitHub token with `Contents: read/write` and `Pull requests: read/write` for that repo, and press **Start autonomous mode**.

## Per-repository configuration

| Setting | Options | Notes |
|---|---|---|
| Schedule | continuous / nightly / manual | Continuous has a 5-minute cooldown between cycles |
| Merge mode | pull requests / direct merge | PRs are the safe default |
| Auto-merge PRs | on / off | Off = the AI opens PRs and you merge them on GitHub |
| Human approval | on / off | On = each cycle parks at *Awaiting approval* until you approve/reject in the dashboard |
| Deploy hook | URL | Vercel/Railway/Render-style POST webhook, triggered after merge |
| Health check | URL | Polled after deploy; failure ⇒ automatic revert + GitHub issue |

## Development

```bash
npm test            # unit tests (scoring, secret scanning, tool sandbox)
npm run typecheck
npm run db:studio   # inspect the database
```

## Notes

- Agent model defaults to `claude-opus-4-8` (`ANTHROPIC_MODEL` to override).
- Cloned repos live in `WORKSPACES_DIR` (default `./workspaces`), one directory per repository.
- The worker is safe to restart at any time — runs resume from their last persisted phase.
